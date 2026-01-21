# Implementation Plan: Branch Isolation Model

**Branch**: `001-branch-isolation-model` | **Date**: 2026-01-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-branch-isolation-model/spec.md`

## Summary

Implement a governed contribution workflow powered by Git-based branch isolation with a three-environment model (dev → stage → main). The system enforces explicit lifecycle states (Draft → Review → Approved → Published → Archived) with dual entry points: design team contributors branch from `dev` for high-frequency work, while general contributors branch from `main` for low-friction access. All changes flow through review gates before converging to the authoritative `main` branch, which remains stable, trustworthy, and immutable once published.

## Technical Context

**Language/Version**: TypeScript 5.9+, Node.js 20 LTS
**Primary Dependencies**: React 19, Vite 7, isomorphic-git (client-side Git), PostgreSQL (metadata)
**Storage**: Git repositories (content, branches, history), PostgreSQL (users, permissions, workflow state, audit logs)
**Testing**: Vitest (unit/integration), Playwright (E2E), contract tests for API
**Target Platform**: Web (modern browsers), Node.js server
**Project Type**: Web application (React frontend + Node.js backend API)
**Performance Goals**: Branch creation <5s, comparisons <3s (1000 modifications), convergence validation <10s (5000 changes)
**Constraints**: 99.5% uptime, RPO 24h, RTO 4h, 100 concurrent branches without degradation
**Scale/Scope**: 100 concurrent branches, 5000 changes per branch max, 7-year audit log retention

## Constitution Check (Pre-Design)

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.0):

- [x] **Explicit Change Control (I)**: All state changes explicit, attributable, intentional
  - All branch operations logged with actor, timestamp, action
  - No silent state mutations; all transitions require explicit user action
  - Automated processes follow same rules as humans
- [x] **Single Source of Truth (II)**: Published content protection mechanisms defined
  - `main` branch is authoritative; direct edits forbidden
  - Changes only via convergence from approved branches
  - First-wins blocking prevents concurrent overwrites
- [x] **Branch-First Collaboration (III)**: Isolated workspaces and lifecycle stages defined
  - Draft → Review → Approved → Published → Archived lifecycle
  - All work in isolated branches; no direct main edits
  - Three-environment model: dev → stage → main
- [x] **Separation of Concerns (IV)**: Clear read/write boundary between consumption and contribution
  - Anonymous users: read-only published content
  - Authenticated users: contribution workflows
  - API endpoints categorized as read-only vs write-capable
- [x] **Role-Driven Governance (V)**: Actors, roles, and permissions explicitly defined
  - Contributor, Reviewer, Publisher, Administrator roles defined
  - Permission matrix for each state transition
  - Audit logs record actor for every operation
- [x] **Open by Default (VI)**: Public read access maintained unless justified restriction
  - Published content publicly readable
  - Draft branches private by default (owner choice)
  - Restrictions explicit and intentional
- [x] **Layered Architecture (VII)**: Core workflows stable, changes don't break contracts
  - Core: Branch, Review, Convergence contracts stable
  - Extensions/integrations don't modify core workflows
  - Versioned API contracts
- [x] **Specification Completeness (VIII)**: All required sections present
  - Actors/permissions: defined in spec
  - Lifecycle states/transitions: defined with state diagram
  - Visibility boundaries: defined per state
  - Auditability: comprehensive audit event list
  - Success criteria: measurable outcomes defined
- [x] **Clarity Over Breadth (IX)**: Complexity justified
  - Three-environment model adds complexity but enables preview/staging
  - Dual entry points serve distinct user needs (design team vs general)
  - See Complexity Tracking below
- [x] **Testing as Contract (X)**: Test strategy defined, TDD approach confirmed
  - 80% minimum coverage for core workflows
  - Acceptance tests from user story scenarios
  - Chaos testing for convergence rollback

## Project Structure

### Documentation (this feature)

```text
specs/001-branch-isolation-model/
├── plan.md              # This file
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: entity schemas
├── quickstart.md        # Phase 1: developer setup
├── contracts/           # Phase 1: API contracts
│   ├── branches.openapi.yaml
│   ├── reviews.openapi.yaml
│   └── convergence.openapi.yaml
└── tasks.md             # Phase 2: implementation tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   ├── branch.ts           # Branch entity, state machine
│   │   ├── user.ts             # User, roles, permissions
│   │   ├── audit-log.ts        # Audit event schema
│   │   └── convergence.ts      # Convergence operation
│   ├── services/
│   │   ├── git/                # Git operations wrapper
│   │   │   ├── repository.ts   # Repo management
│   │   │   ├── branch.ts       # Branch operations
│   │   │   └── diff.ts         # Comparison logic
│   │   ├── workflow/           # Lifecycle management
│   │   │   ├── state-machine.ts
│   │   │   ├── transitions.ts
│   │   │   └── validation.ts
│   │   ├── auth/               # Authentication
│   │   │   ├── oauth.ts
│   │   │   ├── saml.ts
│   │   │   └── permissions.ts
│   │   └── audit/              # Audit logging
│   │       └── logger.ts
│   └── api/
│       ├── routes/
│       │   ├── branches.ts
│       │   ├── reviews.ts
│       │   ├── convergence.ts
│       │   └── audit.ts
│       └── middleware/
│           ├── auth.ts
│           └── permissions.ts
└── tests/
    ├── unit/
    ├── integration/
    └── contract/

frontend/
├── src/
│   ├── components/
│   │   ├── branch/
│   │   │   ├── BranchList.tsx
│   │   │   ├── BranchDetail.tsx
│   │   │   ├── BranchCreate.tsx
│   │   │   └── LifecycleStatus.tsx
│   │   ├── review/
│   │   │   ├── ReviewPanel.tsx
│   │   │   ├── DiffViewer.tsx
│   │   │   └── ApprovalActions.tsx
│   │   └── common/
│   │       ├── EnvironmentIndicator.tsx
│   │       └── AuditTrail.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── BranchWorkspace.tsx
│   │   ├── ReviewQueue.tsx
│   │   └── PublishConfirm.tsx
│   ├── services/
│   │   ├── api.ts
│   │   └── auth.ts
│   └── hooks/
│       ├── useBranch.ts
│       └── useWorkflow.ts
└── tests/
    ├── unit/
    └── e2e/

shared/
├── types/
│   ├── branch.ts
│   ├── user.ts
│   └── workflow.ts
└── constants/
    └── states.ts
```

**Structure Decision**: Web application structure selected (backend + frontend + shared) to support:
1. Git operations require server-side processing for security
2. React frontend provides rich UI for branch management and review
3. Shared types ensure type safety across the stack

## Three-Environment Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ENVIRONMENT MODEL                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                          │
│  │   DEV    │───►│  STAGE   │───►│   MAIN   │                          │
│  │(sandbox) │    │(preview) │    │(live)    │                          │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘                          │
│       │               │               │                                 │
│  Design team    Integration     Authoritative                          │
│  branches       testing         published state                        │
│  (high-freq)    & previews      (immutable)                            │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                       CONTRIBUTION ENTRY POINTS                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Design Team Contributors          General Internal Contributors        │
│  ─────────────────────────        ──────────────────────────────       │
│  Branch from: DEV                  Branch from: MAIN                    │
│  Workflow: High-frequency,         Workflow: Low-friction,              │
│            nuance-aware                      simple edits               │
│  Merge path: feature→dev→         Merge path: feature→main              │
│              stage→main                      (via stage)                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Dual Entry Model

### Design Team Path (dev → stage → main)
1. **Create**: Branch from `dev` for high-frequency design work
2. **Iterate**: Multiple commits, team collaboration in dev environment
3. **Preview**: Merge to `stage` for integration testing and previews
4. **Validate**: Run automated checks, visual regression, stakeholder review
5. **Publish**: Merge approved changes to `main`

### General Contributor Path (main → stage → main)
1. **Create**: Branch from `main` for isolated changes
2. **Edit**: Make targeted edits in draft state
3. **Submit**: Submit for review (transition to Review state)
4. **Stage**: Approved changes merge to `stage` for preview
5. **Publish**: After validation, merge to `main`

## Merge Flow Rules

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHANGE FLOW DIAGRAM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Feature Branch (Draft)                                         │
│       │                                                         │
│       ▼ [Submit for Review]                                     │
│  Feature Branch (Review)                                        │
│       │                                                         │
│       ▼ [Reviewer Approves]                                     │
│  Feature Branch (Approved)                                      │
│       │                                                         │
│       ├───► stage (Preview/Validation)                          │
│       │         │                                               │
│       │         ▼ [Validation Passes]                           │
│       │                                                         │
│       └───► main (Published) ◄── First-wins blocking            │
│                                   if conflicts                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    MERGE INTEGRITY RULES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. All merges to main MUST be intentional and attributable     │
│  2. Merge conflicts follow first-wins blocking protocol         │
│  3. Second branch MUST rebase/resolve before retry              │
│  4. No bypassing governance (review gate mandatory)             │
│  5. Atomic convergence: fully succeeds or fully rolls back      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## System Behaviors & Guardrails

### Protection of Published Truth (main)
- **Direct edit prevention**: All API endpoints that modify `main` are blocked except through convergence
- **Convergence validation**: Pre-merge checks (conflicts, history integrity, audit completeness)
- **Atomic operations**: Transaction-like convergence with rollback on failure
- **First-wins blocking**: Concurrent convergence attempts are serialized

### Review Gate Enforcement
- **State machine enforcement**: Cannot skip Draft → Review → Approved
- **Permission checks**: Only authorized roles can approve/publish
- **Immutability locks**: Review/Approved states are read-only

### Clarity of Live vs In-Progress
- **Environment indicators**: Clear visual distinction (dev/stage/main badges)
- **Lifecycle status badges**: Draft, Review, Approved, Published, Archived
- **Preview isolation**: Stage previews are clearly marked as non-authoritative

## API Surface Requirements

### Branch Management
- `POST /api/branches` - Create branch (specify source: dev or main)
- `GET /api/branches` - List branches (filter by state, owner, visibility)
- `GET /api/branches/:id` - Get branch details
- `PATCH /api/branches/:id` - Update branch metadata (visibility, reviewers)
- `POST /api/branches/:id/transition` - State transitions

### Review Operations
- `POST /api/reviews` - Submit branch for review
- `GET /api/reviews` - List pending reviews
- `POST /api/reviews/:id/approve` - Approve changes
- `POST /api/reviews/:id/request-changes` - Request changes (return to draft)

### Convergence
- `POST /api/convergence` - Initiate convergence to main
- `GET /api/convergence/:id/status` - Check convergence status
- `POST /api/convergence/:id/rollback` - Manual rollback (admin only)

### Comparison
- `GET /api/branches/:id/diff` - Compare branch to base (main or dev)
- `GET /api/branches/:id/diff/:targetBranch` - Compare two branches

### Audit
- `GET /api/audit` - Query audit logs
- `GET /api/branches/:id/history` - Branch-specific audit trail

## UI Requirements

### Branch Creation
- Source selector: "Branch from dev (Design Team)" / "Branch from main (Quick Edit)"
- Name input with validation
- Initial visibility selection (Private/Team/Public)

### Branch Workspace
- Edit interface for draft branches
- Save/commit controls
- Environment indicator (which base: dev or main)
- Lifecycle status badge with transition actions

### Review Interface
- Diff viewer with before/after comparison
- Approve/Request Changes buttons
- Comment thread for feedback
- Reviewer assignment

### Preview Visibility
- Stage environment preview URL
- Clear "PREVIEW - NOT LIVE" indicator
- Validation status (tests, checks)

### Publish Confirmation
- Final diff summary
- Conflict detection results
- Explicit "Publish to main" confirmation
- Audit trail preview

## Tooling Expectations

### Branch Management
- isomorphic-git or nodegit for Git operations
- Branch name conventions: `feature/<username>/<description>`
- Automatic cleanup of merged branches

### Preview System
- Stage environment with automatic deployments on merge
- Preview URLs per branch (e.g., `preview-<branch-id>.echo-portal.dev`)
- Visual regression testing integration

### PR/Review Linkage
- Internal review system (not external GitHub PRs for content)
- Reviewer notifications (email, in-app)
- Review deadline tracking

### Conflict Handling
- Conflict detection before convergence attempt
- Visual conflict resolution interface
- Rebase assistance tools

## Edge Cases & Testing Strategy

### Environment Drift
- **Scenario**: `dev` diverges significantly from `main` over time
- **Mitigation**: Periodic sync recommendations; conflict detection at merge time
- **Test**: Create branches in dev, advance main independently, verify merge handling

### Preview Failures
- **Scenario**: Stage deployment fails during preview
- **Mitigation**: Deployment health checks; rollback to last known good; clear error messaging
- **Test**: Inject deployment failures, verify graceful degradation and error reporting

### Divergence Between Dev and Main
- **Scenario**: Design team work in dev conflicts with general contributor work merged to main
- **Mitigation**: First-wins blocking; require rebase before merge; clear conflict indicators
- **Test**: Create parallel branches from dev and main with conflicting changes, attempt convergence

### Conflict Scenarios
- **Scenario**: Two approved branches attempt to converge simultaneously
- **Mitigation**: Serialized convergence with first-wins blocking; second branch blocked with clear message
- **Test**: Race condition test with concurrent convergence attempts

### Additional Edge Cases
- **Permission loss during edit**: Session remains valid until save; next operation checks permissions
- **User deactivation**: Branches owned by deactivated users transition to admin ownership or archive
- **Partial convergence failure**: Transaction rollback ensures atomic operation; no partial state
- **Forbidden transitions**: State machine rejects invalid transitions with clear error messages

### Test Strategy Summary
| Category | Approach | Coverage Target |
|----------|----------|-----------------|
| Unit tests | Vitest for models, services, utilities | 80% core workflows |
| Integration tests | API route testing with test database | All state transitions |
| E2E tests | Playwright for full user journeys | All user stories |
| Contract tests | OpenAPI validation | All API endpoints |
| Chaos tests | Failure injection during convergence | Rollback scenarios |
| Performance tests | Load testing concurrent branches | 100 concurrent branches |

## Complexity Tracking

| Aspect | Why Needed | Simpler Alternative Rejected Because |
|--------|------------|-------------------------------------|
| Three environments (dev/stage/main) | Design team needs sandbox for high-frequency iteration; staging enables preview before publish | Single environment (main only) doesn't support preview or team iteration safely |
| Dual entry points | Design team has different needs than casual contributors | Single entry point forces all users through same workflow, friction for simple edits |
| Git-based storage | Native branching, history, merge capabilities; aligns with developer mental model | Custom versioning system would duplicate Git functionality poorly |
| PostgreSQL for metadata | ACID compliance for workflow state, audit logs; better than eventual consistency | NoSQL loses transaction guarantees critical for convergence atomicity |

## Constitution Check (Post-Design)

*Re-evaluation after Phase 1 design completion.*

All 10 principles remain satisfied after detailed design:

- [x] **Explicit Change Control (I)**: ✅ VERIFIED
  - Audit logging captures all operations with actor, timestamp, action
  - AuditLogEntry schema includes comprehensive metadata
  - No silent mutations possible - all state changes through explicit API endpoints

- [x] **Single Source of Truth (II)**: ✅ VERIFIED
  - `main` branch protection enforced at API level
  - Convergence API is only path to modify published state
  - First-wins blocking with conflict detection implemented in contracts

- [x] **Branch-First Collaboration (III)**: ✅ VERIFIED
  - Full lifecycle defined: Draft → Review → Approved → Published → Archived
  - State machine with guards prevents invalid transitions
  - Three-environment model (dev/stage/main) fully designed

- [x] **Separation of Concerns (IV)**: ✅ VERIFIED
  - API contracts clearly separate read (GET) from write (POST/PATCH) operations
  - Authentication optional for reads, required for writes
  - Frontend/backend/shared code structure maintains separation

- [x] **Role-Driven Governance (V)**: ✅ VERIFIED
  - User entity includes roles array
  - Permission matrix defined in data model
  - API contracts enforce role checks (reviewer for approve, publisher for convergence)

- [x] **Open by Default (VI)**: ✅ VERIFIED
  - Visibility enum supports private/team/public
  - Published content readable without authentication
  - API contracts allow anonymous access to public resources

- [x] **Layered Architecture (VII)**: ✅ VERIFIED
  - Core contracts (Branch, Review, Convergence) versioned at /api/v1
  - OpenAPI specifications enable contract-first development
  - Shared types ensure stable interfaces across stack

- [x] **Specification Completeness (VIII)**: ✅ VERIFIED
  - All entities documented with validation rules
  - State transitions with guards defined
  - Audit events enumerated
  - Success criteria measurable

- [x] **Clarity Over Breadth (IX)**: ✅ VERIFIED
  - Complexity justified in tracking table
  - Technology choices documented with alternatives considered
  - No unnecessary abstractions introduced

- [x] **Testing as Contract (X)**: ✅ VERIFIED
  - Test strategy defined with coverage targets
  - Contract tests validate OpenAPI specs
  - 80% coverage target for core workflows
