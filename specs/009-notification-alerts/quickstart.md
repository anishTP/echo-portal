# Quickstart: Notification & Alert System

**Feature**: 009-notification-alerts | **Date**: 2026-02-12

## Overview

This feature extends the existing notification system with preference controls, real-time delivery, lifecycle/AI event triggers, and a complete frontend notification experience. It builds on the existing `notifications` table, `notification-service.ts`, `review-notifications.ts`, and frontend notification components.

## Prerequisites

- PostgreSQL database running with existing schema
- pnpm monorepo with `backend/`, `frontend/`, `shared/` packages
- Existing notification infrastructure in place (service, routes, components, hooks)

## Phased Delivery

### Phase 1: Core Notification Inbox (P1)

**Backend:**
1. Add `category` and `actor_id` columns to `notifications` table schema
2. Create `notification_preferences` table schema
3. Run Drizzle migration: `cd backend && pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
4. Extend `notification-service.ts`:
   - Add `resolveRecipients(userIds, actorId, category, branchId?)` — filters self, deactivated, visibility, preferences
   - Add `markAllRead(userId)` — bulk update + audit log
   - Add `getPreferences(userId)` / `updatePreference(userId, category, enabled)` — CRUD with audit
   - Update `create` / `createBulk` to accept `category` and `actorId`, call `resolveRecipients`
5. Extend `notifications.ts` routes:
   - `POST /notifications/mark-all-read`
   - `GET /notifications/preferences`
   - `PATCH /notifications/preferences`
6. Update `list` response to include `category`, `actorId`, `actorName` (join with users table)

**Frontend:**
1. Update `NotificationBell.tsx` — change badge cap from 9+ to 99+
2. Create `NotificationPopover.tsx` — Radix Popover wrapping NotificationList (5 items) + "Show all" link
3. Update `NotificationList.tsx` — add popover mode (limited items), "Mark all as read" button
4. Create `Notifications.tsx` page — full page at `/notifications` with pagination
5. Update `notification-api.ts` — add `markAllRead`, `getPreferences`, `updatePreference`
6. Update `useNotifications.ts` — add `useMarkAllRead`, `useNotificationPreferences`, `useUpdatePreference`
7. Update `notificationStore.ts` — add `preferences` state
8. Wire `NotificationPopover` into `AppHeader.tsx`
9. Add `/notifications` route to router

### Phase 2: Review Event Triggers (P1)

**Backend:**
1. Update `review-notifications.ts` — integrate `resolveRecipients` into all 7 notify functions
2. Add `category: 'review'` and `actorId` to all review notification calls
3. Ensure comment thread participant tracking for reply notifications

### Phase 3: Lifecycle Event Triggers (P2)

**Backend:**
1. Create `notification-triggers.ts`:
   - `notifyCollaboratorAdded(branchId, collaboratorId, branchName, actorId)`
   - `notifyCollaboratorRemoved(branchId, collaboratorId, branchName, actorId)`
   - `notifyContentPublished(branchId, branchName, ownerId, collaboratorIds, actorId)`
   - `notifyBranchArchived(branchId, branchName, ownerId, actorId)`
   - `notifyRoleChanged(userId, oldRole, newRole, actorId)`
2. Add trigger calls in:
   - Branch service — collaborator add/remove
   - Branch routes — publish endpoint
   - Transition service — archive event
   - User routes — role change endpoint

### Phase 4: Preferences UI (P2)

**Frontend:**
1. Create `NotificationPreferences.tsx` — three category toggles with descriptions
2. Add `/settings/notifications` route
3. Add "Notification Settings" link in user menu or notifications page

### Phase 5: Real-Time Delivery (P3)

**Backend:**
1. Create `notification-sse.ts` — in-memory pub/sub + connection manager
   - `subscribe(userId, stream)` / `unsubscribe(userId, stream)`
   - `publish(userId, notification)` — delivers to all active connections
   - Heartbeat every 30s
   - `Last-Event-ID` catch-up on reconnect
2. Add `GET /notifications/stream` SSE endpoint
3. Update `create` / `createBulk` to call `publish` after insert

**Frontend:**
1. Create `useNotificationSSE` hook — connects to SSE endpoint, handles reconnection
2. Update `notificationStore.ts` — merge SSE events into local state
3. Update `NotificationBell` — reflect SSE count updates immediately
4. Update `NotificationPopover` — prepend new SSE notifications when open

### Phase 6: Admin Metrics (P3)

**Backend:**
1. Add `GET /notifications/admin/metrics` endpoint with admin role check
2. Aggregate counts by type for 24h, 7d, 30d periods

**Frontend:**
1. Add notification metrics section to admin dashboard (or new admin page)
2. Display counts by type and time period

## Running Tests

```bash
# Backend unit tests
cd backend && pnpm vitest run tests/unit/notification-service.test.ts
cd backend && pnpm vitest run tests/unit/notification-triggers.test.ts
cd backend && pnpm vitest run tests/unit/notification-preferences.test.ts

# Backend integration tests
cd backend && pnpm vitest run tests/integration/notification-api.test.ts
cd backend && pnpm vitest run tests/integration/notification-sse.test.ts

# Frontend component tests
cd frontend && pnpm vitest run tests/unit/components/NotificationBell.test.tsx
cd frontend && pnpm vitest run tests/unit/components/NotificationPopover.test.tsx
cd frontend && pnpm vitest run tests/unit/components/NotificationPreferences.test.tsx

# All notification tests
cd backend && pnpm vitest run --grep notification
cd frontend && pnpm vitest run --grep notification
```

## Key Patterns to Follow

1. **Fire-and-forget notifications**: Always wrap trigger calls in `.catch(err => console.error(...))` — never let notification failures block the triggering action
2. **Recipient filtering**: Always call `resolveRecipients` before `createBulk` — this handles self-suppression, deactivation, visibility, and preferences
3. **Zustand + TanStack Query**: Store manages client state, TanStack manages server cache. SSE events update the store directly; TanStack queries provide the initial load and polling fallback.
4. **Audit logging**: Use `auditLogger.log()` for preference changes and bulk mark-read. Follow existing audit patterns in `backend/src/services/audit/logger.ts`.
