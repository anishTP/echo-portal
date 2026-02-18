# Feature Specification: Branch Isolation Model

**Feature Branch**: `001-branch-isolation-model`
**Created**: 2026-01-20
**Status**: Draft
**Input**: User description: "This feature defines the branch as the primary unit of isolation, change, comparison, and convergence. All mutable work must occur within branches, and all shared or consumable states must be reached only through explicit convergence. Branches have explicit lifecycle states that determine mutability and eligibility for convergence. Only defined state transitions are allowed; forbidden transitions must be rejected. Branches have explicit visibility levels that govern who can observe their state. Visibility is intentional, inherited, and enforced; public or consumed states are immutable. Branch lineage and history must always be preserved. Convergence is explicit, traceable, and must not rewrite history or bypass validation. These rules apply equally to human and automated actions and must hold regardless of implementation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Work in Isolated Branch (Priority: P1)

A contributor needs to create a new branch to work on documentation changes without affecting the published content. They create a branch, make edits, preview their changes, and can save work-in-progress without impacting anyone else.

**Why this priority**: This is the foundational workflow - all collaboration begins with isolated workspace creation. Without this, no other features can function.

**Independent Test**: Can be fully tested by creating a branch, making changes, and verifying that published content remains unchanged while the branch owner can see and edit their work.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they create a new branch from published content, **Then** a new isolated workspace is created with a copy of the current published state
2. **Given** a branch exists, **When** the branch owner makes edits, **Then** changes are only visible to the branch owner and published content remains unchanged
3. **Given** a branch is in draft state, **When** the owner saves changes, **Then** changes persist in the branch without affecting published content
4. **Given** a branch exists, **When** a non-owner attempts to view it, **Then** access is denied unless explicit visibility permissions grant access

---

### User Story 2 - Submit Branch for Review (Priority: P1)

A contributor completes their work and wants to submit their branch for review before publishing. They transition the branch to review state, making it visible to designated reviewers who can provide feedback and request changes.

**Why this priority**: Review is critical for governance and quality control. This is the gate between mutable work and publication, enforcing the constitution's explicit change control.

**Independent Test**: Can be fully tested by creating a branch with changes, submitting for review, and verifying that reviewers can see the changes, provide feedback, and either approve or request changes.

**Acceptance Scenarios**:

1. **Given** a branch is in draft state with committed changes, **When** the owner submits for review, **Then** the branch transitions to review state and becomes visible to designated reviewers
2. **Given** a branch is in review state, **When** a reviewer examines the changes, **Then** they can see all modifications compared to the base (published) state
3. **Given** a branch is in review state, **When** a reviewer requests changes, **Then** the branch transitions back to draft state and the owner can make revisions
4. **Given** a branch is in review state, **When** a reviewer approves, **Then** the branch transitions to approved state and becomes eligible for publication
5. **Given** a branch is in review state, **When** the owner attempts to make edits, **Then** the edit is rejected (branch must return to draft first)

---

### User Story 3 - Publish Approved Branch (Priority: P1)

A publisher wants to merge approved changes into the published state, making them visible to all consumers. They initiate convergence, which validates the branch, preserves history, and updates the published state without rewriting any history.

**Why this priority**: Publication is the culmination of the workflow and the only way approved changes reach consumers. This enforces the constitution's principle that published content is reached only through explicit convergence.

**Independent Test**: Can be fully tested by approving a branch and then publishing it, verifying that changes appear in published content, history is preserved, and the branch becomes immutable.

**Acceptance Scenarios**:

1. **Given** a branch is in approved state, **When** a publisher initiates convergence, **Then** all validation checks pass (no conflicts, history intact, audit trail complete)
2. **Given** validation passes, **When** convergence proceeds, **Then** the branch content merges into published state and becomes visible to all consumers
3. **Given** convergence succeeds, **When** the branch transitions to published state, **Then** the branch becomes immutable and lineage is preserved
4. **Given** a branch is published, **When** anyone attempts to modify it, **Then** the modification is rejected
5. **Given** convergence is in progress, **When** a failure occurs, **Then** the system rolls back safely without corrupting published state

---

### User Story 4 - Compare Branch to Published State (Priority: P2)

A contributor or reviewer wants to see exactly what has changed between a branch and the current published content. They view a comparison that shows all additions, deletions, and modifications.

**Why this priority**: Comparison enables informed review and validation. It's essential for reviewers to understand the scope of changes before approval.

**Independent Test**: Can be fully tested by creating a branch with changes and viewing the comparison, verifying that all differences are accurately displayed.

**Acceptance Scenarios**:

1. **Given** a branch has changes, **When** a user with view permission requests a comparison, **Then** all differences between the branch and published state are displayed
2. **Given** multiple changes exist, **When** viewing the comparison, **Then** each change shows the before and after state with clear visual indicators
3. **Given** no changes exist, **When** viewing the comparison, **Then** the system indicates the branch is identical to published state

---

### User Story 5 - Manage Branch Visibility (Priority: P2)

A branch owner wants to control who can see their work-in-progress. They can set visibility to private (owner only), team (specific reviewers), or public (anyone can view but not edit).

**Why this priority**: Visibility control supports flexible collaboration models while maintaining security. Not all work should be visible to everyone immediately.

**Independent Test**: Can be fully tested by creating a branch, setting different visibility levels, and verifying access control works correctly for different user types.

**Acceptance Scenarios**:

1. **Given** a branch is created, **When** the owner sets visibility to private, **Then** only the owner can view the branch
2. **Given** a branch exists, **When** the owner sets visibility to team and designates reviewers, **Then** owner and designated reviewers can view the branch
3. **Given** a branch exists, **When** the owner sets visibility to public, **Then** anyone can view the branch but only the owner can edit (in draft state)
4. **Given** visibility changes, **When** a user's access level changes, **Then** their access is updated immediately

---

### User Story 6 - Trace Branch Lineage and History (Priority: P3)

A user wants to understand the history of a branch: when it was created, who worked on it, what reviews occurred, and when it was published. They access the complete audit trail showing all state transitions and modifications.

**Why this priority**: Auditability is essential for governance but doesn't block core workflows. Users can work effectively without constantly checking history.

**Independent Test**: Can be fully tested by performing a complete workflow (create, edit, review, publish) and verifying that all events are logged and traceable.

**Acceptance Scenarios**:

1. **Given** a branch exists, **When** a user views the branch history, **Then** all state transitions are displayed with timestamp, actor, and reason
2. **Given** changes were made, **When** viewing history, **Then** each modification shows who made it and when
3. **Given** a branch was published, **When** viewing lineage, **Then** the connection to the published state and the base it diverged from is clear
4. **Given** multiple reviews occurred, **When** viewing history, **Then** all review comments, approvals, and rejections are recorded

---

### Edge Cases

- What happens when two branches have conflicting changes and both attempt to converge to published state? → **Resolved**: First-wins with blocking. The first branch to start convergence wins; the second is blocked and must rebase/merge manually before retrying. This preserves explicit control and prevents silent overwrites.
- How does the system handle a branch that remains in draft state for an extended period while published content evolves significantly? → **Resolved**: No special handling. Branches remain valid indefinitely; staleness is the user's responsibility. Conflicts surface at convergence time per first-wins blocking policy.
- What happens if a user loses permission to access a branch while actively editing it? → **Resolved**: Session remains valid until save; next operation checks permissions and rejects if unauthorized. User receives clear error message.
- How does the system handle attempted state transitions that violate the defined lifecycle (e.g., draft directly to published)? → **Resolved**: Per FR-005, the state machine rejects invalid transitions with clear error messages specifying which transition is forbidden and why.
- What happens when a convergence operation partially succeeds then fails midway? → **Resolved**: Per FR-015, convergence is atomic. Transaction rollback ensures no partial state; either fully succeeds or fully rolls back with no data corruption.
- How does the system handle branch lineage when published state has advanced significantly since branch creation? → **Resolved**: No special handling per clarification session. Branches remain valid indefinitely; conflicts surface at convergence time per first-wins blocking policy.
- What happens if an automated process attempts to bypass review and directly publish? → **Resolved**: Per FR-017, all rules apply equally to human users and automated processes. Automation cannot bypass review; the same state machine guards reject forbidden transitions.
- How are branches handled when the user who created them is deactivated or removed? → **Resolved**: Branches owned by deactivated users transition to admin ownership or are archived. The branch and its history are preserved for audit purposes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce that all mutable work occurs exclusively within branches
- **FR-002**: System MUST prevent direct modification of published content (changes only via branch convergence)
- **FR-003**: System MUST create new branches with a complete copy of the current published state at time of creation
- **FR-004**: System MUST enforce explicit lifecycle states for branches: Draft, Review, Approved, Published, Archived
- **FR-005**: System MUST allow only defined state transitions and reject all forbidden transitions
- **FR-006**: System MUST enforce that Draft branches are editable only by the branch owner
- **FR-007**: System MUST enforce that Review and Approved branches are immutable (no edits without returning to Draft)
- **FR-008**: System MUST enforce that Published branches are permanently immutable
- **FR-009**: System MUST support explicit visibility levels: Private (owner only), Team (designated reviewers), Public (anyone can view)
- **FR-010**: System MUST enforce visibility rules consistently across all access paths (UI, API, automated processes)
- **FR-011**: System MUST preserve complete branch lineage showing origin, divergence point, and relationship to published state
- **FR-012**: System MUST preserve complete history of all changes, state transitions, and convergence events
- **FR-013**: System MUST perform validation before convergence: conflict detection, history integrity, audit completeness
- **FR-014**: System MUST reject convergence attempts that would rewrite history or bypass validation
- **FR-015**: System MUST ensure convergence is atomic: either fully succeeds or fully rolls back
- **FR-016**: System MUST support comparison between branch state and published state at any point
- **FR-017**: System MUST apply all rules equally to human users and automated processes
- **FR-018**: System MUST log all branch operations for audit trail: creation, modifications, state transitions, convergence
- **FR-019**: System MUST track actor (user or system) for every operation
- **FR-020**: System MUST prevent orphaned or dangling branches (all branches must trace to a known published state)

### Key Entities

- **Branch**: An isolated workspace for making changes. Contains state (Draft/Review/Approved/Published/Archived), visibility level, owner, lineage information, and change history. Represents the primary unit of work.

- **Published State**: The authoritative, immutable record of content. All consumers see this state. Can only be updated through branch convergence. Represents the single source of truth.

- **Convergence**: The explicit operation that merges a branch's changes into published state. Includes validation, conflict resolution, history preservation, and audit logging. Represents the transition from mutable work to immutable truth.

- **Lineage**: The relationship chain showing how a branch relates to published state: origin point, divergence, parallel changes, and convergence. Represents the historical record.

**Storage Architecture**: Git-based storage for all branch content, commits, and merge operations (leveraging native Git branching/history). PostgreSQL for user accounts, permissions, workflow state, and application metadata.

- **State Transition**: A movement between lifecycle states (e.g., Draft → Review). Must be explicit, authorized, and logged. Represents governance checkpoints.

### Actors and Permissions *(mandatory per Constitution VIII)*

| Role/Actor          | Permissions                                                                                                    | Authentication Required |
|---------------------|----------------------------------------------------------------------------------------------------------------|-------------------------|
| **Anonymous User**  | View published content only                                                                                    | No                      |
| **Contributor**     | Create branches, edit own draft branches, submit for review, view branches where granted visibility            | Yes                     |
| **Reviewer**        | View branches in review state, compare changes, approve or request changes, cannot edit branch content         | Yes                     |
| **Publisher**       | Initiate convergence for approved branches, publish to live state, cannot bypass approval                      | Yes                     |
| **Administrator**   | Override workflows (emergency only), archive branches, manage user permissions, view all audit logs            | Yes                     |
| **System/Automation** | Create branches, perform automated validations, log audit events - MUST follow same rules as human users   | Yes (service account)   |

**Authentication Methods**: OAuth 2.0 with multiple providers (GitHub, Google, etc.) for individual users, plus SSO/SAML integration for enterprise identity providers. Service accounts use API tokens.

### Lifecycle States and Transitions *(mandatory per Constitution VIII)*

**States**:

- **Draft**: Branch is being actively authored. Editable by owner only. Not eligible for convergence. Default visibility: Private.

- **Review**: Branch submitted for review. Immutable (no edits). Visible to designated reviewers. Eligible for approval or rejection back to Draft.

- **Approved**: Branch has passed review. Immutable. Eligible for convergence/publication. Visible to publishers.

- **Published**: Branch has been converged into published state. Permanently immutable. Visible to all (per original visibility setting, but content is in published state).

- **Archived**: Branch is no longer active. Immutable. Preserved for history and audit purposes. Visible per original visibility rules.

**Valid Transitions**:

```
Draft → Review (by: Branch Owner)
  Condition: Branch has committed changes

Review → Draft (by: Reviewer - request changes)
  Condition: Reviewer provides reason for rejection

Review → Approved (by: Reviewer)
  Condition: Reviewer validates changes meet requirements

Approved → Published (by: Publisher via convergence operation)
  Condition: Validation passes (no conflicts, history intact)

Published → Archived (by: Administrator)
  Condition: Content no longer needed or superseded

Draft → Archived (by: Owner or Administrator)
  Condition: Work abandoned or no longer needed

Review → Archived (by: Administrator)
  Condition: Review stalled or work abandoned
```

**Forbidden Transitions** (must be rejected):

```
Draft → Approved (cannot skip review)
Draft → Published (cannot skip review and approval)
Review → Published (cannot skip approval)
Approved → Draft (cannot un-approve; create new branch if changes needed)
Published → any other state except Archived (immutability)
Archived → any state (final state)
```

**State Diagram**:

```
                    ┌──────────┐
                    │  DRAFT   │ (editable by owner)
                    └────┬─────┘
                         │
                    submit for review
                         │
                         ▼
                    ┌──────────┐
            ┌───────┤  REVIEW  │ (immutable, reviewers can view)
            │       └────┬─────┘
            │            │
    request changes   approve
            │            │
            ▼            ▼
         ┌──────────┐  ┌──────────┐
         │  back to │  │ APPROVED │ (immutable, eligible for publish)
         │  DRAFT   │  └────┬─────┘
         └──────────┘       │
                         publish
                            │
                            ▼
                      ┌───────────┐
                      │ PUBLISHED │ (permanently immutable)
                      └─────┬─────┘
                            │
                         archive
                            ▼
                       ┌──────────┐
                       │ ARCHIVED │ (final state)
                       └──────────┘
```

### Visibility Boundaries *(mandatory per Constitution VIII)*

| State      | Default Visibility | Who Can View                                      | Who Can Edit        | Can Change Visibility |
|------------|--------------------|---------------------------------------------------|---------------------|-----------------------|
| Draft      | Private            | Branch owner only (unless explicitly shared)      | Branch owner only   | Yes (owner)           |
| Review     | Team               | Owner + designated reviewers                      | No one (immutable)  | No (locked during review) |
| Approved   | Team               | Owner + reviewers + publishers                    | No one (immutable)  | No (locked)           |
| Published  | Public             | Everyone (content is now in published state)      | No one (immutable)  | No (locked)           |
| Archived   | Inherited          | Same as when archived (preserved)                 | No one (immutable)  | No (locked)           |

**Visibility Levels** (for Draft branches):

- **Private**: Only branch owner can view and edit
- **Team**: Owner + explicitly designated team members/reviewers can view (owner can edit if Draft)
- **Public**: Anyone can view (owner can edit if Draft, but content visible to all)

**Inheritance Rules**:

- Visibility set in Draft state carries through to Review, Approved, and Published (with restrictions above)
- Once a branch enters Review, visibility cannot be changed (governance lock)
- Published content is always publicly visible regardless of original branch visibility (content merged into public state)

### Auditability and Traceability *(mandatory per Constitution VIII)*

**Required Audit Events**:

- Branch created (actor, timestamp, base published state, initial visibility)
- Branch state transition (actor, timestamp, from-state, to-state, reason)
- Branch content modification (actor, timestamp, summary of changes)
- Visibility change (actor, timestamp, old visibility, new visibility)
- Review submitted (actor, timestamp, reviewers assigned)
- Review action (actor, timestamp, action: approved/rejected, comments)
- Convergence initiated (actor, timestamp, branch ID, validation results)
- Convergence completed (actor, timestamp, branch ID, published state updated)
- Convergence failed (actor, timestamp, branch ID, failure reason, rollback status)
- Branch archived (actor, timestamp, reason)

**Audit Log Format**: Each log entry MUST include:

- `timestamp`: ISO 8601 format with timezone
- `actor`: User ID, username, or system identifier (e.g., "user:123", "system:auto-validator")
- `action`: Action type (branch_created, state_transitioned, content_modified, converged, etc.)
- `resource`: Branch ID or published state ID
- `metadata`: JSON object with additional context:
  - `from_state` / `to_state` (for transitions)
  - `old_value` / `new_value` (for modifications)
  - `reason` (for rejections, approvals, archival)
  - `validation_results` (for convergence)
  - `affected_files` or `change_summary` (for content modifications)

**Retention Policy**: Audit logs retained for 7 years to support compliance and forensic analysis

**Traceability Requirements**:

- Every branch MUST trace its origin to a specific published state (base divergence point)
- Every published state update MUST trace back to the branch that introduced it
- Every state transition MUST be traceable to a specific actor and timestamp
- Lineage MUST show the complete chain: published state → branch creation → modifications → review → approval → convergence → updated published state

## Clarifications

### Session 2026-01-20

- Q: When two branches with conflicting changes both attempt to converge to published state, how should the system resolve the conflict? → A: First-wins with blocking - first branch to start convergence wins; second is blocked and must rebase/merge manually before retrying
- Q: What is the primary data storage approach for branches, published state, and audit logs? → A: Git-based storage for branching, commits, and PRs; PostgreSQL for users and other application metadata
- Q: What are the availability and recovery expectations for the system? → A: Standard (99.5% uptime) - ~4 hours downtime/month acceptable, daily backups, recovery within 4 hours
- Q: How should user authentication be handled for this system? → A: OAuth with multiple providers (GitHub, Google, etc.) plus SSO/SAML integration for enterprise identity providers
- Q: How should the system handle long-lived branches that have diverged significantly from published state (stale branches)? → A: No special handling - branches remain valid indefinitely; staleness is the user's responsibility to manage

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Contributors can create a branch and begin editing within 5 seconds
- **SC-002**: 100% of direct edits to published content are rejected (zero tolerance for bypassing branch workflow)
- **SC-003**: 100% of forbidden state transitions are rejected with clear error messages
- **SC-004**: Branch comparisons display all changes within 3 seconds for branches with up to 1000 modifications
- **SC-005**: Convergence validation completes within 10 seconds for branches with up to 5000 changes
- **SC-006**: System supports 100 concurrent branches being edited without performance degradation
- **SC-007**: All branch operations (create, transition, converge) complete or rollback safely with zero data loss
- **SC-008**: 100% of operations are logged with complete audit trail (zero silent failures)
- **SC-009**: Users can trace complete branch lineage and history within 2 seconds
- **SC-010**: Published state remains consistent and accessible even when multiple convergence operations are queued
- **SC-011**: System maintains 99.5% uptime (~4 hours downtime/month maximum)
- **SC-012**: Daily backups with recovery capability within 4 hours (RPO: 24 hours, RTO: 4 hours)

### Verification Requirements *(mandatory per Constitution VIII)*

**Acceptance Tests**:

- [ ] All user stories pass acceptance scenarios
- [ ] All functional requirements verified through automated and manual testing
- [ ] All state transitions tested including forbidden transitions (must be rejected)
- [ ] All permission checks validated for each role/actor
- [ ] All audit events logged correctly with complete metadata
- [ ] Convergence rollback tested (simulate failures at various stages)
- [ ] Concurrent operations tested (multiple users, multiple branches)
- [ ] Lineage preservation tested (verify no history is lost or rewritten)

**Test Coverage**:

- Core workflows: 80% minimum (Constitution X)
  - Branch creation and editing
  - State transitions (valid and invalid)
  - Review and approval workflows
  - Convergence and publication
  - Visibility enforcement
  - Audit logging
- Edge cases: All documented edge cases have test coverage
  - Conflicting changes during convergence
  - Permission changes during active editing
  - Long-lived branches diverging significantly from published state
  - Partial convergence failures and rollback
  - Forbidden state transitions
  - Automated processes following human rules
- Integration tests: All state transitions and actor interactions across the complete workflow

**Validation Procedures**:

1. Manual walkthrough of all user stories by product owner and sample users
2. Automated regression test suite covering all functional requirements
3. Security audit confirming role-based access control and visibility enforcement
4. Performance testing confirming success criteria metrics (5s, 3s, 10s thresholds)
5. Chaos testing: simulate failures during convergence, verify rollback and recovery
6. Audit log review: verify completeness, accuracy, and traceability of all events
7. Constitution compliance check: verify all 10 principles upheld (explicit control, immutability, branch-first, etc.)

**Sign-off Criteria**:

- [ ] Product owner approves user experience for all workflows
- [ ] Security review completed and confirms governance model is enforced
- [ ] Performance benchmarks met (all success criteria pass)
- [ ] Documentation complete (user guides, API docs, audit reports)
- [ ] Constitution compliance verified (no silent state changes, no history rewrites, explicit convergence)
