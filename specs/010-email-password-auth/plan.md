# Implementation Plan: Email/Password Authentication

**Branch**: `010-email-password-auth` | **Date**: 2026-02-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-email-password-auth/spec.md`

## Summary

Add email/password authentication as an additional method alongside existing OAuth (GitHub/Google). Users can sign up with email, verify via email link, log in with credentials, and reset forgotten passwords. The implementation extends the existing auth infrastructure — reusing session management, lockout, roles, and audit logging — while adding password hashing (argon2), a transactional email service (nodemailer/console), and new frontend auth pages built with Radix UI.

## Technical Context

**Language/Version**: TypeScript 5.9+, Node.js 20 LTS
**Primary Dependencies**: Hono 4.8.2 (backend), React 19 + Radix UI (frontend), Drizzle ORM 0.44 (PostgreSQL), arctic 3.5.0 (existing OAuth), argon2 (new — password hashing), nodemailer (new — email delivery), Zod 3.24.2 (validation)
**Storage**: PostgreSQL (existing Drizzle schema — modified `users` table + new `auth_tokens` table)
**Testing**: Vitest (unit + integration), Playwright (e2e)
**Target Platform**: Web application (Node.js server + React SPA)
**Project Type**: Web (pnpm monorepo: backend/ + frontend/ + shared/)
**Performance Goals**: Login < 500ms (argon2 ~100ms + DB + session), email delivery < 5s
**Constraints**: Must not break existing OAuth flows. No external services required in development (console email fallback).
**Scale/Scope**: ~15 new/modified backend files, ~10 new/modified frontend files, 7 new API endpoints, 5 new frontend routes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.1):

- [x] **Explicit Change Control (I)**: All auth state changes (signup, verify, login, reset, change password) are explicit user actions tied to an authenticated actor or identified token. No silent/automatic mutations.
- [x] **Single Source of Truth (II)**: Feature does not touch published content. Auth state lives in users + sessions tables with clear ownership.
- [x] **Branch-First Collaboration (III)**: Not directly applicable — this feature manages user identity, not content branches. Existing branch workflows unaffected.
- [x] **Separation of Concerns (IV)**: Auth endpoints are clearly separated from content endpoints. Signup/login/reset are anonymous actions; contribution requires authentication. Login page clearly separates "sign in" from platform functionality.
- [x] **Role-Driven Governance (V)**: New email users assigned 'contributor' role. Existing role system (viewer/contributor/reviewer/administrator) unchanged. All auth events audited with actor attribution.
- [x] **Open by Default (VI)**: Signup and login are publicly accessible. Published content remains publicly readable. Auth only gates write actions.
- [x] **Layered Architecture (VII)**: Core workflows (branching, review, publish) are completely unchanged. New auth methods produce identical sessions. Email service is a new module with no impact on existing services.
- [x] **Specification Completeness (VIII)**: Spec includes actors/permissions, lifecycle states, visibility boundaries, audit events, and measurable success criteria. 24 functional requirements, 7 user stories, 8 edge cases.
- [x] **Clarity Over Breadth (IX)**: No unnecessary complexity. Reuses existing session, lockout, role, and audit systems. Email service is the only new infrastructure. Account linking and 2FA explicitly deferred.
- [x] **Testing as Contract (X)**: Test strategy covers unit tests (password hashing, token generation, validation), integration tests (API endpoints with DB), and e2e tests (signup-verify-login flow). 80% coverage target for core auth workflows.

## Project Structure

### Documentation (this feature)

```text
specs/010-email-password-auth/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Technology decisions and rationale
├── data-model.md        # Schema changes and entity design
├── quickstart.md        # Developer getting-started guide
├── contracts/
│   └── auth-api.md      # API endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Task breakdown (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/schema/
│   │   ├── enums.ts                    # MODIFY: add 'email' to authProviderEnum, add authTokenTypeEnum
│   │   ├── users.ts                    # MODIFY: add passwordHash, emailVerified; make externalId nullable
│   │   ├── auth-tokens.ts             # NEW: verification + password reset tokens table
│   │   └── index.ts                    # MODIFY: export auth-tokens
│   ├── services/
│   │   ├── auth/
│   │   │   ├── password.ts            # NEW: argon2 hash/verify, password validation
│   │   │   ├── token.ts              # NEW: token generation, validation, cleanup
│   │   │   └── session.ts            # EXISTING: no changes (cleanup runs in api/routes/auth.ts)
│   │   └── email/
│   │       ├── index.ts              # NEW: EmailService interface + factory
│   │       ├── smtp-transport.ts     # NEW: nodemailer SMTP implementation
│   │       ├── console-transport.ts  # NEW: dev console logging implementation
│   │       └── templates.ts          # NEW: email templates (verification, reset)
│   ├── api/
│   │   ├── routes/
│   │   │   └── auth.ts               # MODIFY: add register, login, verify, reset endpoints; update findOrCreateUser
│   │   └── middleware/
│   │       └── auth-rate-limit.ts    # NEW: generic rate limiter for auth endpoints
│   └── index.ts                       # No change (routes auto-registered)
├── drizzle/                           # AUTO: migration files generated by drizzle-kit
└── tests/
    ├── unit/
    │   ├── password.test.ts          # NEW: hashing, validation, strength checking
    │   ├── token.test.ts             # NEW: generation, expiry, single-use
    │   ├── rate-limiter.test.ts      # NEW: window, limits, cleanup
    │   └── email-service.test.ts     # NEW: console transport, template rendering
    └── integration/
        ├── auth-register.test.ts     # NEW: signup flow end-to-end
        ├── auth-login.test.ts        # NEW: email login + lockout integration
        ├── auth-verify.test.ts       # NEW: verification + resend
        ├── auth-reset.test.ts        # NEW: forgot + reset password flow
        ├── auth-change-password.test.ts # NEW: change password while logged in
        └── auth-provider-conflict.test.ts # NEW: FR-024 single-provider enforcement

frontend/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx             # NEW: unified login (OAuth + email form)
│   │   ├── SignupPage.tsx            # NEW: registration form
│   │   ├── VerifyEmailPage.tsx       # NEW: verification token handler
│   │   ├── ForgotPasswordPage.tsx    # NEW: request password reset
│   │   ├── ResetPasswordPage.tsx     # NEW: set new password
│   │   └── AccountSettings.tsx      # NEW: account settings (password change for email users)
│   ├── components/
│   │   ├── auth/
│   │   │   ├── PasswordStrength.tsx  # NEW: strength indicator + criteria checklist
│   │   │   ├── EmailLoginForm.tsx    # NEW: email + password form component
│   │   │   └── LoginButton.tsx       # No change (reused on login page)
│   │   └── layout/
│   │       └── AppHeader.tsx         # MODIFY: replace OAuth buttons with "Sign In" link
│   ├── context/
│   │   └── AuthContext.tsx           # MODIFY: add loginWithEmail, register methods
│   └── router/
│       └── index.tsx                 # MODIFY: add /login, /signup, /verify-email, /forgot-password, /reset-password
└── tests/
    ├── components/
    │   ├── PasswordStrength.test.tsx  # NEW: criteria display, strength levels
    │   └── EmailLoginForm.test.tsx    # NEW: validation, submission, error states
    └── e2e/
        └── auth-flow.spec.ts         # NEW: full signup → verify → login → reset e2e

shared/
├── constants/
│   └── states.ts                     # MODIFY: add EMAIL to AuthProvider
└── types/
    └── auth.ts                       # MODIFY: extend provider types
```

**Structure Decision**: Existing web application (monorepo) structure. New backend services follow established patterns: `services/auth/` for auth logic, `services/email/` for email delivery. Frontend pages follow existing page pattern with lazy loading. No new packages/workspaces needed.

## Complexity Tracking

No constitution violations. All complexity is justified by the feature requirements:

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| argon2 dependency | Password hashing (FR-014) | No simpler alternative — bcrypt is equally complex but less secure |
| nodemailer dependency | Email delivery (FR-017) | Custom SMTP client would be more complex and less reliable |
| auth_tokens table | Token storage (FR-003, FR-007) | Stateless JWTs cannot be single-use or invalidated |
| Rate limiter utility | Auth rate limiting (FR-011-013) | Existing rate-limit.ts is login-specific, not generic |
