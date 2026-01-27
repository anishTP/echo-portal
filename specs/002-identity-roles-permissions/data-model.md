# Data Model: Identity, Roles, and Permissions

**Feature**: 002-identity-roles-permissions
**Date**: 2026-01-24
**Status**: Complete

## Overview

This document defines the data model extensions required for the identity, roles, and permissions system. It builds on the existing Drizzle ORM schema in `backend/src/db/schema/`.

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │       │    sessions     │       │ login_attempts  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │       │ id (PK)         │
│ email           │  │    │ user_id (FK)    │───────│ user_email      │
│ display_name    │  │    │ token_hash      │       │ ip_address      │
│ roles[]         │  │    │ expires_at      │       │ user_agent      │
│ status          │  │    │ created_at      │       │ attempt_at      │
│ locked_until    │  │    │ last_activity   │       │ success         │
│ failed_attempts │  │    └─────────────────┘       │ failure_reason  │
│ auth_provider   │  │                              └─────────────────┘
│ provider_id     │  │
│ created_at      │  │    ┌─────────────────┐
│ updated_at      │  │    │    branches     │
└─────────────────┘  │    ├─────────────────┤
                     │    │ id (PK)         │
                     └────│ owner_id (FK)   │
                          │ collaborators[] │
                          │ reviewers[]     │
                          │ required_approvals│
                          │ state           │
                          │ visibility      │
                          │ ...existing...  │
                          └─────────────────┘
                                  │
                                  │
                          ┌───────┴───────┐
                          │               │
                   ┌──────┴──────┐ ┌──────┴──────┐
                   │   reviews   │ │ audit_logs  │
                   ├─────────────┤ ├─────────────┤
                   │ id (PK)     │ │ id (PK)     │
                   │ branch_id   │ │ actor_id    │
                   │ reviewer_id │ │ action      │
                   │ status      │ │ resource_id │
                   │ decision    │ │ outcome     │
                   │ ...         │ │ metadata    │
                   └─────────────┘ │ timestamp   │
                                   └─────────────┘
```

---

## New Tables

### sessions

Manages authenticated user sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | Unique session identifier |
| user_id | uuid | FK → users.id, NOT NULL | Associated user |
| token_hash | varchar(64) | NOT NULL, UNIQUE | SHA-256 hash of session token |
| expires_at | timestamp | NOT NULL | Session expiration time |
| created_at | timestamp | NOT NULL, default now() | Session creation time |
| last_activity_at | timestamp | NOT NULL, default now() | Last activity timestamp |
| ip_address | inet | | Client IP for audit |
| user_agent | text | | Client user agent for audit |

**Indexes**:
- `idx_sessions_user_id` on (user_id)
- `idx_sessions_token_hash` on (token_hash) - for fast lookup
- `idx_sessions_expires_at` on (expires_at) - for cleanup queries

**Drizzle Schema**:
```typescript
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
});
```

---

### login_attempts

Tracks authentication attempts for security monitoring and lockout.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | Unique attempt identifier |
| user_email | varchar(255) | NOT NULL | Email attempted (may not exist) |
| ip_address | inet | NOT NULL | Client IP address |
| user_agent | text | | Client user agent |
| attempt_at | timestamp | NOT NULL, default now() | Attempt timestamp |
| success | boolean | NOT NULL | Whether attempt succeeded |
| failure_reason | varchar(100) | | Reason for failure if applicable |

**Indexes**:
- `idx_login_attempts_email_time` on (user_email, attempt_at DESC) - for lockout check
- `idx_login_attempts_ip_time` on (ip_address, attempt_at DESC) - for IP-based analysis

**Drizzle Schema**:
```typescript
export const loginAttempts = pgTable('login_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  ipAddress: inet('ip_address').notNull(),
  userAgent: text('user_agent'),
  attemptAt: timestamp('attempt_at').notNull().defaultNow(),
  success: boolean('success').notNull(),
  failureReason: varchar('failure_reason', { length: 100 }),
});
```

---

## Extended Tables

### users (extensions)

Add lockout tracking fields to existing users table.

| New Column | Type | Constraints | Description |
|------------|------|-------------|-------------|
| locked_until | timestamp | | Account locked until this time |
| failed_login_count | integer | NOT NULL, default 0 | Consecutive failed attempts |
| last_failed_login_at | timestamp | | Last failed attempt time |

**Migration**:
```typescript
// Add to existing users table
await db.schema.alterTable('users')
  .addColumn('locked_until', 'timestamp')
  .addColumn('failed_login_count', 'integer', (col) => col.notNull().default(0))
  .addColumn('last_failed_login_at', 'timestamp')
  .execute();
```

---

### branches (extensions)

Add collaboration and approval threshold fields.

| New Column | Type | Constraints | Description |
|------------|------|-------------|-------------|
| collaborators | uuid[] | default '{}' | User IDs with edit access |
| assigned_reviewers | uuid[] | default '{}' | User IDs assigned to review |
| required_approvals | integer | NOT NULL, default 1 | Approvals needed for state transition |

**Migration**:
```typescript
// Add to existing branches table
await db.schema.alterTable('branches')
  .addColumn('collaborators', 'uuid[]', (col) => col.default('{}'))
  .addColumn('assigned_reviewers', 'uuid[]', (col) => col.default('{}'))
  .addColumn('required_approvals', 'integer', (col) => col.notNull().default(1))
  .execute();
```

**Validation Rules**:
- `required_approvals` must be between 1 and 10
- `collaborators` cannot include `owner_id`
- `assigned_reviewers` cannot include `owner_id`
- `assigned_reviewers` cannot include any `collaborators`

---

### audit_logs (extensions)

Extend existing audit log for permission events.

| New Column | Type | Constraints | Description |
|------------|------|-------------|-------------|
| outcome | varchar(20) | NOT NULL | 'success' or 'denied' |
| initiating_user_id | uuid | FK → users.id | For AI-assisted actions |

**New Action Types**:
```typescript
// Extend existing AuditAction enum
export const auditActionEnum = pgEnum('audit_action', [
  // Existing actions...
  'auth.login',
  'auth.logout',
  'auth.failed',
  'auth.locked',
  'auth.session_expired',
  'role.changed',
  'permission.granted',
  'permission.denied',
  'collaborator.added',
  'collaborator.removed',
  'reviewer.assigned',
  'reviewer.unassigned',
]);
```

**Indexes** (new):
- `idx_audit_logs_actor_time` on (actor_id, timestamp DESC) - for user activity queries
- `idx_audit_logs_resource_time` on (resource_id, timestamp DESC) - for resource history

---

## Enums

### Role Enum (extension)

```typescript
// Extend existing role enum to include explicit viewer concept
export const userRoleEnum = pgEnum('user_role', [
  'viewer',       // Anonymous, not stored in DB (implicit)
  'contributor',  // Existing
  'reviewer',     // Existing
  'administrator' // Existing (absorbs publisher)
]);
```

Note: 'viewer' is conceptual for permission checks but not stored in users.roles since anonymous users have no DB record.

---

### Branch State Enum (existing, unchanged)

```typescript
export const branchStateEnum = pgEnum('branch_state', [
  'draft',
  'review',
  'approved',
  'published',
  'archived'
]);
```

---

### Visibility Enum (existing, unchanged)

```typescript
export const visibilityEnum = pgEnum('visibility', [
  'private',
  'team',
  'public'
]);
```

---

## Validation Rules

### User

| Field | Rule |
|-------|------|
| email | Valid email format, unique |
| roles | At least one role required for authenticated users |
| locked_until | If set, must be in the future |
| failed_login_count | Reset to 0 on successful login |

### Session

| Field | Rule |
|-------|------|
| token_hash | SHA-256 of random 32-byte token |
| expires_at | 24 hours from last activity (sliding expiry; reset on each authenticated request) |
| last_activity_at | Updated on each authenticated request |

### Branch (permission-related)

| Field | Rule |
|-------|------|
| collaborators | Max 20 users |
| assigned_reviewers | Min 1 required for Draft → Review transition |
| required_approvals | Between 1 and 10, cannot exceed assigned_reviewers count |

### Login Attempt

| Field | Rule |
|-------|------|
| user_email | Stored even if user doesn't exist (for attack detection) |
| failure_reason | One of: 'invalid_credentials', 'account_locked', 'provider_error' |

---

## State Transitions

### Account Lockout State Machine

```
┌─────────┐   5 failed    ┌────────┐   15 min    ┌─────────┐
│ Active  │ ────────────► │ Locked │ ──────────► │ Active  │
└─────────┘   attempts    └────────┘   elapsed   └─────────┘
     │                                                │
     │ successful login                               │
     └────────────────────────────────────────────────┘
           (resets failed_login_count to 0)
```

### Branch Visibility Access Matrix

| State | Owner | Collaborators | Assigned Reviewers | Administrators | Public |
|-------|-------|---------------|-------------------|----------------|--------|
| Draft | RW | RW | - | RW | - |
| Review | R | R | RW | RW | - |
| Approved | R | R | R | RW | - |
| Published | R | R | R | R | R (if public) |
| Archived | R | R | R | R | R (if was public) |

Legend: R = Read, W = Write, RW = Read+Write, - = No access

---

## Indexes Summary

| Table | Index Name | Columns | Purpose |
|-------|------------|---------|---------|
| sessions | idx_sessions_user_id | user_id | Find user's sessions |
| sessions | idx_sessions_token_hash | token_hash | Session lookup |
| sessions | idx_sessions_expires_at | expires_at | Cleanup expired |
| login_attempts | idx_login_attempts_email_time | user_email, attempt_at | Lockout check |
| login_attempts | idx_login_attempts_ip_time | ip_address, attempt_at | IP analysis |
| audit_logs | idx_audit_logs_actor_time | actor_id, timestamp | User activity |
| audit_logs | idx_audit_logs_resource_time | resource_id, timestamp | Resource history |

---

## Migration Order

1. Add enums (audit_action extensions)
2. Create login_attempts table
3. Create sessions table
4. Alter users table (add lockout fields)
5. Alter branches table (add collaboration fields)
6. Alter audit_logs table (add outcome, initiating_user_id)
7. Create new indexes
