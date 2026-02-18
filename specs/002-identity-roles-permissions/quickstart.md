# Quickstart: Identity, Roles, and Permissions

**Feature**: 002-identity-roles-permissions
**Date**: 2026-01-24

This guide walks through the key workflows for the identity, roles, and permissions system.

---

## Prerequisites

- Echo Portal running locally (`pnpm dev`)
- PostgreSQL database with migrations applied (`pnpm db:migrate`)
- OAuth provider configured (GitHub or Google)

---

## 1. Authentication Flow

### Sign In with OAuth

1. Click "Sign In" button in the UI
2. Select OAuth provider (GitHub or Google)
3. Authorize Echo Portal on the provider
4. Redirect back to Echo Portal with session established

```bash
# API flow (for reference)
GET /api/v1/auth/login/github?redirect_uri=/dashboard
# → Redirects to GitHub OAuth
# → GitHub redirects to /api/v1/auth/callback/github?code=...&state=...
# → Session cookie set, redirects to /dashboard
```

### Check Current User

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Cookie: echo_session=<session_token>"
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "displayName": "Jane Doe",
  "roles": ["contributor"],
  "permissions": ["branch.create", "branch.view", "branch.edit"]
}
```

### Sign Out

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Cookie: echo_session=<session_token>"
```

---

## 2. Role-Based Access

### Role Hierarchy

| Role | Inherits From | Additional Capabilities |
|------|---------------|------------------------|
| **Contributor** | - | Create branches, edit own drafts, submit for review |
| **Reviewer** | Contributor | Review branches, approve/reject (not own work) |
| **Administrator** | Reviewer | Publish, manage users, view audit logs |

### Check Permissions for a Branch

```bash
curl -X GET http://localhost:3000/api/v1/branches/{branchId}/permissions \
  -H "Cookie: echo_session=<session_token>"
```

Response:
```json
{
  "branchId": "branch-uuid",
  "canView": true,
  "canEdit": true,
  "canSubmitForReview": true,
  "canReview": false,
  "canApprove": false,
  "canPublish": false,
  "isOwner": true,
  "isCollaborator": false,
  "isAssignedReviewer": false
}
```

---

## 3. Branch Collaboration

### Add a Collaborator (Draft State Only)

```bash
curl -X POST http://localhost:3000/api/v1/branches/{branchId}/collaborators \
  -H "Cookie: echo_session=<session_token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "collaborator-uuid"}'
```

### Assign Reviewers Before Submitting

```bash
# Assign a reviewer
curl -X POST http://localhost:3000/api/v1/branches/{branchId}/reviewers \
  -H "Cookie: echo_session=<session_token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "reviewer-uuid"}'

# Check assigned reviewers
curl -X GET http://localhost:3000/api/v1/branches/{branchId}/reviewers \
  -H "Cookie: echo_session=<session_token>"
```

Response:
```json
{
  "reviewers": [
    {
      "userId": "reviewer-uuid",
      "email": "reviewer@example.com",
      "displayName": "Reviewer Name",
      "assignedAt": "2026-01-24T10:00:00Z",
      "status": "pending"
    }
  ],
  "requiredApprovals": 1,
  "currentApprovals": 0
}
```

---

## 4. Review and Approval

### Submit for Review (Contributor)

```bash
# Must have at least one reviewer assigned
curl -X POST http://localhost:3000/api/v1/branches/{branchId}/submit-for-review \
  -H "Cookie: echo_session=<session_token>"
```

### Approve a Branch (Reviewer)

```bash
# Only assigned reviewers can approve
# Cannot approve your own branch
curl -X POST http://localhost:3000/api/v1/branches/{branchId}/approve \
  -H "Cookie: echo_session=<session_token>"
```

### Request Changes (Reviewer)

```bash
curl -X POST http://localhost:3000/api/v1/branches/{branchId}/request-changes \
  -H "Cookie: echo_session=<session_token>" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Please address the following..."}'
```

---

## 5. Publication (Administrator)

### Publish Approved Content

```bash
# Only administrators can publish
# Branch must be in "approved" state
curl -X POST http://localhost:3000/api/v1/branches/{branchId}/publish \
  -H "Cookie: echo_session=<session_token>"
```

---

## 6. User Management (Administrator)

### List Users

```bash
curl -X GET "http://localhost:3000/api/v1/users?page=1&limit=20" \
  -H "Cookie: echo_session=<session_token>"
```

### Change User Role

```bash
curl -X PUT http://localhost:3000/api/v1/users/{userId}/role \
  -H "Cookie: echo_session=<session_token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "reviewer", "reason": "Promoted to reviewer after training"}'
```

### Unlock a Locked Account

```bash
curl -X POST http://localhost:3000/api/v1/users/{userId}/unlock \
  -H "Cookie: echo_session=<session_token>"
```

---

## 7. Audit Logs (Administrator)

### Query Audit History for a Branch

```bash
curl -X GET "http://localhost:3000/api/v1/audit/branches/{branchId}" \
  -H "Cookie: echo_session=<session_token>"
```

### View Security Events

```bash
# Failed login attempts
curl -X GET "http://localhost:3000/api/v1/audit/security/failed-logins?startDate=2026-01-01T00:00:00Z&endDate=2026-01-24T23:59:59Z" \
  -H "Cookie: echo_session=<session_token>"

# Permission denials
curl -X GET "http://localhost:3000/api/v1/audit/security/permission-denials?startDate=2026-01-01T00:00:00Z&endDate=2026-01-24T23:59:59Z" \
  -H "Cookie: echo_session=<session_token>"
```

---

## 8. Error Handling

### Permission Denied Response

All permission denials include actionable guidance:

```json
{
  "error": "permission_denied",
  "message": "You do not have permission to approve this branch",
  "requiredPermission": "review.approve",
  "currentRole": "contributor",
  "guidance": "Contact a reviewer or administrator to have this branch reviewed"
}
```

### Account Locked Response

```json
{
  "error": "account_locked",
  "message": "Account temporarily locked due to failed login attempts",
  "lockedUntil": "2026-01-24T12:15:00Z",
  "retryAfterSeconds": 900
}
```

---

## 9. Frontend Components

### PermissionGate Component

```tsx
import { PermissionGate } from '@/components/permissions/PermissionGate';

// Only renders children if user has permission
<PermissionGate permission="branch.edit" branchId={branch.id}>
  <EditButton onClick={handleEdit} />
</PermissionGate>
```

### usePermissions Hook

```tsx
import { usePermissions } from '@/hooks/usePermissions';

function BranchActions({ branchId }) {
  const { permissions, loading } = usePermissions(branchId);

  if (loading) return <Spinner />;

  return (
    <div>
      {permissions.canEdit && <EditButton />}
      {permissions.canSubmitForReview && <SubmitButton />}
      {permissions.canApprove && <ApproveButton />}
    </div>
  );
}
```

### AccessDenied Component

```tsx
import { AccessDenied } from '@/components/permissions/AccessDenied';

// Shows actionable guidance when access is denied
<AccessDenied
  requiredPermission="review.approve"
  currentRole={user.roles[0]}
  guidance="Contact an administrator to be assigned as a reviewer"
/>
```

---

## Verification Checklist

- [ ] Can sign in with OAuth (GitHub/Google)
- [ ] User profile shows correct role and permissions
- [ ] Contributor can create branch and add collaborators
- [ ] Contributor cannot approve own branch (error shown)
- [ ] Reviewer can approve branch they didn't create
- [ ] Administrator can publish approved content
- [ ] Administrator can change user roles
- [ ] Account locks after 5 failed login attempts
- [ ] Audit logs capture all state transitions
- [ ] Published content is immutable (modification denied)
