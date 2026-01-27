# Feature Specification: Identity, Roles, and Permissions

**Feature Branch**: `002-identity-roles-permissions`
**Created**: 2026-01-24
**Status**: Draft
**Input**: User description: "This feature defines how identity, roles, and permissions are enforced across Echo's public, contributor, and governance layers."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authenticate to Access Protected Features (Priority: P1)

A user visits Echo and wants to contribute content or participate in governance. They must first authenticate to establish their identity. Without authentication, they can only view published public content.

**Why this priority**: Authentication is the foundation for all other permission checks. No contributor, reviewer, or admin actions are possible without first establishing identity.

**Independent Test**: Can be fully tested by attempting to sign in and verifying the user's identity is established before accessing protected features.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user, **When** they attempt to create a branch, **Then** they are prompted to authenticate first
2. **Given** a user with valid credentials, **When** they complete authentication, **Then** their identity is established and they can access features matching their role
3. **Given** an authenticated user, **When** they sign out, **Then** their session ends and they return to anonymous viewer status

---

### User Story 2 - Create and Manage Content as a Contributor (Priority: P1)

An authenticated contributor wants to create a new branch to propose changes. They can create branches, make commits, and submit their work for review, but cannot approve their own work or publish directly.

**Why this priority**: Content creation is the core value proposition of Echo. Contributors must be able to propose changes through the governed workflow.

**Independent Test**: Can be fully tested by creating a branch, making changes, and submitting for review, then verifying the contributor cannot bypass review requirements.

**Acceptance Scenarios**:

1. **Given** an authenticated contributor, **When** they create a new branch, **Then** the branch is created with them as the owner and in draft state
2. **Given** a contributor with a draft branch, **When** they submit for review with explicitly assigned reviewers, **Then** the branch transitions to review state and assigned reviewers are notified
3. **Given** a contributor, **When** they attempt to approve their own branch, **Then** the action is denied with a clear error message
4. **Given** a contributor, **When** they attempt to publish directly, **Then** the action is denied (must go through review)

---

### User Story 3 - Review and Approve Content as a Reviewer (Priority: P1)

A reviewer receives notification that content needs review. They can view the proposed changes, request modifications, or approve the content for publication.

**Why this priority**: Review is the governance gate that ensures quality and compliance before publication. This is essential to Echo's governed workflow.

**Independent Test**: Can be fully tested by reviewing a submitted branch, requesting changes or approving, and verifying state transitions occur correctly.

**Acceptance Scenarios**:

1. **Given** an authenticated reviewer, **When** they view a branch in review state, **Then** they can see all proposed changes and the contributor's context
2. **Given** a reviewer reviewing a branch, **When** they request changes, **Then** the branch returns to draft state with feedback for the contributor
3. **Given** a reviewer reviewing a branch, **When** they approve and the configured approval threshold is met, **Then** the branch transitions to approved state ready for publication
4. **Given** a reviewer, **When** they attempt to review their own branch, **Then** the action is denied (self-review forbidden)

---

### User Story 4 - Publish Approved Content as Admin (Priority: P2)

An administrator sees that content has been approved through review. They can publish the approved content, making it part of the public record. Published content becomes immutable.

**Why this priority**: Publication is the final step in the governance workflow. While important, it builds on authentication and review capabilities.

**Independent Test**: Can be fully tested by publishing an approved branch and verifying it becomes publicly visible and immutable.

**Acceptance Scenarios**:

1. **Given** an admin viewing an approved branch, **When** they publish, **Then** the content becomes publicly visible and immutable
2. **Given** an admin, **When** they attempt to publish a branch that is not approved, **Then** the action is denied
3. **Given** published content, **When** anyone attempts to modify it, **Then** the modification is denied (immutability enforced)

---

### User Story 5 - View Public Content as Anonymous Viewer (Priority: P2)

An anonymous visitor wants to browse Echo's published content without creating an account. They can view all published public content but cannot see drafts, in-review content, or private branches.

**Why this priority**: Public accessibility supports Echo's mission while maintaining governance over unpublished work.

**Independent Test**: Can be fully tested by browsing as an anonymous user and verifying only published content is visible.

**Acceptance Scenarios**:

1. **Given** an anonymous viewer, **When** they browse Echo, **Then** they see only published public content
2. **Given** an anonymous viewer, **When** they attempt to access a draft branch URL, **Then** they receive an access denied message
3. **Given** an anonymous viewer, **When** they attempt to access a private branch URL, **Then** they receive an access denied message

---

### User Story 6 - Audit Trail Review (Priority: P3)

An administrator needs to investigate who made specific changes and when. They can access the complete audit trail showing all actions, actors, and timestamps.

**Why this priority**: Auditability supports accountability and troubleshooting but is not required for core content workflows.

**Independent Test**: Can be fully tested by performing various actions and verifying they appear correctly in the audit log.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they view the audit log for a branch, **Then** they see all state transitions with actor and timestamp
2. **Given** any authenticated user action, **When** it completes, **Then** an audit entry is created with actor ID, action, timestamp, and context
3. **Given** an AI-assisted action, **When** it completes, **Then** the audit entry identifies both the AI system and the human who initiated it

---

### Edge Cases

- What happens when a user's role is changed mid-session? Session permissions update on next action
- How does the system handle concurrent review approvals? First valid approval wins, others see "already approved"
- What happens if a reviewer is removed while reviewing? Their pending review is cancelled. If no assigned reviewers remain, the branch automatically returns to Draft state
- How are permission denied errors communicated? Clear message stating required permission and current role
- What happens to a user's branches if their account is deactivated? Branches remain but become read-only
- What happens after 5 failed login attempts? Account locked for 15 minutes, user shown lockout message with remaining time
- What happens if authentication provider is unavailable? Existing sessions continue, new logins fail gracefully with retry option, anonymous viewing of published content remains available

## Requirements *(mandatory)*

### Functional Requirements

**Identity & Authentication**
- **FR-001**: System MUST require authentication for all contribution and governance actions
- **FR-002**: System MUST attribute every content-affecting action to an authenticated actor
- **FR-003**: System MUST support both human users and AI-assisted actions with the same governance rules
- **FR-004**: System MUST maintain session state so users remain authenticated across page loads
- **FR-005**: System MUST allow users to sign out, immediately ending their session
- **FR-005a**: System MUST lock accounts for 15 minutes after 5 consecutive failed authentication attempts
- **FR-005b**: System MUST log all failed authentication attempts for security monitoring
- **FR-005c**: System MUST maintain existing sessions when authentication provider is unavailable (graceful degradation)
- **FR-005d**: System MUST allow anonymous viewing of published content even when authentication provider is unavailable

**Role Management**
- **FR-006**: System MUST support four distinct roles: Viewer (anonymous), Contributor, Reviewer, and Administrator
- **FR-007**: System MUST assign exactly one primary role to each authenticated user
- **FR-008**: System MUST evaluate permissions based on the user's assigned role
- **FR-009**: System MUST prevent users from granting themselves higher privileges (no privilege escalation)
- **FR-010**: Only Administrators MUST be able to change user roles

**Permission Enforcement**
- **FR-011**: System MUST evaluate permissions in context: considering the active branch, lifecycle state, and content visibility
- **FR-012**: System MUST deny actions that would bypass lifecycle rules (e.g., publishing unapproved content)
- **FR-013**: System MUST deny self-review (contributors cannot approve their own branches)
- **FR-013a**: System MUST support configurable approval thresholds (number of required approvals) per branch
- **FR-013b**: System MUST default to single approval when no threshold is configured
- **FR-014**: System MUST enforce immutability of published content
- **FR-015**: System MUST check permissions before every state-changing action

**Visibility Rules**
- **FR-016**: System MUST allow anonymous viewers to see published public content only
- **FR-017**: System MUST restrict draft and in-review content to the owner and explicitly assigned reviewers
- **FR-017a**: System MUST require branch owner or admin to explicitly assign at least one reviewer before transitioning to Review state. If all assigned reviewers are removed while in Review state, the branch MUST automatically return to Draft state
- **FR-017b**: System MUST allow branch owners to invite other contributors as collaborators with edit access during Draft state. Collaborators MUST retain read-only access when the branch transitions to Review or Approved state
- **FR-017c**: System MUST prevent a user from being both a collaborator and an assigned reviewer on the same branch (mutually exclusive roles per branch)
- **FR-018**: System MUST respect branch visibility settings (public vs. private/gated)
- **FR-019**: System MUST hide private branches from users without explicit access

**Audit & Compliance**
- **FR-020**: System MUST log all authentication events (sign in, sign out, session expiry)
- **FR-021**: System MUST log all permission-checking events with the decision (granted/denied)
- **FR-022**: System MUST log all state transitions with actor, timestamp, and context
- **FR-023**: System MUST retain audit logs for a minimum of 7 years
- **FR-024**: System MUST make audit logs queryable by administrators

### Key Entities

- **User**: An authenticated identity with an assigned role, email, display name, and account status
- **Role**: A named capability boundary (Viewer, Contributor, Reviewer, Administrator) defining what actions are permitted
- **Permission**: A specific action that may be granted or denied (e.g., create-branch, approve-review, publish)
- **Session**: A time-bound authenticated context linking a user to their current access level. Sessions expire 24 hours after last activity (sliding expiry); each authenticated request resets the expiry window
- **Audit Entry**: A record of an action including actor, timestamp, action type, resource, and outcome

### Actors and Permissions *(mandatory per Constitution VIII)*

| Role/Actor       | Permissions                                                                                  | Authentication Required |
|------------------|----------------------------------------------------------------------------------------------|-------------------------|
| **Viewer**       | View published public content                                                                | No                      |
| **Contributor**  | View published content, create branches, edit own drafts, invite collaborators to own drafts, submit for review | Yes                     |
| **Reviewer**     | All Contributor permissions, plus: review branches, request changes, approve (not own work)  | Yes                     |
| **Administrator**| All Reviewer permissions, plus: publish approved content, manage users, view audit logs, archive content | Yes           |

### Lifecycle States and Transitions *(mandatory per Constitution VIII)*

**States**:
- **Draft**: Branch being authored (editable by owner)
- **Review**: Submitted for review (read-only to owner, reviewable by assigned reviewers)
- **Approved**: Reviewed and approved (ready to publish, immutable except by admin)
- **Published**: Live and publicly visible (immutable)
- **Archived**: Removed from active use (read-only, visible based on original settings). *Deferred: archival transitions are out of scope for this feature's MVP*

**Valid Transitions**:
```
Draft → Review (by: Owner/Contributor)
Review → Draft (by: Reviewer - request changes)
Review → Approved (by: Reviewer - not the owner, when configured approval threshold met)
Approved → Published (by: Administrator)
Published → Archived (by: Administrator) [DEFERRED — future feature]
Draft → Archived (by: Owner or Administrator) [DEFERRED — future feature]
```

### Visibility Boundaries *(mandatory per Constitution VIII)*

| State     | Default Visibility | Who Can Access                                      |
|-----------|-------------------|-----------------------------------------------------|
| Draft     | Private           | Owner, owner-invited collaborators (with edit access) |
| Review    | Private           | Owner, collaborators (read-only), assigned reviewers |
| Approved  | Private           | Owner, collaborators (read-only), reviewers who approved, administrators |
| Published | Public            | Everyone (unless marked as gated/private)           |
| Archived  | Inherited         | Same as pre-archive visibility                      |

### Auditability and Traceability *(mandatory per Constitution VIII)*

**Required Audit Events**:
- Authentication events (sign in, sign out, session timeout, failed attempts)
- Role changes (actor, target user, old role, new role)
- Branch creation (actor, branch ID, initial state)
- State transitions (actor, branch ID, from-state, to-state, reason)
- Permission denials (actor, attempted action, reason for denial)
- Publication events (actor, branch ID, timestamp)

**Audit Log Format**: Each log entry MUST include:
- `timestamp`: ISO 8601 format with timezone
- `actor`: User ID (or "system" for automated actions, with initiating user noted)
- `action`: Action type (authenticated, transitioned, denied, published, etc.)
- `resource`: Branch ID or user ID as applicable
- `outcome`: success or failure
- `metadata`: Additional context (old/new values, denial reason, etc.)

**Retention Policy**: Audit logs retained for 7 years minimum to support compliance and governance review. Implementation MUST use PostgreSQL range partitioning (by month) on the audit_logs table to maintain query performance over long retention periods. Old partitions MAY be moved to cold storage after 1 year.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of contribution actions are attributable to an authenticated actor (no anonymous modifications)
- **SC-002**: 0% of content reaches published state without completing the review workflow
- **SC-003**: Users can determine their current permissions within 2 seconds of any page load
- **SC-004**: Permission denied errors include actionable guidance 100% of the time
- **SC-005**: Audit logs capture 100% of state transitions and permission decisions
- **SC-006**: Administrators can query audit history and receive results within 5 seconds for any branch
- **SC-007**: Role changes take effect within 30 seconds without requiring user re-authentication

### Verification Requirements *(mandatory per Constitution VIII)*

**Acceptance Tests**:
- [ ] All user stories pass acceptance scenarios
- [ ] All functional requirements verified
- [ ] All state transitions tested with valid and invalid actors
- [ ] All permission checks validated (positive and negative cases)
- [ ] All audit events logged correctly
- [ ] Privilege escalation attempts blocked and logged

**Test Coverage**:
- Core workflows: 80% minimum (Constitution X)
- Edge cases: All documented edge cases have test coverage
- Integration tests: All state transitions and actor interactions
- Security tests: Permission boundary testing for each role

**Validation Procedures**:
1. Manual walkthrough of each user story by a non-technical user
2. Automated test suite covering all permission combinations
3. Security review confirming role-based access control cannot be bypassed
4. Audit log verification confirming all actions are captured

**Sign-off Criteria**:
- [ ] Product owner approves user experience
- [ ] Security review completed confirming no privilege escalation paths
- [ ] All roles tested in isolation and combination
- [ ] Audit log completeness verified

## Clarifications

### Session 2026-01-24

- Q: How should reviewers be assigned to branches submitted for review? → A: Explicit assignment (branch owner or admin must explicitly assign specific reviewers)
- Q: How should the system handle repeated failed authentication attempts? → A: Temporary lockout (lock account for 15 minutes after 5 failed attempts)
- Q: How many reviewer approvals are required before content can be published? → A: Configurable (admin-configurable per branch; content type scoping deferred)
- Q: Should contributors be able to add collaborators to their draft branches? → A: Yes, branch owners can invite other contributors as collaborators with edit access
- Q: What happens if authentication provider (OAuth) is unavailable? → A: Existing sessions continue working, new logins fail gracefully with retry option, anonymous users can view published content only

### Session 2026-01-26

- Q: Should collaborators retain access to a branch after it transitions from Draft to Review? → A: Yes, collaborators retain read-only access in Review and Approved states (edit access removed when branch leaves Draft)
- Q: Can a branch collaborator also be assigned as a reviewer on the same branch? → A: No, collaborators and reviewers must be mutually exclusive on the same branch (enforces separation of authoring and review roles)
- Q: What should the session duration and renewal strategy be? → A: 24-hour sliding expiry (each authenticated request resets the 24h window; no separate refresh token)
- Q: Should approval thresholds be configurable per content type? → A: No, per-branch only for MVP. Content types are not modeled; removed from FR-013a
- Q: Should archival (Published→Archived, Draft→Archived) be in scope for MVP? → A: No, deferred to future feature. Core workflow (Draft→Review→Approved→Published) is sufficient for launch
- Q: What happens when all assigned reviewers are removed from a branch in Review state? → A: Branch automatically returns to Draft state. Owner must assign new reviewers to resubmit
- Q: What audit log retention mechanism should be used for 7-year compliance? → A: PostgreSQL range partitioning by month. Old partitions may be moved to cold storage after 1 year

## Assumptions

- OAuth2 or similar industry-standard authentication will be used (specific provider TBD during implementation)
- The four-role model (Viewer, Contributor, Reviewer, Administrator) is sufficient for MVP; additional roles may be added later
- AI-assisted actions are always initiated by an authenticated human user and inherit that user's permissions
- Session duration is 24 hours with sliding expiry (reset on each authenticated request). No separate refresh token mechanism is used
- Audit log storage uses PostgreSQL range partitioning (by month) to support 7 years of queryable history
