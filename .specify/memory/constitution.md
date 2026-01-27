<!--
SYNC IMPACT REPORT
==================
Version Change: 1.0.0 → 1.0.1
Bump Rationale: PATCH - Fix role terminology in Principle V to match spec-defined roles

Modified Principles:
  - [UPDATED] Principle V: Role-Driven Governance
    - "viewer, editor, reviewer, publisher" → "viewer, contributor, reviewer, administrator"
    - Aligns with spec 002-identity-roles-permissions role definitions

Added Sections: (none)
Removed Sections: (none)

Templates Requiring Updates:
  ✅ plan-template.md - No references to old role names
  ✅ spec-template.md - Uses template placeholders (Editor/Publisher as examples), no change needed
  ✅ tasks-template.md - No references to old role names
  ✅ constitution.md - Role names corrected

Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Original adoption date not known - marked as 2026-01-20 (creation date)
  - Note: spec-template.md uses "Editor" and "Publisher" as example placeholder values in its
    template tables. These are illustrative and do not conflict with the constitution's
    authoritative role list. Feature specs should use the constitution's canonical role names.
-->

# Echo Portal Constitution

## Core Principles

### I. Explicit Change Control

ALL meaningful changes MUST be explicit, attributable, and intentional. Implicit, silent, or automatic mutation of shared state is FORBIDDEN.

**Rationale**: Change control prevents accidental data loss, enables audit trails, and ensures all modifications can be traced to a deliberate action by an identifiable actor.

**Non-negotiable rules**:
- No background processes may modify published content without user-initiated action
- All state mutations MUST be tied to an authenticated user action or explicit system event
- Silent updates, auto-saves to published state, or implicit cascades are prohibited

### II. Single Source of Truth

Published content MUST be stable, trustworthy, and safe from accidental modification. The platform serves as the authoritative record.

**Rationale**: Users must trust that what they published remains unchanged unless they explicitly modify it. Stability of published content is fundamental to collaboration and documentation workflows.

**Non-negotiable rules**:
- Published content is immutable until explicitly modified through governed workflows
- No automatic or background processes may alter published content
- All changes to published state MUST go through explicit review and approval

### III. Branch-First Collaboration

ALL changes MUST happen in isolated workspaces (branches) and progress through explicit lifecycle stages before affecting published truth.

**Rationale**: Isolated workspaces prevent conflicts, enable parallel work, and ensure changes are reviewed before publication. This mirrors proven version control workflows.

**Non-negotiable rules**:
- Direct edits to published content are FORBIDDEN
- All modifications MUST begin in a branch/workspace
- Changes MUST progress through defined lifecycle stages: draft → review → approval → publish
- Each stage transition MUST be explicit and recordable

### IV. Separation of Concerns

The platform MUST maintain clear separation between:
- **Consumption**: Read-only browsing of published documentation
- **Contribution**: Authenticated editing, preview, and review workflows

**Rationale**: Separating read and write concerns simplifies security models, improves performance, and clarifies user intent.

**Non-negotiable rules**:
- Consumption flows MUST NOT require authentication (open by default)
- Contribution flows MUST require authentication and authorization
- UI/UX MUST clearly distinguish between consumption and contribution modes
- API endpoints MUST be categorized as read-only or write-capable

### V. Role-Driven Governance

Review, approval, and publication MUST be deliberate and attributable, not implicit or informal.

**Rationale**: Governance without clear roles and permissions leads to chaos, lost work, and untraceable changes. Role-based access control enables scalable collaboration.

**Non-negotiable rules**:
- Every action MUST be attributable to a specific user or system actor
- Roles (viewer, contributor, reviewer, administrator) MUST be explicitly assigned
- Permission checks MUST occur at every state transition
- Audit logs MUST record actor, action, timestamp, and affected resources

### VI. Open by Default

The platform MUST remain open by default for consumption and restricted by exception (sensitive assets, locked pages, or contribution actions).

**Rationale**: Maximizing openness encourages knowledge sharing and discoverability while maintaining security where needed.

**Non-negotiable rules**:
- Published content is publicly readable unless explicitly marked private
- Contribution actions require authentication
- Restrictions (private, locked, embargoed) MUST be explicit and justified
- Default permissions favor openness for read, restriction for write

### VII. Layered Architecture Stability

Core system rules MUST be fixed and stable. Outer modules MAY evolve without destabilizing collaboration and publishing workflows.

**Rationale**: A stable core enables innovation at the edges without risking foundational workflows. This principle mirrors hexagonal/clean architecture patterns.

**Non-negotiable rules**:
- Core workflows (branching, preview, review, merge/publish) MUST remain stable
- Breaking changes to core contracts require versioned migration paths
- Plugins, integrations, and UI enhancements MUST NOT require core workflow changes
- Core abstractions (Branch, Review, Publication) MUST have well-defined contracts

### VIII. Specification Completeness

Every spec MUST define:
- **Actors and permissions**: Who can do what
- **Lifecycle states and transitions**: How content moves from draft to published
- **Visibility boundaries**: What is draft vs. published, public vs. private
- **Auditability and traceability**: How changes are tracked and attributed
- **Success outcomes and verification requirements**: How we know it works

**Rationale**: Incomplete specs lead to implementation gaps, security holes, and untestable features. Completeness ensures all critical concerns are addressed.

**Non-negotiable rules**:
- Specs missing any required section MUST be marked incomplete and blocked from implementation
- Functional requirements MUST be testable and measurable
- Edge cases and error scenarios MUST be documented
- Acceptance criteria MUST be verifiable

### IX. Clarity Over Breadth

Favor clarity and reliability over breadth. Prioritize predictable workflows, usability, and safe defaults over optional complexity.

**Rationale**: Complexity is the enemy of reliability. Simple, clear workflows are easier to understand, test, and maintain.

**Non-negotiable rules**:
- New features MUST justify their complexity with clear value propositions
- Safe defaults MUST be preferred over configuration knobs
- Workflows MUST be predictable and consistent
- Documentation MUST be clear and example-driven
- When in doubt, choose the simpler implementation

### X. Testing as Contract

Testing and validation MUST be part of the product contract for core workflows (branching, preview, review, merge/publish). Testing MUST NOT be deferred as a purely engineering concern.

**Rationale**: Untested features are broken features. Testing is not optional; it is the specification in executable form.

**Non-negotiable rules**:
- Core workflows MUST have automated integration tests
- Acceptance criteria MUST be converted to automated tests
- Test failures block deployment
- Test coverage for core workflows MUST be maintained above 80%
- Tests MUST be written before implementation (TDD) when feasible

## Specification Requirements

All feature specifications MUST adhere to the following requirements to ensure governance compliance:

### Mandatory Sections

Every spec MUST include:

1. **Actors and Permissions**
   - Define all user roles and system actors
   - Specify permission matrix (who can perform which actions)
   - Document authentication and authorization requirements

2. **Lifecycle States and Transitions**
   - Define all possible states (draft, review, approved, published, archived)
   - Specify valid transitions between states
   - Document who can trigger each transition
   - Include state transition diagrams when helpful

3. **Visibility Boundaries**
   - Clearly separate draft from published content
   - Define public vs. private visibility rules
   - Specify when content becomes visible to different audiences

4. **Auditability and Traceability**
   - Define audit log requirements
   - Specify what events MUST be logged (actor, action, timestamp, resource)
   - Document retention and access policies for audit data

5. **Success Outcomes and Verification**
   - List measurable success criteria
   - Define acceptance tests
   - Specify validation procedures
   - Include edge cases and error handling requirements

### Quality Gates

Before implementation begins, specs MUST pass these gates:

- [ ] All mandatory sections present and complete
- [ ] No NEEDS CLARIFICATION markers remaining
- [ ] All functional requirements testable
- [ ] All actors and permissions defined
- [ ] All state transitions documented
- [ ] Success criteria measurable

## Governance

This constitution supersedes all other development practices, guidelines, and informal agreements. When conflicts arise, the constitution prevails.

### Amendment Procedure

1. **Proposal**: Amendments MUST be proposed via documented RFC (Request for Comments)
2. **Review**: Proposed changes MUST be reviewed by project maintainers
3. **Approval**: Amendments require unanimous approval from core team
4. **Migration**: Breaking changes MUST include migration plan and transition period
5. **Documentation**: All amendments MUST update this document with version bump

### Versioning Policy

Constitution version follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Backward-incompatible changes, principle removals, governance redefinition
- **MINOR**: New principles added, sections expanded, material guidance added
- **PATCH**: Clarifications, wording improvements, typo fixes, non-semantic changes

### Compliance Review

All pull requests and code reviews MUST verify compliance with this constitution:

- [ ] Changes align with Explicit Change Control (Principle I)
- [ ] Published content protection maintained (Principle II)
- [ ] Branch-first workflow followed (Principle III)
- [ ] Proper separation between read/write flows (Principle IV)
- [ ] Actions are attributable and role-gated (Principle V)
- [ ] Openness defaults respected (Principle VI)
- [ ] Core contracts remain stable (Principle VII)
- [ ] Specs are complete per Principle VIII requirements
- [ ] Complexity is justified (Principle IX)
- [ ] Tests written and passing (Principle X)

### Complexity Justification

Any feature that violates simplicity principles (Principle IX) MUST be justified:

- Document the specific problem being solved
- Explain why simpler alternatives are insufficient
- Include complexity budget: what complexity is being added and why it's acceptable

### Deviation Process

In exceptional circumstances, temporary deviations MAY be permitted:

1. Document the deviation and rationale
2. Define the remediation plan and timeline
3. Obtain approval from project lead
4. Track deviation as technical debt
5. Resolve before next major release

**Version**: 1.0.1 | **Ratified**: 2026-01-20 | **Last Amended**: 2026-01-26
