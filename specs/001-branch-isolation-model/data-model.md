# Data Model: Branch Isolation Model

**Branch**: `001-branch-isolation-model` | **Date**: 2026-01-21

## Overview

This document defines the data model for the Branch Isolation Model feature, including entity schemas, relationships, validation rules, and state transitions.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIPS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐         ┌──────────────┐         ┌─────────────┐             │
│  │   User   │────────►│    Branch    │◄────────│   Review    │             │
│  │          │ owns    │              │ reviews │             │             │
│  └────┬─────┘         └──────┬───────┘         └─────────────┘             │
│       │                      │                                              │
│       │ has_role             │ has_state                                    │
│       ▼                      ▼                                              │
│  ┌──────────┐         ┌──────────────┐                                     │
│  │   Role   │         │ BranchState  │                                     │
│  │          │         │ Transition   │                                     │
│  └──────────┘         └──────────────┘                                     │
│                              │                                              │
│                              │ triggers                                     │
│                              ▼                                              │
│                       ┌──────────────┐         ┌─────────────┐             │
│                       │ Convergence  │────────►│  AuditLog   │             │
│                       │              │ logs    │             │             │
│                       └──────────────┘         └─────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Entities

### 1. User

Represents authenticated users of the system.

```typescript
interface User {
  // Identity
  id: string;                    // UUID v7 (sortable)
  externalId: string;           // OAuth provider ID
  provider: AuthProvider;       // 'github' | 'google' | 'saml'

  // Profile
  email: string;                // Unique, verified
  displayName: string;          // User-facing name
  avatarUrl?: string;           // Profile image

  // Authorization
  roles: Role[];                // Assigned roles
  isActive: boolean;            // Account status

  // Timestamps
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
  lastLoginAt?: string;         // ISO 8601
}

type AuthProvider = 'github' | 'google' | 'saml' | 'api_token';

type Role = 'contributor' | 'reviewer' | 'publisher' | 'administrator';
```

**Validation Rules:**
- `email`: Valid email format, unique across all users
- `displayName`: 1-100 characters
- `roles`: At least one role required for active users

**Indexes:**
- Primary: `id`
- Unique: `email`, `(externalId, provider)`
- Index: `isActive`, `roles`

---

### 2. Branch

Represents an isolated workspace for making changes.

```typescript
interface Branch {
  // Identity
  id: string;                    // UUID v7
  name: string;                  // Human-readable name
  slug: string;                  // URL-safe identifier

  // Git Reference
  gitRef: string;               // Git branch name (feature/<user>/<slug>)
  baseRef: string;              // Source branch (main or dev)
  baseCommit: string;           // SHA of divergence point
  headCommit: string;           // Current HEAD SHA

  // Lifecycle
  state: BranchState;           // Current lifecycle state
  visibility: Visibility;       // Access level

  // Ownership
  ownerId: string;              // User ID of creator
  reviewers: string[];          // User IDs with review access

  // Metadata
  description?: string;         // Purpose of changes
  labels: string[];             // Categorization tags

  // Timestamps
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
  submittedAt?: string;         // When submitted for review
  approvedAt?: string;          // When approved
  publishedAt?: string;         // When merged to main
  archivedAt?: string;          // When archived
}

type BranchState = 'draft' | 'review' | 'approved' | 'published' | 'archived';

type Visibility = 'private' | 'team' | 'public';
```

**Validation Rules:**
- `name`: 1-200 characters
- `slug`: 1-100 characters, lowercase alphanumeric with hyphens
- `baseRef`: Must be 'main' or 'dev'
- `reviewers`: Valid user IDs, cannot include owner

**Indexes:**
- Primary: `id`
- Unique: `slug`, `gitRef`
- Index: `state`, `ownerId`, `visibility`, `createdAt`
- Composite: `(state, ownerId)`, `(state, visibility)`

---

### 3. BranchStateTransition

Records all state changes for a branch.

```typescript
interface BranchStateTransition {
  // Identity
  id: string;                    // UUID v7
  branchId: string;             // Foreign key to Branch

  // Transition
  fromState: BranchState;       // Previous state
  toState: BranchState;         // New state

  // Actor
  actorId: string;              // User ID who triggered
  actorType: ActorType;         // 'user' | 'system'

  // Context
  reason?: string;              // Why transition occurred
  metadata: Record<string, unknown>; // Additional context

  // Timestamp
  createdAt: string;            // ISO 8601
}

type ActorType = 'user' | 'system';
```

**Validation Rules:**
- `fromState` + `toState`: Must be a valid transition (see state machine)
- `reason`: Required for `review → draft` (request changes)
- `metadata`: JSON object, max 10KB

**Indexes:**
- Primary: `id`
- Index: `branchId`, `createdAt`
- Composite: `(branchId, createdAt)`

---

### 4. Review

Represents a review session for a branch.

```typescript
interface Review {
  // Identity
  id: string;                    // UUID v7
  branchId: string;             // Foreign key to Branch

  // Assignment
  reviewerId: string;           // User ID of reviewer
  requestedById: string;        // User ID who requested review

  // Status
  status: ReviewStatus;         // Current review status

  // Feedback
  decision?: ReviewDecision;    // Approve or request changes
  comments: ReviewComment[];    // Review comments

  // Timestamps
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
  completedAt?: string;         // When decision made
}

type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

type ReviewDecision = 'approved' | 'changes_requested';

interface ReviewComment {
  id: string;                    // UUID v7
  authorId: string;             // User ID
  content: string;              // Comment text
  path?: string;                // File path (if file-specific)
  line?: number;                // Line number (if line-specific)
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}
```

**Validation Rules:**
- `reviewerId`: Must have 'reviewer' role
- `decision`: Required when status changes to 'completed'
- `comments.content`: 1-10000 characters

**Indexes:**
- Primary: `id`
- Index: `branchId`, `reviewerId`, `status`
- Composite: `(reviewerId, status)`, `(branchId, status)`

---

### 5. Convergence

Represents a merge operation from branch to main.

```typescript
interface Convergence {
  // Identity
  id: string;                    // UUID v7
  branchId: string;             // Foreign key to Branch

  // Actor
  publisherId: string;          // User ID who initiated

  // Status
  status: ConvergenceStatus;    // Current operation status

  // Validation
  validationResults: ValidationResult[];
  conflictDetected: boolean;
  conflictDetails?: ConflictDetail[];

  // Git
  mergeCommit?: string;         // SHA of merge commit (on success)
  targetRef: string;            // Target branch (main)

  // Timestamps
  createdAt: string;            // ISO 8601
  startedAt?: string;           // When merge started
  completedAt?: string;         // When completed (success or failure)
}

type ConvergenceStatus =
  | 'pending'           // Queued
  | 'validating'        // Running pre-merge checks
  | 'merging'           // Performing merge
  | 'succeeded'         // Successfully merged
  | 'failed'            // Failed (validation or merge)
  | 'rolled_back';      // Rolled back after failure

interface ValidationResult {
  check: string;                // Check name
  passed: boolean;              // Result
  message?: string;             // Details
}

interface ConflictDetail {
  path: string;                 // File with conflict
  type: 'content' | 'rename' | 'delete';
  description: string;
}
```

**Validation Rules:**
- `publisherId`: Must have 'publisher' role
- Branch must be in 'approved' state
- `targetRef`: Must be 'main'

**Indexes:**
- Primary: `id`
- Unique: `(branchId, status)` where status in ('pending', 'validating', 'merging')
- Index: `status`, `publisherId`, `createdAt`

---

### 6. AuditLog

Comprehensive operation logging for compliance.

```typescript
interface AuditLog {
  // Identity
  id: string;                    // UUID v7

  // Event
  timestamp: string;            // ISO 8601 with timezone
  action: AuditAction;          // What happened

  // Actor
  actorId: string;              // user:123 or system:validator
  actorType: ActorType;         // 'user' | 'system'
  actorIp?: string;             // Client IP address
  actorUserAgent?: string;      // Client user agent

  // Resource
  resourceType: ResourceType;   // Type of affected resource
  resourceId: string;           // ID of affected resource

  // Context
  metadata: Record<string, unknown>; // Event-specific data

  // Correlation
  requestId?: string;           // Request trace ID
  sessionId?: string;           // Session ID
}

type AuditAction =
  | 'branch_created'
  | 'branch_updated'
  | 'branch_state_transitioned'
  | 'branch_visibility_changed'
  | 'branch_deleted'
  | 'review_requested'
  | 'review_completed'
  | 'review_comment_added'
  | 'convergence_initiated'
  | 'convergence_succeeded'
  | 'convergence_failed'
  | 'convergence_rolled_back'
  | 'user_created'
  | 'user_updated'
  | 'user_role_changed'
  | 'user_deactivated';

type ResourceType = 'branch' | 'review' | 'convergence' | 'user';
```

**Validation Rules:**
- All fields except optionals are required
- `timestamp`: Must be ISO 8601 with timezone
- `metadata`: JSON object, max 100KB

**Indexes:**
- Primary: `id`
- Index: `timestamp`, `action`, `actorId`, `resourceId`
- GIN Index: `metadata` (for JSONB queries)
- Partition: By month on `timestamp`

**Retention:**
- Hot storage: 1 year
- Cold storage: 7 years total (compliance requirement)

---

## State Machine Definition

### Branch Lifecycle States

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        BRANCH STATE MACHINE                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                         ┌──────────┐                                     │
│                         │  DRAFT   │ ◄─────────────────────────┐        │
│                         │          │                           │        │
│                         │ (mutable)│                           │        │
│                         └────┬─────┘                           │        │
│                              │                                 │        │
│              SUBMIT_FOR_REVIEW (owner)                         │        │
│              [hasCommittedChanges]                             │        │
│                              │                                 │        │
│                              ▼                                 │        │
│                         ┌──────────┐                           │        │
│                         │  REVIEW  │                           │        │
│                         │          │                           │        │
│                         │(immutable)│        REQUEST_CHANGES   │        │
│                         └────┬─────┘        (reviewer)         │        │
│                              │              [hasReason]        │        │
│                              ├───────────────────────────────────       │
│                              │                                          │
│                        APPROVE (reviewer)                               │
│                        [isAuthorizedReviewer]                           │
│                              │                                          │
│                              ▼                                          │
│                         ┌──────────┐                                    │
│                         │ APPROVED │                                    │
│                         │          │                                    │
│                         │(immutable)│                                   │
│                         └────┬─────┘                                    │
│                              │                                          │
│                         PUBLISH (publisher)                             │
│                         [validationPasses, noConflicts]                 │
│                              │                                          │
│                              ▼                                          │
│                         ┌───────────┐                                   │
│                         │ PUBLISHED │                                   │
│                         │           │                                   │
│                         │(immutable)│                                   │
│                         └─────┬─────┘                                   │
│                               │                                         │
│                          ARCHIVE (admin)                                │
│                               │                                         │
│                               ▼                                         │
│                          ┌──────────┐                                   │
│                          │ ARCHIVED │                                   │
│                          │          │                                   │
│                          │ (final)  │                                   │
│                          └──────────┘                                   │
│                                                                          │
│  Additional ARCHIVE transitions (not shown):                            │
│    - Draft → Archived (owner or admin, [workAbandoned])                 │
│    - Review → Archived (admin, [reviewStalled])                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Valid Transitions

| From | To | Event | Actor | Guards |
|------|-----|-------|-------|--------|
| `draft` | `review` | SUBMIT_FOR_REVIEW | owner | hasCommittedChanges |
| `review` | `draft` | REQUEST_CHANGES | reviewer | hasReason |
| `review` | `approved` | APPROVE | reviewer | isAuthorizedReviewer |
| `approved` | `published` | PUBLISH | publisher | validationPasses, noConflicts |
| `draft` | `archived` | ARCHIVE | owner, admin | - |
| `review` | `archived` | ARCHIVE | admin | - |
| `published` | `archived` | ARCHIVE | admin | - |

### Forbidden Transitions

| From | To | Reason |
|------|-----|--------|
| `draft` | `approved` | Cannot skip review |
| `draft` | `published` | Cannot skip review and approval |
| `review` | `published` | Cannot skip approval |
| `approved` | `draft` | Cannot un-approve; create new branch |
| `published` | `draft`, `review`, `approved` | Immutable after publication |
| `archived` | Any | Final state |

---

## Permission Matrix

### Role Capabilities

| Action | Anonymous | Contributor | Reviewer | Publisher | Admin |
|--------|-----------|-------------|----------|-----------|-------|
| View published content | Yes | Yes | Yes | Yes | Yes |
| View own draft branches | - | Yes | Yes | Yes | Yes |
| View team branches | - | If granted | Yes | Yes | Yes |
| Create branch | - | Yes | Yes | Yes | Yes |
| Edit draft branch | - | Own only | Own only | Own only | Any |
| Submit for review | - | Own only | Own only | Own only | Any |
| Approve/reject review | - | - | Yes | Yes | Yes |
| Initiate convergence | - | - | - | Yes | Yes |
| Override workflows | - | - | - | - | Yes |
| View all audit logs | - | - | - | - | Yes |
| Archive any branch | - | Own draft | - | - | Yes |

### Visibility Access

| Visibility | Owner | Designated Reviewers | Publishers | All Users |
|------------|-------|----------------------|------------|-----------|
| Private | Read/Write | - | - | - |
| Team | Read/Write | Read | Read | - |
| Public | Read/Write | Read | Read | Read |

---

## Database Schema (Drizzle)

```typescript
// schema.ts
import { pgTable, uuid, text, timestamp, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const branchStateEnum = pgEnum('branch_state', ['draft', 'review', 'approved', 'published', 'archived']);
export const visibilityEnum = pgEnum('visibility', ['private', 'team', 'public']);
export const roleEnum = pgEnum('role', ['contributor', 'reviewer', 'publisher', 'administrator']);

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: text('external_id').notNull(),
  provider: text('provider').notNull(),
  email: text('email').unique().notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  roles: roleEnum('roles').array().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
});

// Branches
export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  gitRef: text('git_ref').unique().notNull(),
  baseRef: text('base_ref').notNull(),
  baseCommit: text('base_commit').notNull(),
  headCommit: text('head_commit').notNull(),
  state: branchStateEnum('state').default('draft').notNull(),
  visibility: visibilityEnum('visibility').default('private').notNull(),
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  reviewers: uuid('reviewers').array().default([]),
  description: text('description'),
  labels: text('labels').array().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  submittedAt: timestamp('submitted_at'),
  approvedAt: timestamp('approved_at'),
  publishedAt: timestamp('published_at'),
  archivedAt: timestamp('archived_at'),
});

// Branch State Transitions
export const branchStateTransitions = pgTable('branch_state_transitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  fromState: branchStateEnum('from_state').notNull(),
  toState: branchStateEnum('to_state').notNull(),
  actorId: text('actor_id').notNull(),
  actorType: text('actor_type').notNull(),
  reason: text('reason'),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Reviews
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  reviewerId: uuid('reviewer_id').references(() => users.id).notNull(),
  requestedById: uuid('requested_by_id').references(() => users.id).notNull(),
  status: text('status').default('pending').notNull(),
  decision: text('decision'),
  comments: jsonb('comments').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Convergence Operations
export const convergenceOperations = pgTable('convergence_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  publisherId: uuid('publisher_id').references(() => users.id).notNull(),
  status: text('status').default('pending').notNull(),
  validationResults: jsonb('validation_results').default([]).notNull(),
  conflictDetected: boolean('conflict_detected').default(false).notNull(),
  conflictDetails: jsonb('conflict_details'),
  mergeCommit: text('merge_commit'),
  targetRef: text('target_ref').default('main').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});

// Audit Logs (partitioned table - conceptual)
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  action: text('action').notNull(),
  actorId: text('actor_id').notNull(),
  actorType: text('actor_type').notNull(),
  actorIp: text('actor_ip'),
  actorUserAgent: text('actor_user_agent'),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  requestId: text('request_id'),
  sessionId: text('session_id'),
});
```

---

## Migration Strategy

### Initial Migration (001_initial_schema)
1. Create enums
2. Create users table
3. Create branches table
4. Create branch_state_transitions table
5. Create reviews table
6. Create convergence_operations table
7. Create audit_logs table (with partitioning)
8. Create indexes
9. Seed initial admin user

### Index Strategy
- B-tree indexes for equality/range queries
- GIN indexes for JSONB metadata queries
- Partial indexes for common query patterns (e.g., active branches)

### Partitioning Strategy (audit_logs)
```sql
-- Monthly partitioning for audit_logs
CREATE TABLE audit_logs (
  ...
) PARTITION BY RANGE (timestamp);

-- Create partitions for each month
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```
