# Implementation Plan: Notification & Alert System

**Branch**: `009-notification-alerts` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-notification-alerts/spec.md`

## Summary

Extend the existing notification infrastructure to deliver a complete in-app notification system with real-time delivery, category-level preference controls, and comprehensive event triggers across review, lifecycle, and AI workflows. The system surfaces meaningful state changes to the right users while enforcing branch visibility rules, self-notification suppression, and deactivated user exclusion. Notification creation is fire-and-forget — it never blocks or rolls back the triggering action.

The implementation builds on the existing notifications table, notification service, review-notifications module, and frontend notification components (bell, list, store, hooks). New additions include a notification preferences table, SSE-based real-time delivery, a full notifications page, lifecycle/AI event triggers, and admin metrics.

## Technical Context

**Language/Version**: TypeScript 5.9+, Node.js 20 LTS
**Primary Dependencies**: Hono 4.8.2 (backend), React 19 + Zustand + TanStack Query 5 (frontend), Drizzle ORM 0.44 (PostgreSQL), Zod 3.24.2, @radix-ui/themes + @radix-ui/react-popover
**Storage**: PostgreSQL (existing `notifications` table + new `notification_preferences` table)
**Testing**: Vitest (unit + integration), React Testing Library (component)
**Target Platform**: Web (browser + Node.js server)
**Project Type**: Web application (pnpm monorepo: backend/, frontend/, shared/)
**Performance Goals**: Popover load < 1s, real-time delivery < 5s, notification creation adds no perceptible latency to triggering action
**Constraints**: Fire-and-forget creation (never block triggering action), 90-day retention, in-app only (no email/push)
**Scale/Scope**: Single-server deployment, in-memory pub/sub for SSE

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.1):

- [x] **Explicit Change Control (I)**: Notifications are immutable records of explicit events. Only read status changes (unread→read). Preference changes are audited with actor, timestamp, old/new values. Notification creation is triggered by explicit user actions (review submission, branch publication, etc.), never by background processes.
- [x] **Single Source of Truth (II)**: Notifications are read-only records — they never modify published content. They reference resources by ID but cannot alter them. The notification system is purely observational.
- [x] **Branch-First Collaboration (III)**: Notifications are scoped to branch-level events (review, lifecycle transitions). They respect branch visibility boundaries. No notification can trigger a lifecycle transition.
- [x] **Separation of Concerns (IV)**: Notification viewing is a read-only consumption flow (authenticated). Preference management is a write flow. Notification creation is an internal system concern decoupled from user-facing write flows.
- [x] **Role-Driven Governance (V)**: All roles (viewer, contributor, reviewer, administrator) can view own notifications and manage own preferences. Admin metrics are restricted to administrators. Recipient determination is role-aware (owner, collaborator, reviewer, participant).
- [x] **Open by Default (VI)**: Notifications are private to the recipient (justified — they contain user-specific event information). Aggregate admin metrics are restricted to administrators (justified — operational concern).
- [x] **Layered Architecture (VII)**: Notification triggers are added at service boundaries via fire-and-forget calls. Core workflows (review, branch transitions, publishing) remain unchanged — notification failures are caught and logged, never propagated.
- [x] **Specification Completeness (VIII)**: Spec defines actors/permissions, lifecycle states (unread→read), visibility boundaries (private to recipient), auditability (preference changes, bulk read), and success criteria with verification requirements.
- [x] **Clarity Over Breadth (IX)**: Category-level preferences (not per-event-type). In-app only (no email/push). No notification grouping/batching. No notification deletion from user perspective. Single-server pub/sub (no Redis).
- [x] **Testing as Contract (X)**: Test strategy covers recipient determination, preference enforcement, read state management, immutability, fire-and-forget guarantee, real-time delivery, badge accuracy, pagination, admin metrics, and audit completeness.

## Project Structure

### Documentation (this feature)

```text
specs/009-notification-alerts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── notification-api.md
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   └── schema/
│   │       ├── notifications.ts         # Existing — add category column
│   │       └── notification-preferences.ts  # NEW — preferences table
│   ├── services/
│   │   ├── notification/
│   │   │   ├── notification-service.ts  # Extend — preferences, filtering, markAllRead, SSE pub
│   │   │   ├── notification-triggers.ts # NEW — lifecycle + AI trigger functions
│   │   │   └── notification-sse.ts      # NEW — in-memory pub/sub + SSE connection manager
│   │   └── review/
│   │       └── review-notifications.ts  # Extend — add recipient filtering
│   └── api/
│       └── routes/
│           └── notifications.ts         # Extend — markAllRead, preferences CRUD, SSE, admin metrics
└── tests/
    ├── unit/
    │   ├── notification-service.test.ts      # NEW
    │   ├── notification-triggers.test.ts     # NEW
    │   └── notification-preferences.test.ts  # NEW
    └── integration/
        ├── notification-api.test.ts          # NEW
        └── notification-sse.test.ts          # NEW

frontend/
├── src/
│   ├── components/
│   │   └── notification/
│   │       ├── NotificationBell.tsx      # Extend — 99+ cap, popover integration
│   │       ├── NotificationList.tsx      # Extend — 5-item popover mode, "Show all" link
│   │       ├── NotificationPopover.tsx   # NEW — Radix Popover wrapper
│   │       └── NotificationPreferences.tsx  # NEW — category toggle UI
│   ├── pages/
│   │   └── Notifications.tsx            # NEW — full notifications page with pagination
│   ├── stores/
│   │   └── notificationStore.ts         # Extend — SSE state, preferences
│   ├── hooks/
│   │   └── useNotifications.ts          # Extend — markAllRead, preferences, SSE
│   ├── services/
│   │   └── notification-api.ts          # Extend — markAllRead, preferences, admin metrics
│   └── router/
│       └── index.tsx                    # Extend — add /notifications, /settings/notifications routes
└── tests/
    ├── unit/
    │   └── components/
    │       ├── NotificationBell.test.tsx      # NEW
    │       ├── NotificationPopover.test.tsx   # NEW
    │       └── NotificationPreferences.test.tsx  # NEW
    └── e2e/
        └── notifications.test.ts             # NEW

shared/
├── constants/
│   └── states.ts        # Extend — new notification types + category mapping
└── types/
    └── notification.ts  # Extend — preferences types, category type
```

**Structure Decision**: Web application (Option 2). Extends existing files across backend/, frontend/, shared/ monorepo. New files are minimal — most changes extend existing notification infrastructure.

## Complexity Tracking

> No constitution violations. All complexity is justified by spec requirements.

| Decision | Justification | Simpler Alternative Rejected Because |
|----------|--------------|-------------------------------------|
| SSE for real-time (Phase 5) | Spec FR-015 requires real-time delivery < 5s | Polling-only would not meet 5s requirement without aggressive interval |
| `notification_preferences` table | Spec FR-012 requires persistent category preferences | JSON column on users table — harder to query, no index support |
| `category` column on notifications | Needed for preference enforcement at insert time | Derive from type at runtime — can't use DB-level filtering, maintenance burden |
| In-memory pub/sub for SSE | Single-server deployment, no external dependency | Redis pub/sub — over-engineered for MVP scope |
