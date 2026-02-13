# Tasks: Notification & Alert System

**Feature**: `specs/009-notification-alerts/`
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/notification-api.md
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `echo-portal-635s` |
| **Spec Label** | `spec:009-notification-alerts` |
| **User Stories Source** | `specs/009-notification-alerts/spec.md` |
| **Planning Details** | `specs/009-notification-alerts/plan.md` |
| **Data Model** | `specs/009-notification-alerts/data-model.md` |

> **STATUS**: Beads tracking is **ACTIVE**

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | Notification & Alert System |
| **User Stories** | 6 from spec.md |
| **Priority** | P1 (MVP: US1 + US2) → P2 (US3 + US4) → P3 (US5 + US6) |
| **Est. Tasks** | 51 |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.1:
- ✅ **Testing as Contract (X)**: Tests included per user story phase
- ✅ **Explicit Change Control (I)**: All notifications attributable, preference changes audited
- ✅ **Specification Completeness (VIII)**: All mandatory sections verified in spec.md
- ✅ **Clarity Over Breadth (IX)**: Category-level preferences, in-app only, no grouping/batching

Refer to `.specify/memory/constitution.md` for full principles.

---

## Status Reference

| Icon | Status | Description |
|------|--------|-------------|
| ⬜ | Pending | Not started |
| 🔄 | In Progress | Work underway |
| ✅ | Completed | Done and verified |
| ⚠️ | Blocked | Waiting on dependency |
| 🎯 | MVP | Core deliverable |

---

## Task Format

```
- [ ] T001 [P] [US1] Description `path/to/file.ext`
```

| Element | Meaning |
|---------|---------|
| `T001` | Task ID (sequential) |
| `[P]` | Parallelizable (different files, no blocking deps) |
| `[US1]` | User Story reference |
| `` `path` `` | Exact file path(s) affected |

---

## Query Hints

### Markdown Queries (grep)

```bash
# Filter by user story
grep -E "\[US1\]" tasks.md

# Find parallelizable tasks
grep -E "\[P\]" tasks.md

# Count remaining tasks
grep -c "^- \[ \]" tasks.md
```

### Beads Queries (bd CLI)

```bash
# All open tasks for this feature
bd list --status=open --limit 60

# Ready tasks (no blockers)
bd ready --limit 10

# Task details and comments
bd show {id}
```

---

## Phase 1: Setup — ✅ Completed

**Beads Phase ID**: `echo-portal-o0uw`
**Purpose**: Shared types, DB schema definitions, migration
**Blocks**: All subsequent phases
**Parallelism**: T001–T004 can run in parallel; T005 depends on T003+T004

- [x] T001 [P] Extend `NotificationType` with all 13 event types and add `NotificationCategory` constants with type-to-category mapping in `shared/constants/states.ts`
- [x] T002 [P] Extend `Notification` interface with `category`, `actorId`, `actorName` fields and add `NotificationPreference` type in `shared/types/notification.ts`
- [x] T003 [P] Add `category` (text, NOT NULL) and `actor_id` (uuid, FK → users, nullable) columns to notifications table schema, add `notifications_user_category_idx` index in `backend/src/db/schema/notifications.ts`
- [x] T004 [P] Create `notification_preferences` table schema with `id`, `user_id`, `category`, `enabled`, `updated_at` and UNIQUE(user_id, category) constraint in `backend/src/db/schema/notification-preferences.ts`
- [x] T005 Generate and run Drizzle migration for notifications schema changes (category, actor_id columns) and new notification_preferences table

**✓ Checkpoint**: Schema updated, migration applied, shared types available across packages

---

## Phase 2: Foundational — ✅ Completed

**Beads Phase ID**: `echo-portal-pneh`
**Purpose**: Core notification service extensions that ALL user stories depend on
**Blocks**: All user story implementation
**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T006 Implement `resolveRecipients(userIds, actorId, category, branchId?)` in notification service — applies self-suppression, deactivated user filtering, branch visibility enforcement, and preference checking in order `backend/src/services/notification/notification-service.ts`
- [x] T007 Implement `getPreferences(userId)` and `updatePreference(userId, category, enabled)` with audit logging via `auditLogger.log()` in `backend/src/services/notification/notification-service.ts`
- [x] T008 Implement `markAllRead(userId)` — bulk update `is_read=true, read_at=now()` for all unread notifications, return count, audit log `notifications_bulk_read` in `backend/src/services/notification/notification-service.ts`
- [x] T009 Update `create` and `createBulk` to accept `category` and `actorId` parameters, call `resolveRecipients` before inserting, derive category from type via `NOTIFICATION_TYPE_TO_CATEGORY` mapping in `backend/src/services/notification/notification-service.ts`
- [x] T010 Update `list` to join with users table for `actorName` (left join on actor_id), add `category` query parameter support, include `category`/`actorId`/`actorName` in response in `backend/src/services/notification/notification-service.ts`
- [x] T011 [P] Add `POST /notifications/mark-all-read` route with Zod validation, calls `markAllRead`, returns `{ count }` in `backend/src/api/routes/notifications.ts`
- [x] T012 [P] Add `GET /notifications/preferences` and `PATCH /notifications/preferences` routes with Zod validation for category enum and enabled boolean in `backend/src/api/routes/notifications.ts`
- [x] T013 Update `GET /notifications` route to accept `category` query param (enum: review, lifecycle, ai) and pass to service in `backend/src/api/routes/notifications.ts`
- [x] T014 [P] Unit tests for notification service: `resolveRecipients` (self-suppression, deactivated, visibility, preferences), `markAllRead`, `getPreferences`/`updatePreference`, extended `create`/`createBulk` in `backend/tests/unit/notification-service.test.ts`
- [x] T015 [P] Integration tests for notification API: mark-all-read endpoint, preferences GET/PATCH endpoints, list with category filter, response includes actorName in `backend/tests/integration/notification-api.test.ts`

**✓ Checkpoint**: All notification service extensions working, API endpoints responding correctly, tests passing. Foundation ready for user stories.

---

## Phase 3: US1 — View and manage in-app notifications (P1) 🎯 MVP — ✅ Completed

**Beads Phase ID**: `echo-portal-y2f6`
**Goal**: Users can view notifications via bell icon popover and full page, mark as read individually or in bulk
**Acceptance**: Bell badge shows count (99+ cap), popover shows 5 recent + "Show all", full page paginates, mark read/all-read works, empty state renders
**Dependencies**: Phase 2 complete

- [x] T016 [P] [US1] Update `NotificationBell` badge cap from 9+ to 99+ — show exact count up to 99, then "99+" for higher values in `frontend/src/components/notification/NotificationBell.tsx`
- [x] T017 [P] [US1] Add `markAllRead()`, `getPreferences()`, `updatePreference(category, enabled)` methods to notification API client in `frontend/src/services/notification-api.ts`
- [x] T018 [P] [US1] Add `useMarkAllRead` mutation hook — calls `markAllRead()`, invalidates unread-count and list queries, resets store count in `frontend/src/hooks/useNotifications.ts`
- [x] T019 [US1] Update `NotificationList` to support popover mode (prop `maxItems={5}`, "Show all" link navigating to `/notifications`, "Mark all as read" button) and full-page mode (pagination controls) in `frontend/src/components/notification/NotificationList.tsx`
- [x] T020 [US1] Create `NotificationPopover` using `@radix-ui/react-popover` — wraps NotificationBell as trigger, renders NotificationList in popover content (5 items), handles open/close state, dismisses on outside click in `frontend/src/components/notification/NotificationPopover.tsx`
- [x] T021 [US1] Wire `NotificationPopover` into `AppHeader` right section (before ThemeToggle, after avatar) for authenticated users only in `frontend/src/components/layout/AppHeader.tsx`
- [x] T022 [US1] Create `Notifications` full page — renders NotificationList in full-page mode with pagination, "Mark all as read" button in header, empty state when no notifications in `frontend/src/pages/Notifications.tsx`
- [x] T023 [US1] Add `/notifications` route (lazy-loaded) to router configuration in `frontend/src/router/index.tsx`
- [x] T024 [P] [US1] Component tests for NotificationBell — badge renders exact count 1-99, renders "99+" at 100+, hides badge at 0, handles loading state in `frontend/tests/unit/components/NotificationBell.test.tsx`
- [x] T025 [P] [US1] Component tests for NotificationPopover — shows 5 most recent items, "Show all" link navigates to /notifications, "Mark all as read" calls mutation, empty state message, click notification marks as read in `frontend/tests/unit/components/NotificationPopover.test.tsx`

**✓ Checkpoint**: User Story 1 functional — bell badge shows unread count (99+ cap), popover shows 5 recent + "Show all", full page paginates, mark read/all-read works

---

## Phase 4: US2 — Review event triggers (P1) 🎯 MVP — ✅ Completed

**Beads Phase ID**: `echo-portal-acgm`
**Goal**: Review workflow events generate correctly-filtered notifications for the right recipients
**Acceptance**: All 7 review event types trigger notifications, self-suppression works, deactivated users excluded, preferences respected
**Dependencies**: Phase 2 complete (can run parallel with US1)

- [x] T026 [US2] Update all 7 notify functions in `review-notifications.ts` to pass `category: 'review'` and `actorId` to notification service, use `resolveRecipients` for recipient filtering instead of direct createBulk in `backend/src/services/review/review-notifications.ts`
- [x] T027 [US2] Ensure comment thread participant tracking — when `notifyCommentReply` is called, collect all thread participant IDs (parent author + prior repliers) for recipient list in `backend/src/services/review/review-notifications.ts`
- [x] T028 [US2] Unit tests for review notification triggers — verify each of 7 event types creates correct notifications, self-suppression excludes actor, deactivated users filtered, disabled review category suppresses all in `backend/tests/unit/review-notifications.test.ts`

**✓ Checkpoint**: User Story 2 functional — review workflow events create properly-filtered notifications for correct recipients

---

## Phase 5: US3 — Lifecycle event triggers (P2) — ✅ Completed

**Beads Phase ID**: `echo-portal-gqfg`
**Goal**: Branch lifecycle events and role changes generate notifications
**Acceptance**: All 5 lifecycle event types trigger notifications, fire-and-forget pattern followed, recipient filtering applied
**Dependencies**: Phase 2 complete (can run parallel with US1, US2)

- [x] T029 [US3] Create `notification-triggers.ts` with fire-and-forget lifecycle trigger functions: `notifyCollaboratorAdded`, `notifyCollaboratorRemoved`, `notifyContentPublished`, `notifyBranchArchived`, `notifyRoleChanged` — all use `resolveRecipients` and `.catch()` pattern in `backend/src/services/notification/notification-triggers.ts`
- [x] T030 [US3] Integrate `notifyCollaboratorAdded`/`notifyCollaboratorRemoved` fire-and-forget calls into collaborator management functions in `backend/src/api/routes/branches.ts`
- [x] T031 [US3] Integrate `notifyContentPublished` fire-and-forget call into publish endpoint — notify branch owner + all collaborators after successful publication in `backend/src/api/routes/branches.ts`
- [x] T032 [US3] Integrate `notifyBranchArchived` fire-and-forget call into archive transition — notify branch owner after ARCHIVE event completes in `backend/src/api/routes/branches.ts`
- [x] T033 [US3] Integrate `notifyRoleChanged` fire-and-forget call into role change endpoint — notify affected user with old and new role in `backend/src/api/routes/users.ts`
- [x] T034 [US3] Unit tests for all 5 lifecycle trigger functions — verify recipients, fire-and-forget pattern (errors don't propagate), category='lifecycle', actorId set correctly in `backend/tests/unit/notification-triggers.test.ts`

**✓ Checkpoint**: User Story 3 functional — lifecycle events create notifications for correct recipients without blocking triggering actions

---

## Phase 6: US4 — Configure notification preferences (P2) — ✅ Completed

**Beads Phase ID**: `echo-portal-zpte`
**Goal**: Users can view and toggle notification categories on/off
**Acceptance**: Preferences page shows 3 categories with toggles, changes persist immediately, disabled categories suppress notifications
**Dependencies**: Phase 2 complete

- [x] T035 [P] [US4] Add `useNotificationPreferences` (query) and `useUpdatePreference` (mutation) hooks — query returns all 3 categories, mutation updates single category and invalidates preferences query in `frontend/src/hooks/useNotifications.ts`
- [x] T036 [US4] Create `NotificationPreferences` component — displays 3 category cards (Review Events, Lifecycle Events, AI Events) with descriptions, Radix Switch toggles, loading/saving state feedback in `frontend/src/components/notification/NotificationPreferences.tsx`
- [x] T037 [US4] Add `/settings/notifications` route (lazy-loaded) and add "Notification Settings" link to notifications full page header in `frontend/src/router/index.tsx` and `frontend/src/pages/Notifications.tsx`
- [x] T038 [US4] Component tests for NotificationPreferences — renders 3 categories with correct enabled/disabled state, toggle calls mutation, loading state, error handling in `frontend/tests/unit/components/NotificationPreferences.test.tsx`

**✓ Checkpoint**: User Story 4 functional — preferences page renders, toggles persist, disabled categories suppress notification creation

---

## Phase 7: US5 — Real-time notification updates (P3) — ✅ Completed

**Beads Phase ID**: `echo-portal-dai0`
**Goal**: New notifications appear in real-time without page refresh via SSE
**Acceptance**: Badge updates within 5 seconds of new notification, open popover prepends new items, reconnection recovers missed notifications
**Dependencies**: Phase 2 + Phase 3 complete (needs bell/popover from US1)

- [x] T039 [P] [US5] Create `notification-sse.ts` — in-memory pub/sub with `subscribe(userId, stream)`, `unsubscribe(userId, stream)`, `publish(userId, notification)`, heartbeat timer (30s), `Last-Event-ID` catch-up replay in `backend/src/services/notification/notification-sse.ts`
- [x] T040 [US5] Add `GET /notifications/stream` SSE endpoint using Hono's `streamSSE` — authenticates via requireAuth, subscribes user, sends heartbeat/notification/count events, handles disconnect cleanup in `backend/src/api/routes/notifications.ts`
- [x] T041 [US5] Integrate SSE publish into `create` and `createBulk` — after successful DB insert, call `publish(userId, notification)` for each recipient (fire-and-forget) in `backend/src/services/notification/notification-service.ts`
- [x] T042 [US5] Create `useNotificationSSE` hook — opens persistent fetch-based SSE connection on auth, parses notification/count/heartbeat events, auto-reconnects with backoff, sends Last-Event-ID on reconnect in `frontend/src/hooks/useNotificationSSE.ts`
- [x] T043 [US5] Update `notificationStore` for SSE integration — add `addNotification(notification)` action that prepends to list and increments count, update `NotificationBell` to reflect SSE count events, update `NotificationPopover` to prepend SSE notifications when open in `frontend/src/stores/notificationStore.ts`
- [x] T044 [US5] Integration tests for SSE endpoint — connection established, heartbeat received, notification event received after creation, Last-Event-ID catch-up works, connection cleanup on disconnect in `backend/tests/integration/notification-sse.test.ts`

**✓ Checkpoint**: User Story 5 functional — real-time badge/popover updates < 5s, reconnection catches up missed notifications

---

## Phase 8: US6 — Administrator notification metrics (P3) — ✅ Completed

**Beads Phase ID**: `echo-portal-bybx`
**Goal**: Admins can view aggregate notification counts by type and time period
**Acceptance**: Admin metrics endpoint returns counts for 24h/7d/30d grouped by type, non-admins get 403
**Dependencies**: Phase 2 complete

- [x] T045 [US6] Add `GET /notifications/admin/metrics` endpoint — admin role check, aggregate COUNT + GROUP BY type for 24h/7d/30d time periods, return `{ periods: { 24h: { total, byType }, 7d: {...}, 30d: {...} } }` in `backend/src/api/routes/notifications.ts`
- [x] T046 [US6] Add notification metrics section to admin dashboard — display total counts and by-type breakdown for each time period, admin-only access check in `frontend/src/pages/AIAdmin.tsx` (or new admin page)
- [x] T047 [US6] Integration tests for admin metrics endpoint — correct counts match actual notifications, non-admin returns 403, empty periods return zero counts in `backend/tests/integration/notification-api.test.ts`

**✓ Checkpoint**: User Story 6 functional — admin dashboard shows accurate aggregate notification metrics

---

## Phase 9: Polish & Cross-Cutting — ✅ Completed

**Beads Phase ID**: `echo-portal-2yod`
**Purpose**: AI notification trigger, edge case coverage, final validation
**Dependencies**: All user story phases complete

- [x] T048 [P] Add AI compliance error notification trigger — when image analysis detects error-severity findings, call `notifyAIComplianceError` fire-and-forget for branch owner/content creator, category='ai' in `backend/src/services/ai/ai-service.ts` and `backend/src/services/notification/notification-triggers.ts`
- [x] T049 [P] Edge case tests — notification with inaccessible resource (link shows access denied), deactivated user receives zero notifications, rapid state transitions each produce own notification, notification creation failure doesn't block triggering action in `backend/tests/unit/notification-edge-cases.test.ts`
- [x] T050 Run quickstart.md validation — execute all test commands from quickstart.md, verify all pass
- [x] T051 Verify Constitution X test coverage — ensure 80%+ coverage for core notification workflows (service, triggers, API), document coverage report

**✓ Checkpoint**: Feature complete — all user stories verified, edge cases covered, AI trigger active, 80%+ test coverage

---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational ─────────────────────────────────────────────┐
    │                                                               │
    ├──────────────┬──────────────┬──────────────┬──────────────┐   │
    ▼              ▼              ▼              ▼              ▼   │
Phase 3: US1   Phase 4: US2   Phase 5: US3   Phase 6: US4   Phase 8: US6
(P1 MVP 🎯)    (P1 🎯)        (P2)           (P2)           (P3)
    │              │              │              │              │   │
    ├──────────────┤              │              │              │   │
    ▼              │              │              │              │   │
Phase 7: US5 ◄─┘              │              │              │   │
(P3, needs US1)                │              │              │   │
    │              │              │              │              │   │
    └──────────────┴──────────────┴──────────────┴──────────────┘   │
                                │                                   │
                                ▼                                   │
                        Phase 9: Polish ◄──────────────────────────┘
```

### Key Rules

1. **Setup** → No dependencies, start immediately
2. **Foundational** → Blocks ALL user stories
3. **US1, US2, US3, US4, US6** → Can run in parallel after Foundational
4. **US5 (SSE)** → Depends on Foundational + US1 (needs bell/popover components)
5. **Polish** → After all desired stories complete

---

## Execution Strategies

### Strategy A: MVP First (Solo Developer)

```
Setup → Foundational → US1 (MVP) → US2 (MVP) → STOP & VALIDATE → [US3 → US4 → US5 → US6 → Polish]
```

Ship after US1 + US2 for core notification inbox + review triggers. Add P2/P3 stories incrementally.

### Strategy B: Parallel Team

```
All: Setup → Foundational
Then split:
  Dev A: US1 (P1) → US5 (P3)
  Dev B: US2 (P1) → US3 (P2)
  Dev C: US4 (P2) → US6 (P3)
Sync: Polish
```

### Strategy C: Sequential Priority

```
Setup → Foundational → US1 → US2 → US3 → US4 → US5 → US6 → Polish
```

One story at a time, in priority order.

---

## Parallel Execution Examples

### Within Setup Phase

```bash
# All [P] tasks in parallel
T001 & T002 & T003 & T004
wait
T005  # depends on T003, T004
```

### Within Foundational Phase

```bash
# Sequential service work (same file)
T006 → T007 → T008 → T009 → T010
# Parallel route work
T011 & T012
wait
T013  # depends on T010
# Parallel tests
T014 & T015
```

### Within US1 Phase

```bash
# Parallel independent tasks
T016 & T017 & T018
wait
# Sequential frontend chain
T019 → T020 → T021
T022 → T023
# Parallel tests
T024 & T025
```

### Across User Stories

```bash
# After Foundational complete, stories in parallel
(Phase 3: US1) & (Phase 4: US2) & (Phase 5: US3) & (Phase 6: US4) & (Phase 8: US6)
wait
Phase 7: US5  # needs US1
wait
Phase 9: Polish
```

---

## Beads ID Mapping

| Task ID | Beads ID | Phase |
|---------|----------|-------|
| T001 | `echo-portal-onlc` | Setup |
| T002 | `echo-portal-dvwg` | Setup |
| T003 | `echo-portal-rz36` | Setup |
| T004 | `echo-portal-df31` | Setup |
| T005 | `echo-portal-6642` | Setup |
| T006 | `echo-portal-xs8y` | Foundational |
| T007 | `echo-portal-gp0w` | Foundational |
| T008 | `echo-portal-cq97` | Foundational |
| T009 | `echo-portal-1uuf` | Foundational |
| T010 | `echo-portal-vn4t` | Foundational |
| T011 | `echo-portal-n92p` | Foundational |
| T012 | `echo-portal-s4fl` | Foundational |
| T013 | `echo-portal-43ta` | Foundational |
| T014 | `echo-portal-1o7v` | Foundational |
| T015 | `echo-portal-t4ij` | Foundational |
| T016 | `echo-portal-x836` | US1 |
| T017 | `echo-portal-qe5o` | US1 |
| T018 | `echo-portal-4o99` | US1 |
| T019 | `echo-portal-5tn2` | US1 |
| T020 | `echo-portal-teg5` | US1 |
| T021 | `echo-portal-hi10` | US1 |
| T022 | `echo-portal-r3mp` | US1 |
| T023 | `echo-portal-v8jf` | US1 |
| T024 | `echo-portal-2f51` | US1 |
| T025 | `echo-portal-rn7s` | US1 |
| T026 | `echo-portal-qzu0` | US2 |
| T027 | `echo-portal-m7bu` | US2 |
| T028 | `echo-portal-ftp6` | US2 |
| T029 | `echo-portal-h48l` | US3 |
| T030 | `echo-portal-nwsd` | US3 |
| T031 | `echo-portal-uibm` | US3 |
| T032 | `echo-portal-7y9l` | US3 |
| T033 | `echo-portal-l7tf` | US3 |
| T034 | `echo-portal-ovn5` | US3 |
| T035 | `echo-portal-5pve` | US4 |
| T036 | `echo-portal-nw1g` | US4 |
| T037 | `echo-portal-5mz4` | US4 |
| T038 | `echo-portal-wrff` | US4 |
| T039 | `echo-portal-fmoh` | US5 |
| T040 | `echo-portal-w988` | US5 |
| T041 | `echo-portal-03dd` | US5 |
| T042 | `echo-portal-rnfh` | US5 |
| T043 | `echo-portal-kcyp` | US5 |
| T044 | `echo-portal-nlcl` | US5 |
| T045 | `echo-portal-bui4` | US6 |
| T046 | `echo-portal-pms1` | US6 |
| T047 | `echo-portal-pnpq` | US6 |
| T048 | `echo-portal-os1t` | Polish |
| T049 | `echo-portal-5bmu` | Polish |
| T050 | `echo-portal-joah` | Polish |
| T051 | `echo-portal-qxdd` | Polish |

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[USn]` labels map tasks to user stories for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate and potentially ship
- Fire-and-forget pattern: All notification trigger calls MUST use `.catch(err => console.error(...))` to never block the triggering action
- **Beads sync**: Always run `bd sync --from-main` at end of session to persist tracking state
