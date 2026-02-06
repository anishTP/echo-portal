# Phase Patterns

Real-world examples from production use.

## Full-Stack Feature (API + UI)

```markdown
## Phases Structure

- **Epic**: `grid-c64a` (Output Schema Support - Phase 2)
- **Phase 2: Prerequisites**: `grid-5d3e` - ✅ **COMPLETED** (2025-11-25)
- **Phase 2A: Schema Inferences**: `grid-daf8` - ✅ **COMPLETED** (2025-11-26)
- **Phase 2B: Schema Validations**: `grid-d93b` - ✅ **COMPLETED** (2025-11-27)
- **Phase 3: Webapp UI**: `grid-bf46` - 🔄 **In Progress**

## Implementation Strategy

1. **Phase 2: Prerequisites** (P1) - ✅ **COMPLETED**
   - ✅ Fix schema preservation bug in `UpsertOutputs`
   - ✅ All Phase 1 integration tests passing

2. **Phase 2A: Schema Inferences** (P2) - ✅ **COMPLETED** (2025-11-26)
   - ✅ Database migration (schema_source + validation columns)
   - ✅ Inference service using `jsonschema-infer v0.1.2`
   - ✅ Repository interface extensions
   - ✅ 10 integration tests passing (FR-019 through FR-028)
   - **Bug Fixed**: JSON double-encoding in inferrer.go
   - **Tasks Closed**: grid-5d22, grid-9461, grid-befd, grid-3f9b, grid-1845
```

## React Feature

```markdown
## Phases Structure

- **Epic**: `auth-a1b2` (User Authentication)
- **Phase 1: Setup**: `auth-c3d4` - ✅ **COMPLETED**
- **Phase 2: Tests First**: `auth-e5f6` - 🔄 **In Progress**
- **Phase 3: Components**: `auth-g7h8` - ⬜ **Pending**

## Phase 1: Setup
- [x] T001 Add deps to package.json: `react-router-dom`, `@tanstack/react-query`
- [x] T002 Create `src/test/setup.ts` with testing-library config
- [x] T003 Add `src/types/auth.ts` with User, AuthState interfaces

## Phase 2: Tests First (TDD) ⚠️
- [ ] T004 [P] Add `src/hooks/__tests__/useAuth.test.ts`
- [ ] T005 [P] Add `src/components/__tests__/LoginForm.test.tsx`
```

## Backend API

```markdown
## Phases Structure

- **Epic**: `api-x1y2` (Payment Processing)
- **Phase 1: Contracts**: `api-a1b1` - ✅ **COMPLETED**
- **Phase 2: Repository**: `api-c1d1` - 🔄 **In Progress**
- **Phase 3: Service**: `api-e1f1` - ⬜ **Pending**

## Phase 1: Contracts
- [x] T001 Define `proto/payment/v1/payment.proto`
- [x] T002 Add `contracts/payment_service.yaml` OpenAPI spec
- [x] T003 Generate Go stubs with `buf generate`

## Phase 2: Repository
- [ ] T004 Add migration `migrations/004_payments.sql`
- [ ] T005 Create `internal/repository/payment.go` interface
- [ ] T006 [P] Add `internal/repository/postgres/payment_test.go`
```

## Status Icons

| Icon | Meaning |
|------|---------|
| ⬜ | Pending |
| 🔄 | In Progress |
| ✅ | Completed |
| ⚠️ | Blocked/Warning |
