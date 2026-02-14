# Data Model: Email/Password Authentication

**Feature Branch**: `010-email-password-auth`
**Date**: 2026-02-13

## Schema Changes

### Modified: `auth_provider` Enum

Add `'email'` to the existing enum.

```
Current: 'github' | 'google' | 'saml' | 'api_token'
Updated: 'github' | 'google' | 'saml' | 'api_token' | 'email'
```

**File**: `backend/src/db/schema/enums.ts`

### Modified: `users` Table

Add three columns, modify one constraint:

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `external_id` | text | **Yes** (change from NOT NULL) | — | Nullable for email/password users who have no OAuth external ID |
| `password_hash` | text | Yes | `null` | Argon2id hash. Null for OAuth-only users. Never returned in API responses. |
| `email_verified` | boolean | No | `false` | True for OAuth users (verified by provider). Must be true for email users to log in. |

**File**: `backend/src/db/schema/users.ts`

**Migration notes**:
- Existing OAuth users: set `email_verified = true` (they verified via OAuth provider)
- Existing OAuth users: `password_hash` remains `null` (no password)
- Existing OAuth users: `external_id` values unchanged (all non-null)

### New: `auth_tokens` Table

Unified table for verification and password reset tokens.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | No | `defaultRandom()` | Primary key |
| `user_id` | uuid | No | — | FK → users.id, CASCADE on delete |
| `token` | text | No | — | Cryptographically secure, base64url-encoded (32 bytes). Unique. |
| `type` | auth_token_type enum | No | — | `'verification'` or `'password_reset'` |
| `expires_at` | timestamp (tz) | No | — | 24h for verification, 1h for password reset |
| `used_at` | timestamp (tz) | Yes | `null` | Set when token is consumed. Prevents reuse. |
| `created_at` | timestamp (tz) | No | `defaultNow()` | Creation timestamp |

**Indexes**:
- `auth_tokens_token_idx` on `token` (unique, for O(1) lookup)
- `auth_tokens_user_id_idx` on `user_id` (for finding user's tokens)
- `auth_tokens_expires_at_idx` on `expires_at` (for cleanup queries)

**New Enum**: `auth_token_type` — `'verification'` | `'password_reset'`

**File**: `backend/src/db/schema/auth-tokens.ts`

## Entity Relationships

```
users (1) ←——→ (N) auth_tokens    [user_id FK, CASCADE delete]
users (1) ←——→ (N) sessions       [existing, unchanged]
users (1) ←——→ (N) login_attempts [existing, unchanged]
```

## Validation Rules

### User Registration (FR-001, FR-002)
- `email`: Valid email format (Zod `.email()`), unique across all providers
- `password`: Minimum 8 characters, at least 3 of 4 types (uppercase, lowercase, number, special)
- `displayName`: Non-empty string, trimmed, max 100 characters

### Token Lifecycle
- **Verification tokens**: 24-hour expiry (FR-003). New token invalidates previous (set `used_at`). Purged with account after 7 days if unused.
- **Password reset tokens**: 1-hour expiry (FR-007). Single-use (`used_at` set on consumption). New request invalidates previous tokens for same user.

### Provider Constraint (FR-024)
- Each email address maps to exactly one auth provider
- Enforced at application level (not DB constraint) — the `email` column already has a unique constraint, and `findOrCreateUser()` checks provider match before creating

## State Transitions

### Account Verification State

```
                  signup
[No Account] ────────────→ [Unverified]
                                │
                   verify-email │  (within 24h)
                                ↓
                            [Active]
                                │
                    7-day expiry │  (if still unverified)
[No Account] ←──────────── [Purged]
```

### Account Lockout (existing, unchanged)

```
[Active] ──5 failed logins──→ [Locked] ──15min / admin unlock──→ [Active]
```

## Shared Type Updates

### `shared/constants/states.ts`
Add `EMAIL: 'email'` to `AuthProvider` constant.

### `shared/types/auth.ts`
- Extend `OAuthProvider` type or create a broader `AuthProvider` type that includes `'email'`
- Add `emailVerified` to user-facing types where appropriate
- Session and LoginAttempt types already use `string` for `provider` — no change needed
