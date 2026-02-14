# Research: Email/Password Authentication

**Feature Branch**: `010-email-password-auth`
**Date**: 2026-02-13

## R-001: Password Hashing Library

**Decision**: Use `argon2` npm package with argon2id variant

**Rationale**: Argon2id is the current OWASP recommendation for password hashing (2024+). It is memory-hard, making GPU/ASIC attacks impractical. The `argon2` npm package uses native bindings for performance — hashing completes in ~100ms at default settings which is acceptable for auth endpoints.

**Alternatives considered**:
- **bcrypt**: Mature and widely used but CPU-bound only (no memory-hardness). Vulnerable to GPU parallelism at scale. Cost factor 12 gives ~250ms but less security margin than argon2id.
- **scrypt**: Memory-hard but less configurable and less adopted than argon2. No OWASP primary recommendation.
- **@node-rs/argon2**: Alternative argon2 binding via Rust/napi-rs. Faster compilation but less adoption. Unnecessary since the C-based `argon2` package is well-maintained.

**Configuration**: Default argon2id parameters (memory: 65536 KB, iterations: 3, parallelism: 4). No need to tune — defaults are OWASP-compliant.

## R-002: Email Delivery Service

**Decision**: Use `nodemailer` with SMTP transport (configurable), console transport for development

**Rationale**: Nodemailer is the most established Node.js email library (17+ years, 3M+ weekly downloads). It supports any SMTP provider (SendGrid, SES, Mailgun, Resend, self-hosted). This avoids vendor lock-in — the admin can configure any SMTP-compatible service via environment variables. For development, a custom console transport logs the full email including action URLs.

**Alternatives considered**:
- **resend** (SDK): Modern, good DX, but vendor-locked. Requires a Resend account. SMTP mode available but then just use nodemailer directly.
- **@sendgrid/mail**: Vendor-locked to SendGrid. SMTP mode available.
- **Custom fetch-based mailer**: Lightweight but would need to reimplement SMTP or REST transport, error handling, retry logic. Nodemailer handles this already.

**Configuration**: Environment variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. When `NODE_ENV=development` or SMTP is unconfigured, falls back to console logging.

## R-003: Rate Limiting Strategy

**Decision**: Extend existing in-memory rate limiting pattern with a generic `RateLimiter` utility class

**Rationale**: The codebase already has two rate limiting implementations: `backend/src/api/middleware/rate-limit.ts` (login attempts) and `backend/src/services/ai/rate-limiter.ts` (AI requests). Both use database-backed counting. For auth rate limiting (signup, resend, reset), an in-memory sliding window approach is simpler and sufficient — auth rate limits don't need to survive server restarts. The existing `login_attempts` table continues to handle login lockout as-is.

**Alternatives considered**:
- **Database-backed rate limiting**: Persistent across restarts but adds DB queries on every auth request. Overkill for signup/resend/reset limits.
- **Redis**: Would be ideal at scale but the project doesn't use Redis. Adding it for rate limiting alone is over-engineering.
- **express-rate-limit / hono-rate-limiter**: External packages add dependencies for functionality that's ~50 lines of code. The project already has custom rate limiting.

**Design**: A `RateLimiter` class with configurable window (ms) and max attempts. Keyed by IP or email. Automatic cleanup of expired entries via setInterval (same pattern as OAuth state cleanup in `auth.ts`).

## R-004: Schema Migration — users.externalId Constraint

**Decision**: Make `users.externalId` nullable (currently `notNull`) for email/password users

**Rationale**: The `externalId` field stores the OAuth provider's user ID (e.g., GitHub user ID). Email/password users have no external ID — they are identified by email + password hash. Making it nullable is the minimal schema change. Existing OAuth users all have `externalId` populated so no data migration needed — only the constraint changes.

**Alternatives considered**:
- **Use email as externalId**: Leaks implementation detail. Email is already stored in its own column.
- **Generate a synthetic externalId**: Adds complexity for no benefit. The field is only used for OAuth provider lookups (`WHERE externalId = ? AND provider = ?`).
- **Separate credentials table**: More normalized but adds JOIN complexity. The user table already has provider-specific fields (`externalId`, `provider`). Adding `passwordHash` and `emailVerified` keeps the pattern consistent.

## R-005: Token Generation and Storage

**Decision**: Unified `auth_tokens` table for both verification and password reset tokens, using `crypto.randomBytes(32).toString('base64url')` for token generation

**Rationale**: Verification and reset tokens share identical structure (userId, token, type, expiresAt, usedAt). A single table with a `type` discriminator avoids duplicate schemas. The existing session service uses the same `randomBytes(32).toString('base64url')` pattern for session tokens — consistent approach. Tokens are indexed by token value for O(1) lookups.

**Alternatives considered**:
- **Separate tables**: Clearer semantics but duplicate schema, migration, and service code.
- **JWT-based tokens**: Stateless but cannot be invalidated (single-use requirement in FR-007). Database-backed tokens allow marking as used.
- **UUID-based tokens**: Less entropy than 32 random bytes. UUIDs are 122 bits of randomness vs 256 bits for base64url(randomBytes(32)).

## R-006: OAuth findOrCreateUser Change (FR-024)

**Decision**: Modify `findOrCreateUser()` in `auth.ts` to reject email conflicts across providers instead of auto-linking

**Rationale**: The current implementation (line 214-231 in `auth.ts`) auto-links providers when the same email exists with a different provider. Per FR-024 (single-provider-per-email), this must be changed to return an error instead. The OAuth callback handler already handles error states and redirects — extending it to include a provider conflict error is straightforward.

**Impact**: This is a **breaking change** to existing behavior. Users who previously had auto-linked accounts will not be affected (their records already exist), but new users cannot link a second provider to the same email. This aligns with the spec's "account linking is out of scope" decision.

## R-007: Unverified Account Cleanup Scheduling

**Decision**: Add cleanup function called via `setInterval` in the auth routes module (same pattern as OAuth state cleanup)

**Rationale**: The codebase has no centralized job scheduler. The existing OAuth state cleanup uses `setInterval` in `auth.ts` (line 31-39). The session cleanup function `cleanupExpiredSessions()` exists but is never automatically scheduled. Following the established pattern, we add a `setInterval` that calls `cleanupUnverifiedAccounts()` every hour. This also schedules the existing `cleanupExpiredSessions()` which was previously unscheduled.

**Alternatives considered**:
- **External cron**: Requires additional infrastructure. Not justified for a periodic DELETE query.
- **pg_cron**: PostgreSQL extension. Not all deployments will have it. Adds operational complexity.
- **On-demand cleanup**: Check and delete on every signup. Adds latency to the signup flow.

## R-008: Frontend Password Strength Indicator

**Decision**: Custom component that evaluates the 3-of-4-types rule from FR-002, no external library

**Rationale**: The password policy is simple (8+ chars, 3 of 4 types). A dedicated library like `zxcvbn-ts` (800KB gzipped) is massive overkill for this check. A simple function checking length + regex matches for each character type provides instant feedback and matches the exact policy enforced server-side.

**Alternatives considered**:
- **zxcvbn-ts**: Comprehensive entropy-based scoring but 800KB+ bundle. The spec's policy is rule-based, not entropy-based.
- **check-password-strength**: Lighter but still adds a dependency for ~20 lines of custom logic.

**Design**: A `PasswordStrength` component showing a segmented bar (weak/fair/strong) and checklist of met/unmet criteria. Criteria: length >= 8, has uppercase, has lowercase, has number, has special char. "Strong" when >= 3 of 4 types + length met.
