# Research: Notification & Alert System

**Feature**: 009-notification-alerts | **Date**: 2026-02-12

## 1. Existing Notification Infrastructure

### Decision: Extend existing notification service, schema, and routes

**Rationale**: The codebase already has a functional notification system with DB schema, service layer, API routes, and frontend components. Extending it is faster and maintains consistency.

**Existing Backend:**
- `backend/src/services/notification/notification-service.ts` — `create`, `createBulk`, `list`, `getUnreadCount`, `markRead`
- `backend/src/api/routes/notifications.ts` — `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`
- `backend/src/db/schema/notifications.ts` — notifications table with `id`, `userId`, `type`, `title`, `message`, `resourceType`, `resourceId`, `isRead`, `createdAt`, `readAt`
- `backend/src/services/review/review-notifications.ts` — 7 review notification types with fire-and-forget pattern

**Existing Frontend:**
- `frontend/src/components/notification/NotificationBell.tsx` — Bell icon with badge (currently caps at 9+)
- `frontend/src/components/notification/NotificationList.tsx` — Scrollable notification list with read/unread styling
- `frontend/src/stores/notificationStore.ts` — Zustand store with `unreadCount`, `notifications`, `markAsRead`
- `frontend/src/hooks/useNotifications.ts` — TanStack Query hooks with 30s polling (`useUnreadCount`, `useNotificationList`, `useMarkNotificationRead`)
- `frontend/src/services/notification-api.ts` — API client (`list`, `getUnreadCount`, `markRead`)

**Existing Shared:**
- `shared/constants/states.ts` — `NotificationType` enum (4 types: `review_requested`, `review_completed`, `changes_requested`, `content_published`)
- `shared/types/notification.ts` — `Notification` interface

**Gaps to Fill:**
- No notification preferences table or service
- No `markAllRead` endpoint
- No SSE endpoint for real-time delivery
- No full notifications page (only popover list)
- No lifecycle or AI notification triggers
- Badge caps at 9+ (spec requires 99+)
- No visibility enforcement in notification creation
- No self-notification suppression
- No deactivated user filtering

**Alternatives Considered:**
- Replace notification service entirely → Rejected (existing service is well-structured and extensible)
- Use WebSockets instead of SSE → Rejected (SSE is simpler, unidirectional, and matches existing `streamSSE` pattern from Hono)

---

## 2. Notification Type Categories

### Decision: Map event types to three categories for preference filtering

**Rationale**: The spec mandates category-level preference control (not per-event-type). Categories must be defined as constants and used at creation time to check preferences.

**Category Mapping:**

| Category | Event Types |
|----------|------------|
| **review** | `review_requested`, `review_comment_added`, `review_comment_reply`, `review_approved`, `review_changes_requested`, `reviewer_added`, `reviewer_removed` |
| **lifecycle** | `collaborator_added`, `collaborator_removed`, `content_published`, `branch_archived`, `role_changed` |
| **ai** | `ai_compliance_error` |

**Implementation:** Add a `category` column to the notifications table (or derive from type at query time). Adding the column is cleaner — allows indexed queries and preference enforcement at insert time without a lookup table.

**Alternatives Considered:**
- Derive category from type at runtime → Rejected (requires maintenance of mapping function, can't use DB-level filtering)
- Separate tables per category → Rejected (unnecessary complexity, violates Principle IX)

---

## 3. Real-Time Delivery Mechanism

### Decision: Server-Sent Events (SSE) via Hono's `streamSSE`

**Rationale**: The codebase already uses `streamSSE` from `hono/streaming` for AI generation streaming. SSE is unidirectional (server→client), which is exactly what notifications need. No additional dependencies required.

**Existing Pattern** (from `backend/src/api/routes/ai.ts`):
```typescript
import { streamSSE } from 'hono/streaming';
return streamSSE(c, async (sseStream) => {
  await sseStream.writeSSE({ data: JSON.stringify(payload), event: 'notification' });
});
```

**Frontend Pattern** (from `frontend/src/hooks/useSSEStream.ts`):
- Uses `fetch()` with `ReadableStream` (not `EventSource`) for auth header support
- Supports abort via `AbortController`
- Parses SSE events from text stream

**Architecture:**
- Backend: In-memory pub/sub per userId. When notification is created, publish to any active SSE connections for that user.
- Frontend: Persistent SSE connection opened on auth, auto-reconnects on disconnect, sends `lastEventId` for catch-up.
- Fallback: Existing 30s polling continues as baseline; SSE supplements it.

**Alternatives Considered:**
- WebSockets → Rejected (bidirectional not needed, more complex, Hono has native SSE support)
- Long polling → Rejected (SSE is more efficient and already patterned in codebase)
- External pub/sub (Redis) → Rejected for MVP (in-memory sufficient for single-server deployment)

---

## 4. Notification Preferences Storage

### Decision: New `notification_preferences` table with one row per user per category

**Rationale**: Simple schema. Default is "enabled" — rows only need to exist when a user disables a category. Could use either approach: (a) create rows for all categories on user creation, or (b) treat missing rows as enabled. Option (b) is simpler — only insert when user explicitly disables.

**Schema:**
```
notification_preferences (
  id: uuid PK
  userId: uuid FK → users
  category: text ('review' | 'lifecycle' | 'ai')
  enabled: boolean (default true)
  updatedAt: timestamp
)
UNIQUE(userId, category)
```

**Enforcement:** Check preferences in `notificationService.create` / `createBulk` before inserting. If category is disabled for recipient, skip that recipient.

**Alternatives Considered:**
- JSON column on users table → Rejected (harder to query, no index support)
- Separate preferences service → Rejected (simple CRUD, can live in notification service)

---

## 5. Recipient Determination & Filtering

### Decision: Centralized `resolveRecipients` function in notification service

**Rationale**: Multiple trigger points need the same filtering logic. Centralizing prevents duplication and ensures consistent enforcement.

**Filters Applied (in order):**
1. **Self-suppression**: Remove `actorId` from recipient list
2. **Deactivated users**: Filter out users where `isActive = false`
3. **Visibility enforcement**: For branch-scoped notifications, verify recipients can access the branch
4. **Preference check**: Remove users who disabled the notification's category

**Branch Visibility Check:**
- Existing branch service has visibility queries
- For public branches: all recipients valid
- For private branches: only owner, collaborators, and assigned reviewers

**Alternatives Considered:**
- Filter at query time (show all, hide restricted) → Rejected (spec says "never created", not "created-then-hidden")
- Per-trigger-point filtering → Rejected (duplication, inconsistency risk)

---

## 6. Notification Trigger Integration Points

### Decision: Add notification calls at existing service boundaries

**Rationale**: Follow the existing fire-and-forget pattern from review-notifications.ts. Notifications are triggered after the primary operation succeeds, wrapped in `.catch()` to prevent blocking.

**Review Events** (extend `review-notifications.ts`):
- Already handles: `review_requested`, `review_comment_added`, `review_comment_reply`, `review_approved`, `review_changes_requested`, `reviewer_added`, `reviewer_removed`
- Needs: preference checking, visibility enforcement, self-suppression, deactivated filtering

**Lifecycle Events** (new triggers):
- `collaborator_added` / `collaborator_removed` — in branch-service.ts collaborator management
- `content_published` — in branch routes publish endpoint (line ~577)
- `branch_archived` — in transition service ARCHIVE event
- `role_changed` — in user routes role change endpoint

**AI Events** (new triggers):
- `ai_compliance_error` — in image compliance analysis when error-severity findings detected

**Alternatives Considered:**
- Event bus / middleware pattern → Rejected for MVP (over-engineering, Principle IX)
- Database triggers → Rejected (breaks Drizzle ORM pattern, harder to test)

---

## 7. Frontend Architecture

### Decision: Extend existing components, add new page and preferences

**Rationale**: NotificationBell, NotificationList, and the store/hooks already exist. Extend rather than replace.

**Changes:**
- `NotificationBell.tsx`: Update badge cap from 9+ to 99+
- `NotificationList.tsx`: Add "Show all" link, limit to 5 items in popover mode
- New `NotificationsPage.tsx`: Full page at `/notifications` with pagination
- New `NotificationPreferences.tsx`: Category toggles at `/settings/notifications`
- `notificationStore.ts`: Add SSE connection state, preference state
- `useNotifications.ts`: Add `useMarkAllRead`, `useNotificationPreferences`, `useUpdatePreference`
- `notification-api.ts`: Add `markAllRead`, `getPreferences`, `updatePreference`
- `AppHeader.tsx`: Ensure NotificationBell is wired with popover

**Popover Pattern**: Use `@radix-ui/react-popover` (already used in TeamMemberPicker)

**Alternatives Considered:**
- Dialog instead of popover → Rejected (popover is lighter, spec says "dropdown popover")
- Separate notification app → Rejected (overkill, violates Principle IX)

---

## 8. Admin Metrics

### Decision: Aggregate queries on existing notifications table

**Rationale**: No new tables needed. Simple `COUNT` + `GROUP BY` queries on notifications table with time filters (24h, 7d, 30d). Admin-only endpoint.

**Endpoint**: `GET /api/v1/notifications/admin/metrics` (admin role required)

**Alternatives Considered:**
- Materialized view → Rejected for MVP (premature optimization)
- Separate analytics table → Rejected (simple counts don't warrant it)

---

## 9. Audit Logging

### Decision: Use existing AuditLogger for preference changes and bulk mark-read

**Rationale**: Existing audit infrastructure in `backend/src/services/audit/logger.ts` supports generic `log()` with action, actor, resource, and metadata. Two new audit actions needed.

**New Audit Actions:**
- `notification_preference_changed` — metadata: `{ category, oldValue, newValue }`
- `notifications_bulk_read` — metadata: `{ count }`

**Alternatives Considered:**
- Custom logging → Rejected (audit logger already exists and is consistent)

---

## 10. Testing Strategy

### Decision: Unit tests for service logic, integration tests for API endpoints, component tests for UI

**Rationale**: Follow existing test patterns. Backend uses Vitest with `vi.mock` for DB. Frontend uses Vitest + React Testing Library.

**Backend Tests:**
- Unit: notification service (preference checking, recipient filtering, self-suppression, visibility enforcement)
- Unit: notification trigger functions (review, lifecycle, AI)
- Integration: notification API routes (list, unread-count, mark-read, mark-all-read, preferences CRUD, SSE, admin metrics)

**Frontend Tests:**
- Component: NotificationBell (badge rendering, 99+ cap)
- Component: NotificationPopover (5 items, show all link, empty state)
- Component: NotificationsPage (pagination, mark all read)
- Component: NotificationPreferences (category toggles)

**Patterns:**
- Backend mock: `vi.mock('../../src/db', ...)` with chain pattern
- Auth mock: cookie-based (`Cookie: echo_session=token`)
- Frontend mock: `Element.prototype.scrollIntoView = vi.fn()` for jsdom
