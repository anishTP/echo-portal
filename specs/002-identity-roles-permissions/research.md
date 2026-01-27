# Research: Identity, Roles, and Permissions

**Feature**: 002-identity-roles-permissions
**Date**: 2026-01-24
**Status**: Complete

## Research Summary

This document consolidates research findings for implementing the identity, roles, and permissions system. All NEEDS CLARIFICATION items from the specification have been resolved through the clarification session and codebase exploration.

---

## 1. Authentication Architecture

### Decision: OAuth2 with Arctic Library

**Rationale**: The codebase already includes `arctic` 3.5.0 for OAuth authentication with providers configured (GitHub, Google, SAML). Extending this existing infrastructure is lower risk than introducing a new authentication system.

**Implementation Approach**:
- Use Arctic's provider abstractions for GitHub and Google OAuth flows
- Implement session management with database-backed sessions (PostgreSQL)
- 24-hour sliding expiry (reset on each authenticated request, no refresh tokens)
- Graceful degradation: existing sessions continue when OAuth provider unavailable

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| JWT-only (stateless) | Cannot revoke sessions immediately on role change; 30-second requirement needs server-side session |
| Auth0/Clerk | Additional external dependency; existing Arctic setup sufficient |
| Custom username/password | OAuth2 is industry standard; reduces password management burden |

---

## 2. Session Management

### Decision: Database-Backed Sessions with In-Memory Cache

**Rationale**: Spec requires role changes to take effect within 30 seconds without re-authentication (SC-007). Database-backed sessions allow immediate invalidation while cache provides performance.

**Implementation Approach**:
- New `sessions` table: id, user_id, token_hash, expires_at, created_at, last_activity_at
- Session token in HTTP-only secure cookie
- Cache session lookups with 30-second TTL (matches role change requirement)
- On role change, invalidate cache entry to force re-fetch

**Session Lifecycle**:
```
Create → Active (with periodic refresh) → Expired/Invalidated → Deleted
```

**Graceful Degradation**:
- If OAuth provider unavailable: existing sessions continue working
- New login attempts fail with retry message
- Anonymous viewing remains available (FR-005c, FR-005d)

---

## 3. Role Model

### Decision: 4-Role Hierarchy with Viewer as Implicit Anonymous

**Rationale**: Spec defines 4 roles (Viewer, Contributor, Reviewer, Administrator). Current codebase has contributor, reviewer, publisher, administrator. Align naming while preserving existing functionality.

**Role Mapping**:
| Spec Role | Implementation | Notes |
|-----------|----------------|-------|
| Viewer | Anonymous (no auth) | Implicit role, not stored in DB |
| Contributor | `contributor` | Existing role, unchanged |
| Reviewer | `reviewer` | Existing role, unchanged |
| Administrator | `administrator` | Combines publisher + admin; spec consolidates these |

**Permission Inheritance**:
```
Administrator > Reviewer > Contributor > Viewer
```

Each role inherits all permissions of lower roles plus additional capabilities.

**Role Assignment Rules**:
- New users default to Contributor (after first OAuth login)
- Only Administrators can change roles (FR-010)
- Role stored in `users.roles` array (existing schema)

---

## 4. Permission Evaluation Model

### Decision: Contextual Permission Function with Caching

**Rationale**: Permissions must be evaluated in context of active branch, lifecycle state, content visibility, and actor role (FR-011). The existing `permissions.ts` service provides foundation but needs extension.

**Context Parameters**:
```typescript
interface PermissionContext {
  actor: AuthUser | null;           // null = anonymous viewer
  branch?: Branch;                  // active branch (if applicable)
  branchState?: BranchState;        // draft, review, approved, published, archived
  visibility?: Visibility;          // private, team, public
  resourceOwnerId?: string;         // for ownership checks
  assignedReviewers?: string[];     // for reviewer access checks
  collaborators?: string[];         // for collaborator access checks
}
```

**Evaluation Order**:
1. Check authentication requirement
2. Check role-based permission
3. Check resource-specific access (ownership, assignment, collaboration)
4. Check lifecycle state constraints
5. Check visibility rules

**Performance Target**: <10ms per evaluation (cached role lookups)

---

## 5. Self-Review Prevention

### Decision: Explicit Check in Review Transition Logic

**Rationale**: FR-013 requires self-review prevention. Must be enforced at both API and service layer.

**Implementation**:
```typescript
// In review approval logic
if (actor.id === branch.ownerId) {
  throw new ForbiddenError('Self-review is not permitted');
}
```

**Edge Cases**:
- Collaborators cannot review branches they contributed to
- Reviewer assignment must exclude branch owner
- Audit log captures all self-review attempts

---

## 6. Configurable Approval Thresholds

### Decision: Branch-Level Configuration with System Default

**Rationale**: Clarification confirmed admin-configurable thresholds per branch only (content type scoping deferred). Default to single approval (FR-013b).

**Implementation**:
- Add `required_approvals` field to branches table (default: 1)
- Track approval count in reviews table
- Transition to Approved only when `approval_count >= required_approvals`

**Threshold Rules**:
- Minimum: 1 (cannot bypass review entirely)
- Maximum: 10 (reasonable upper bound)
- Only Administrators can change threshold
- Threshold changes do not affect in-progress reviews

---

## 7. Failed Login Attempt Handling

### Decision: Account Lockout with Tracking Table

**Rationale**: Clarification specified 15-minute lockout after 5 failed attempts (FR-005a).

**Implementation**:
- New `login_attempts` table: user_email, attempt_at, ip_address, success
- Count failed attempts in 15-minute window
- Lock account when count >= 5
- Clear attempts on successful login
- Log all attempts for security monitoring (FR-005b)

**Lockout Response**:
```json
{
  "error": "account_locked",
  "message": "Account temporarily locked due to failed login attempts",
  "retry_after_seconds": 900,
  "locked_until": "2026-01-24T12:15:00Z"
}
```

---

## 8. Reviewer Assignment

### Decision: Explicit Assignment with Minimum Requirement

**Rationale**: Clarification confirmed explicit assignment model (FR-017a).

**Implementation**:
- Add `assigned_reviewers` array to branches table
- Require at least one reviewer before Draft → Review transition
- Branch owner or Admin can assign reviewers
- Assigned reviewers notified on transition

**Assignment Rules**:
- Cannot assign branch owner as reviewer
- Reviewers must have Reviewer or Administrator role
- Collaborators cannot be assigned as reviewers (conflict of interest)

---

## 9. Collaborator Access

### Decision: Owner-Managed Collaboration During Draft State

**Rationale**: Clarification confirmed owners can invite collaborators (FR-017b).

**Implementation**:
- Add `collaborators` array to branches table
- Collaborators have edit access during Draft state only
- Collaborators retain read-only access when branch transitions to Review or Approved
- Collaborators and reviewers are mutually exclusive per branch (FR-017c)

**Visibility Impact**:
- Draft: Owner + Collaborators can view and edit
- Review/Approved: Collaborators retain read-only access but not edit

---

## 10. Audit Logging Strategy

### Decision: Event-Sourced Audit Log with Structured Metadata

**Rationale**: Spec requires 7-year retention (FR-023), queryable by admins (FR-024), capturing 100% of state transitions (SC-005).

**Existing Infrastructure**: `audit-logs` table and `AuditService` exist.

**Extensions Needed**:
- Add permission decision events (granted/denied)
- Add AI-assisted action tracking (actor + initiating_user)
- Add role change events
- Add failed login attempt logging

**Event Types**:
```typescript
type AuditEventType =
  | 'auth.login' | 'auth.logout' | 'auth.failed' | 'auth.locked'
  | 'role.changed'
  | 'permission.granted' | 'permission.denied'
  | 'branch.created' | 'branch.transitioned' | 'branch.published'
  | 'review.assigned' | 'review.approved' | 'review.rejected'
  | 'collaborator.added' | 'collaborator.removed';
```

**Query Performance**: Index on `(resource_id, timestamp)` and `(actor_id, timestamp)` for <5 second query requirement (SC-006).

---

## 11. Frontend Permission Display

### Decision: Permission-Aware Component Gating

**Rationale**: Users must determine permissions within 2 seconds (SC-003).

**Implementation**:
- `usePermissions` hook fetches user permissions on mount
- `PermissionGate` component conditionally renders children
- `AccessDenied` component shows actionable guidance (SC-004)
- `RoleBadge` component displays current role

**Permission Caching**:
- Cache permissions in AuthContext
- Refresh on focus/visibility change
- Invalidate on 403 responses

---

## 12. Graceful Degradation

### Decision: Tiered Service Availability

**Rationale**: Clarification confirmed existing sessions continue when OAuth unavailable.

**Implementation Tiers**:

| Scenario | Behavior |
|----------|----------|
| OAuth available | Full functionality |
| OAuth unavailable, session valid | Authenticated features work, no new logins |
| OAuth unavailable, no session | Anonymous viewing only |
| Database unavailable | Service unavailable (no graceful path) |

**Detection**:
- Health check endpoint for OAuth providers
- Circuit breaker pattern for OAuth calls
- Clear error messages with retry guidance

---

## Unresolved Items

None. All NEEDS CLARIFICATION items resolved through:
1. Clarification session (5 questions answered)
2. Codebase exploration (existing patterns identified)
3. Best practices research (industry standards applied)

---

## References

- [spec.md](./spec.md) - Feature specification
- [constitution.md](../../.specify/memory/constitution.md) - Project constitution
- [Arctic OAuth Library](https://github.com/pilcrowOnPaper/arctic) - OAuth implementation
- [Drizzle ORM](https://orm.drizzle.team/) - Database ORM
- Existing codebase: `backend/src/services/auth/permissions.ts`
