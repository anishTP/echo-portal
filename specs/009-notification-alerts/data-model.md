# Data Model: Notification & Alert System

**Feature**: 009-notification-alerts | **Date**: 2026-02-12

## Entities

### 1. Notification (existing — extended)

An immutable record of a system event relevant to a specific user.

**Table**: `notifications`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique notification identifier |
| `user_id` | `uuid` | FK → `users.id`, NOT NULL | Recipient user |
| `type` | `text` | NOT NULL | Event type (e.g., `review_requested`, `collaborator_added`) |
| `category` | `text` | NOT NULL | **NEW** — Category for preference filtering: `review`, `lifecycle`, `ai` |
| `title` | `text` | NOT NULL | Human-readable notification title |
| `message` | `text` | NOT NULL | Descriptive message with actor attribution |
| `resource_type` | `text` | nullable | Type of linked resource (`branch`, `review`, `content`, `user`) |
| `resource_id` | `uuid` | nullable | ID of linked resource |
| `actor_id` | `uuid` | FK → `users.id`, nullable | **NEW** — User who caused the event (for attribution display) |
| `is_read` | `boolean` | NOT NULL, default `false` | Read status |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `read_at` | `timestamptz` | nullable | When marked as read |

**Indexes**:
- `notifications_user_id_idx` ON (`user_id`) — existing
- `notifications_user_read_idx` ON (`user_id`, `is_read`) — existing
- `notifications_created_at_idx` ON (`created_at`) — existing
- `notifications_user_category_idx` ON (`user_id`, `category`) — **NEW** — for category-filtered queries

**New Columns**: `category` (text, not null) and `actor_id` (uuid, nullable FK)

**Migration Notes**:
- Backfill `category` for existing notifications: derive from `type` (`review_*` → `review`, `content_published` → `lifecycle`)
- `actor_id` is nullable to support existing notifications that don't have actor tracking

---

### 2. Notification Preference (new)

A user-scoped setting controlling which notification categories are enabled.

**Table**: `notification_preferences`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique preference record ID |
| `user_id` | `uuid` | FK → `users.id`, NOT NULL | User who owns this preference |
| `category` | `text` | NOT NULL, CHECK IN (`review`, `lifecycle`, `ai`) | Notification category |
| `enabled` | `boolean` | NOT NULL, default `true` | Whether notifications in this category are delivered |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last modification timestamp |

**Constraints**:
- `UNIQUE(user_id, category)` — one preference row per user per category

**Indexes**:
- `notification_preferences_user_idx` ON (`user_id`) — for loading all preferences for a user

**Default Behavior**: Missing rows are treated as enabled. Rows are created on first user interaction with preferences. This avoids creating 3 rows per user on registration.

---

## Notification Types

### Review Category (`review`)

| Type Constant | Value | Trigger | Recipients |
|--------------|-------|---------|------------|
| `REVIEW_REQUESTED` | `review_requested` | Branch submitted for review | Assigned reviewers |
| `REVIEW_COMMENT_ADDED` | `review_comment_added` | Comment posted on review | Branch owner + other reviewers (excl. author) |
| `REVIEW_COMMENT_REPLY` | `review_comment_reply` | Reply to comment thread | Parent comment author + thread participants (excl. author) |
| `REVIEW_APPROVED` | `review_approved` | Reviewer approves branch | Branch owner |
| `REVIEW_CHANGES_REQUESTED` | `review_changes_requested` | Reviewer requests changes | Branch owner |
| `REVIEWER_ADDED` | `reviewer_added` | Reviewer assigned to branch | Added reviewer |
| `REVIEWER_REMOVED` | `reviewer_removed` | Reviewer removed from branch | Removed reviewer |

### Lifecycle Category (`lifecycle`)

| Type Constant | Value | Trigger | Recipients |
|--------------|-------|---------|------------|
| `COLLABORATOR_ADDED` | `collaborator_added` | Collaborator added to branch | Added collaborator |
| `COLLABORATOR_REMOVED` | `collaborator_removed` | Collaborator removed from branch | Removed collaborator |
| `CONTENT_PUBLISHED` | `content_published` | Branch published | Branch owner + all collaborators |
| `BRANCH_ARCHIVED` | `branch_archived` | Branch archived | Branch owner |
| `ROLE_CHANGED` | `role_changed` | Admin changes user's role | Affected user |

### AI Category (`ai`)

| Type Constant | Value | Trigger | Recipients |
|--------------|-------|---------|------------|
| `AI_COMPLIANCE_ERROR` | `ai_compliance_error` | Image analysis detects error-severity issue | Branch owner / content creator |

---

## Entity Relationships

```
users 1──────N notifications        (user_id FK)
users 1──────N notifications        (actor_id FK, nullable)
users 1──────N notification_preferences  (user_id FK)
```

Notifications reference resources polymorphically via `resource_type` + `resource_id` (no FK constraint — resources may be deleted independently).

---

## State Transitions

### Notification

```
[Created] → Unread → Read
```

- **Unread → Read**: Triggered by recipient clicking notification or "Mark all as read" action
- **Immutability**: Once created, `type`, `category`, `title`, `message`, `resource_type`, `resource_id`, `actor_id`, `created_at` are never modified
- **Only mutable fields**: `is_read`, `read_at`

### Notification Preference

```
Enabled ⇄ Disabled
```

- **Enabled → Disabled**: User disables category toggle
- **Disabled → Enabled**: User enables category toggle
- Both transitions audited

---

## Validation Rules

### Notification
- `type` must be one of the defined constants in `NotificationType`
- `category` must be one of: `review`, `lifecycle`, `ai`
- `category` must match the type (enforced by category mapping, not DB constraint)
- `user_id` must reference an active, existing user
- `actor_id` (when present) must differ from `user_id` (self-notification suppression — enforced in service, not DB)

### Notification Preference
- `category` must be one of: `review`, `lifecycle`, `ai`
- `user_id` + `category` must be unique (DB constraint)
- `enabled` is boolean, defaults to `true`

---

## Retention

- Notifications older than 90 days may be purged by a scheduled cleanup (not part of user-facing API)
- Notification preferences are retained indefinitely (tied to user account)
- Audit log entries follow system-wide retention policy
