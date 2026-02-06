# Feature Specification: Review and Approval Workflow

**Feature Branch**: `006-review-approval`
**Created**: 2026-02-03
**Status**: Draft

## Clarifications

### Session 2026-02-03

- Q: When are multiple approvals required vs. single approval? → A: Configurable per-branch; default is 1 approval, contributor can require more when submitting for review.
- Q: Can a contributor approve their own branch? → A: No, contributors cannot approve their own branches (established in prior spec).
- Q: How are reviewers notified of pending reviews? → A: In-app notifications only; reviewers see pending work when they access the system.
- Q: Do unresolved comments block approval? → A: No, comments are informational; only explicit "Request Changes" action blocks approval.
- Q: Are review comments visible in public audit trail after publication? → A: No, audit shows review occurred (actors, timestamps, outcomes) but comment text remains private.

**Input**: User description: "This feature defines how changes are reviewed, evaluated, and approved before becoming shared or consumable. Any change intended to converge, publish, or increase visibility must pass through an explicit review state. This flow is already covered in the branch isolation spec but the review experience has not been addressed. Review evaluates proposed changes relative to a branch's parent and current state. Changes under review must be comparable, inspectable, and attributable. Differences between states must be explicit and preserved for audit. Approval represents intentional acceptance of change. Only approved changes may converge or become consumable. Review outcomes must be explicit. Approval, rejection, and requested changes must be recorded and traceable. No actor—human or automated—may bypass review or approval requirements. These rules apply regardless of implementation and tooling."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit Branch for Review with Context (Priority: P1)

A contributor has completed changes in their branch and wants to submit them for review. They provide a description of their changes, select reviewers, and submit. The system captures the current state for comparison and notifies assigned reviewers.

**Why this priority**: This is the entry point to the review workflow. Without the ability to submit changes with proper context, no review can occur.

**Independent Test**: Can be fully tested by creating a branch with changes, submitting for review with a description, and verifying that reviewers are notified and can see the submission with full context.

**Acceptance Scenarios**:

1. **Given** a contributor has a branch in Draft state with uncommitted or committed changes, **When** they submit for review, **Then** they must provide a description summarizing the changes and select at least one reviewer
2. **Given** a contributor submits for review, **When** the submission is processed, **Then** the system captures a snapshot of the branch state and the parent state for comparison
3. **Given** a review submission is complete, **When** reviewers are assigned, **Then** all assigned reviewers receive notification of the pending review
4. **Given** a branch is submitted for review, **When** the transition completes, **Then** the branch becomes immutable until the review is resolved (approved or returned to draft)

---

### User Story 2 - View and Compare Changes Under Review (Priority: P1)

A reviewer needs to understand exactly what has changed. They access the review, see the contributor's description, and view a comparison showing all differences between the branch state and its parent state. Every change is clearly attributed.

**Why this priority**: Comparison is the core of review—reviewers cannot make informed decisions without seeing exactly what changed. This enables the "inspectable and comparable" requirement.

**Independent Test**: Can be fully tested by accessing a review, viewing the comparison interface, and verifying that all changes are displayed with clear attribution and context.

**Acceptance Scenarios**:

1. **Given** a reviewer accesses a pending review, **When** the review loads, **Then** they see the contributor's description, submission date, and list of all changes
2. **Given** changes exist in the branch, **When** viewing the comparison, **Then** each change shows the before state (parent), after state (branch), and who made the change
3. **Given** multiple changes exist, **When** viewing the comparison, **Then** changes are organized logically (by content type, chronologically, or by affected area)
4. **Given** the parent state has changed since branch creation, **When** viewing the comparison, **Then** the reviewer sees a clear indicator that the base has diverged

---

### User Story 3 - Provide Inline Feedback on Changes (Priority: P1)

A reviewer examines specific changes and wants to leave feedback directly on the content being reviewed. They add comments attached to specific changes, ask questions, or suggest modifications without altering the branch content.

**Why this priority**: Feedback is the communication mechanism between reviewer and contributor. Without inline feedback, review becomes a binary accept/reject with no path to improvement.

**Independent Test**: Can be fully tested by adding comments to specific changes in a review, verifying the contributor can see and respond to them.

**Acceptance Scenarios**:

1. **Given** a reviewer is viewing changes, **When** they select a specific change, **Then** they can add a comment attached to that exact change
2. **Given** a comment is added, **When** the contributor views the review, **Then** the comment appears in context alongside the change it references
3. **Given** multiple reviewers are assigned, **When** each reviewer adds comments, **Then** all comments are visible with clear attribution to each reviewer
4. **Given** a comment thread exists, **When** the contributor or reviewer responds, **Then** the response appears as a thread maintaining conversation context

---

### User Story 4 - Request Changes and Return to Draft (Priority: P1)

A reviewer determines that changes need modification before approval. They request changes, providing a clear explanation. The branch returns to Draft state so the contributor can address the feedback.

**Why this priority**: The ability to request changes is essential for iterative improvement. Without this, review is purely gatekeeping with no constructive path forward.

**Independent Test**: Can be fully tested by requesting changes on a review, verifying the branch returns to Draft, and confirming the contributor can make modifications.

**Acceptance Scenarios**:

1. **Given** a reviewer has examined changes, **When** they request changes, **Then** they must provide a reason explaining what needs to be modified
2. **Given** changes are requested, **When** the action completes, **Then** the branch transitions from Review to Draft state
3. **Given** the branch returns to Draft, **When** the contributor views their branch, **Then** they see all feedback and the request reason prominently displayed
4. **Given** the contributor addresses feedback, **When** they resubmit for review, **Then** the new submission includes history of previous review cycles
5. **Given** changes were requested, **When** viewing the audit trail, **Then** the request is recorded with reviewer, timestamp, and reason

---

### User Story 5 - Approve Changes (Priority: P1)

A reviewer determines that changes are ready for publication. They approve the review, optionally adding a final comment. The branch transitions to Approved state and becomes eligible for convergence.

**Why this priority**: Approval is the gate that enables publication. This is the explicit acceptance of change required before any content can become shared or consumable.

**Independent Test**: Can be fully tested by approving a review and verifying the branch transitions to Approved state with proper audit trail.

**Acceptance Scenarios**:

1. **Given** a reviewer has examined changes, **When** they approve the review, **Then** the branch transitions from Review to Approved state
2. **Given** the contributor configured a required approval count greater than 1, **When** not all required approvals have been collected, **Then** the branch remains in Review state until the configured threshold is met
3. **Given** approval is complete, **When** viewing the branch, **Then** it shows as eligible for publication/convergence
4. **Given** a review is approved, **When** viewing the audit trail, **Then** the approval is recorded with reviewer, timestamp, and any approval comments
5. **Given** the branch is approved, **When** anyone attempts to modify it, **Then** the modification is rejected (approved branches are immutable)

---

### User Story 6 - Track Review Progress and History (Priority: P2)

A contributor or reviewer wants to understand the status of a review: who has reviewed, what feedback was given, how many review cycles occurred, and what's blocking approval. They view a summary of review activity.

**Why this priority**: Visibility into review progress enables coordination and reduces bottlenecks. Contributors know what's expected; reviewers know what's pending.

**Independent Test**: Can be fully tested by viewing review status on a branch that has gone through multiple review cycles, verifying all history is visible and accurate.

**Acceptance Scenarios**:

1. **Given** a branch is in Review state, **When** viewing review status, **Then** the user sees which reviewers have responded and which are pending
2. **Given** multiple review cycles have occurred, **When** viewing history, **Then** each cycle shows submission date, reviewers, outcome, and feedback
3. **Given** feedback was provided, **When** viewing status, **Then** unresolved comments are highlighted as pending items (informational; do not block approval)
4. **Given** approval requirements exist, **When** viewing progress, **Then** the user sees how many approvals are required vs. received

---

### User Story 7 - Manage Review Assignments (Priority: P2)

A contributor or administrator needs to modify reviewer assignments. They can add or remove reviewers from an active review, and new reviewers are notified while removed reviewers lose access.

**Why this priority**: Flexibility in reviewer assignment enables practical workflows—people go on vacation, expertise requirements change, or additional perspectives are needed.

**Independent Test**: Can be fully tested by modifying reviewer assignments on an active review and verifying access and notification changes.

**Acceptance Scenarios**:

1. **Given** a branch is in Review state, **When** the contributor adds a reviewer, **Then** the new reviewer receives notification and gains access to the review
2. **Given** a branch is in Review state, **When** the contributor removes a reviewer who hasn't yet responded, **Then** the reviewer loses access to the review
3. **Given** a reviewer has already provided feedback, **When** they are removed, **Then** their feedback remains visible but they cannot add new comments
4. **Given** reviewer assignments change, **When** viewing audit trail, **Then** all assignment changes are recorded with actor and timestamp

---

### User Story 8 - Handle Automated Review Checks (Priority: P3)

The system can run automated checks as part of review (validation, compliance, quality gates). Automated reviewers follow the same rules as human reviewers: their results are recorded, they cannot bypass requirements, and their feedback is visible.

**Why this priority**: Automation augments human review but must not circumvent governance. This ensures automated processes participate transparently in the review workflow.

**Independent Test**: Can be fully tested by configuring automated checks, submitting a review, and verifying automated results appear alongside human feedback.

**Acceptance Scenarios**:

1. **Given** automated checks are configured, **When** a branch is submitted for review, **Then** automated checks run and their results appear in the review
2. **Given** an automated check fails, **When** viewing the review, **Then** the failure appears as feedback from the automated reviewer with clear explanation
3. **Given** automated approval is configured, **When** the check passes, **Then** the automated approval counts toward required approvals but cannot be the sole approval
4. **Given** automated checks exist, **When** viewing audit trail, **Then** automated actions are recorded with same detail as human actions

---

### Edge Cases

- What happens when a reviewer is assigned but never responds? → **Resolution**: Reviews do not auto-approve or auto-expire. Stale reviews remain in Review state. Contributors can remove unresponsive reviewers or escalate to administrators.
- What happens if the parent/base state changes while a branch is under review? → **Resolution**: Review continues against the original comparison snapshot. Upon approval, convergence validates against current published state—conflicts detected at convergence time per branch isolation spec.
- How are review comments handled when a branch returns to Draft and changes are made? → **Resolution**: Original comments remain visible and linked to the change they reference. If the referenced content is modified, comments are marked as "outdated" but preserved for context.
- What happens if a required reviewer is deactivated while a review is pending? → **Resolution**: Administrators must reassign the review to another qualified reviewer before the review can proceed.
- How does the system handle conflicting approvals and rejections from different reviewers? → **Resolution**: Any reviewer requesting changes blocks approval. All requested changes must be addressed before final approval. Unanimous approval not required, but all concerns must be resolved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST require a description when submitting a branch for review
- **FR-002**: System MUST require at least one reviewer assignment when submitting for review
- **FR-002a**: System MUST allow contributor to configure required approval count (default: 1) when submitting for review
- **FR-003**: System MUST capture a snapshot of branch state and parent state at submission time for comparison
- **FR-004**: System MUST notify all assigned reviewers via in-app notifications when a review is submitted or updated
- **FR-005**: System MUST display all changes between branch state and parent state in a comparable format
- **FR-006**: System MUST attribute each change to the actor who made it
- **FR-007**: System MUST allow reviewers to add comments attached to specific changes
- **FR-008**: System MUST support threaded conversations on review comments
- **FR-009**: System MUST require a reason when requesting changes
- **FR-009a**: System MUST treat "Request Changes" as a blocking action that prevents approval until addressed
- **FR-009b**: System MUST treat comments as informational (unresolved comments do not block approval)
- **FR-010**: System MUST transition branch from Review to Draft when changes are requested
- **FR-011**: System MUST preserve all feedback when a branch returns to Draft for modification
- **FR-012**: System MUST track review history across multiple submission cycles
- **FR-013**: System MUST record approval with reviewer identity, timestamp, and optional comment
- **FR-013a**: System MUST prevent contributors from approving their own branches
- **FR-014**: System MUST enforce that approved branches cannot be modified
- **FR-015**: System MUST enforce that only approved branches may proceed to convergence/publication
- **FR-016**: System MUST apply the same review rules to automated processes as to human reviewers
- **FR-017**: System MUST display review progress showing pending/completed reviewer responses
- **FR-018**: System MUST mark comments as outdated when referenced content changes (but preserve them)
- **FR-019**: System MUST log all review actions to the audit trail
- **FR-020**: System MUST prevent any actor from bypassing review requirements for convergence

### Key Entities

- **Review**: A request for evaluation of a branch's changes. Contains submission description, assigned reviewers, required approval count (default: 1, configurable by contributor), comparison snapshot, status (pending, changes requested, approved), and history of all review cycles. Represents the formal evaluation process.

- **Review Comment**: Feedback attached to a specific change within a review. Contains comment text, author, timestamp, thread replies, and resolution status (informational only—does not block approval). Linked to the specific content it references. Represents communication during review.

- **Comparison Snapshot**: A preserved record of the branch state and parent state at submission time. Enables consistent comparison even if the source or parent changes. Represents the "what changed" view.

- **Review Outcome**: The recorded decision for a review cycle. Types: Approved, Changes Requested, or Pending. Includes actor, timestamp, reason/comments. Represents the formal decision.

- **Review Cycle**: A single round of submission → review → outcome. Multiple cycles may occur before final approval. Each cycle preserves its own comments, outcomes, and timestamps. Represents iterative improvement.

### Actors and Permissions *(mandatory per Constitution VIII)*

| Role/Actor            | Permissions                                                                                         | Authentication Required |
|-----------------------|-----------------------------------------------------------------------------------------------------|-------------------------|
| **Anonymous User**    | No access to reviews (reviews are private until content is published)                               | No                      |
| **Contributor**       | Submit own branches for review, assign/modify reviewers, respond to comments, resubmit after changes | Yes                     |
| **Reviewer**          | View assigned reviews, add comments, approve or request changes, cannot edit branch content         | Yes                     |
| **Publisher**         | View approved branches, initiate convergence (but only for approved branches)                       | Yes                     |
| **Administrator**     | Reassign reviews, remove reviewers, view all reviews, override stuck reviews (emergency only)       | Yes                     |
| **System/Automation** | Run automated checks, record results as reviewer feedback, cannot bypass human approval requirements | Yes (service account)   |

### Lifecycle States and Transitions *(mandatory per Constitution VIII)*

**Review States** (sub-states within the branch Review state):

- **Pending Review**: Submitted, awaiting reviewer response
- **In Discussion**: At least one reviewer has provided feedback, discussion ongoing
- **Changes Requested**: One or more reviewers have requested changes (blocks approval)
- **Approved**: All required approvals received, no outstanding change requests

**Valid Transitions**:

```
Branch Draft → Branch Review (Pending Review)
  Triggered by: Contributor submits for review
  Condition: Description provided, reviewers assigned

Pending Review → In Discussion
  Triggered by: Any reviewer adds comment
  Condition: Feedback provided

Pending Review → Changes Requested
  Triggered by: Reviewer requests changes
  Condition: Reason provided

In Discussion → Changes Requested
  Triggered by: Reviewer requests changes
  Condition: Reason provided

Pending Review → Approved
  Triggered by: All required reviewers approve
  Condition: No outstanding change requests

In Discussion → Approved
  Triggered by: All required reviewers approve
  Condition: No outstanding change requests

Changes Requested → Branch Draft
  Triggered by: Contributor acknowledges and returns to Draft
  Condition: Always allowed (no blocking)

Branch Review (any sub-state) → Branch Draft
  Triggered by: Contributor withdraws review
  Condition: Always allowed

Approved → Branch Approved (eligible for convergence)
  Triggered by: Final approval recorded
  Condition: All requirements met
```

**Forbidden Transitions**:

```
Changes Requested → Approved (must address changes first)
Any state → Published (review cannot directly publish)
Approved → Changes Requested (create new review cycle instead)
```

**State Diagram**:

```
                         ┌─────────────────────────────────────┐
                         │          BRANCH REVIEW              │
                         │                                     │
   Branch Draft ─────────┼───► Pending Review                  │
                         │           │                         │
                         │     ┌─────┴─────┐                   │
                         │     ▼           ▼                   │
                         │ In Discussion  Changes Requested ───┼───► Branch Draft
                         │     │           │                   │     (contributor
                         │     └─────┬─────┘                   │      addresses
                         │           ▼                         │      feedback)
                         │       Approved ─────────────────────┼───► Branch Approved
                         │                                     │     (eligible for
                         └─────────────────────────────────────┘      convergence)
```

### Visibility Boundaries *(mandatory per Constitution VIII)*

| Review State        | Visibility                             | Who Can Access                          |
|---------------------|----------------------------------------|----------------------------------------|
| Pending Review      | Private to review participants         | Contributor, assigned reviewers, admins |
| In Discussion       | Private to review participants         | Contributor, assigned reviewers, admins |
| Changes Requested   | Private to review participants         | Contributor, assigned reviewers, admins |
| Approved            | Private until published                | Contributor, reviewers, publishers, admins |
| (After publication) | Public (review history in audit)       | Everyone can see that review occurred   |

**Comment Visibility**:

- All comments visible to all review participants
- Comments remain visible even after reviewer removed (for audit purposes)
- After publication, comment text remains private; public audit trail shows only that review occurred (actors, timestamps, outcomes)

### Auditability and Traceability *(mandatory per Constitution VIII)*

**Required Audit Events**:

- Review submitted (contributor, timestamp, description, assigned reviewers, snapshot ID)
- Reviewer added (actor, timestamp, reviewer added)
- Reviewer removed (actor, timestamp, reviewer removed, feedback preserved)
- Comment added (reviewer, timestamp, comment ID, linked change) — comment text stored privately, not in public audit
- Comment reply added (actor, timestamp, reply ID, parent comment) — reply text stored privately, not in public audit
- Changes requested (reviewer, timestamp, reason)
- Approval granted (reviewer, timestamp, comments)
- Review withdrawn (contributor, timestamp, reason)
- Review cycle completed (outcome, timestamp, cycle number)
- Automated check completed (system, timestamp, result, details)

**Audit Log Format**: Each log entry MUST include:

- `timestamp`: ISO 8601 format with timezone
- `actor`: User ID or system identifier
- `action`: Action type (review_submitted, comment_added, changes_requested, approved, etc.)
- `resource`: Review ID and Branch ID
- `metadata`: JSON object with context:
  - `description` (for submissions)
  - `reviewers` (for assignment changes)
  - `comment_id` (for comments — text stored separately, not in public audit)
  - `reason` (for change requests)
  - `cycle_number` (for tracking iterations)

**Retention Policy**: Review audit logs retained for 7 years (aligned with branch isolation audit policy)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Contributors can submit a branch for review within 30 seconds of completing their changes
- **SC-002**: Reviewers can view the complete comparison and begin reviewing within 5 seconds of accessing a review
- **SC-003**: 100% of reviews have recorded outcomes (no silent approvals or rejections)
- **SC-004**: 100% of review comments are preserved and traceable after publication
- **SC-005**: 100% of convergence attempts without prior approval are rejected
- **SC-006**: Review comparison displays all changes accurately with zero missed modifications
- **SC-007**: Review history shows complete progression across all cycles within 3 seconds
- **SC-008**: 90% of reviewers report that the comparison view provides sufficient context for decision-making
- **SC-009**: Average review cycle time decreases by 25% compared to email/manual review processes
- **SC-010**: 100% of automated review results are recorded with same audit detail as human reviews

### Verification Requirements *(mandatory per Constitution VIII)*

**Acceptance Tests**:

- [ ] All user stories pass acceptance scenarios
- [ ] All functional requirements verified through automated and manual testing
- [ ] All review state transitions tested (valid and forbidden)
- [ ] All permission checks validated for each role
- [ ] All audit events logged correctly with complete metadata
- [ ] Comment threading and outdated marking tested
- [ ] Multi-cycle review history preserved and displayed correctly
- [ ] Automated reviewer integration tested

**Test Coverage**:

- Core workflows: 80% minimum
  - Submit for review
  - View and compare changes
  - Add and respond to comments
  - Request changes and resubmit
  - Approve review
  - Track review progress
- Edge cases: All documented edge cases have test coverage
  - Unresponsive reviewers
  - Base state divergence
  - Comment preservation across cycles
  - Deactivated reviewers
  - Conflicting reviewer decisions
- Integration tests: Review workflow integrated with branch lifecycle

**Validation Procedures**:

1. Manual walkthrough of complete review workflow by product owner
2. Usability testing with sample reviewers to validate comparison view clarity
3. Automated regression tests for all review state transitions
4. Security audit confirming review cannot be bypassed
5. Performance testing confirming comparison renders within time thresholds
6. Audit log review verifying completeness of review trail

**Sign-off Criteria**:

- [ ] Product owner approves review user experience
- [ ] Security review confirms no bypass paths exist
- [ ] Performance benchmarks met (5s comparison, 30s submission)
- [ ] Audit trail demonstrates complete traceability
- [ ] Documentation complete (reviewer guide, contributor guide)
