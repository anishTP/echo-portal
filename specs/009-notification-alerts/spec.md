# Feature Specification: Notification & Alert System

**Feature Branch**: `009-notification-alerts`
**Created**: 2026-02-11
**Status**: Draft
**Input**: User description: "Notifications and alert system. This feature defines how the system signals events that require user awareness or action. Notifications are triggered by meaningful state changes or required interventions. They exist to inform or prompt action, not to mirror all system activity. Notifications must be explicit, attributable, and relevant to the recipient. Delivery must respect identity, permissions, branch context, and visibility rules. Notifications must not alter system state. They must never substitute for required review, approval, or governance actions. Failures or delays in notification delivery must not compromise system correctness. These guarantees apply regardless of delivery channel or implementation."

## Clarifications

### Session 2026-02-11

- Q: At what granularity can users control notification preferences? → A: Category-level only (Review Events, Lifecycle Events, AI Events). Individual event types within a category cannot be separately disabled.
- Q: What format should the notification panel take? → A: Dropdown popover from the bell icon showing 5 most recent notifications, plus a "Show all" link that navigates to a dedicated full notifications page.
- Q: Should users be notified when their role is changed by an administrator? → A: Yes, role change notifications are included under Lifecycle Events.
- Q: How should the badge display high unread counts? → A: Cap at 99+. Badge shows exact count up to 99, then "99+" for higher values.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View and manage in-app notifications (Priority: P1)

A user logs in and sees a bell icon in the application header indicating unread notifications. They click it to open a dropdown popover showing the 5 most recent notifications in reverse chronological order, plus a "Show all" link. Each notification describes a specific event (e.g., "Alice requested changes on 'Brand Guidelines v2'"), includes a timestamp, and links to the relevant resource. Clicking "Show all" navigates to a dedicated notifications page with the full list. The user marks individual notifications as read by clicking them, or marks all as read with a single action.

**Why this priority**: Without a notification inbox, users have no way to discover events that need their attention. This is the foundational interaction everything else depends on.

**Independent Test**: Can be fully tested by creating notifications via the existing notification service, then verifying the UI displays them, links to resources, and supports read/unread state management.

**Acceptance Scenarios**:

1. **Given** a user has 5 unread notifications, **When** they view the header, **Then** a badge on the bell icon shows "5"
2. **Given** a user has more than 99 unread notifications, **When** they view the header, **Then** the badge shows "99+"
3. **Given** a user clicks the bell icon, **When** the popover opens, **Then** it shows the 5 most recent notifications and a "Show all" link
4. **Given** a user clicks "Show all" in the popover, **When** the page loads, **Then** they see a full paginated list of all notifications
5. **Given** a user clicks a notification, **When** it opens, **Then** it is marked as read and the unread count decreases by 1
6. **Given** a user clicks "Mark all as read", **Then** all notifications are marked read and the badge disappears
7. **Given** a user has no notifications, **When** they open the popover, **Then** they see an empty state message

---

### User Story 2 - Receive notifications for review workflow events (Priority: P1)

A reviewer is assigned to review a branch. They receive a notification that a review has been requested. They add comments and eventually approve or request changes. The branch owner receives notifications for each of these actions. When the owner resubmits after addressing feedback, the reviewer is notified again. All participants in a comment thread are notified of new replies.

**Why this priority**: Review workflow is the primary collaborative process in the system. Without timely notifications, reviews stall and content publication is delayed.

**Independent Test**: Can be tested by walking through a complete review cycle (submit, comment, request changes, resubmit, approve) and verifying each participant receives the correct notification at each step.

**Acceptance Scenarios**:

1. **Given** an author submits a branch for review, **When** the state transitions to "review", **Then** all assigned reviewers receive a "review requested" notification linking to the review
2. **Given** a reviewer posts a comment on a review, **When** the comment is saved, **Then** the branch owner and other participating reviewers receive a notification
3. **Given** a reviewer requests changes, **When** the decision is recorded, **Then** the branch owner receives a "changes requested" notification with the reviewer's name
4. **Given** a reviewer approves a branch, **When** the decision is recorded, **Then** the branch owner receives an "approved" notification
5. **Given** a user replies to a comment thread, **When** the reply is saved, **Then** the parent comment author and other thread participants are notified

---

### User Story 3 - Receive notifications for branch and content lifecycle events (Priority: P2)

A contributor creates a branch and adds collaborators. The collaborators receive a notification that they've been added. When the branch is published by an administrator, the branch owner and collaborators are notified that their content is now live. When a branch is archived, the owner is notified. When an administrator changes a user's role, the user receives a notification informing them of their new role.

**Why this priority**: Lifecycle events (publication, archival, collaborator changes, role changes) represent important state changes that users need to know about, but they occur less frequently than review events.

**Independent Test**: Can be tested by triggering branch lifecycle transitions (add collaborator, publish, archive) and role changes, then verifying the correct recipients receive notifications.

**Acceptance Scenarios**:

1. **Given** a contributor is added as a collaborator on a branch, **When** the assignment is saved, **Then** the new collaborator receives a notification
2. **Given** a branch is published, **When** the state transitions to "published", **Then** the branch owner and all collaborators receive a "content published" notification
3. **Given** a branch is archived, **When** the state transitions to "archived", **Then** the branch owner receives an "archived" notification
4. **Given** a collaborator is removed from a branch, **When** the removal is saved, **Then** the removed collaborator receives a notification
5. **Given** an administrator changes a user's role, **When** the role change is saved, **Then** the affected user receives a "role changed" notification stating their new role

---

### User Story 4 - Configure notification preferences (Priority: P2)

A user navigates to their notification preferences page. They see a list of notification categories (Review Events, Lifecycle Events, AI Events) with toggles to enable or disable each category for in-app delivery. Preferences operate at the category level — users enable or disable an entire category, not individual event types within it. Changes take effect immediately. Disabled categories stop generating notifications for that user.

**Why this priority**: Users who participate in many branches may be overwhelmed by notifications. Preferences let them control signal-to-noise ratio, which is essential for sustained adoption.

**Independent Test**: Can be tested by disabling a notification category, triggering a corresponding event, and verifying no notification is created for that user.

**Acceptance Scenarios**:

1. **Given** a user opens notification preferences, **When** the page loads, **Then** they see all notification categories with their current enabled/disabled state
2. **Given** a user disables the "Review Events" category, **When** a reviewer approves their branch, **Then** no notification is created for that user
3. **Given** a user re-enables a previously disabled category, **When** a matching event occurs, **Then** they receive the notification
4. **Given** a user has custom preferences, **When** they view preferences, **Then** the toggles reflect their saved choices

---

### User Story 5 - Receive real-time notification updates (Priority: P3)

A user is actively working in the application. A reviewer approves their branch. Without refreshing the page, the notification bell badge updates to reflect the new unread notification. If the notification popover is open, the new notification appears at the top of the list.

**Why this priority**: Real-time delivery improves responsiveness but is not strictly required for the system to function. Users can still refresh or re-open the popover to see new notifications.

**Independent Test**: Can be tested by having two users in separate sessions, triggering a notification event from one, and verifying the other's UI updates without a page refresh.

**Acceptance Scenarios**:

1. **Given** a user is logged in with the notification popover closed, **When** a new notification is created for them, **Then** the badge count updates within 5 seconds without page refresh
2. **Given** a user has the notification popover open, **When** a new notification arrives, **Then** it appears at the top of the list with a visual indicator that it is new
3. **Given** a user loses their real-time connection, **When** they regain connectivity, **Then** any missed notifications are fetched and displayed

---

### User Story 6 - Administrator views notification metrics (Priority: P3)

An administrator wants to understand notification delivery health. They access the admin panel and see aggregate metrics: total notifications sent (last 24h, 7d, 30d) and a breakdown by notification type. This is read-only and does not allow administrators to view individual users' notification content.

**Why this priority**: Operational visibility is important for system health but does not affect core user workflows.

**Independent Test**: Can be tested by generating notifications of various types and verifying the admin dashboard shows correct aggregate counts.

**Acceptance Scenarios**:

1. **Given** an administrator opens the notification admin panel, **When** the page loads, **Then** they see aggregate notification counts by type and time period
2. **Given** notifications have been generated over the past week, **When** the admin views metrics, **Then** the counts match the actual notification records in the system

---

### Edge Cases

- What happens when a notification references a resource the user no longer has access to (e.g., branch visibility changed to private)? The notification remains visible but the link shows an "access denied" message rather than leaking content.
- What happens when a user is deactivated? No new notifications are generated for deactivated users. Existing notifications remain in the database but are inaccessible.
- What happens when a notification event affects a large number of recipients (e.g., a heavily-collaborated branch is published)? The system creates notifications for all eligible recipients without blocking the triggering action.
- What happens when a branch transitions rapidly through multiple states? Each transition generates its own notification; no notifications are suppressed or merged.
- What happens when the notification service is temporarily unavailable? The triggering action (review, publish, etc.) succeeds regardless. Notification creation failures are logged but do not roll back the triggering operation.
- What happens when a user has all notification categories disabled? No notifications are created for them. They can still manually navigate to resources via the UI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an unread notification count badge in the application header for authenticated users, capped at "99+" for counts exceeding 99
- **FR-002**: System MUST provide a dropdown popover from the bell icon showing the 5 most recent notifications, plus a "Show all" link to a dedicated full notifications page
- **FR-003**: Each notification MUST display: event description, actor attribution (who caused it), timestamp, and a link to the relevant resource
- **FR-004**: Users MUST be able to mark individual notifications as read
- **FR-005**: Users MUST be able to mark all notifications as read in a single action
- **FR-006**: System MUST generate notifications for review workflow events: review requested, comment added, comment reply, changes requested, approved, reviewer added, reviewer removed
- **FR-007**: System MUST generate notifications for lifecycle events: collaborator added/removed, content published, branch archived, user role changed
- **FR-008**: Notification recipients MUST be determined by their relationship to the resource (owner, collaborator, reviewer, comment participant) and the event type
- **FR-009**: System MUST NOT generate notifications for a user's own actions (e.g., a reviewer does not receive a notification for their own comment)
- **FR-010**: System MUST respect branch visibility rules when determining notification recipients — users who cannot access a branch MUST NOT receive notifications about it
- **FR-011**: System MUST NOT generate notifications for deactivated users
- **FR-012**: Users MUST be able to configure notification preferences at the category level (Review Events, Lifecycle Events, AI Events). Individual event types within a category cannot be separately controlled.
- **FR-013**: Preference changes MUST take effect immediately for subsequent events
- **FR-014**: Notification creation failures MUST NOT prevent or roll back the triggering action
- **FR-015**: System MUST support real-time delivery of notifications to active sessions without requiring page refresh
- **FR-016**: System MUST provide a notification preferences page listing all notification categories with enable/disable controls
- **FR-017**: The full notifications page MUST support pagination for users with many notifications
- **FR-018**: Notifications MUST be immutable records — once created, their content MUST NOT be modified (only read status may change)
- **FR-019**: System MUST generate notifications for AI compliance events when image analysis detects issues at "error" severity on a user's branch content

### Key Entities

- **Notification**: An immutable record of a system event relevant to a specific user. Key attributes: recipient, event type, actor, resource reference, read status, creation time.
- **Notification Preference**: A user-scoped setting that controls which categories of notifications a user receives. Key attributes: user, category, enabled/disabled. Operates at category level only.
- **Notification Category**: A logical grouping of related event types. Three categories: "Review Events" (review requested, comment added, comment reply, changes requested, approved, reviewer added, reviewer removed), "Lifecycle Events" (collaborator added/removed, content published, branch archived, role changed), "AI Events" (compliance issues).

### Actors and Permissions *(mandatory per Constitution VIII)*

| Role/Actor       | Permissions                                                                                        | Authentication Required |
|------------------|----------------------------------------------------------------------------------------------------|-------------------------|
| **Viewer**       | View own notifications, mark as read, configure own preferences                                    | Yes                     |
| **Contributor**  | View own notifications, mark as read, configure own preferences                                    | Yes                     |
| **Reviewer**     | View own notifications, mark as read, configure own preferences                                    | Yes                     |
| **Administrator**| View own notifications, mark as read, configure own preferences, view aggregate notification metrics | Yes                     |
| **System**       | Create notifications, enforce visibility and preference rules                                       | N/A (internal actor)    |

### Lifecycle States and Transitions *(mandatory per Constitution VIII)*

**Notification States**:
- **Unread**: Notification has been created but the recipient has not acknowledged it
- **Read**: Recipient has marked the notification as read (explicitly or by clicking it)

**Valid Transitions**:
```
Unread → Read (by: Recipient)
```

Notifications are immutable once created. There is no delete, edit, or archive state for notifications from the user's perspective. The system may implement retention policies to remove old notifications, but this is an operational concern, not a user-facing state.

**Notification Preference States**:
- **Enabled** (default): Notifications in this category are generated for the user
- **Disabled**: Notifications in this category are suppressed for the user

**Valid Transitions**:
```
Enabled → Disabled (by: User)
Disabled → Enabled (by: User)
```

### Visibility Boundaries *(mandatory per Constitution VIII)*

| Context                          | Visibility                                | Who Can Access           |
|----------------------------------|-------------------------------------------|--------------------------|
| User's own notifications         | Private                                   | Only the recipient       |
| Notification content             | Bounded by source resource visibility     | System enforces at creation time |
| Notification preferences         | Private                                   | Only the user            |
| Aggregate notification metrics   | Admin-only                                | Administrators           |

Notifications MUST NOT be used to circumvent branch or content visibility rules. If a user cannot access a branch, they MUST NOT receive notifications about events on that branch, regardless of their role on other branches.

### Auditability and Traceability *(mandatory per Constitution VIII)*

**Required Audit Events**:
- Notification preference changed (actor, timestamp, category, old value, new value)
- Bulk "mark all as read" actions (actor, timestamp, count of notifications affected)

Routine notification creation and individual read-state changes are high-volume, low-risk operations that do not require individual audit log entries. The existing audit log for triggering events (review submitted, branch published, etc.) provides traceability to the source action.

**Audit Log Format**: Each log entry MUST include:
- `timestamp`: ISO 8601 format
- `actor`: User ID
- `action`: Action type (preference_changed, notifications_bulk_read)
- `resource`: User ID (for preferences) or "notifications" (for bulk read)
- `metadata`: Additional context (category, old/new values, count)

**Retention Policy**: Notifications are retained for 90 days. Notifications older than 90 days may be purged by the system. Audit log entries follow the existing system-wide retention policy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authenticated users can view their unread notification count and open the notification popover within 1 second of page load
- **SC-002**: Users can navigate from a notification to the referenced resource in a single click
- **SC-003**: Real-time notification delivery reaches active sessions within 5 seconds of the triggering event
- **SC-004**: Notification preference changes take effect for the very next event (zero missed suppressions after save)
- **SC-005**: Notification creation for any triggering event completes without adding perceptible delay to the triggering action
- **SC-006**: All notification recipients are correct per visibility and permission rules — zero notifications delivered to users who lack access to the referenced resource

### Verification Requirements *(mandatory per Constitution VIII)*

**Acceptance Tests**:
- [ ] All user stories pass acceptance scenarios
- [ ] All functional requirements verified
- [ ] Notification lifecycle states tested (unread, read)
- [ ] All permission checks validated (visibility enforcement, self-notification suppression, deactivated user suppression)
- [ ] Notification preference toggles verified for each category
- [ ] Real-time delivery tested across concurrent sessions
- [ ] Notification creation failure does not block triggering action

**Test Coverage**:
- Core workflows: 80% minimum (Constitution X)
- Edge cases: All documented edge cases have test coverage
- Integration tests: Notification generation for all event types, preference enforcement, visibility enforcement

**Validation Procedures**:
1. Manual walkthrough of notification popover and full page interactions (open, read, mark all read, navigate to resource)
2. Automated test suite covers all notification trigger events and recipient determination logic
3. Security validation confirms no cross-user notification leakage and visibility rule enforcement
4. Load testing confirms notification creation does not degrade triggering action performance

**Sign-off Criteria**:
- [ ] Product owner approves notification UX and event coverage
- [ ] Security review confirms visibility and permission enforcement
- [ ] Performance benchmarks met (popover load < 1s, real-time < 5s)
- [ ] All notification categories have preference controls

## Assumptions

- **In-app only**: The initial implementation covers in-app notifications only. Email, push, or other external delivery channels are out of scope and can be added as future enhancements.
- **Existing notification infrastructure**: The system already has a `notifications` table and `notification-service.ts` with basic CRUD operations. This feature builds on that foundation rather than replacing it.
- **Existing review notifications**: Review-related notification types (review_requested, review_approved, etc.) already exist in `review-notifications.ts`. This feature formalizes, extends, and adds UI for them.
- **90-day retention**: Notifications are retained for 90 days as a reasonable default for a content management system. This is an operational default, not a compliance requirement.
- **No notification grouping/batching**: Notifications are delivered individually. Digest or batching features are out of scope for the initial implementation.
- **All categories enabled by default**: New users and existing users start with all notification categories enabled. Users opt out rather than opt in.
