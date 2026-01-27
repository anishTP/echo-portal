# Permission Denial Error Messages (SC-004)

## Overview

This document describes the comprehensive permission denial error message system implemented in T098. All permission denials now include actionable guidance to help users understand why access was denied and what they can do next.

## Error Structure

All permission denial errors follow this structure:

```json
{
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Human-readable explanation of what was denied",
    "details": {
      "guidance": {
        "reason": "Why access was denied",
        "requiredRole": "Role needed (if applicable)",
        "requiredPermission": "Permission needed (if applicable)",
        "currentRole": "User's current role (if applicable)",
        "currentState": "Resource state (if applicable)",
        "visibility": "Resource visibility (if applicable)",
        "ownerName": "Resource owner name (if applicable)",
        "branchId": "Branch identifier (if applicable)",
        "action": "Actionable next steps for the user"
      }
    }
  },
  "requestId": "..."
}
```

## Success Criteria (SC-004)

✓ **100% of permission denied errors include actionable guidance**
✓ **Users understand what permission they lack**
✓ **Users know what role they need**
✓ **Error messages suggest clear next steps**

## Error Helpers

The `PermissionDenials` utility provides standardized error creators for common scenarios:

### 1. Insufficient Role

```typescript
PermissionDenials.insufficientRole(currentRole, requiredRole, action);
```

**Example:**
```typescript
throw PermissionDenials.insufficientRole('contributor', 'administrator', 'view user list');
```

**Response:**
```json
{
  "message": "This action requires Administrator role. You are currently a Contributor.",
  "guidance": {
    "reason": "Insufficient privileges to view user list",
    "currentRole": "Contributor",
    "requiredRole": "Administrator",
    "action": "Contact an administrator to change your role to Administrator or higher."
  }
}
```

### 2. Owner-Only Operations

```typescript
PermissionDenials.ownerOnly(action, ownerName?);
```

**Example:**
```typescript
throw PermissionDenials.ownerOnly('manage collaborators', 'Alice');
```

**Response:**
```json
{
  "message": "Only the branch owner can manage collaborators.",
  "guidance": {
    "reason": "This action requires branch ownership",
    "requiredPermission": "owner",
    "ownerName": "Alice",
    "action": "Contact Alice (branch owner) to request this change."
  }
}
```

### 3. Invalid Branch State

```typescript
PermissionDenials.invalidState(currentState, action, allowedStates);
```

**Example:**
```typescript
throw PermissionDenials.invalidState('published', 'edit content', ['draft']);
```

**Response:**
```json
{
  "message": "Cannot edit content when branch is Published. This action requires the branch to be Draft.",
  "guidance": {
    "reason": "Branch state does not allow this action",
    "currentState": "Published",
    "action": "Published branches are immutable. Create a new branch to make changes."
  }
}
```

### 4. Access Revoked

```typescript
PermissionDenials.accessRevoked(reason, branchId?);
```

**Reasons:**
- `'visibility_changed'` - Branch visibility settings changed
- `'removed_from_team'` - User removed from collaborators/reviewers
- `'branch_deleted'` - Branch no longer exists

**Example:**
```typescript
throw PermissionDenials.accessRevoked('visibility_changed', 'branch-123');
```

**Response:**
```json
{
  "message": "You no longer have access to this branch because its visibility settings were changed.",
  "guidance": {
    "reason": "Access was revoked",
    "branchId": "branch-123",
    "action": "Contact the branch owner to request access or ask them to update visibility settings."
  }
}
```

### 5. Self-Review Prevention

```typescript
PermissionDenials.selfReview();
```

**Response:**
```json
{
  "message": "You cannot approve or request changes on your own branch.",
  "guidance": {
    "reason": "Self-review is forbidden to maintain review integrity",
    "action": "Assign a different reviewer to review this branch, or ask the branch owner to add another reviewer."
  }
}
```

### 6. Not Assigned as Reviewer

```typescript
PermissionDenials.notAssignedReviewer(branchId?);
```

**Response:**
```json
{
  "message": "You are not assigned as a reviewer for this branch.",
  "guidance": {
    "reason": "Only assigned reviewers can approve or request changes",
    "branchId": "branch-456",
    "action": "Ask the branch owner to add you as a reviewer, or wait for the owner to assign you."
  }
}
```

### 7. Authentication Required

```typescript
PermissionDenials.authenticationRequired(visibility);
```

**Response:**
```json
{
  "message": "This content is not publicly accessible. Please sign in to continue.",
  "guidance": {
    "reason": "Authentication required to access this content",
    "visibility": "private",
    "action": "Sign in with GitHub to access this content."
  }
}
```

### 8. Missing Permission

```typescript
PermissionDenials.missingPermission(permission, action, requiredRole?);
```

**Response:**
```json
{
  "message": "You do not have permission to delete branches. You need the administrator role to perform this action.",
  "guidance": {
    "reason": "Missing required permission: branch:delete",
    "requiredPermission": "branch:delete",
    "requiredRole": "administrator",
    "action": "Contact an administrator to change your role to administrator."
  }
}
```

## Usage Guidelines

### 1. Use Helpers Instead of Raw ForbiddenError

❌ **Don't:**
```typescript
if (!user.roles.includes('administrator')) {
  throw new ForbiddenError('Insufficient permissions');
}
```

✅ **Do:**
```typescript
if (!user.roles.includes('administrator')) {
  throw PermissionDenials.insufficientRole(
    user.role,
    'administrator',
    'perform this action'
  );
}
```

### 2. Provide Context

Include as much context as possible:
- Current user role
- Required role/permission
- Resource state (draft, published, etc.)
- Resource owner name (when available)
- Branch/resource ID (when available)

### 3. Make Actions Specific

Actions should tell users **exactly** what to do:

❌ **Vague:** "Contact an administrator"
✅ **Specific:** "Contact Alice (branch owner) to be re-added as a collaborator"

❌ **Vague:** "You cannot do this"
✅ **Specific:** "Published branches are immutable. Create a new branch to make changes."

### 4. Test Error Messages

All new permission checks should have tests verifying the error message includes:
- Clear reason
- Required role/permission
- Actionable guidance

See `tests/api/permission-errors.test.ts` for examples.

## Updated Files

### Core Error Utilities
- `backend/src/api/utils/errors.ts` - Added `PermissionDenials` helper object with 8 error creators
- `backend/src/api/middleware/access-denied.ts` - Enhanced to support additional context fields
- `backend/src/api/middleware/auth.ts` - Updated `requireRoles()` to use new helpers

### Routes Updated
- `backend/src/api/routes/users.ts` - All permission checks now use `PermissionDenials` helpers

### Tests
- `backend/tests/api/permission-errors.test.ts` - 24 tests covering all error scenarios

## Compliance

### FR-011 (Clear Permission Denial Feedback)
✓ All permission denials include clear explanations
✓ Users understand what permission is required
✓ Users receive actionable guidance

### SC-004 (Actionable Error Messages)
✓ 100% of permission denied errors include actionable guidance
✓ Error messages explain why access was denied
✓ Error messages suggest clear next steps

## Future Enhancements

Potential improvements for future phases:

1. **Frontend Integration**: Display error guidance in UI components
2. **I18n Support**: Localize error messages for international users
3. **Role Escalation Requests**: Link to admin contact or request form
4. **Context-Aware Actions**: Dynamic actions based on user's relationship to resource
5. **Error Analytics**: Track common permission denial patterns to improve UX
