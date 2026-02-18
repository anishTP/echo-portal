# Implementation Plan: Identity, Roles, and Permissions

**Branch**: `002-identity-roles-permissions` | **Date**: 2026-01-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-identity-roles-permissions/spec.md`

## Summary

This feature defines the identity, roles, and permissions system that governs access across Echo's public, contributor, and governance layers. The implementation enhances the existing authentication placeholder with a production-ready OAuth2-based identity system, expands the current role model to include explicit anonymous viewer handling, and implements contextual permission evaluation based on branch state, lifecycle stage, content visibility, and governance responsibility.

The system ensures all contribution actions are attributable to authenticated actors, enforces lifecycle constraints (draft → review → approved → published), prevents privilege escalation, and provides comprehensive audit trails for governance compliance.

Key clarifications incorporated since initial planning:
- Sessions use 24-hour sliding expiry (no refresh tokens)
- Collaborators retain read-only access during Review/Approved states
- Collaborators and reviewers are mutually exclusive per branch
- Approval thresholds are per-branch only (no content type concept)
- Archival transitions deferred to future feature
- Reviewer removal triggers auto-return to Draft if no reviewers remain
- Audit log retention via PostgreSQL range partitioning by month

## Technical Context

**Language/Version**: TypeScript 5.9+, Node.js 20 LTS
**Primary Dependencies**: Hono 4.8.2 (backend), React 19 (frontend), Drizzle ORM 0.44.0, arctic 3.5.0 (OAuth), xstate 5.19.2 (existing branch state machine), zod 3.24.2
**Storage**: PostgreSQL (existing Drizzle schema with users, branches, reviews, audit-logs tables)
**Testing**: Vitest 3.1.3 (unit/integration), Playwright 1.52.0 (E2E)
**Target Platform**: Web application (Node.js backend, React frontend)
**Project Type**: Web application (monorepo: backend/, frontend/, shared/)
**Performance Goals**: Permission checks <10ms, audit log writes <50ms, role changes effective within 30 seconds, session validation <5ms (cached)
**Constraints**: 7-year audit log retention (PostgreSQL range partitioning by month), graceful degradation when OAuth provider unavailable, 15-minute account lockout after 5 failed attempts, 24-hour sliding session expiry
**Scale/Scope**: Multi-user collaboration platform with 4 roles (Viewer implicit, Contributor, Reviewer, Administrator)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.1):

- [x] **Explicit Change Control (I)**: All state changes explicit, attributable, intentional
  - Every action attributed to authenticated actor (FR-002)
  - Audit logs capture all state transitions (FR-022)
  - No implicit privilege escalation (FR-009)
- [x] **Single Source of Truth (II)**: Published content protection mechanisms defined
  - Published content is immutable (FR-014)
  - Modification attempts denied with clear error (User Story 4, Scenario 3)
- [x] **Branch-First Collaboration (III)**: Isolated workspaces and lifecycle stages defined
  - States: Draft → Review → Approved → Published (Archived deferred)
  - Explicit transitions with role-based authorization
- [x] **Separation of Concerns (IV)**: Clear read/write boundary between consumption and contribution
  - Anonymous viewers: read-only published public content (FR-016)
  - Contributors/Reviewers/Admins: authenticated write access (FR-001)
- [x] **Role-Driven Governance (V)**: Actors, roles, and permissions explicitly defined
  - 4 roles: Viewer, Contributor, Reviewer, Administrator
  - Permission matrix documented in spec
  - Self-review forbidden (FR-013)
  - Collaborators and reviewers mutually exclusive per branch (FR-017c)
- [x] **Open by Default (VI)**: Public read access maintained unless justified restriction
  - Published content publicly readable (FR-016)
  - Draft/Review content private to owner, collaborators, and assigned reviewers (FR-017)
- [x] **Layered Architecture (VII)**: Core workflows stable, changes don't break contracts
  - Extends existing permission service without breaking current API
  - Extends existing xstate branch state machine
  - Backward-compatible role expansion
- [x] **Specification Completeness (VIII)**: All required sections present
  - Actors/permissions: Defined
  - Lifecycle states: Defined (archival deferred with explicit notation)
  - Visibility boundaries: Defined (including collaborator access in Review/Approved)
  - Auditability: Defined (including partitioning strategy)
  - Success criteria: 7 measurable outcomes
- [x] **Clarity Over Breadth (IX)**: Complexity justified
  - 4-role model is minimal viable (spec Assumptions)
  - Configurable approval thresholds per-branch only (content type scoping removed)
  - Archival deferred to reduce MVP scope
- [x] **Testing as Contract (X)**: Test strategy defined, TDD approach confirmed
  - 80% coverage for core workflows
  - Security boundary tests for each role
  - Integration tests for all state transitions

## Project Structure

### Documentation (this feature)

```text
specs/002-identity-roles-permissions/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   ├── middleware/
│   │   │   ├── auth.ts              # [EXTEND] Session validation, OAuth callback
│   │   │   ├── permissions.ts       # [EXTEND] Contextual permission evaluation
│   │   │   └── rate-limit.ts        # [NEW] Login attempt throttling
│   │   ├── routes/
│   │   │   ├── auth.ts              # [EXTEND] OAuth endpoints, session management
│   │   │   ├── users.ts             # [NEW] User management, role assignment
│   │   │   └── audit.ts             # [EXTEND] Permission decision logging
│   │   └── schemas/
│   │       ├── auth.ts              # [EXTEND] Session, login attempt schemas
│   │       └── user.ts              # [NEW] User management schemas
│   ├── db/
│   │   └── schema/
│   │       ├── users.ts             # [EXTEND] Add lockout fields, session refs
│   │       ├── sessions.ts          # [NEW] Session management table
│   │       ├── login-attempts.ts    # [NEW] Failed login tracking
│   │       └── audit-logs.ts        # [EXTEND] Partitioning setup
│   └── services/
│       ├── auth/
│       │   ├── session.ts           # [NEW] Session lifecycle (24h sliding expiry)
│       │   ├── oauth.ts             # [EXTEND] Provider integration + graceful degradation
│       │   └── permissions.ts       # [EXTEND] Contextual evaluation
│       ├── branch/                  # [EXTEND] Reviewer removal → auto-Draft logic
│       ├── workflow/
│       │   └── state-machine.ts     # [EXTEND] xstate machine for new permission guards
│       └── audit/
│           └── index.ts             # [EXTEND] Permission decision logging
└── tests/
    ├── integration/
    │   ├── auth.test.ts             # [NEW] Authentication flow tests
    │   ├── permissions.test.ts      # [EXTEND] Contextual permission tests
    │   └── security-audit.test.ts   # [EXTEND] Privilege escalation tests
    └── unit/
        └── permissions.test.ts      # [NEW] Permission evaluation unit tests

frontend/
├── src/
│   ├── context/
│   │   └── AuthContext.tsx          # [EXTEND] Session management, OAuth flow
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginButton.tsx      # [NEW] OAuth login trigger
│   │   │   ├── LogoutButton.tsx     # [NEW] Session termination
│   │   │   └── RoleBadge.tsx        # [NEW] Role indicator
│   │   └── permissions/
│   │       ├── PermissionGate.tsx   # [NEW] Conditional rendering by permission
│   │       └── AccessDenied.tsx     # [NEW] Actionable denial message
│   ├── hooks/
│   │   ├── usePermissions.ts        # [NEW] Permission checking hook
│   │   └── useAuth.ts               # [EXTEND] OAuth callback handling
│   └── services/
│       └── auth.ts                  # [EXTEND] Session API client
└── tests/
    ├── unit/
    │   └── permissions.test.ts      # [NEW] Permission gate tests
    └── e2e/
        └── auth.spec.ts             # [NEW] E2E authentication flows

shared/
├── types/
│   ├── user.ts                      # [EXTEND] Role enum, permission types
│   ├── auth.ts                      # [NEW] Session, OAuth types
│   └── permissions.ts               # [NEW] Permission evaluation types
└── constants/
    ├── roles.ts                     # [NEW] Role constants (including VIEWER)
    └── permissions.ts               # [NEW] Permission constants
```

**Structure Decision**: Extends existing web application monorepo structure (backend/, frontend/, shared/). Changes are additive to existing auth and permissions infrastructure. The existing xstate state machine in `backend/src/services/workflow/state-machine.ts` will be extended with new permission guards rather than replaced.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Configurable approval thresholds | Different branches may have different governance needs | Single fixed threshold insufficient for varied content sensitivity |
| 7-year audit retention with partitioning | Compliance and governance requirements | Shorter retention would violate regulatory expectations; no partitioning would degrade query performance over time |
| OAuth graceful degradation | User experience during provider outages | Full lockout would block all authenticated work during temporary outages |
| Session cache with 30s TTL | Role changes must take effect within 30s (SC-007) | Direct DB lookup on every request would not meet <5ms session validation target |

## Changes from Previous Plan

This plan incorporates the following changes based on `/speckit.analyze` findings and `/speckit.clarify` sessions:

1. **OAuth graceful degradation moved to Phase 3 (US1)**: Previously in Phase 10 (Polish), FR-005c/d are P1-adjacent reliability concerns that belong with the authentication implementation.

2. **Audit log partitioning task added**: FR-023 (7-year retention) now has an implementation task for PostgreSQL range partitioning by month, not just a test.

3. **Reviewer removal auto-Draft task added**: FR-017a now specifies that removing all reviewers from a branch in Review state automatically returns it to Draft. Needs implementation in branch service.

4. **xstate retained**: The existing `backend/src/services/workflow/state-machine.ts` uses xstate for branch transitions. The dependency is legitimate and will be extended with new permission guards.

5. **Archival tasks removed**: Published→Archived and Draft→Archived transitions are deferred to a future feature per clarification. No implementation tasks needed for MVP.

6. **Approval thresholds simplified**: Scoped to per-branch only; "content type" concept removed from FR-013a.

7. **Session TTL specified**: 24-hour sliding expiry with `last_activity_at` update on each authenticated request. No refresh token mechanism.

8. **Collaborator visibility clarified**: Collaborators retain read-only access in Review and Approved states. Collaborators and reviewers are mutually exclusive per branch (FR-017c).

9. **`shared/constants/roles.ts` corrected**: Marked as `[NEW]` (file does not currently exist), not `[EXTEND]`.
