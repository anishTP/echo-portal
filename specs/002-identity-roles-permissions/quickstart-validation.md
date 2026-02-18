# Quickstart Validation Checklist (T099)

**Date:** 2026-01-27
**Phase:** 10 (Polish)
**Status:** Ready for Validation

---

## Validation Procedure

This checklist should be completed by running through the quickstart.md documentation from a fresh installation. Check off each item as it's validated.

---

## Pre-Validation Setup

- [ ] Fresh checkout of repository
- [ ] Clean PostgreSQL database
- [ ] Node.js 20 LTS installed
- [ ] GitHub OAuth app configured
- [ ] Environment variables set

---

## 1. Installation & Setup

### Backend Setup
- [ ] `cd backend && npm install` completes successfully
- [ ] `.env` file created with required variables
- [ ] Database migrations run: `npm run db:migrate`
- [ ] Partitioning migration applied: `psql -f src/db/migrations/0001_setup_partitioning.sql`
- [ ] Performance indexes applied: `psql -f src/db/migrations/0002_audit_log_performance_indexes.sql`
- [ ] Backend starts: `npm run dev`
- [ ] Backend accessible at `http://localhost:3000`
- [ ] No errors in console on startup

### Frontend Setup
- [ ] `cd frontend && npm install` completes successfully
- [ ] Frontend starts: `npm run dev`
- [ ] Frontend accessible at `http://localhost:5173`
- [ ] No errors in console on startup

---

## 2. Authentication Flow (US1)

### GitHub OAuth Integration
- [ ] Navigate to `http://localhost:5173`
- [ ] "Sign in with GitHub" button appears
- [ ] Click button redirects to GitHub
- [ ] Authorize app on GitHub
- [ ] Redirect back to app works
- [ ] User logged in successfully
- [ ] User name/avatar displayed in header
- [ ] Session cookie set (check browser DevTools)
- [ ] Session persists on page reload

### Logout
- [ ] Logout button appears in header
- [ ] Click logout
- [ ] User logged out
- [ ] Session cookie cleared
- [ ] Redirected to landing page

### Account Lockout (FR-002)
- [ ] Attempt login with invalid OAuth (if possible to test)
- [ ] After 5 failed attempts, account locks
- [ ] Locked status visible (if applicable)
- [ ] Unlock after 30 minutes or admin unlock

---

## 3. Role-Based Access (US1, FR-006)

### Viewer Role
- [ ] Unauthenticated user can view public branches
- [ ] Cannot create branches
- [ ] Cannot edit branches
- [ ] Cannot view audit logs
- [ ] Cannot access admin pages

### Contributor Role
- [ ] Can create new branch
- [ ] Can edit own branches
- [ ] Can add collaborators to own branches
- [ ] Cannot edit others' branches (unless collaborator)
- [ ] Cannot approve reviews
- [ ] Cannot publish branches
- [ ] Cannot access admin pages

### Reviewer Role
- [ ] Has contributor permissions
- [ ] Can approve reviews on others' branches
- [ ] Cannot approve own branches (self-review prevention)
- [ ] Can request changes on others' branches
- [ ] Cannot publish branches
- [ ] Cannot access admin pages

### Administrator Role
- [ ] Has reviewer permissions
- [ ] Can publish branches
- [ ] Can access user management page (`/users`)
- [ ] Can access audit log page (`/audit`)
- [ ] Can view performance metrics (`/api/v1/metrics/permissions`)
- [ ] Cannot change own role (FR-009)

---

## 4. Branch Operations (US2)

### Branch Creation
- [ ] Navigate to dashboard
- [ ] Click "Create Branch" button
- [ ] Fill in branch details (title, content)
- [ ] Set visibility (private/team/public)
- [ ] Branch created successfully
- [ ] Branch appears in list
- [ ] Branch ID is valid format

### Branch Editing
- [ ] Open branch in workspace
- [ ] Edit branch content
- [ ] Changes saved
- [ ] State remains "draft"

### Collaborator Management
- [ ] As owner, add collaborator to branch
- [ ] Collaborator can view branch
- [ ] Collaborator can edit branch
- [ ] Remove collaborator
- [ ] Collaborator loses access

### Reviewer Management
- [ ] As owner, assign reviewer to branch
- [ ] Reviewer can view branch
- [ ] Reviewer cannot edit branch (not collaborator)
- [ ] Remove reviewer
- [ ] Reviewer loses review access

---

## 5. Review Workflow (US3)

### Submit for Review
- [ ] Create branch as contributor
- [ ] Assign reviewer
- [ ] Click "Submit for Review"
- [ ] Confirmation dialog appears
- [ ] Submit successful
- [ ] Branch state changes to "in_review"
- [ ] Branch read-only for owner

### Approve Review
- [ ] As reviewer, view review queue
- [ ] Branch appears in queue
- [ ] Open branch for review
- [ ] Click "Approve"
- [ ] Provide approval message
- [ ] Approval successful
- [ ] Branch state changes to "approved"

### Request Changes
- [ ] As reviewer, open branch in review
- [ ] Click "Request Changes"
- [ ] Provide change request details
- [ ] Changes requested
- [ ] Branch state returns to "draft"
- [ ] Owner notified (if notifications implemented)

### Self-Review Prevention (FR-013)
- [ ] As owner, assign self as reviewer (if possible)
- [ ] Submit branch for review
- [ ] Attempt to approve own branch
- [ ] Approval fails with error message
- [ ] Error indicates self-review forbidden

---

## 6. Publishing (US4)

### Publish Branch
- [ ] As administrator, view approved branch
- [ ] Click "Publish" button
- [ ] Confirmation dialog appears
- [ ] Confirm publish
- [ ] Branch state changes to "published"
- [ ] Branch becomes immutable
- [ ] Branch visible to public viewers

### Immutability Verification
- [ ] Attempt to edit published branch
- [ ] Edit fails with appropriate error
- [ ] Error message suggests creating new branch

---

## 7. User Management (US7)

### View Users
- [ ] As administrator, navigate to `/users`
- [ ] User list displays
- [ ] Shows all users with roles
- [ ] Shows last login times
- [ ] Shows active/inactive status

### Change User Role
- [ ] Click "Change Role" on a user
- [ ] Dialog appears with role selector
- [ ] Select different role
- [ ] Confirm change
- [ ] Role updated
- [ ] Audit log entry created

### Role Change Validation
- [ ] Attempt to change own role
- [ ] Operation fails with error
- [ ] Error message explains self-role-change forbidden

### Unlock User Account
- [ ] Find locked user (if any)
- [ ] Click "Unlock" button
- [ ] User unlocked
- [ ] Locked status cleared
- [ ] Audit log entry created

---

## 8. Audit Logging (US6)

### View Audit Logs
- [ ] As administrator, navigate to `/audit`
- [ ] Audit log viewer displays
- [ ] Shows recent activity
- [ ] Pagination works

### Filter Audit Logs
- [ ] Filter by resource type (branch, user, etc.)
- [ ] Filter by action
- [ ] Filter by date range
- [ ] Filters work correctly
- [ ] Results update

### Security Reports
- [ ] Switch to "Security Reports" tab
- [ ] Failed login report displays
- [ ] Permission denial report displays
- [ ] Statistics are accurate

### Performance (SC-006)
- [ ] Query audit logs with filters
- [ ] Results return in <5 seconds
- [ ] No noticeable lag

---

## 9. Error Handling (T098, SC-004)

### Permission Denial Errors
- [ ] As contributor, attempt admin action
- [ ] Error message displays
- [ ] Message explains what was denied
- [ ] Message shows current role
- [ ] Message shows required role
- [ ] Message includes actionable guidance
- [ ] Message suggests next steps

### Other Error Scenarios
- [ ] Invalid input (malformed data)
- [ ] Error message clear and helpful
- [ ] No stack traces visible
- [ ] Request ID provided for support

---

## 10. Performance (T100, SC-003)

### Permission Check Performance
- [ ] As administrator, view metrics: `GET /api/v1/metrics/permissions`
- [ ] P95 latency < 10ms
- [ ] Average latency < 1ms
- [ ] No slow checks (> 10ms) in recent activity

### Page Load Performance
- [ ] Dashboard loads in < 2 seconds
- [ ] Branch workspace loads in < 2 seconds
- [ ] No perceived lag in UI
- [ ] Permission checks feel instant

---

## 11. Security Validation (T102)

### Session Security
- [ ] Session cookie has HttpOnly flag
- [ ] Session cookie has Secure flag (production)
- [ ] Session cookie has SameSite=Lax
- [ ] Session expires after 24 hours inactivity

### OAuth Security
- [ ] State parameter used in OAuth flow
- [ ] Redirect URI validated
- [ ] Authorization code used once
- [ ] No tokens stored in database

### Input Validation
- [ ] Try XSS in branch title: `<script>alert('XSS')</script>`
- [ ] XSS attempt rejected or sanitized
- [ ] Try SQL injection in search: `'; DROP TABLE branches; --`
- [ ] SQL injection prevented

---

## 12. API Endpoints

### Branches API
- [ ] `GET /api/v1/branches` - List branches
- [ ] `POST /api/v1/branches` - Create branch
- [ ] `GET /api/v1/branches/:id` - Get branch
- [ ] `PUT /api/v1/branches/:id` - Update branch
- [ ] `DELETE /api/v1/branches/:id` - Delete branch (admin)

### Users API
- [ ] `GET /api/v1/users` - List users (admin)
- [ ] `GET /api/v1/users/:id` - Get user
- [ ] `PUT /api/v1/users/:id/role` - Change role (admin)
- [ ] `POST /api/v1/users/:id/unlock` - Unlock account (admin)

### Audit API
- [ ] `GET /api/v1/audit` - Query audit logs (admin)
- [ ] `GET /api/v1/audit/failed-logins` - Failed login report (admin)
- [ ] `GET /api/v1/audit/permission-denials` - Permission denial report (admin)

### Metrics API
- [ ] `GET /api/v1/metrics/permissions` - Permission performance (admin)
- [ ] `POST /api/v1/metrics/permissions/reset` - Reset metrics (admin)

---

## 13. Database Validation

### Schema
- [ ] `users` table exists with correct columns
- [ ] `sessions` table exists with correct columns
- [ ] `branches` table exists with correct columns
- [ ] `audit_logs` table exists and is partitioned
- [ ] All foreign keys in place

### Indexes
- [ ] `sessions_token_idx` exists
- [ ] `audit_logs_resource_idx` exists
- [ ] `audit_logs_resource_timestamp_idx` exists (T101)
- [ ] `audit_logs_action_timestamp_idx` exists (T101)
- [ ] `audit_logs_outcome_timestamp_idx` exists (T101)
- [ ] All indexes from migrations present

### Data Integrity
- [ ] No orphaned records
- [ ] Foreign key constraints enforced
- [ ] Audit logs immutable (cannot UPDATE/DELETE)

---

## 14. Documentation Validation

### README
- [ ] Installation instructions accurate
- [ ] Environment variables documented
- [ ] Commands work as documented

### Quickstart
- [ ] All examples work
- [ ] Screenshots match current UI (if any)
- [ ] Links work
- [ ] No outdated information

### API Documentation
- [ ] Endpoints documented
- [ ] Request/response examples accurate
- [ ] Authentication requirements clear
- [ ] Error responses documented

---

## Issues Found

Document any issues discovered during validation:

| Issue | Severity | Description | Status |
|-------|----------|-------------|--------|
| (example) | Low | Button text unclear | Fixed |

---

## Validation Sign-off

**Validator:** ______________________
**Date:** __________________________
**Result:** ☐ Pass ☐ Fail ☐ Pass with Issues

**Notes:**

---

**Recommended Next Steps:**
1. Fix any identified issues
2. Re-validate affected areas
3. Update documentation as needed
4. Mark T099 as complete
