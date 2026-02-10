# Feature Specification: AI-Powered Image Compliance Analysis

**Feature Branch**: `008-image-compliance-analysis`
**Created**: 2026-02-10
**Status**: Draft
**Input**: User description: "This feature defines how images embedded in branch content are analysed for compliance with organisational standards using Echo's existing AI multimodal capabilities. All documentation content in Echo may contain images — screenshots, diagrams, logos, illustrations — that carry brand, accessibility, and quality obligations. Today, compliance of these images is verified manually by reviewers, which is inconsistent, slow, and scales poorly. This feature introduces AI-assisted image compliance analysis as a structured, auditable step in the branch authoring and review workflow. Image compliance analysis must operate within Echo's existing governed contribution model. Analysis is never automatic or authoritative — it is assistive. The AI examines images against administrator-configured compliance categories (brand adherence, accessibility, content appropriateness, licensing, technical quality) and produces structured findings with severity levels and remediation guidance. Authors and reviewers decide what to act on. No image is automatically rejected, modified, or removed by the system."

## Clarifications

### Session 2026-02-10

- Q: Should compliance analysis reuse the existing AI conversation from 007-ai-assisted-authoring, or maintain a separate conversation context? → A: Compliance analysis operates through the existing AI chat panel and reuses the same multi-turn conversation infrastructure from 007. An author can invoke a compliance check mid-conversation, receive structured findings, and ask follow-up questions about specific findings within the same conversation. Compliance checks consume conversation turns like any other AI interaction. There is no separate compliance conversation lifecycle.
- Q: Should compliance results be ephemeral (conversation-scoped like AI requests in 007) or persisted independently? → A: Compliance results live within the AI conversation from 007. There is no separate persistence layer, no formal compliance report entity, and no finding states. The AI chat provides the feedback as part of normal conversation flow.
- Q: How are images submitted for compliance analysis? → A: Users explicitly upload or reference images through the AI chat panel. The system does not automatically extract and scan images from content bodies. Authors and reviewers choose which images to check by sending them to the AI chat.
- Q: Should compliance checks run automatically or only on demand? → A: On demand only. Authors trigger checks through the AI chat panel by sending images.
- Q: What compliance categories should be supported? → A: Five categories: brand adherence, accessibility, content appropriateness, licensing and attribution, and technical quality. Administrators configure which categories are active and what severity level (error, warning, informational) each carries. All five are enabled by default at warning severity.
- Q: Is there a compliance gate on the publish transition? → A: No. Compliance analysis is purely advisory feedback delivered through the AI chat. There is no publish gate, no formal report entity, no finding states (open/acknowledged/escalated), and no reviewer-specific workflow beyond what 007 already provides. Authors and reviewers use the feedback at their discretion.
- Q: How does this feature relate to 007-ai-assisted-authoring? → A: This feature is a direct extension of 007. It reuses the AI chat panel as the interaction surface, the AI provider registry and multimodal capabilities for sending images to AI, the context documents system for injecting brand guidelines and style guides into compliance prompts, the conversation infrastructure for multi-turn follow-up, and the audit logging patterns. The new addition is compliance-specific system prompts that structure the AI's analysis around administrator-configured compliance categories.
- Q: How do users invoke a compliance check in the AI chat? → A: The existing `/analyse` command from 007 is extended to handle images. When a user sends images with `/analyse`, the system performs compliance analysis using compliance-specific prompts. When they send text selections or reference content, `/analyse` performs the existing text analysis. No new slash command is introduced — `/analyse` analyses whatever is provided.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Author Checks Images for Compliance via AI Chat (Priority: P1)

A content author working on a draft branch wants to verify that images meet organisational standards before submitting for review. They open the AI chat panel (established in 007-ai-assisted-authoring), attach one or more images, and use the existing `/analyse` command. When `/analyse` detects images, it performs compliance analysis — sending each image to the configured AI provider along with compliance-specific prompts built from administrator-managed context documents (brand guidelines, style guides from 007). The AI streams back structured feedback identifying issues by compliance category, severity level, and remediation suggestion. The author can ask follow-up questions about specific findings within the same multi-turn conversation.

**Why this priority**: This is the core value proposition — enabling authors to self-service image compliance checks before review, catching issues early and reducing review cycle time. Without this, the feature has no utility.

**Independent Test**: Can be fully tested by an author opening the AI panel, uploading an image, triggering a compliance check, receiving structured findings, and asking a follow-up question about a specific finding.

**Acceptance Scenarios**:

1. **Given** an author has a draft branch open with the AI chat panel visible, **When** they attach an image and use the `/analyse` command, **Then** the system detects the image input and sends it to the AI provider with compliance-specific prompts, streaming back structured findings
2. **Given** the AI provider has analysed the image, **When** results are returned, **Then** each finding includes: the compliance category, severity (error, warning, informational), description, and remediation suggestion
3. **Given** compliance feedback is displayed in the chat panel, **When** the author asks a follow-up question about a specific finding (e.g., "why does the logo fail brand compliance?"), **Then** the AI responds within the same conversation context with additional detail
4. **Given** an author uploads multiple images in one message, **When** the compliance check runs, **Then** findings are returned for each image, clearly attributed to the specific image they relate to
5. **Given** compliance categories have been configured by an administrator, **When** the AI analyses an image, **Then** the findings are structured around the enabled categories and reflect the configured severity levels

---

### User Story 2 - Reviewer Checks Images During Review via AI Chat (Priority: P1)

A reviewer examining a branch in review state wants to verify that images in the content meet organisational standards. They open the AI chat panel, upload or reference images from the content under review, and request a compliance check. The experience is identical to the author flow — the reviewer receives structured compliance feedback in the conversation.

**Why this priority**: Reviewers need the same compliance analysis capability as authors. This ensures images are checked regardless of whether the author ran a check before submitting. The reviewer's compliance conversation is independent of any conversation the author had.

**Independent Test**: Can be fully tested by a reviewer opening a branch in review, uploading an image to the AI chat, and receiving compliance feedback.

**Acceptance Scenarios**:

1. **Given** a reviewer is examining a branch in review state, **When** they attach an image to the AI chat panel and use the `/analyse` command, **Then** the system analyses the image and returns structured findings
2. **Given** a reviewer receives compliance findings, **When** they want to communicate an issue to the contributor, **Then** they use the existing review comment system from 006 to reference the compliance concern (no automated link between compliance chat and review comments)
3. **Given** the author previously ran a compliance check on the same images, **When** the reviewer runs their own check, **Then** the reviewer's analysis is independent — it runs in the reviewer's own conversation context

---

### User Story 3 - Administrator Configures Compliance Categories (Priority: P2)

An administrator configures which compliance categories are active and what severity level each category carries. They access compliance configuration through the existing AI administration interface (established in 007). Changes take effect on the next compliance check without system restart.

**Why this priority**: Configuration enables organisations to tailor compliance analysis to their specific standards. Without this, all five categories run at default severity and organisations cannot focus checks on what matters most to them.

**Independent Test**: Can be fully tested by an administrator enabling/disabling categories, changing severity levels, and verifying that subsequent compliance checks reflect the configuration.

**Acceptance Scenarios**:

1. **Given** an administrator accesses compliance configuration, **When** they disable a compliance category, **Then** subsequent compliance checks no longer include findings for that category
2. **Given** an administrator changes a category's severity from warning to error, **When** a compliance check produces a finding in that category, **Then** the finding is reported at the configured severity level
3. **Given** no administrator configuration has been performed, **When** a compliance check runs, **Then** all five categories are evaluated at warning severity (default)
4. **Given** an administrator updates configuration, **When** the change is saved, **Then** it takes effect on the next compliance check without requiring a restart or redeployment

---

### User Story 4 - Author Checks a Single Image Quickly (Priority: P2)

An author working in the editor wants to quickly check compliance of a specific image. They interact with the image through the editor context menu (extending 007's existing AI context menu) and receive compliance feedback in the AI chat panel for just that image.

**Why this priority**: Context menu integration provides a fast feedback loop during editing. Authors can right-click an image and check compliance without manually uploading it to the chat panel. This supports the iterative workflow established in 007.

**Independent Test**: Can be fully tested by right-clicking an image in the editor, selecting a compliance check action, and receiving findings in the AI chat panel.

**Acceptance Scenarios**:

1. **Given** an author is editing content containing an image, **When** they right-click the image and select "Check Compliance" from the context menu, **Then** the image is sent to the AI for compliance analysis and results appear in the AI chat panel
2. **Given** a single-image compliance check completes, **When** the author views the results, **Then** the findings follow the same structure as multi-image checks (category, severity, description, remediation)

---

### Edge Cases

- What happens when the AI chat panel receives an image with no compliance-related issues? The AI responds with a positive confirmation that the image passes all enabled compliance categories.
- What happens when the user uploads a non-image file for compliance checking? The system rejects the upload using the existing image validation from 007 (type and size checks) and informs the user that only images are supported.
- What happens when the AI provider is unavailable during a compliance check? The system reports an error through the existing AI error handling from 007 (stream error event) and the user can retry.
- What happens when no context documents (brand guidelines, style guides) have been configured? The AI still analyses the image using general compliance best practices for each enabled category, but findings may be less specific to the organisation's standards.
- What happens when all compliance categories are disabled by an administrator? The system informs the user that compliance analysis is not available because no categories are enabled.
- What happens when the AI provider returns ambiguous or low-confidence findings? Findings are reported as-is. The AI is assistive, not authoritative — authors and reviewers exercise judgement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extend the existing `/analyse` command from 007 to accept images — when images are provided with `/analyse`, the system performs compliance analysis using compliance-specific prompts; when text or content is provided, existing text analysis behaviour is preserved
- **FR-002**: System MUST send uploaded images to the configured AI provider (from 007's provider registry) with compliance-specific system prompts for analysis
- **FR-003**: System MUST inject administrator-managed context documents (from 007's context document system) into compliance analysis prompts to provide organisational standards as reference
- **FR-004**: System MUST return structured findings for each image, with each finding containing: compliance category, severity level (error, warning, informational), description, and remediation suggestion
- **FR-005**: System MUST support five compliance categories: brand adherence, accessibility, content appropriateness, licensing and attribution, and technical quality
- **FR-006**: System MUST allow administrators to enable or disable individual compliance categories
- **FR-007**: System MUST allow administrators to configure the severity level (error, warning, informational) for each compliance category
- **FR-008**: System MUST default all five categories to enabled at warning severity when no administrator configuration exists
- **FR-009**: System MUST deliver compliance analysis through the existing AI chat panel from 007, supporting follow-up questions within the same multi-turn conversation
- **FR-010**: System MUST support compliance analysis for multiple images in a single conversation turn, with findings clearly attributed to each image
- **FR-011**: System MUST support triggering a single-image compliance check from the editor context menu (extending 007's existing context menu)
- **FR-012**: System MUST log compliance analysis activity to the existing audit trail using the established patterns from 007
- **FR-013**: System MUST respect existing rate limits and conversation turn limits from 007 for compliance analysis requests
- **FR-014**: System MUST handle the case where no context documents are configured by using general compliance best practices
- **FR-015**: System MUST inform users when all compliance categories are disabled and analysis is not available

### Key Entities

- **Compliance Category Configuration**: Administrator-managed settings for each of the five compliance categories. Tracks whether the category is enabled and what severity level findings in that category carry. Stored using the existing AI configuration infrastructure from 007.

### Actors and Permissions *(mandatory per Constitution VIII)*

| Role/Actor | Permissions | Authentication Required |
|------------|-------------|-------------------------|
| **Anonymous User** | No access to compliance features | No |
| **Contributor** | Run compliance checks on images via AI chat panel while editing own draft branches | Yes |
| **Reviewer** | Run compliance checks on images via AI chat panel while reviewing branches in review state | Yes |
| **Administrator** | All contributor/reviewer permissions, plus configure compliance categories and severity levels | Yes |

### Lifecycle States and Transitions *(mandatory per Constitution VIII)*

This feature does not introduce new lifecycle states. Compliance analysis is a stateless interaction within the existing AI chat conversation from 007. The conversation lifecycle (active/ended, turn counting, session scoping) is inherited entirely from 007.

**Compliance Category Configuration** follows a simple enabled/disabled model per category, managed through the existing AI configuration interface from 007. No state machine is required.

### Visibility Boundaries *(mandatory per Constitution VIII)*

| Context | Visibility | Who Can Access |
|---------|-----------|----------------|
| Compliance analysis in AI chat | Private | The user who initiated the conversation (per 007's conversation scoping) |
| Compliance category configuration | Private | Administrators only |
| Published content | No compliance data exposed | Compliance conversations are internal workflow artifacts; they are never visible on published content |

### Auditability and Traceability *(mandatory per Constitution VIII)*

**Required Audit Events**:
- Compliance analysis requested (actor, branch, image count, categories checked, timestamp)
- Compliance category configuration changed (administrator, category, old value, new value, timestamp)

**Audit Log Format**: Each log entry MUST include:
- `timestamp`: ISO 8601 format
- `actor`: User ID or system identifier
- `action`: Prefixed with `compliance.*` (e.g., `compliance.analysis_requested`, `compliance.config_changed`)
- `resource`: Branch ID or configuration scope as appropriate
- `metadata`: Additional context (category, severity, provider, old/new values)

**Retention Policy**: Compliance audit logs follow the same retention policy as existing audit logs from 007.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authors can upload an image and receive compliance findings within 15 seconds
- **SC-002**: 100% of compliance findings include a specific remediation suggestion that the author can act on without external guidance
- **SC-003**: Follow-up questions about compliance findings receive contextually relevant responses within the same conversation
- **SC-004**: Administrators can configure compliance categories and severity levels, with changes taking effect on the next compliance check without system restart
- **SC-005**: All compliance analysis activity is recorded in the audit trail with complete actor attribution

### Verification Requirements *(mandatory per Constitution VIII)*

**Acceptance Tests**:
- [ ] All user stories pass acceptance scenarios
- [ ] All functional requirements verified
- [ ] All permission checks validated (contributor, reviewer, administrator boundaries)
- [ ] All audit events logged correctly with proper attribution
- [ ] Integration with 007 AI chat panel, provider registry, and context documents verified
- [ ] Compliance-specific system prompts produce structured, category-aware findings

**Test Coverage**:
- Core workflows: 80% minimum (Constitution X)
- Edge cases: All documented edge cases have test coverage
- Integration tests: Compliance analysis via 007 AI panel, context document injection, configuration changes

**Validation Procedures**:
1. End-to-end walkthrough: author uploads image to AI chat, receives compliance findings, asks follow-up, receives detailed response
2. Configuration verification: administrator changes category severity, re-runs check, findings reflect new severity
3. Context document influence: configure brand guidelines as context document, run compliance check, verify findings reference the guidelines
4. Multi-image check: upload multiple images, verify each receives individual findings

**Sign-off Criteria**:
- [ ] Product owner approves compliance finding presentation in AI chat
- [ ] Constitution compliance verified (all 10 principles)
- [ ] Performance benchmarks met (15-second single image analysis)
- [ ] Integration with 007 verified end-to-end

## Assumptions

- The existing AI providers (from 007) support multimodal image analysis with sufficient quality to produce meaningful compliance findings across all five categories
- Images uploaded through the AI chat panel are accessible to the AI provider at analysis time
- The existing context document system (from 007) is sufficient for administrators to express brand guidelines and compliance standards without a dedicated compliance rules editor
- The existing AI configuration infrastructure from 007 can be extended to store compliance category settings without a new configuration system
- Five default compliance categories are sufficient for the initial release; additional categories can be added in future iterations
- All five categories default to enabled at warning severity, providing immediate value without mandatory administrator configuration
- Compliance analysis conversations follow the same rate limits, turn limits, and session scoping as regular AI conversations from 007
