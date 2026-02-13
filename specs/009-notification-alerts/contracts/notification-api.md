# API Contract: Notification & Alert System

**Feature**: 009-notification-alerts | **Date**: 2026-02-12

All endpoints require authentication via `requireAuth` middleware unless otherwise noted.
Base path: `/api/v1/notifications`

---

## Notification Endpoints

### GET /api/v1/notifications

List notifications for the authenticated user with filtering and pagination.

**Query Parameters**:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `page` | integer | no | 1 | Page number (1-indexed) |
| `limit` | integer | no | 20 | Items per page (max 100) |
| `isRead` | boolean | no | — | Filter by read status |
| `type` | string | no | — | Filter by notification type |
| `category` | string | no | — | Filter by category (`review`, `lifecycle`, `ai`) |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "review_approved",
      "category": "review",
      "title": "Review Approved",
      "message": "Alice approved 'Brand Guidelines v2'",
      "resourceType": "branch",
      "resourceId": "uuid",
      "actorId": "uuid",
      "actorName": "Alice",
      "isRead": false,
      "createdAt": "2026-02-12T10:30:00Z",
      "readAt": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "hasMore": true
  }
}
```

**Changes from existing**: Added `category`, `actorId`, `actorName` fields to response. Added `category` query param.

---

### GET /api/v1/notifications/unread-count

Get unread notification count for the authenticated user.

**Response** `200 OK`:
```json
{
  "data": {
    "count": 12
  }
}
```

**No changes from existing.**

---

### PATCH /api/v1/notifications/:notificationId/read

Mark a single notification as read.

**Path Parameters**: `notificationId` (uuid)

**Response** `200 OK`:
```json
{
  "data": {
    "id": "uuid",
    "type": "review_approved",
    "category": "review",
    "title": "Review Approved",
    "message": "...",
    "isRead": true,
    "readAt": "2026-02-12T10:35:00Z"
  }
}
```

**Error** `404 Not Found`: Notification does not exist or is not owned by the authenticated user.

**No changes from existing** (response now includes `category`, `actorId`, `actorName`).

---

### POST /api/v1/notifications/mark-all-read — **NEW**

Mark all unread notifications as read for the authenticated user.

**Request Body**: None

**Response** `200 OK`:
```json
{
  "data": {
    "count": 12
  }
}
```

`count` is the number of notifications that were marked as read.

**Audit**: Logs `notifications_bulk_read` with `{ count }` metadata.

---

## Notification Preferences Endpoints — **NEW**

### GET /api/v1/notifications/preferences

Get notification preferences for the authenticated user.

**Response** `200 OK`:
```json
{
  "data": [
    { "category": "review", "enabled": true },
    { "category": "lifecycle", "enabled": true },
    { "category": "ai", "enabled": false }
  ]
}
```

**Note**: Returns all three categories. Missing DB rows are treated as `enabled: true`.

---

### PATCH /api/v1/notifications/preferences

Update a notification preference for the authenticated user.

**Request Body**:
```json
{
  "category": "ai",
  "enabled": false
}
```

**Validation**:
- `category`: required, one of `review`, `lifecycle`, `ai`
- `enabled`: required, boolean

**Response** `200 OK`:
```json
{
  "data": {
    "category": "ai",
    "enabled": false
  }
}
```

**Audit**: Logs `notification_preference_changed` with `{ category, oldValue, newValue }` metadata.

---

## SSE Endpoint — **NEW**

### GET /api/v1/notifications/stream

Server-Sent Events stream for real-time notification delivery.

**Headers**:
- `Accept: text/event-stream`
- `Last-Event-ID` (optional): Resume from a specific notification ID for catch-up

**Response**: `200 OK` with `Content-Type: text/event-stream`

**Event Types**:

```
event: notification
id: <notification-id>
data: {"id":"uuid","type":"review_approved","category":"review","title":"Review Approved","message":"...","resourceType":"branch","resourceId":"uuid","actorId":"uuid","actorName":"Alice","isRead":false,"createdAt":"2026-02-12T10:30:00Z"}

event: count
data: {"count":13}

event: heartbeat
data: {}
```

| Event | Description |
|-------|-------------|
| `notification` | New notification created for this user. `id` field enables `Last-Event-ID` resume. |
| `count` | Updated unread count (sent after each `notification` event). |
| `heartbeat` | Keepalive every 30 seconds to detect stale connections. |

**Connection Lifecycle**:
- Client opens connection on authentication
- Server sends `heartbeat` every 30s
- If `Last-Event-ID` is provided, server replays missed notifications created after that ID's timestamp
- Client auto-reconnects on disconnect (browser EventSource or custom fetch-based reconnection)
- Connection closed on logout or server shutdown

---

## Admin Metrics Endpoint — **NEW**

### GET /api/v1/notifications/admin/metrics

Aggregate notification metrics for administrators.

**Authorization**: Requires `administrator` role.

**Response** `200 OK`:
```json
{
  "data": {
    "periods": {
      "24h": {
        "total": 156,
        "byType": {
          "review_requested": 45,
          "review_approved": 30,
          "review_changes_requested": 12,
          "review_comment_added": 28,
          "review_comment_reply": 15,
          "content_published": 10,
          "collaborator_added": 8,
          "branch_archived": 5,
          "role_changed": 2,
          "ai_compliance_error": 1
        }
      },
      "7d": { "total": 892, "byType": { "..." } },
      "30d": { "total": 3241, "byType": { "..." } }
    }
  }
}
```

**Error** `403 Forbidden`: User does not have administrator role.

---

## Shared Types

### NotificationType (extended)

```typescript
export const NotificationType = {
  // Review category
  REVIEW_REQUESTED: 'review_requested',
  REVIEW_COMMENT_ADDED: 'review_comment_added',
  REVIEW_COMMENT_REPLY: 'review_comment_reply',
  REVIEW_APPROVED: 'review_approved',
  REVIEW_CHANGES_REQUESTED: 'review_changes_requested',
  REVIEWER_ADDED: 'reviewer_added',
  REVIEWER_REMOVED: 'reviewer_removed',
  // Lifecycle category
  COLLABORATOR_ADDED: 'collaborator_added',
  COLLABORATOR_REMOVED: 'collaborator_removed',
  CONTENT_PUBLISHED: 'content_published',
  BRANCH_ARCHIVED: 'branch_archived',
  ROLE_CHANGED: 'role_changed',
  // AI category
  AI_COMPLIANCE_ERROR: 'ai_compliance_error',
} as const;
```

### NotificationCategory

```typescript
export const NotificationCategory = {
  REVIEW: 'review',
  LIFECYCLE: 'lifecycle',
  AI: 'ai',
} as const;

export type NotificationCategoryValue =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];
```

### Category Mapping

```typescript
export const NOTIFICATION_TYPE_TO_CATEGORY: Record<NotificationTypeValue, NotificationCategoryValue> = {
  review_requested: 'review',
  review_comment_added: 'review',
  review_comment_reply: 'review',
  review_approved: 'review',
  review_changes_requested: 'review',
  reviewer_added: 'review',
  reviewer_removed: 'review',
  collaborator_added: 'lifecycle',
  collaborator_removed: 'lifecycle',
  content_published: 'lifecycle',
  branch_archived: 'lifecycle',
  role_changed: 'lifecycle',
  ai_compliance_error: 'ai',
};
```

### NotificationPreference

```typescript
export interface NotificationPreference {
  category: NotificationCategoryValue;
  enabled: boolean;
}
```

### Notification (extended)

```typescript
export interface Notification {
  id: string;
  type: NotificationTypeValue;
  category: NotificationCategoryValue;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}
```

---

## Error Responses

All endpoints follow the existing error response format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Notification not found"
  }
}
```

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid query params or request body |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient role (admin metrics) |
| 404 | `NOT_FOUND` | Notification not found or not owned by user |

---

## Middleware Requirements

| Endpoint | Middleware |
|----------|-----------|
| All notification endpoints | `requireAuth` — validates session, populates `c.get('user')` |
| `GET /admin/metrics` | `requireAuth` + admin role check |
| `GET /stream` | `requireAuth` — session validated before SSE connection established |
