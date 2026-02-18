# Feature Specification: Radix Themes Migration

**Feature Branch**: `004-radix-themes-migration`
**Created**: 2026-01-29
**Status**: Draft
**Input**: User description: "Migrate UI from Tailwind CSS to Radix Themes Design System"

## Clarifications

### Session 2026-01-29

- Q: Should migration be big bang or phased? → A: Phased coexistence - migrate component groups incrementally while both systems work together
- Q: Where should the theme toggle UI be located? → A: App header - persistent toggle/dropdown in the main navigation bar
- Q: Should Tailwind color/typography classes be removed during migration? → A: Remove - strip Tailwind color/typography classes when migrating each component
- Q: What order should component groups be migrated? → A: By component type - atomic first (buttons, badges), then molecules (forms, cards), then organisms (dialogs, tables)
- Q: What is the default theme for new users? → A: System default - immediately respect OS preference on first visit

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Theme Toggle Experience (Priority: P1)

Users need the ability to switch between light and dark modes based on their preference or system settings. This is a core value proposition of adopting Radix Themes. The theme toggle control will be located in the app header as a persistent toggle/dropdown in the main navigation bar.

**Why this priority**: Dark mode is a primary driver for this migration. Users increasingly expect applications to respect their system preferences and provide manual override capability.

**Independent Test**: Can be fully tested by toggling between light/dark/system modes and verifying all UI elements adapt correctly. Delivers immediate visual value to users.

**Acceptance Scenarios**:

1. **Given** the application loads for the first time, **When** the user's system is set to dark mode, **Then** the application displays in dark mode automatically
2. **Given** the user is viewing the application in light mode, **When** they manually select dark mode from theme settings, **Then** all UI components switch to dark theme colors
3. **Given** the user has selected a manual theme preference, **When** they select "system" preference, **Then** the application follows the operating system theme setting
4. **Given** the user sets a theme preference, **When** they close and reopen the application, **Then** their preference is remembered and applied

---

### User Story 2 - Consistent Component Styling (Priority: P1)

Developers and users experience consistent button, badge, form, and card styling across the entire application using Radix Themes' design tokens.

**Why this priority**: Visual consistency builds trust and improves usability. Inconsistent styling is immediately visible and degrades perceived quality.

**Independent Test**: Can be tested by navigating through all major flows (login, content creation, review workflow) and verifying buttons/badges/forms use consistent sizing, spacing, and colors.

**Acceptance Scenarios**:

1. **Given** any button in the application, **When** rendered, **Then** it uses Radix Button component with consistent size and variant styling
2. **Given** any status badge (role, lifecycle, published), **When** rendered, **Then** it uses Radix Badge component with semantic color mapping
3. **Given** any form input (text field, dropdown, checkbox), **When** rendered, **Then** it uses Radix form components with consistent focus states and validation styling
4. **Given** the user views any card component, **When** comparing across different pages, **Then** cards use identical padding, border radius, and shadow tokens

---

### User Story 3 - Accessible Keyboard Navigation (Priority: P2)

Users who rely on keyboard navigation can interact with all UI components (dialogs, dropdowns, buttons) using standard keyboard patterns.

**Why this priority**: Accessibility is a legal and ethical requirement. Radix provides this out-of-the-box, making it a key benefit of migration.

**Independent Test**: Can be tested by navigating the entire application using only keyboard (Tab, Enter, Escape, Arrow keys) without requiring mouse interaction.

**Acceptance Scenarios**:

1. **Given** a user opens a dialog (e.g., RoleChangeDialog), **When** pressing Tab, **Then** focus moves through interactive elements in logical order
2. **Given** a user opens a dropdown menu, **When** pressing arrow keys, **Then** options are highlighted sequentially and selectable via Enter
3. **Given** a user is focused on a dialog, **When** pressing Escape, **Then** the dialog closes and focus returns to the triggering element
4. **Given** any interactive element, **When** focused, **Then** it displays a visible focus ring indicator

---

### User Story 4 - Design Token Customization (Priority: P3)

Future designers/developers can customize the application's visual appearance by modifying centralized design tokens rather than hunting through component files.

**Why this priority**: This is a long-term maintainability benefit. While not immediately visible to end users, it enables future design iteration.

**Independent Test**: Can be tested by changing a single token value (e.g., accent color) and verifying the change propagates to all components that use that token.

**Acceptance Scenarios**:

1. **Given** the theme configuration file, **When** changing the accent color from blue to indigo, **Then** all primary buttons, links, and highlights update to the new color
2. **Given** the theme configuration file, **When** modifying the border radius scale, **Then** all cards, buttons, and inputs update their corner radius
3. **Given** a developer needs to create a new component, **When** they reference Radix tokens (e.g., `var(--accent-9)`), **Then** the component automatically respects the current theme settings

---

### Edge Cases

- What happens when a user rapidly toggles between themes? (Should not cause visual glitches or layout shifts)
- How does the system handle components that have no Radix equivalent? (Monaco editor should gracefully use CSS variable bridge)
- What happens if Tailwind and Radix CSS conflict? (Layout utilities should work without color/typography interference)
- How do loading/skeleton states appear in dark mode? (Should use appropriate gray scale tokens)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a theme provider that supports light, dark, and system appearance modes; default for new users (no localStorage) MUST be system preference
- **FR-002**: System MUST persist user's theme preference across browser sessions using localStorage
- **FR-003**: System MUST respond to operating system theme changes when user preference is set to "system"
- **FR-004**: All button components MUST use Radix Button with support for solid, outline, soft, and ghost variants
- **FR-005**: All badge components (RoleBadge, LifecycleStatus, PublishedBadge) MUST use Radix Badge with semantic color mapping
- **FR-006**: All form inputs MUST use Radix form components (TextField, Select, TextArea, Checkbox)
- **FR-007**: All dialog/modal components MUST use Radix Dialog with focus trapping and escape-to-close
- **FR-008**: All dropdown menus MUST use Radix DropdownMenu with keyboard navigation
- **FR-009**: All table components MUST use Radix Table with consistent header and cell styling
- **FR-010**: System MUST maintain Tailwind CSS for layout utilities only (flex, grid, gap-*, position, responsive prefixes); color and typography classes MUST be removed when migrating each component
- **FR-011**: System MUST provide CSS variable bridge for Monaco editor theme integration
- **FR-012**: All migrated components MUST maintain existing functionality and user flows
- **FR-013**: System MUST map existing Tailwind colors to Radix semantic colors (see Color Mapping below)
- **FR-014**: Migration MUST follow phased coexistence approach - component groups migrated incrementally while both Tailwind and Radix systems work together
- **FR-015**: Migration order MUST follow atomic design hierarchy: (1) atomic components (buttons, badges, inputs), (2) molecules (forms, cards), (3) organisms (dialogs, tables, complex compositions)

### Color Mapping

| Current Usage      | Tailwind Class | Radix Token     | Semantic Meaning                            |
| ------------------ | -------------- | --------------- | ------------------------------------------- |
| Primary actions    | blue-600/700   | accent (blue)   | Interactive elements, links, primary buttons |
| Neutral UI         | gray-*         | gray (slate)    | Backgrounds, borders, secondary text        |
| Success states     | green-*        | green           | Approved, published, success messages       |
| Warning states     | yellow-*       | yellow          | Pending review, caution messages            |
| Error/danger       | red-*          | red             | Delete actions, error messages, logout      |
| Reviewer role      | purple-*       | purple          | Reviewer badges, review-related UI          |
| Opinion content    | amber-*        | orange          | Opinion content type indicator              |

### Key Entities

- **Theme Configuration**: Defines accent color, gray scale, border radius, and appearance settings for the application
- **Theme Context**: React context that provides current theme state and toggle functions to all components
- **CSS Variable Bridge**: CSS file that maps Radix tokens to custom properties for non-Radix components (Monaco)

### Actors and Permissions

| Role/Actor    | Permissions                                   | Authentication Required |
| ------------- | --------------------------------------------- | ----------------------- |
| **Any User**  | Toggle theme preference (light/dark/system)   | No                      |
| **Developer** | Modify theme configuration and design tokens  | N/A (development)       |

### Lifecycle States and Transitions

This feature does not introduce new content lifecycle states. Theme preferences are user settings, not content.

**Theme Preference States**:
- **Light**: User explicitly selected light mode
- **Dark**: User explicitly selected dark mode
- **System**: User defers to operating system preference

### Visibility Boundaries

| Setting              | Visibility | Who Can Access                         |
| -------------------- | ---------- | -------------------------------------- |
| Theme Preference     | Private    | Individual user (localStorage)         |
| Theme Configuration  | Public     | All users see the same design tokens   |

### Auditability and Traceability

Theme preference changes are not security-sensitive and do not require audit logging.

**Retention Policy**: No retention required for theme preferences (stored in browser localStorage).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 50 components successfully render in both light and dark modes without visual defects
- **SC-002**: Theme toggle response time is under 100ms (no perceptible delay when switching)
- **SC-003**: Zero accessibility regressions as measured by axe-core automated testing
- **SC-004**: Bundle size increase is under 20KB gzipped (Radix Themes is approximately 15KB)
- **SC-005**: All existing user flows (login, branch creation, content review, publishing) work identically before and after migration
- **SC-006**: Design token changes (e.g., accent color) propagate to 100% of components using that token

### Verification Requirements

**Acceptance Tests**:
- [ ] All user stories pass acceptance scenarios
- [ ] All functional requirements verified
- [ ] Theme toggle works correctly in all three modes
- [ ] All 50 components render correctly in both themes
- [ ] Monaco editor respects theme via CSS variable bridge

**Test Coverage**:
- Core workflows: Visual regression tests for all major pages in light and dark mode
- Edge cases: Theme toggle during loading states, rapid toggling, system preference changes
- Integration tests: Theme provider integration with all component categories

**Validation Procedures**:
1. Manual walkthrough of all pages in light mode
2. Manual walkthrough of all pages in dark mode
3. Automated visual regression test suite passes
4. axe-core accessibility audit shows no new violations
5. Bundle size comparison before and after migration

**Sign-off Criteria**:
- [ ] Product owner approves visual appearance in both themes
- [ ] Accessibility audit passes (no regressions)
- [ ] Performance benchmarks met (theme toggle < 100ms)
- [ ] All existing E2E tests pass
