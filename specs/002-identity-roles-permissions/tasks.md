# Tasks: Identity, Roles, and Permissions

**Feature**: `specs/002-identity-roles-permissions/`
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `echo-portal-s4v` |
| **Spec Label** | `spec:002-identity-roles-permissions` |
| **User Stories Source** | `specs/002-identity-roles-permissions/spec.md` |
| **Planning Details** | `specs/002-identity-roles-permissions/plan.md` |
| **Data Model** | `specs/002-identity-roles-permissions/data-model.md` |

> **NOTE**: Run the Beads Issue Creation Script (at end of file) after generating this tasks.md to create the epic and phase issues in beads.

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | Identity, Roles, and Permissions |
| **User Stories** | 6 from spec.md |
| **Priority** | P1 (US1-3 MVP) → P2 (US4-5) → P3 (US6) |
| **Est. Tasks** | 102 |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.1:
- ✅ **Testing as Contract (X)**: Tests written before implementation (TDD)
- ✅ **Explicit Change Control (I)**: All changes attributable and intentional
- ✅ **Specification Completeness (VIII)**: All mandatory sections verified in spec.md
- ✅ **Clarity Over Breadth (IX)**: Complexity justified in plan.md

Refer to `.specify/memory/constitution.md` for full principles.

### Changes from Previous Version

- OAuth graceful degradation (was T094 in Phase 10) moved to Phase 3 (US1) per FR-005c/d
- Audit log partitioning task added for FR-023 (7-year retention)
- Reviewer removal auto-Draft task added for FR-017a
- Archival tasks removed (deferred to future feature per clarification)
- Approval thresholds scoped to per-branch only (no content type)
- Session TTL specified as 24h sliding expiry
- Collaborator visibility in Review/Approved states clarified (read-only)
- `shared/constants/roles.ts` corrected to `[NEW]` (does not exist yet)
- xstate retained — used in existing `backend/src/services/workflow/state-machine.ts`

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

## Phase 1: Setup — ⬜ Pending

**Beads Phase ID**: `echo-portal-s4v.1`
**Purpose**: Database migrations, shared types, and base infrastructure
**Blocks**: All subsequent phases
**Parallelism**: Most tasks can run in parallel after T001

- [x] T001 Generate database migration for new tables and column extensions `backend/src/db/migrations/`
- [x] T002 [P] Create sessions table schema `backend/src/db/schema/sessions.ts`
- [x] T003 [P] Create login_attempts table schema `backend/src/db/schema/login-attempts.ts`
- [x] T004 [P] Extend users table with lockout fields (locked_until, failed_login_count, last_failed_login_at) `backend/src/db/schema/users.ts`
- [x] T005 [P] Extend branches table with collaboration fields (collaborators, assigned_reviewers, required_approvals) `backend/src/db/schema/branches.ts`
- [x] T006 [P] Extend audit_logs table with outcome and initiating_user_id columns `backend/src/db/schema/audit-logs.ts`
- [x] T007 [P] Add new audit action enum values (auth.login, auth.logout, auth.failed, auth.locked, role.changed, permission.granted, permission.denied, collaborator.added, collaborator.removed, reviewer.assigned, reviewer.unassigned) `backend/src/db/schema/enums.ts`
- [x] T008 [P] Create shared auth types (Session, OAuthProvider, LoginAttempt) `shared/types/auth.ts`
- [x] T009 [P] Create shared permission types (PermissionContext, PermissionResult, PermissionAction) `shared/types/permissions.ts`
- [x] T010 [P] Extend shared user types with role enum (add Viewer as implicit anonymous concept) `shared/types/user.ts`
- [x] T011 [P] Create permission constants (action names, role-permission mapping) `shared/constants/permissions.ts`
- [x] T012 [P] Create role constants with VIEWER, CONTRIBUTOR, REVIEWER, ADMINISTRATOR `shared/constants/roles.ts`
- [x] T013 [P] Setup audit_logs table partitioning by month for 7-year retention (FR-023) `backend/src/db/migrations/`

**✓ Checkpoint**: `pnpm db:migrate` succeeds, shared types compile

---

## Phase 2: Foundational — ✅ Completed

**Beads Phase ID**: `echo-portal-s4v.2` — ✅ CLOSED
**Purpose**: Core infrastructure ALL user stories depend on
**Completed**: 2026-01-27 (13/13 tasks)

### Backend Services

- [x] T014 Create session service with create/validate/revoke and 24h sliding expiry logic `backend/src/services/auth/session.ts`
- [x] T015 [P] Extend OAuth service with Arctic providers (GitHub, Google) `backend/src/services/auth/oauth.ts`
- [x] T016 [P] Create rate limit middleware for login attempts (5 attempts / 15 min lockout) `backend/src/api/middleware/rate-limit.ts`
- [x] T017 Extend permissions service with contextual evaluation (actor, branch state, visibility, ownership, collaborators, reviewers) `backend/src/services/auth/permissions.ts`
- [x] T018 [P] Extend audit service with permission decision logging (granted/denied with metadata) `backend/src/services/audit/index.ts`
- [x] T019 Implement session cache with 30-second TTL for role change propagation (SC-007) `backend/src/services/auth/session.ts`

### Backend Schemas (Zod)

- [x] T020 [P] Create auth schemas (session validation, login attempt, OAuth callback) `backend/src/api/schemas/auth.ts`
- [x] T021 [P] Create user management schemas (role change, user status, user list) `backend/src/api/schemas/user.ts`

### Backend Middleware

- [x] T022 Extend auth middleware with session validation (cookie-based, sliding expiry update) `backend/src/api/middleware/auth.ts`
- [x] T023 Extend permissions middleware with contextual checks (branch state, visibility, role, collaborators, reviewers) `backend/src/api/middleware/permissions.ts`

### Frontend Foundation

- [x] T024 [P] Extend AuthContext with session management and role state `frontend/src/context/AuthContext.tsx`
- [x] T025 [P] Create usePermissions hook for contextual permission checks `frontend/src/hooks/usePermissions.ts`
- [x] T026 [P] Extend useAuth hook with OAuth callback handling `frontend/src/hooks/useAuth.ts`
- [x] T027 [P] Extend auth service API client (login, logout, me, sessions) `frontend/src/services/auth.ts`

**✅ Checkpoint**: Foundation ready — user stories can begin in parallel

---

## Phase 3: User Story 1 — Authenticate to Access Protected Features (P1) 🎯 MVP — ⬜ Pending

**Beads Phase ID**: `echo-portal-s4v.3`
**Goal**: Users can sign in with OAuth, maintain sessions across page loads, and sign out
**Acceptance**: Sign in via GitHub/Google, session persists across page loads, sign out clears session, lockout after 5 failed attempts, graceful degradation when OAuth unavailable
**Dependencies**: Phase 2 complete

### Tests (Constitution X: Testing as Contract)

- [ ] T028 [P] [US1] Write session service unit tests (create, validate, revoke, sliding expiry, cache invalidation) `backend/tests/unit/session.test.ts`
- [ ] T029 [P] [US1] Write auth flow integration tests (OAuth login, callback, /me, logout) `backend/tests/integration/auth.test.ts`
- [ ] T030 [P] [US1] Write login lockout integration tests (5 failures → 15 min lock, unlock after timeout, reset on success) `backend/tests/integration/auth-lockout.test.ts`
- [ ] T031 [P] [US1] Write OAuth graceful degradation tests (existing sessions work, new logins fail gracefully, anonymous viewing continues) `backend/tests/integration/auth-degradation.test.ts`
- [ ] T032 [P] [US1] Write E2E auth flow tests (login button, OAuth redirect, session persistence, logout) `frontend/tests/e2e/auth.spec.ts`

### Backend Implementation

- [ ] T033 [US1] Implement OAuth login route (initiate flow with Arctic provider) `backend/src/api/routes/auth.ts`
- [ ] T034 [US1] Implement OAuth callback route (create session, set cookie, handle errors) `backend/src/api/routes/auth.ts`
- [ ] T035 [US1] Implement /auth/me endpoint (return current user with role and permissions) `backend/src/api/routes/auth.ts`
- [ ] T036 [US1] Implement /auth/logout endpoint (revoke session, clear cookie) `backend/src/api/routes/auth.ts`
- [ ] T037 [US1] Implement /auth/sessions endpoint (list active sessions for current user) `backend/src/api/routes/auth.ts`
- [ ] T038 [US1] Implement session revocation endpoint (revoke specific session by ID) `backend/src/api/routes/auth.ts`
- [ ] T039 [US1] Implement login attempt tracking and lockout logic (FR-005a: 5 attempts, 15 min) `backend/src/services/auth/session.ts`
- [ ] T040 [US1] Add graceful degradation for OAuth provider outages (circuit breaker, health check, clear error messages with retry) `backend/src/services/auth/oauth.ts`

### Frontend Implementation

- [ ] T041 [P] [US1] Create LoginButton component (OAuth provider selection) `frontend/src/components/auth/LoginButton.tsx`
- [ ] T042 [P] [US1] Create LogoutButton component (session termination) `frontend/src/components/auth/LogoutButton.tsx`
- [ ] T043 [P] [US1] Create RoleBadge component (display current role) `frontend/src/components/auth/RoleBadge.tsx`
- [ ] T044 [US1] Wire OAuth callback handling in router `frontend/src/router/`
- [ ] T045 [US1] Update app header with auth state display (login/logout, role badge) `frontend/src/components/`

**✓ Checkpoint**: User Story 1 functional and independently testable

---

## Phase 4: User Story 2 — Create and Manage Content as Contributor (P1) 🎯 MVP — ⬜ Pending

**Beads Phase ID**: `echo-portal-s4v.4`
**Goal**: Contributors can create branches, add collaborators (edit access in Draft, read-only in Review/Approved), and submit for review with assigned reviewers
**Acceptance**: Create branch, invite collaborators, assign reviewers (mutually exclusive with collaborators per FR-017c), submit for review
**Dependencies**: Phase 2 complete (can run parallel with US1 after Phase 2)

### Tests (Constitution X: Testing as Contract)

- [ ] T046 [P] [US2] Write collaborator permission tests (add/remove, edit in Draft, read-only in Review/Approved, mutual exclusion with reviewers) `backend/tests/integration/collaborators.test.ts`
- [ ] T047 [P] [US2] Write reviewer assignment tests (assign, validate not owner/collaborator, min 1 for submit) `backend/tests/integration/reviewers.test.ts`
- [ ] T048 [P] [US2] Write self-review denial tests (owner cannot approve own branch) `backend/tests/integration/self-review.test.ts`

### Backend Implementation

- [ ] T049 [US2] Implement collaborator add/remove endpoints (enforce not-owner, not-reviewer constraints per FR-017c) `backend/src/api/routes/branches.ts`
- [ ] T050 [US2] Implement reviewer assignment endpoints (enforce not-owner, not-collaborator constraints per FR-017c) `backend/src/api/routes/branches.ts`
- [ ] T051 [US2] Implement submit-for-review with reviewer validation (min 1 reviewer required per FR-017a) `backend/src/api/routes/branches.ts`
- [ ] T052 [US2] Add self-review prevention logic in permissions service `backend/src/services/auth/permissions.ts`
- [ ] T053 [US2] Implement branch visibility enforcement (owner, collaborators read-only in Review/Approved, reviewers) `backend/src/services/auth/permissions.ts`

### Frontend Implementation

- [ ] T054 [P] [US2] Create CollaboratorPicker component `frontend/src/components/branch/CollaboratorPicker.tsx`
- [ ] T055 [P] [US2] Create ReviewerAssignment component `frontend/src/components/branch/ReviewerAssignment.tsx`
- [ ] T056 [US2] Update BranchDetail with collaborator management UI `frontend/src/components/branch/`
- [ ] T057 [US2] Add submit-for-review flow with reviewer requirement validation `frontend/src/components/branch/`

**✓ Checkpoint**: User Story 2 functional, contributors can manage branches

---

## Phase 5: User Story 3 — Review and Approve Content as Reviewer (P1) 🎯 MVP — ⬜ Pending

**Beads Phase ID**: `echo-portal-s4v.5`
**Goal**: Reviewers can approve or request changes on assigned branches, with configurable per-branch thresholds
**Acceptance**: View assigned reviews, approve (meets per-branch threshold), request changes, reviewer removal triggers auto-return to Draft
**Dependencies**: Phase 2 complete (can run parallel with US1, US2)

### Tests (Constitution X: Testing as Contract)

- [ ] T058 [P] [US3] Write approval threshold tests (per-branch config, default=1, threshold met → approved) `backend/tests/integration/approval-threshold.test.ts`
- [ ] T059 [P] [US3] Write review state transition tests (approve, reject → draft, concurrent approval handling) `backend/tests/integration/review-transitions.test.ts`
- [ ] T060 [P] [US3] Write reviewer removal tests (remove reviewer, cancel pending review, last reviewer removed → auto-return to Draft per FR-017a) `backend/tests/integration/reviewer-removal.test.ts`

### Backend Implementation

- [ ] T061 [US3] Implement approval endpoint with per-branch threshold check `backend/src/api/routes/reviews.ts`
- [ ] T062 [US3] Implement request-changes endpoint (Review → Draft with feedback) `backend/src/api/routes/reviews.ts`
- [ ] T063 [US3] Implement approval threshold configuration endpoint (admin only, per-branch, 1-10 range) `backend/src/api/routes/branches.ts`
- [ ] T064 [US3] Update branch transition service for approval thresholds in xstate machine `backend/src/services/workflow/state-machine.ts`
- [ ] T065 [US3] Implement reviewer removal with auto-return to Draft when no reviewers remain (FR-017a) `backend/src/services/branch/`

### Frontend Implementation

- [ ] T066 [P] [US3] Create ReviewActions component (approve/request changes buttons) `frontend/src/components/review/ReviewActions.tsx`
- [ ] T067 [US3] Update ReviewDetail with approval status indicator (current approvals / required) `frontend/src/components/review/`
- [ ] T068 [US3] Add threshold configuration UI for admins on branch settings `frontend/src/components/branch/`

**✓ Checkpoint**: User Story 3 functional, reviewers can approve/reject

---

## Phase 6: User Story 4 — Publish Approved Content as Admin (P2) — ⬜ Pending

**Beads Phase ID**: `echo-portal-s4v.6`
**Goal**: Administrators can publish approved content, enforcing immutability
**Acceptance**: Publish approved branch, verify immutability, deny modification of published content
**Dependencies**: Phase 2 complete

### Tests (Constitution X: Testing as Contract)

- [ ] T069 [P] [US4] Write publish permission tests (admin only, must be approved state) `backend/tests/integration/publish.test.ts`
- [ ] T070 [P] [US4] Write immutability enforcement tests (deny all modifications to published content) `backend/tests/integration/immutability.test.ts`

### Backend Implementation

- [ ] T071 [US4] Implement publish endpoint with approval state check `backend/src/api/routes/convergence.ts`
- [ ] T072 [US4] Implement immutability enforcement in branch service (deny edits to published branches) `backend/src/services/branch/`

### Frontend Implementation

- [ ] T073 [US4] Update PublishButton with permission gate (admin + approved only) `frontend/src/components/convergence/PublishButton.tsx`
- [ ] T074 [US4] Add immutability indicator for published branches (visual lock, disabled edit controls) `frontend/src/components/branch/`

**✓ Checkpoint**: User Story 4 functional, admins can publish

---

## Phase 7: User Story 5 — View Public Content as Anonymous Viewer (P2) — ⬜ Pending

**Beads Phase ID**: `echo-portal-s4v.7`
**Goal**: Anonymous users can view published public content only
**Acceptance**: View published content without auth, denied access to draft/private branches with actionable guidance
**Dependencies**: Phase 2 complete

### Tests (Constitution X: Testing as Contract)

- [ ] T075 [P] [US5] Write anonymous access tests (view published, deny draft, deny private) `backend/tests/integration/anonymous-access.test.ts`
- [ ] T076 [P] [US5] Write visibility boundary tests (collaborator read-only in Review/Approved, reviewer access, admin access) `backend/tests/integration/visibility.test.ts`

### Backend Implementation

- [ ] T077 [US5] Implement public content endpoint without auth requirement `backend/src/api/routes/branches.ts`
- [ ] T078 [US5] Implement access denied handler with actionable guidance (SC-004: state required permission and current role) `backend/src/api/middleware/permissions.ts`

### Frontend Implementation

- [ ] T079 [P] [US5] Create AccessDenied component with actionable guidance message `frontend/src/components/permissions/AccessDenied.tsx`
- [ ] T080 [P] [US5] Create PermissionGate component (conditional rendering by permission) `frontend/src/components/permissions/PermissionGate.tsx`
- [ ] T081 [US5] Update branch views with permission gating (hide/show based on role and branch state) `frontend/src/components/branch/`

**✓ Checkpoint**: User Story 5 functional, anonymous viewing works

---

## Phase 8: User Story 6 — Audit Trail Review (P3) — ⬜ Pending

**Beads Phase ID**: `echo-portal-s4v.8`
**Goal**: Administrators can query audit logs for investigation
**Acceptance**: Query logs by branch/user/action, view permission decisions, see AI-assisted action attribution
**Dependencies**: Phase 2 complete

### Tests (Constitution X: Testing as Contract)

- [ ] T082 [P] [US6] Write audit log query tests (filter by actor, resource, action, date range) `backend/tests/integration/audit-query.test.ts`
- [ ] T083 [P] [US6] Write audit partitioning tests (verify partitions created, queries span partitions correctly) `backend/tests/integration/audit-partitioning.test.ts`

### Backend Implementation

- [ ] T084 [US6] Implement audit log query endpoints (filter by actor, resource, action, date range; paginated; <5s per SC-006) `backend/src/api/routes/audit.ts`
- [ ] T085 [US6] Implement failed login report endpoint (for security monitoring) `backend/src/api/routes/audit.ts`
- [ ] T086 [US6] Implement permission denial report endpoint (aggregated denials by actor/action) `backend/src/api/routes/audit.ts`
- [ ] T087 [US6] Add AI-assisted action attribution to audit service (initiating_user_id field) `backend/src/services/audit/index.ts`

### Frontend Implementation

- [ ] T088 [P] [US6] Create AuditLogViewer component (filterable table with actor, action, resource, outcome) `frontend/src/components/audit/AuditLogViewer.tsx`
- [ ] T089 [P] [US6] Create SecurityReportView component (failed logins, permission denials) `frontend/src/components/audit/SecurityReportView.tsx`
- [ ] T090 [US6] Add audit log page for admins `frontend/src/pages/`

**✓ Checkpoint**: User Story 6 functional, audit queries work

---

## Phase 9: User Management (Admin) — ⬜ Pending

**Beads Phase ID**: `echo-portal-s4v.9`
**Purpose**: Admin user management capabilities (role changes, account unlock, status changes)
**Dependencies**: Phase 2 complete

### Tests (Constitution X: Testing as Contract)

- [ ] T091 [P] Write role change tests (admin only, no self-escalation, takes effect within 30s) `backend/tests/integration/role-change.test.ts`
- [ ] T092 [P] Write privilege escalation prevention tests (contributor cannot promote self, reviewer cannot grant admin) `backend/tests/integration/security-audit.test.ts`

### Backend Implementation

- [ ] T093 Create user management routes (list users, get user) `backend/src/api/routes/users.ts`
- [ ] T094 Implement role change endpoint with admin check and escalation prevention (FR-009, FR-010) `backend/src/api/routes/users.ts`
- [ ] T095 Implement user unlock endpoint (admin clears lockout) `backend/src/api/routes/users.ts`

### Frontend Implementation

- [ ] T096 [P] Create UserManagement page (user list with role, status, last login) `frontend/src/pages/UserManagement.tsx`
- [ ] T097 [P] Create RoleChangeDialog component (role selector, confirmation, escalation warning) `frontend/src/components/admin/RoleChangeDialog.tsx`

**✓ Checkpoint**: User management functional

---

## Phase 10: Polish & Cross-Cutting — ⬜ Pending

**Beads Phase ID**: `echo-portal-s4v.10`
**Purpose**: Quality improvements affecting multiple stories
**Dependencies**: All P1 user stories complete (US1, US2, US3)

- [ ] T098 [P] Add comprehensive error messages with actionable guidance for all permission denials `backend/src/api/utils/errors.ts`
- [ ] T099 Run quickstart.md validation end-to-end `specs/002-identity-roles-permissions/quickstart.md`
- [ ] T100 [P] Performance optimization for permission checks (<10ms target per SC-003) `backend/src/services/auth/permissions.ts`
- [ ] T101 [P] Add audit log indexes for 5-second query performance (SC-006) `backend/src/db/migrations/`
- [ ] T102 Security review and penetration testing documentation `specs/002-identity-roles-permissions/`

**✓ Checkpoint**: Feature complete, documented, production-ready

---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational ───────────────────────────────────────────────┐
    │                                                                │
    ├──────────────┬──────────────┬──────────────┐                   │
    ▼              ▼              ▼              ▼                   │
Phase 3: US1   Phase 4: US2   Phase 5: US3   Phase 6: US4            │
(Auth P1 🎯)   (Contrib P1 🎯) (Review P1 🎯) (Publish P2)           │
    │              │              │              │                   │
    ├──────────────┴──────────────┴──────────────┤                   │
    │                                            │                   │
    ├────────────────┬───────────────┐           │                   │
    ▼                ▼               ▼           │                   │
Phase 7: US5    Phase 8: US6    Phase 9: Admin  │ (parallel after   │
(Viewer P2)     (Audit P3)      (User Mgmt)     │  foundational)    │
    │                │               │           │                   │
    └────────────────┴───────────────┴───────────┘                   │
                          │                                          │
                          ▼                                          │
                  Phase 10: Polish ◄─────────────────────────────────┘
```

### Key Rules

1. **Setup** → No dependencies, start immediately
2. **Foundational** → Blocks ALL user stories
3. **User Stories** → Can run in parallel after Foundational
4. **Within each story**: Tests → Backend → Frontend
5. **Polish** → After P1 stories (US1, US2, US3) complete

---

## Execution Strategies

### Strategy A: MVP First (Solo Developer)

```
Setup → Foundational → US1 (Auth) → US2 (Contributor) → US3 (Review) → STOP & VALIDATE → [US4 → US5 → US6 → Admin → Polish]
```

Ship after US1-3 if viable. Add US4-6 incrementally.

### Strategy B: Parallel Team (3 Developers)

```
All: Setup → Foundational
Then split:
  Dev A: US1 (Auth) → US4 (Publish)
  Dev B: US2 (Contributor) → US5 (Viewer)
  Dev C: US3 (Review) → US6 (Audit)
Sync: Phase 9 (Admin) → Polish
```

### Strategy C: Sequential Priority

```
Setup → Foundational → US1 → US2 → US3 → US4 → US5 → US6 → Admin → Polish
```

One story at a time, in priority order.

---

## Parallel Execution Examples

### Within Setup Phase

```bash
# T001 migration first, then all schema tasks parallel
T001
wait
T002 & T003 & T004 & T005 & T006 & T007 & T008 & T009 & T010 & T011 & T012 & T013
wait
```

### Within User Story 1

```bash
# Tests first (parallel)
T028 & T029 & T030 & T031 & T032
wait

# Backend implementation (sequential - route dependencies)
T033 → T034 → T035 → T036 → T037 → T038 → T039 → T040

# Frontend (parallel where possible)
T041 & T042 & T043
wait
T044 → T045
```

### Across User Stories (after Foundational)

```bash
# P1 stories in parallel
(Phase 3: US1) & (Phase 4: US2) & (Phase 5: US3)
wait

# P2 stories in parallel
(Phase 6: US4) & (Phase 7: US5)
wait

# P3 and Admin
(Phase 8: US6) & (Phase 9: Admin)
wait

# Polish
Phase 10
```

---

## Completion Tracking

### Task Completion (Markdown + Beads)

```markdown
- [x] T001 Generate migration — ✅ (2026-01-26)
```

```bash
bd update {task-id} --status in_progress  # Before starting
bd close {task-id} --reason "Implemented {file}"  # After completion
bd sync  # Sync changes
```

### Phase Completion

```markdown
## Phase 1: Setup — ✅ COMPLETED (2026-01-26)

**Beads Phase ID**: `echo-portal-s4v.1` — ✅ CLOSED
**Completed Tasks**: T001-T013
```

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[USn]` labels map tasks to user stories for traceability
- Each user story should be independently completable and testable
- Verify tests FAIL before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate and potentially ship
- **MVP scope**: US1 + US2 + US3 (Authentication, Contribution, Review)
- **Deferred**: Archival transitions (Published→Archived, Draft→Archived) — future feature
- **Beads sync**: Always run `bd sync` at end of session to persist tracking state

---

## Beads Issue Creation Script

Run this script after generating tasks.md to create the epic and phase structure in beads:

```bash
#!/bin/bash
FEATURE="002-identity-roles-permissions"
FEATURE_TITLE="Identity, Roles, and Permissions"
LABEL="spec:${FEATURE}"

# Create epic
EPIC=$(bd create "$FEATURE_TITLE" -t epic -p 1 -l "$LABEL" --json | jq -r '.id')
echo "Created Epic: $EPIC"

# Create phases
P1=$(bd create "Phase 1: Setup" -t feature -p 1 -l "$LABEL,phase:setup" --parent $EPIC --json | jq -r '.id')
P2=$(bd create "Phase 2: Foundational" -t feature -p 1 -l "$LABEL,phase:foundational" --parent $EPIC --json | jq -r '.id')
P3=$(bd create "Phase 3: US1 - Authentication (MVP)" -t feature -p 1 -l "$LABEL,phase:us1" --parent $EPIC --json | jq -r '.id')
P4=$(bd create "Phase 4: US2 - Contributor (MVP)" -t feature -p 1 -l "$LABEL,phase:us2" --parent $EPIC --json | jq -r '.id')
P5=$(bd create "Phase 5: US3 - Reviewer (MVP)" -t feature -p 1 -l "$LABEL,phase:us3" --parent $EPIC --json | jq -r '.id')
P6=$(bd create "Phase 6: US4 - Publish" -t feature -p 2 -l "$LABEL,phase:us4" --parent $EPIC --json | jq -r '.id')
P7=$(bd create "Phase 7: US5 - Viewer" -t feature -p 2 -l "$LABEL,phase:us5" --parent $EPIC --json | jq -r '.id')
P8=$(bd create "Phase 8: US6 - Audit" -t feature -p 3 -l "$LABEL,phase:us6" --parent $EPIC --json | jq -r '.id')
P9=$(bd create "Phase 9: User Management" -t feature -p 2 -l "$LABEL,phase:admin" --parent $EPIC --json | jq -r '.id')
PN=$(bd create "Phase 10: Polish" -t feature -p 3 -l "$LABEL,phase:polish" --parent $EPIC --json | jq -r '.id')

echo "Created Phases: P1=$P1, P2=$P2, P3=$P3, P4=$P4, P5=$P5, P6=$P6, P7=$P7, P8=$P8, P9=$P9, PN=$PN"

# Set phase dependencies
bd dep add $P2 $P1  # Foundational depends on Setup
bd dep add $P3 $P2  # US1 depends on Foundational
bd dep add $P4 $P2  # US2 depends on Foundational (parallel with US1)
bd dep add $P5 $P2  # US3 depends on Foundational (parallel with US1, US2)
bd dep add $P6 $P2  # US4 depends on Foundational
bd dep add $P7 $P2  # US5 depends on Foundational
bd dep add $P8 $P2  # US6 depends on Foundational
bd dep add $P9 $P2  # Admin depends on Foundational
bd dep add $PN $P3  # Polish depends on US1 (MVP)
bd dep add $PN $P4  # Polish depends on US2 (MVP)
bd dep add $PN $P5  # Polish depends on US3 (MVP)

echo "Dependencies configured"

# Sync and show tree
bd sync
bd dep tree $EPIC

echo ""
echo "Update tasks.md with these IDs:"
echo "  Epic ID: $EPIC"
echo "  Phase 1 (Setup): $P1"
echo "  Phase 2 (Foundational): $P2"
echo "  Phase 3 (US1 MVP): $P3"
echo "  Phase 4 (US2 MVP): $P4"
echo "  Phase 5 (US3 MVP): $P5"
echo "  Phase 6 (US4): $P6"
echo "  Phase 7 (US5): $P7"
echo "  Phase 8 (US6): $P8"
echo "  Phase 9 (Admin): $P9"
echo "  Phase N (Polish): $PN"
```

### Labels Reference

| Label | Purpose |
|-------|--------|
| `spec:002-identity-roles-permissions` | Links all issues to this feature |
| `phase:setup` | Setup phase tasks |
| `phase:foundational` | Foundational/blocking tasks |
| `phase:us1` through `phase:us6` | User story phases |
| `phase:admin` | Admin user management |
| `phase:polish` | Polish and cross-cutting |
| `parallel:true` | Task is parallelizable |

### Session Management

**Start of session:**
```bash
git pull && bd sync && bd prime
bd list --label 'spec:002-identity-roles-permissions' --status in_progress
bd ready --limit 5
```

**End of session (CRITICAL):**
```bash
bd sync
git add . && git commit -m "{message}" && git push
```
