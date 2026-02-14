# Tasks: Email/Password Authentication

**Feature**: `specs/010-email-password-auth/`
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `echo-portal-b2pz` |
| **Spec Label** | `spec:010-email-password-auth` |
| **User Stories Source** | `specs/010-email-password-auth/spec.md` |
| **Planning Details** | `specs/010-email-password-auth/plan.md` |
| **Data Model** | `specs/010-email-password-auth/data-model.md` |

> **NOTE**: Beads tracking is ACTIVE. Issue IDs populated below.

### Task ID → Beads ID Mapping

| Task | Beads ID | Phase |
|------|----------|-------|
| T001 | `echo-portal-2y1r` | Phase 1 |
| T002 | `echo-portal-okhz` | Phase 1 |
| T003 | `echo-portal-8iv5` | Phase 1 |
| T004 | `echo-portal-5z7n` | Phase 1 |
| T005 | `echo-portal-ky70` | Phase 2 |
| T006 | `echo-portal-ncd7` | Phase 2 |
| T007 | `echo-portal-7gdb` | Phase 2 |
| T008 | `echo-portal-x8mc` | Phase 2 |
| T009 | `echo-portal-7az7` | Phase 2 |
| T010 | `echo-portal-x8ch` | Phase 2 |
| T011 | `echo-portal-fldx` | Phase 2 |
| T012 | `echo-portal-no4t` | Phase 2 |
| T013 | `echo-portal-9mf9` | Phase 2 |
| T014 | `echo-portal-cfzy` | Phase 2 |
| T015 | `echo-portal-h0o3` | Phase 3 |
| T016 | `echo-portal-puwr` | Phase 3 |
| T017 | `echo-portal-stqw` | Phase 3 |
| T018 | `echo-portal-ztlr` | Phase 3 |
| T019 | `echo-portal-z6v3` | Phase 3 |
| T020 | `echo-portal-njv9` | Phase 3 |
| T021 | `echo-portal-aggd` | Phase 3 |
| T022 | `echo-portal-c7td` | Phase 3 |
| T023 | `echo-portal-1y8p` | Phase 3 |
| T024 | `echo-portal-o3st` | Phase 3 |
| T025 | `echo-portal-xhbx` | Phase 3 |
| T026 | `echo-portal-97wc` | Phase 3 |
| T027 | `echo-portal-n5yc` | Phase 3 |
| T028 | `echo-portal-zzay` | Phase 3 |
| T029 | `echo-portal-8az0` | Phase 3 |
| T030 | `echo-portal-in63` | Phase 4 |
| T031 | `echo-portal-jse6` | Phase 4 |
| T032 | `echo-portal-9wz6` | Phase 4 |
| T033 | `echo-portal-12a2` | Phase 4 |
| T034 | `echo-portal-re9o` | Phase 4 |
| T035 | `echo-portal-prmy` | Phase 4 |
| T036 | `echo-portal-891d` | Phase 5 |
| T037 | `echo-portal-st37` | Phase 5 |
| T038 | `echo-portal-llu1` | Phase 5 |
| T039 | `echo-portal-o1j6` | Phase 5 |
| T040 | `echo-portal-a4jt` | Phase 5 |
| T041 | `echo-portal-5fp5` | Phase 6 |
| T042 | `echo-portal-agy5` | Phase 6 |
| T043 | `echo-portal-qcwy` | Phase 6 |
| T044 | `echo-portal-pijr` | Phase 6 |
| T045 | `echo-portal-wyww` | Phase 6 |

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | Email/Password Authentication |
| **User Stories** | 7 from spec.md (3x P1, 2x P2, 2x P3) |
| **Priority** | P1 (MVP) → P2 → P3 |
| **Est. Tasks** | 45 |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.1:
- ✅ **Testing as Contract (X)**: Tests in Phase 6 after implementation
- ✅ **Explicit Change Control (I)**: All changes attributable and intentional
- ✅ **Specification Completeness (VIII)**: All mandatory sections verified in spec.md
- ✅ **Clarity Over Breadth (IX)**: Complexity justified in plan.md

---

## Status Reference

| Icon | Status | Description |
|------|--------|-------------|
| ⬜ | Pending | Not started |
| 🔄 | In Progress | Work underway |
| ✅ | Completed | Done and verified |
| ⚠️ | Blocked | Waiting on dependency |
| 🎯 | MVP | Core deliverable |

---

## Task Format

```
- [ ] T001 [P] [US1] Description `path/to/file.ext`
```

| Element | Meaning |
|---------|---------|
| `T001` | Task ID (sequential) |
| `[P]` | Parallelizable (different files, no blocking deps) |
| `[US1]` | User Story reference |
| `` `path` `` | Exact file path(s) affected |

---

## Phase 1: Setup — ✅ Completed

**Beads Phase ID**: `echo-portal-lv90`
**Purpose**: Install dependencies, create new file stubs, update env config
**Blocks**: All subsequent phases
**Parallelism**: All tasks can run in parallel

- [x] T001 [P] Install argon2 and nodemailer with types in backend `backend/package.json`
- [x] T002 [P] Create auth token type enum (`authTokenTypeEnum`) in `backend/src/db/schema/enums.ts`
- [x] T003 [P] Create `auth_tokens` table schema in `backend/src/db/schema/auth-tokens.ts`
- [x] T004 [P] Update `.env.example` with SMTP configuration variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) in `backend/.env.example`

**✓ Checkpoint**: New dependencies installed, schema files created, env template updated

---

## Phase 2: Foundational — ✅ Completed

**Beads Phase ID**: `echo-portal-ywie`
**Purpose**: Core infrastructure ALL user stories depend on — services, schema changes, migration
**Blocks**: All user story implementation
**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T005 [P] Add `'email'` to `authProviderEnum` in `backend/src/db/schema/enums.ts` and add `EMAIL: 'email'` to `AuthProvider` in `shared/constants/states.ts`
- [x] T006 [P] Modify users table schema: add `passwordHash` (nullable text), `emailVerified` (boolean default false), make `externalId` nullable in `backend/src/db/schema/users.ts`; update Zod user schema to make `externalId` nullable in `backend/src/api/schemas/user.ts`
- [x] T007 [P] Export `auth-tokens` from schema index in `backend/src/db/schema/index.ts`
- [x] T008 [P] Implement password service: `hashPassword()`, `verifyPassword()` (FR-020: argon2 provides timing-safe verification), `validatePasswordStrength()` using argon2id in `backend/src/services/auth/password.ts`
- [x] T009 [P] Implement token service: `generateToken()`, `validateToken()` (FR-020: use timing-safe comparison for token lookup), `invalidateUserTokens()`, `cleanupExpiredTokens()` in `backend/src/services/auth/token.ts`
- [x] T010 [P] Implement email service: `EmailService` interface, SMTP transport, console transport, factory function in `backend/src/services/email/index.ts`, `backend/src/services/email/smtp-transport.ts`, `backend/src/services/email/console-transport.ts`
- [x] T011 [P] Implement email templates: verification email and password reset email with action URLs in `backend/src/services/email/templates.ts`
- [x] T012 [P] Implement generic auth rate limiter middleware: in-memory sliding window, configurable per-key limits in `backend/src/api/middleware/auth-rate-limit.ts`
- [x] T013 Update shared auth types: extend provider types to include `'email'`, add `emailVerified` field in `shared/types/auth.ts`
- [x] T014 Generate and apply Drizzle migration: add email provider, user columns, auth_tokens table, set existing OAuth users `email_verified=true` — run `drizzle-kit generate` and `drizzle-kit migrate` in `backend/drizzle/`

**✓ Checkpoint**: All services testable in isolation; migration applied; `pnpm build` passes

---

## Phase 3: MVP — Signup, Login & Auth Pages (P1) 🎯 — ✅ Completed

**Beads Phase ID**: `echo-portal-zqhk`
**Goal**: Users can sign up with email, verify via email, and log in. OAuth continues to work. Dedicated login page replaces header buttons. (US1 + US2 + US3 + US5)
**Acceptance**: Complete signup → verify email → login flow works end-to-end; OAuth login still works; header shows "Sign In" link
**Dependencies**: Phase 2 complete
**Note**: US5 promoted from P2 to MVP — the login page is required as the UI entry point for signup/login flows

### Backend

- [x] T015 [US1] Implement `POST /auth/register` endpoint: validate input (Zod), check email uniqueness, check provider conflict (FR-024), hash password, create user with `provider='email'` and `emailVerified=false`, generate verification token, send email, audit log in `backend/src/api/routes/auth.ts`
- [x] T016 [US2] Implement `POST /auth/login` endpoint: find user by email+provider, check `emailVerified`, check lockout via existing `checkAccountLockout()`, verify password with argon2, create session via `createSession()`, set cookie, record login attempt, audit log in `backend/src/api/routes/auth.ts`
- [x] T017 [US1] Implement `POST /auth/verify-email` endpoint: validate token via token service, mark `emailVerified=true`, mark token used, audit log in `backend/src/api/routes/auth.ts`
- [x] T018 [US1] [US2] Modify `findOrCreateUser()` to enforce FR-024: if email exists with different provider, return error instead of auto-linking. Add `provider_conflict` error type in `backend/src/api/routes/auth.ts`
- [x] T019 [US1] Add scheduled cleanup: `setInterval` calling `cleanupUnverifiedAccounts()` (7-day expiry) and `cleanupExpiredTokens()` alongside existing OAuth state cleanup pattern in `backend/src/api/routes/auth.ts`
- [x] T020 [US1] [US2] Apply rate limiting middleware to register (5/hr per IP) and login endpoints in `backend/src/api/routes/auth.ts`

### Frontend Components

- [x] T021 [P] [US5] Create `EmailLoginForm` component: email + password fields, validation, submit handler, error display, "Forgot password?" link in `frontend/src/components/auth/EmailLoginForm.tsx`
- [x] T022 [P] [US1] Create `PasswordStrength` component: segmented bar (weak/fair/strong), checklist showing 3-of-4-types criteria in `frontend/src/components/auth/PasswordStrength.tsx`

### Frontend Pages & Context

- [x] T023 [US5] Create `LoginPage`: OAuth buttons (reuse `LoginButton`) + `EmailLoginForm` + "Don't have an account? Sign up" link in `frontend/src/pages/LoginPage.tsx`
- [x] T024 [US1] Create `SignupPage`: email, display name, password, confirm password fields with `PasswordStrength` indicator + "Already have an account? Log in" link in `frontend/src/pages/SignupPage.tsx`
- [x] T025 [US1] Create `VerifyEmailPage`: extract token from URL params, call verify-email API, show success/failure/expired states in `frontend/src/pages/VerifyEmailPage.tsx`
- [x] T026 [US5] Update `AppHeader`: replace inline `LoginButton` components with a single "Sign In" `Button`/`Link` navigating to `/login` for unauthenticated users in `frontend/src/components/layout/AppHeader.tsx`
- [x] T027 [US1] [US2] Update `AuthContext`: add `loginWithEmail(email, password)`, `register(email, password, displayName)`, `verifyEmail(token)` methods in `frontend/src/context/AuthContext.tsx`
- [x] T028 [US5] Add new routes to router: `/login` → `LoginPage`, `/signup` → `SignupPage`, `/verify-email` → `VerifyEmailPage` (lazy-loaded) in `frontend/src/router/index.tsx`
- [x] T029 [US1] [US2] Update `AuthCallback` to handle `provider_conflict` error with message directing user to their existing auth method in `frontend/src/pages/AuthCallback.tsx`

**✓ Checkpoint**: Full signup → verify → login flow works. OAuth still works. Header shows "Sign In" link.

---

## Phase 4: Password Reset (P2) — ✅ Completed

**Beads Phase ID**: `echo-portal-meq5`
**Goal**: Users can reset forgotten passwords via email link (US4)
**Acceptance**: Request reset → receive email → click link → set new password → login with new password
**Dependencies**: Phase 3 complete (needs email service + auth routes established)

### Backend

- [x] T030 [US4] Implement `POST /auth/forgot-password` endpoint: always return success, generate reset token + send email only if email exists with `provider='email'`, rate limit 3/hr per email, audit log in `backend/src/api/routes/auth.ts`
- [x] T031 [US4] Implement `POST /auth/reset-password` endpoint: validate token, hash new password, update user, revoke all sessions (FR-008), mark token used, audit log in `backend/src/api/routes/auth.ts`

### Frontend

- [x] T032 [P] [US4] Create `ForgotPasswordPage`: email input, submit, show "Check your email" confirmation regardless of result in `frontend/src/pages/ForgotPasswordPage.tsx`
- [x] T033 [P] [US4] Create `ResetPasswordPage`: extract token from URL, new password + confirm fields with `PasswordStrength`, submit, redirect to login on success in `frontend/src/pages/ResetPasswordPage.tsx`
- [x] T034 [US4] Add routes `/forgot-password` → `ForgotPasswordPage`, `/reset-password` → `ResetPasswordPage` to router in `frontend/src/router/index.tsx`
- [x] T035 [US4] Add `forgotPassword(email)` and `resetPassword(token, password)` methods to `AuthContext` in `frontend/src/context/AuthContext.tsx`

**✓ Checkpoint**: Complete forgot → reset → re-login flow works. No account enumeration possible.

---

## Phase 5: Verification Resend & Change Password (P3) — ✅ Completed

**Beads Phase ID**: `echo-portal-brfz`
**Goal**: Users can resend verification emails and change passwords while logged in (US6 + US7)
**Acceptance**: Resend verification from login prompt works; logged-in email user can change password from settings
**Dependencies**: Phase 3 complete

### Backend

- [x] T036 [US6] Implement `POST /auth/resend-verification` endpoint: find unverified user, rate limit 3/hr per email, invalidate old tokens, generate new token, send email, audit log in `backend/src/api/routes/auth.ts`
- [x] T037 [US7] Implement `PUT /auth/change-password` endpoint: `requireAuth` middleware, verify current password, validate new password, hash + update, revoke other sessions (FR-023, keep current), audit log in `backend/src/api/routes/auth.ts`

### Frontend

- [x] T038 [US6] Add resend verification UI: "Resend email" button on `VerifyEmailPage` and as prompt when login returns `needsVerification`, add `resendVerification(email)` to AuthContext in `frontend/src/pages/VerifyEmailPage.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/context/AuthContext.tsx`
- [x] T039 [US7] Create `AccountSettings.tsx` page with password change section: show only for `provider='email'` users, current password + new password + confirm fields with `PasswordStrength`, success/error feedback in `frontend/src/pages/AccountSettings.tsx`
- [x] T040 [US7] Add `/settings/account` route for account settings page (if new page created) in `frontend/src/router/index.tsx`

**✓ Checkpoint**: Unverified users can resend. Logged-in email users can change password. OAuth users don't see password change.

---

## Phase 6: Polish & Testing — ✅ Completed

**Beads Phase ID**: `echo-portal-1gql`
**Purpose**: Tests, integration verification, edge cases, cleanup
**Dependencies**: All user story phases complete

- [x] T041 [P] Write unit tests: password hashing/validation, token generation/expiry/single-use, rate limiter window/limits/cleanup, email service console transport + template rendering in `backend/tests/unit/password.test.ts`, `backend/tests/unit/token.test.ts`, `backend/tests/unit/rate-limiter.test.ts`, `backend/tests/unit/email-service.test.ts`
- [x] T042 [P] Write integration tests: register flow, login + lockout, verify email, forgot + reset password, change password, provider conflict (FR-024) in `backend/tests/integration/auth-register.test.ts`, `backend/tests/integration/auth-login.test.ts`, `backend/tests/integration/auth-verify.test.ts`, `backend/tests/integration/auth-reset.test.ts`, `backend/tests/integration/auth-change-password.test.ts`, `backend/tests/integration/auth-provider-conflict.test.ts`
- [x] T043 [P] Write frontend component tests: `PasswordStrength` criteria display and strength levels, `EmailLoginForm` validation and error states in `frontend/tests/components/PasswordStrength.test.tsx`, `frontend/tests/components/EmailLoginForm.test.tsx`
- [x] T044 Run `quickstart.md` validation: full end-to-end walkthrough of signup, verify, login, reset, change password flows and verify all checklist items pass
- [x] T045 [P] Write Playwright e2e test: full signup → verify email → login → password reset flow in `frontend/tests/e2e/auth-flow.spec.ts`

**✓ Checkpoint**: Feature complete, tested, production-ready

---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational ─────────────────────────────────┐
    │                                                    │
    ▼                                                    │
Phase 3: MVP — Signup, Login & Auth Pages (P1) 🎯       │
    │                                                    │
    ├───────────────┬──────────────────┐                │
    ▼               ▼                  ▼                │
Phase 4:        Phase 5:           (parallel)            │
Password Reset  Resend & Change                          │
(P2)            Password (P3)                            │
    │               │                                    │
    └───────────────┘                                    │
            │                                            │
            ▼                                            │
    Phase 6: Polish & Testing ◄─────────────────────────┘
```

### Key Rules

1. **Setup** → No dependencies, start immediately
2. **Foundational** → Blocks ALL user stories
3. **MVP (Phase 3)** → Must complete before P2/P3 phases
4. **Password Reset + Resend/Change Password** → Can run in parallel after MVP
5. **Polish** → After all story phases complete

---

## Execution Strategies

### Strategy A: MVP First (Solo Developer)

```
Setup → Foundational → Phase 3 (MVP) → STOP & VALIDATE → [Phase 4 → Phase 5 → Phase 6]
```

Ship after Phase 3 if viable. Users can sign up, verify, and login.

### Strategy B: Parallel After MVP

```
All: Setup → Foundational → Phase 3 (MVP)
Then split:
  Dev A: Phase 4 (Password Reset)
  Dev B: Phase 5 (Resend & Change Password)
Sync: Phase 6 (Polish & Testing)
```

### Strategy C: Sequential Priority

```
Setup → Foundational → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

One phase at a time, in priority order.

---

## Parallel Execution Examples

### Within Setup Phase

```bash
# All [P] tasks in parallel
T001 & T002 & T003 & T004
wait
```

### Within Foundational Phase

```bash
# All [P] tasks in parallel (different files)
T005 & T006 & T007 & T008 & T009 & T010 & T011 & T012
wait
# Sequential tasks
T013  # depends on T005 (shared types need enum update)
T014  # depends on T002, T003, T005, T006 (migration needs all schema changes)
```

### Within MVP Phase

```bash
# Backend routes (sequential — same file)
T015 → T016 → T017 → T018 → T019 → T020

# Frontend components (parallel — different files)
T021 & T022
wait

# Frontend pages (sequential — depend on components + context)
T023 → T024 → T025 → T026 → T027 → T028 → T029
```

### Across Post-MVP Phases

```bash
# After Phase 3 complete, phases in parallel
(Phase 4: Password Reset) & (Phase 5: Resend & Change Password)
wait
# Then Polish
Phase 6
```

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[USn]` labels map tasks to user stories for traceability
- Each phase should be independently completable and testable at its checkpoint
- Commit after each task or logical group
- Stop at any checkpoint to validate and potentially ship
- **Avoid**: Vague tasks, same-file conflicts, cross-story dependencies that break independence
- **Beads sync**: Always run `bd sync` at end of session to persist tracking state
