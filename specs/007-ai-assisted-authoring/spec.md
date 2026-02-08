# Feature Specification: AI-Assisted Authoring and Controls

**Feature Branch**: `007-ai-assisted-authoring`
**Created**: 2026-02-06
**Status**: Draft

## Clarifications

### Session 2026-02-08

- Q: What types of AI assistance should be available? → A: Both content generation (create new content from prompts) and content transformation (rewrite, summarize, expand, change tone of selected text). The system should support the full spectrum of assistive authoring.
- Q: How should authors invoke AI assistance? → A: Two interaction surfaces: (1) a collapsible side panel with a chat interface for generation requests and iterative refinement, and (2) an inline context menu that appears when right-clicking selected editable content for transformation actions.
- Q: Should AI conversations be multi-turn or independent? → A: Multi-turn within a session. The AI maintains conversation context so authors can iteratively refine output (e.g., "make it shorter", "add more detail"). Conversation context is scoped to the session and branch.
- Q: How should AI-generated content be tracked for attribution? → A: Version-level attribution. Entire content versions are marked as AI-generated (not individual text spans). When an author accepts AI content, a new version is created attributed to the AI system. Subsequent human edits create a new human-attributed version. This is simpler and aligns with existing version infrastructure.
- Q: Where should pending (not-yet-accepted) AI content be stored? → A: Server-side ephemeral storage with session-bound TTL. Pending AI content survives page refresh but is automatically discarded when the session ends. This enables audit of all AI interactions including rejected content.
- Q: What admin constraints should be configurable? → A: Moderate controls including global AI toggle, per-role enable/disable, content type restrictions, usage quotas per user/time period, approved provider/model list, and prompt guidelines/templates.
- Q: What AI provider strategy? → A: Pluggable provider architecture. The system abstracts AI behind a provider interface so providers (Anthropic, OpenAI, local models, etc.) can be configured and swapped without changing the authoring workflow.
- Q: Implementation phasing? → A: P1 (core authoring with generate + transform) and P2 (review attribution) are the initial scope. P3 (admin constraints), P4 (revert), and P5 (audit reporting) follow as subsequent phases.
- Q: What data privacy posture when sending content to external AI providers? → A: No restrictions. Content and prompts are sent to configured providers as-is. Provider's standard data handling applies. Privacy controls (sanitization, on-premise requirements) are out of scope and may be addressed by administrators through provider selection.
- Q: Should AI responses stream in real-time or be delivered as complete responses? → A: Streaming. Tokens stream to the UI as they are generated, giving immediate feedback and reducing perceived latency. The author can cancel mid-generation if the output is going in the wrong direction.
- Q: How should transformation results be previewed before acceptance? → A: Inline replacement with undo. Transformed text replaces the selection inline, visually highlighted as pending AI content. A floating toolbar offers Accept/Reject. Rejecting restores the original text immediately.
- Q: What default limits for AI generation size and conversation depth? → A: Sensible defaults. Max ~4,000 tokens (~3,000 words) per generation, max 20 conversation turns per session. Hardcoded in Phase 1, configurable by administrators in Phase 2.
- Q: Should Phase 1 include a default rate limit for AI requests? → A: Yes. Hardcoded default of 50 AI requests per user per hour. Simple server-side check, no UI needed. Prevents runaway usage until admin controls arrive in Phase 2.

**Input**: User description: "AI-Assisted Authoring and controls. This feature defines how automated and AI-driven assistance may participate in authoring and modification of system state. AI and automation are assistive actors, not authoritative ones. They may propose, generate, or modify content only within explicit constraints. All AI-assisted changes must: occur within a branch, respect branch lifecycle, visibility, and mutability rules, respect identity, role, and permission constraints. AI-generated output must be attributable, reviewable, and reversible. No AI action may directly finalize convergence, publication, or visibility changes. AI must not introduce changes that cannot be explained, audited, or validated. Human approval is required for any AI-assisted change that affects shared or consumable states. These guarantees apply regardless of model, provider, or implementation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Author Requests AI Content Generation (Priority: P1)

A content author working on a branch wants AI assistance to generate new draft content or transform existing content. The author invokes AI assistance through a side panel chat (for generation) or a context menu on selected text (for transformation). The author can have a multi-turn conversation with the AI to iteratively refine output, then review, edit, accept, or reject the AI's output before it becomes part of their draft.

**Why this priority**: This is the core value proposition—enabling AI to assist humans while maintaining human control. Without this capability, the feature has no purpose.

**Independent Test**: Can be fully tested by having an author request AI-generated content within a branch, reviewing the output, and either accepting or rejecting it. Delivers immediate productivity value.

**Acceptance Scenarios**:

1. **Given** an author has an active draft branch, **When** the author opens the AI assistance panel and submits a generation prompt, **Then** the AI generates content that is clearly marked as AI-proposed and placed in the author's branch without affecting any other branch or shared state.
2. **Given** an author has selected text in the editor, **When** the author right-clicks and selects a transformation action (rewrite, summarize, expand, change tone, or custom instruction), **Then** the AI streams a transformed version that replaces the selection inline with a visual highlight indicating pending AI content, and a floating toolbar appears offering Accept or Reject. Rejecting restores the original text.
3. **Given** AI has generated proposed content, **When** the author reviews the content, **Then** the author can accept (incorporate into draft), reject (discard entirely), or edit (modify before incorporating) the proposed content.
4. **Given** AI has generated content, **When** the author accepts the content, **Then** the change is attributed to both the AI (as generator) and the human (as approver) in the audit trail, recorded as a new content version with AI attribution.
5. **Given** an author has received AI-generated content, **When** the author provides follow-up instructions in the same session (e.g., "make it shorter", "add more technical detail"), **Then** the AI refines its output using the conversation context from the current session.
6. **Given** an author's session ends or the author switches branches, **When** there is pending (not yet accepted) AI content, **Then** the pending content is discarded and the conversation context is cleared.

---

### User Story 2 - Reviewer Sees AI Attribution in Review (Priority: P2)

A reviewer examining a branch for approval needs to see which portions of content were AI-generated versus human-authored. Clear attribution helps reviewers understand content provenance and apply appropriate scrutiny to AI-generated portions.

**Why this priority**: Essential for the review workflow to function properly. Reviewers must be able to distinguish AI contributions to make informed approval decisions.

**Independent Test**: Can be tested by creating a branch with mixed AI and human content, submitting for review, and verifying the reviewer sees clear attribution markers for each content section.

**Acceptance Scenarios**:

1. **Given** a branch contains AI-generated content, **When** a reviewer opens the review interface, **Then** AI-generated sections are visually distinguished from human-authored sections with clear attribution.
2. **Given** a reviewer is examining AI-generated content, **When** they view content details, **Then** they can see the AI model/system that generated the content, the human who approved its inclusion, and the timestamp of generation and approval.

---

### User Story 3 - Administrator Configures AI Constraints (Priority: P3)

An administrator needs to configure system-wide constraints on AI assistance, including which AI capabilities are enabled, what content types AI can assist with, and what approval workflows apply to AI-generated content.

**Why this priority**: Enables organizations to control AI usage according to their policies. Important for compliance but not required for basic AI assistance functionality.

**Independent Test**: Can be tested by an administrator configuring AI constraints and verifying that subsequent AI assistance requests respect those constraints.

**Acceptance Scenarios**:

1. **Given** an administrator accesses AI configuration settings, **When** they disable a specific AI capability, **Then** that capability becomes unavailable to all users until re-enabled.
2. **Given** an administrator sets a constraint requiring additional approval for AI-generated content, **When** an author accepts AI-generated content, **Then** the content is flagged for the required additional approval step before publication.

---

### User Story 4 - Author Reverts AI-Generated Content (Priority: P4)

An author who previously accepted AI-generated content decides they want to remove or undo that content. They can revert AI-generated changes independently of other changes in their branch.

**Why this priority**: Supports the reversibility guarantee. Users need confidence they can undo AI assistance at any time.

**Independent Test**: Can be tested by accepting AI content, then reverting it, and verifying the content is removed while other branch changes remain intact.

**Acceptance Scenarios**:

1. **Given** a branch contains accepted AI-generated content, **When** the author chooses to revert AI content, **Then** they can select specific AI contributions to revert without affecting human-authored changes.
2. **Given** an author reverts AI-generated content, **When** the reversion completes, **Then** the audit log records the reversion with appropriate attribution.

---

### User Story 5 - System Auditor Reviews AI Activity (Priority: P5)

A compliance auditor needs to review all AI-assisted authoring activity across the system to ensure AI usage complies with organizational policies and regulatory requirements.

**Why this priority**: Critical for compliance and governance but operates independently of day-to-day authoring workflows.

**Independent Test**: Can be tested by generating AI activity, then using audit tools to retrieve and filter AI-related events.

**Acceptance Scenarios**:

1. **Given** AI assistance has been used in the system, **When** an auditor queries AI activity logs, **Then** they receive a complete record of all AI invocations, generations, acceptances, and rejections with full attribution.
2. **Given** an auditor needs to trace a specific piece of content, **When** they examine the content's audit trail, **Then** they can determine if AI was involved, which AI system was used, and who approved the AI's contribution.

---

### Edge Cases

- What happens when AI assistance is requested but the AI service is unavailable? → **Resolution**: System displays error message and allows author to continue without AI assistance; no partial or incomplete AI content is created. Conversation context is preserved so the author can retry when the service recovers.
- What happens when AI generates content that violates content policies? → **Resolution**: Generated content is validated against content policies before being presented to the author; policy violations are flagged or filtered.
- What happens when an author's session ends with pending AI-generated content not yet accepted? → **Resolution**: Pending AI-generated content is discarded from server-side ephemeral storage; only explicitly accepted content persists in the branch. The discard event is logged for audit.
- What happens when AI assistance is requested on content the author doesn't have permission to modify? → **Resolution**: Request is denied with appropriate error message; AI cannot grant permissions the user doesn't have.
- What happens when AI configuration changes while an author has pending AI content? → **Resolution**: Pending content follows the rules in effect when generated; new requests use updated configuration.
- What happens to conversation context when the author switches branches? → **Resolution**: Conversation context is scoped to a branch. Switching branches clears the current conversation; pending content for the previous branch is discarded. The author can start a new conversation in the new branch.
- What happens when the author modifies selected text while an AI transformation is in progress? → **Resolution**: The in-progress transformation is cancelled and the author is notified. The author can re-select and re-request the transformation.
- What happens when the AI provider fails mid-conversation (after prior successful turns)? → **Resolution**: The error is displayed to the author. Prior conversation context is preserved so the author can retry the failed request or continue the conversation.
- Can an author have multiple pending AI requests simultaneously? → **Resolution**: No. Only one AI request can be pending at a time per branch per user. The author must accept, reject, or cancel the current pending content before requesting new AI assistance. This ensures clear attribution and simple audit trails.
- What happens when AI-generated content is accepted and then the author manually edits it? → **Resolution**: The accepted AI content creates a version with AI attribution. Subsequent manual edits create a new version with human attribution. The version history preserves the lineage showing the AI origin.
- What happens when the author cancels a streaming AI generation mid-way? → **Resolution**: Generation stops immediately. Partially generated content is discarded (not shown as pending). The conversation context retains the request but not the incomplete output. The author can re-request or provide a new prompt.
- What happens when the conversation turn limit (20) is reached? → **Resolution**: The author is notified that the conversation limit has been reached. They can start a new conversation (clearing context) or accept/reject the current pending content. The turn limit resets with each new conversation.
- What happens when a user hits the rate limit (50 requests/hour)? → **Resolution**: The request is rejected with an error message showing when the limit resets. The author can continue editing manually. Any pending AI content from prior requests remains available for accept/reject. Conversation context is preserved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST ensure all AI-generated content is created within a branch and MUST NOT directly modify any shared, published, or converged state.
- **FR-002**: System MUST attribute all AI-generated content to both the AI system (generator) and the human actor (approver) who accepted the content, recorded at the content version level.
- **FR-003**: System MUST require explicit human approval before AI-generated content can be incorporated into a draft, submitted for review, or published.
- **FR-004**: System MUST allow users to revert AI-generated content independently of other changes in their branch.
- **FR-005**: System MUST log all AI assistance events including requests, generations, acceptances, rejections, and reversions with full attribution.
- **FR-006**: System MUST visually distinguish AI-generated content from human-authored content in all review interfaces.
- **FR-007**: System MUST prevent AI from directly initiating state transitions (review submission, approval, publication, convergence).
- **FR-008**: System MUST validate AI-generated content against the same constraints that apply to human-authored content (permissions, content policies, format requirements).
- **FR-009**: System MUST ensure AI-generated content respects branch lifecycle rules, including visibility and mutability constraints.
- **FR-010**: System MUST provide administrators with controls to enable, disable, or constrain AI assistance capabilities, including global toggle, per-role controls, content type restrictions, usage quotas, and approved provider/model lists.
- **FR-011**: System MUST ensure AI behavior is consistent regardless of AI model, provider, or implementation changes. The AI provider interface MUST be abstracted so that providers can be configured and swapped without affecting the authoring workflow.
- **FR-012**: System MUST discard pending AI-generated content that has not been explicitly accepted when the authoring session ends or the author switches branches.
- **FR-013**: System MUST support both content generation (creating new content from prompts) and content transformation (rewriting, summarizing, expanding, or changing tone of selected existing content).
- **FR-014**: System MUST provide a side panel chat interface for content generation requests and an inline context menu on selected text for transformation actions.
- **FR-015**: System MUST maintain multi-turn conversation context within a session and branch, enabling iterative refinement of AI output.
- **FR-016**: System MUST scope conversation context to a single branch per session. Switching branches MUST clear the conversation and discard any pending AI content for the previous branch.
- **FR-017**: System MUST enforce that only one AI request can be pending at a time per branch per user. The author must resolve the current pending content before requesting new AI assistance.
- **FR-018**: System MUST store pending AI content server-side with session-bound lifetime, ensuring it survives page refresh but is discarded on session end.
- **FR-019**: System MUST stream AI-generated content to the author in real-time (token by token) as it is produced, and MUST allow the author to cancel generation mid-stream.
- **FR-020**: System MUST enforce a default maximum generation length of ~4,000 tokens per AI request and a maximum of 20 conversation turns per session. These limits are hardcoded in Phase 1 and become administrator-configurable in Phase 2.
- **FR-021**: System MUST enforce a default rate limit of 50 AI requests per user per hour. Requests exceeding the limit are rejected with an appropriate error message indicating when the user can retry. This limit is hardcoded in Phase 1 and becomes administrator-configurable in Phase 2.

### Key Entities

- **AI Assistance Request**: A request from a human actor to receive AI-generated content. Includes the request type (generation or transformation), the context (current document content, selected text for transforms), the prompt or instruction, the requesting user, and the target branch. Each request is scoped to exactly one branch and one user.
- **AI Generation**: The output produced by an AI system in response to a request, including the generated content, the AI system/model identifier, generation timestamp, token usage, and status (pending, accepted, rejected, discarded). Only one generation can be pending per user per branch at any time. Each generation is capped at ~4,000 tokens.
- **AI Conversation**: A session-scoped, branch-scoped sequence of AI assistance requests and responses. Maintains context across multiple turns (up to 20 turns per session) to enable iterative refinement. Cleared when the session ends or the author switches branches. Each conversation has a unique identifier for audit correlation.
- **AI Attribution Record**: A record linking a content version to its AI generation source and human approver, stored at the version level. When AI content is accepted, the resulting content version carries AI attribution. Subsequent human edits create new versions with human attribution, preserving the AI origin in version history.
- **AI Constraint Configuration**: System-wide and optionally role-specific settings that govern what AI capabilities are available. Includes global enable/disable, per-role enable/disable, content type restrictions, usage quotas (per user per time period), approved provider/model list, and prompt guidelines or templates.
- **AI Provider**: An abstracted AI service that can generate or transform content. The system supports multiple providers (e.g., different LLM vendors) behind a common interface. Providers are configured by administrators and can be swapped without affecting the authoring workflow.

### Actors and Permissions

| Role/Actor               | Permissions                                                                                  | Authentication Required |
| ------------------------ | -------------------------------------------------------------------------------------------- | ----------------------- |
| **Anonymous User**       | None (cannot invoke AI assistance)                                                           | No                      |
| **Authenticated Author** | Request AI assistance within own branches, accept/reject/edit AI content, revert AI content  | Yes                     |
| **Reviewer**             | View AI attribution during review, request AI assistance for review comments                 | Yes                     |
| **Publisher**            | View AI attribution, cannot override AI-related approval requirements                        | Yes                     |
| **Administrator**        | Configure AI constraints, enable/disable AI capabilities, view AI audit logs                 | Yes                     |
| **Auditor**              | View all AI audit logs, generate AI activity reports                                         | Yes                     |
| **AI System**            | Generate content when requested, cannot initiate state changes or approve content            | System credential       |

### Lifecycle States and Transitions

**AI Content States** (two levels):

*Request-level states* (tracked in `ai_requests.status`):
- **Generating**: AI is actively streaming content (visible to requesting author as in-progress)
- **Pending**: AI has completed generation; content awaiting human review (viewable by requesting author only)
- **Accepted**: Human has approved AI content for inclusion in draft (becomes a content version, subject to draft rules)
- **Rejected**: Human has declined AI content (discarded from ephemeral storage, logged for audit)
- **Cancelled**: Human cancelled generation mid-stream (partial content discarded, logged for audit)
- **Discarded**: System has automatically removed pending content due to session end, branch switch, or conversation clear (logged for audit)

*Version-level state* (tracked via `contentVersions.authorType`):
- **Reverted**: A previously accepted AI content version has been undone by human action (version revert, logged for audit). This is not a request status — it is a version-level operation in Phase 2 (US4).

**Valid Transitions** (request-level):
```
[new] → Generating (AI request initiated)
Generating → Pending (generation complete, awaiting user action)
Generating → Cancelled (user aborts mid-stream; partial content discarded)
Generating → Error (provider failure; can retry → Generating)
Pending → Accepted (by: Requesting Author — creates new content version with AI attribution)
Pending → Rejected (by: Requesting Author — discards pending content, logs rejection)
Pending → Discarded (by: System — session timeout, branch switch, or conversation clear)
```

**AI Conversation Lifecycle**:
```
Created → Active (first request sent)
Active → Active (follow-up turns within session)
Active → Ended (session ends, branch switch, or explicit clear)
```

**Note**: AI-generated content that is Accepted becomes part of the branch draft as a new content version and follows the standard branch lifecycle (Draft → Review → Approved → Published). The request-level states above govern only the initial acceptance workflow. Version-level attribution persists through the entire branch lifecycle. The `Error` state is transient and allows retry.

### Visibility Boundaries

| State     | Visibility | Who Can Access                                                                               |
| --------- | ---------- | -------------------------------------------------------------------------------------------- |
| Pending   | Private    | Requesting author only                                                                       |
| Accepted  | Branch     | Follows branch visibility rules (content version visible to all branch participants)         |
| Rejected  | Private    | Requesting author (during session), auditors (via audit log)                                 |
| Discarded | Private    | Auditors only (via audit log; content not preserved, only the discard event)                 |
| Reverted  | Branch     | Content removed; reversion logged in audit trail accessible to branch viewers and auditors   |

### Auditability and Traceability

**Required Audit Events**:
- AI assistance requested (actor, timestamp, request type [generation/transformation], context/prompt summary, AI system identifier, branch ID, conversation ID)
- AI content generated (request ID, timestamp, AI system identifier, model, generation metadata including token usage)
- AI content accepted (actor, timestamp, request ID, content version reference, conversation ID)
- AI content rejected (actor, timestamp, request ID, conversation ID, reason if provided)
- AI content discarded (system, timestamp, request ID, conversation ID, discard reason [session_end/branch_switch/cancel])
- AI content reverted (actor, timestamp, content version reference, reason if provided)
- AI conversation started (actor, timestamp, conversation ID, branch ID)
- AI conversation ended (actor or system, timestamp, conversation ID, end reason [session_end/branch_switch/explicit_clear], turn count)
- AI constraint configuration changed (actor, timestamp, old/new configuration)
- AI capability enabled/disabled (actor, timestamp, capability identifier, new state)

**Audit Log Format**: Each log entry MUST include:
- `timestamp`: ISO 8601 format
- `actor`: User ID or AI system identifier
- `action`: Action type (requested, generated, accepted, rejected, reverted, configured)
- `resource`: Request ID, content ID, or configuration reference
- `ai_system`: Identifier of AI model/provider involved (when applicable)
- `metadata`: Additional context (prompt hash, content hash, configuration details)

**Retention Policy**: AI audit logs retained according to system-wide audit log retention policy (minimum 7 years for regulated industries, configurable by administrator).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of AI-generated content in the system has complete attribution (AI system + human approver) verifiable via audit trail.
- **SC-002**: Authors can accept or reject AI-generated content within 3 clicks from the generation interface.
- **SC-003**: Reviewers can identify AI-generated portions of content within 2 seconds of viewing a review item.
- **SC-004**: 100% of AI content state transitions (pending, accepted, rejected, reverted) are logged with full attribution.
- **SC-005**: Zero instances of AI-generated content directly modifying shared or published state without human approval.
- **SC-006**: Administrators can enable or disable AI capabilities within 5 minutes of configuration change.
- **SC-007**: Auditors can retrieve AI activity reports filtered by time range, user, or AI system within 30 seconds for the past year of data.

### Verification Requirements

**Acceptance Tests**:
- [ ] All user stories pass acceptance scenarios
- [ ] All functional requirements verified
- [ ] All state transitions tested
- [ ] All permission checks validated
- [ ] All audit events logged correctly
- [ ] AI attribution visible in all review interfaces
- [ ] AI content reversion functions independently of other changes
- [ ] AI constraints enforced across all AI invocation points

**Test Coverage**:
- Core workflows: 80% minimum (Constitution X)
- Edge cases: All documented edge cases have test coverage
- Integration tests: All state transitions and actor interactions
- Security tests: Permission boundary enforcement for AI operations

**Validation Procedures**:
1. Manual walkthrough of AI assistance workflow by author persona
2. Review workflow walkthrough verifying AI attribution visibility
3. Administrator configuration walkthrough for AI constraints
4. Audit report generation and verification of completeness
5. Negative testing: Attempt AI operations without proper permissions
6. Session timeout testing: Verify pending AI content is discarded

**Sign-off Criteria**:
- [ ] Product owner approves user experience for AI assistance workflow
- [ ] Security review confirms AI cannot bypass permission boundaries
- [ ] Compliance review confirms audit trail completeness
- [ ] Performance benchmarks met for AI content attribution queries
- [ ] Documentation complete and reviewed

## Assumptions

- The system already has a functioning branch model, review workflow, and audit logging infrastructure that AI assistance will integrate with.
- AI service integration (specific models, providers) is an implementation concern; this spec defines the interface and constraints that any AI implementation must respect.
- Content policies and validation rules already exist in the system; AI-generated content will use the same validation infrastructure.
- Session management already exists; AI pending content lifecycle ties into existing session timeout behavior.
- The audit logging system can accommodate the additional AI-specific event types without architectural changes.
- The existing content versioning system already supports distinguishing system-generated actions from user actions (actor type distinction), and can attribute system actions to an initiating human user.
- The WYSIWYG/Markdown editor supports programmatic content insertion and replacement, enabling AI-generated content to be previewed and applied within the editing interface.
- Content and prompts sent to AI providers carry no special sanitization or privacy filtering. Provider data handling is governed by the provider's own policies and the administrator's choice of approved providers.

## Implementation Phasing

**Phase 1 (Initial Scope)**: User Stories 1 and 2 (P1 + P2)
- Core AI authoring: generation, transformation, multi-turn conversation, accept/reject workflow
- Review attribution: visual distinction of AI-generated content versions in review interfaces
- Provider abstraction: pluggable AI provider interface with at least one concrete provider
- Server-side ephemeral storage for pending AI content
- Audit trail for all AI events

**Phase 2 (Follow-up)**: User Stories 3, 4, and 5 (P3 + P4 + P5)
- Administrator configuration of AI constraints
- Independent revert of AI-generated content
- Comprehensive AI activity audit reporting and filtering
