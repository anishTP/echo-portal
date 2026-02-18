# Implementation Plan: Radix Themes Migration

**Branch**: `004-radix-themes-migration` | **Date**: 2026-01-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-radix-themes-migration/spec.md`

## Summary

Migrate echo-portal's UI from Tailwind CSS inline classes to Radix Themes design system, enabling dark mode support (light/dark/system) with localStorage persistence. Migration follows phased coexistence strategy: atomic components first (buttons, badges, inputs), then molecules (forms, cards), then organisms (dialogs, tables). Tailwind layout utilities retained; color/typography classes removed per component.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node.js 20 LTS
**Primary Dependencies**: React 19.2.0, @radix-ui/themes (to install), Vite 7.2.4, @tailwindcss/vite 4.1.18
**Storage**: localStorage (theme preference), PostgreSQL (existing, unchanged)
**Testing**: Vitest 3.1.3 (unit), Playwright 1.52.0 (E2E)
**Target Platform**: Web (browsers supporting CSS custom properties)
**Project Type**: Monorepo (frontend + backend + shared)
**Performance Goals**: Theme toggle <100ms, Bundle increase <20KB gzipped
**Constraints**: Zero accessibility regressions, all E2E tests must pass
**Scale/Scope**: 50 components to migrate across 11 categories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.1):

- [x] **Explicit Change Control (I)**: Theme preference changes are explicit user actions (toggle click)
- [x] **Single Source of Truth (II)**: Theme is UI-only; no impact on published content
- [x] **Branch-First Collaboration (III)**: N/A - no content state changes
- [x] **Separation of Concerns (IV)**: Theme applies to both consumption and contribution UIs consistently
- [x] **Role-Driven Governance (V)**: Theme preference accessible to all users (no auth required)
- [x] **Open by Default (VI)**: Theme toggle available publicly
- [x] **Layered Architecture (VII)**: UI-only change; core workflows unchanged
- [x] **Specification Completeness (VIII)**: Spec has all required sections (verified)
- [x] **Clarity Over Breadth (IX)**: Simple toggle with 3 options; no unnecessary complexity
- [x] **Testing as Contract (X)**: Visual regression + accessibility testing defined in spec

## Project Structure

### Documentation (this feature)

```text
specs/004-radix-themes-migration/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal - no new entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── main.tsx                    # Add ThemeProvider wrapper
│   ├── index.css                   # Add Radix Themes CSS imports
│   ├── styles/
│   │   └── monaco-bridge.css       # NEW: CSS variable bridge for Monaco
│   ├── context/
│   │   ├── AuthContext.tsx         # Existing
│   │   └── ThemeContext.tsx        # NEW: Theme state + persistence
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppHeader.tsx       # Add theme toggle dropdown
│   │   ├── auth/
│   │   │   ├── LoginButton.tsx     # Migrate to Radix Button
│   │   │   ├── LogoutButton.tsx    # Migrate to Radix Button
│   │   │   └── RoleBadge.tsx       # Migrate to Radix Badge
│   │   ├── branch/
│   │   │   ├── LifecycleStatus.tsx # Migrate to Radix Badge
│   │   │   ├── PublishedBadge.tsx  # Migrate to Radix Badge
│   │   │   ├── VisibilitySelector.tsx # Migrate to Radix Select
│   │   │   └── ... (12 components)
│   │   ├── content/ (6 components)
│   │   ├── library/ (6 components)
│   │   ├── review/ (6 components)
│   │   ├── notification/ (2 components)
│   │   ├── convergence/ (3 components)
│   │   ├── diff/ (2 components)
│   │   ├── audit/ (2 components)
│   │   ├── users/ (1 component - RoleChangeDialog)
│   │   └── common/ (7 components)
│   └── hooks/
│       └── useTheme.ts             # NEW: Theme hook for components
└── tests/
    ├── unit/
    │   └── theme/                  # NEW: Theme toggle tests
    └── e2e/
        └── theme-toggle.spec.ts    # NEW: E2E theme tests
```

**Structure Decision**: Monorepo structure unchanged. Theme infrastructure added to frontend only. No backend changes required.

## Complexity Tracking

No constitution violations requiring justification. Feature is UI-only with minimal complexity.

---

## Phase 0: Research

### Research Tasks

1. **Radix Themes + Tailwind v4 coexistence patterns** - How to configure both systems to work together without CSS conflicts
2. **Theme persistence with system preference detection** - Best practices for `prefers-color-scheme` + localStorage hybrid
3. **Monaco editor theming** - CSS variable requirements for Monaco editor dark mode
4. **Bundle size optimization** - Tree-shaking Radix Themes components

### Research Findings

#### 1. Radix Themes + Tailwind v4 Coexistence

**Decision**: Use Radix Themes for component styling, Tailwind for layout utilities only

**Rationale**:
- Radix Themes provides complete component library with dark mode support
- Tailwind v4 layout utilities (flex, grid, gap-*, position) don't conflict with Radix
- Color and typography classes conflict and must be removed

**Setup Pattern**:
```tsx
// index.css
@import "@radix-ui/themes/styles.css";
@import "tailwindcss";

// Disable Tailwind colors to prevent conflicts
@theme {
  --color-*: initial;
}
```

**Alternatives Rejected**:
- Full Tailwind + Radix Primitives (headless) - More work, less consistent theming
- Keep both fully - CSS specificity conflicts

#### 2. Theme Persistence with System Detection

**Decision**: Use `prefers-color-scheme` media query with localStorage override

**Rationale**:
- System preference respected by default (FR-001)
- Manual override persists in localStorage
- `matchMedia` listener handles real-time OS changes

**Implementation Pattern**:
```tsx
type ThemePreference = 'light' | 'dark' | 'system';

function getResolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}
```

**Storage Key**: `echo-portal-theme-preference`

#### 3. Monaco Editor CSS Variable Bridge

**Decision**: Create custom CSS file mapping Radix tokens to Monaco CSS variables

**Rationale**:
- Monaco uses its own theming API, not CSS custom properties
- Bridge file maps `--accent-*`, `--gray-*` to Monaco-compatible tokens
- Allows Monaco to respect theme changes

**Bridge Pattern**:
```css
/* monaco-bridge.css */
.monaco-editor {
  --vscode-editor-background: var(--color-background);
  --vscode-editor-foreground: var(--gray-12);
  --vscode-editorLineNumber-foreground: var(--gray-11);
}

:root[data-theme="dark"] .monaco-editor {
  --vscode-editor-background: var(--gray-1);
}
```

#### 4. Bundle Size Optimization

**Decision**: Import only used Radix Themes components, not entire library

**Rationale**:
- `@radix-ui/themes` supports tree-shaking
- Import pattern: `import { Button, Badge, Dialog } from '@radix-ui/themes'`
- Estimated bundle increase: ~15KB gzipped (within 20KB budget)

---

## Phase 1: Design

### Data Model

**No new data model required.** Theme preference is stored in localStorage (client-side only), not in the database. The existing user model is unchanged.

Theme preference schema (localStorage):
```typescript
interface ThemePreference {
  preference: 'light' | 'dark' | 'system';
  lastUpdated: string; // ISO timestamp
}
```

### API Contracts

**No new API endpoints required.** Theme is entirely client-side. No backend changes.

### Component Migration Map

#### Phase 1: Atomic Components (Priority 1)

| Current Component | Radix Component | Color Mapping |
|-------------------|-----------------|---------------|
| LoginButton | `<Button variant="solid">` | blue → accent |
| LogoutButton | `<Button variant="soft" color="red">` | red → red |
| RoleBadge | `<Badge>` | gray/blue/purple/red → semantic |
| LifecycleStatus | `<Badge>` | gray/yellow/green/blue → semantic |
| PublishedBadge | `<Badge color="green">` | green → green |
| Form inputs (various) | `<TextField>`, `<TextArea>` | gray focus → accent |
| Checkbox (various) | `<Checkbox>` | blue → accent |
| Select (various) | `<Select>` | gray/blue → gray/accent |

#### Phase 2: Molecules (Priority 2)

| Current Component | Radix Component | Notes |
|-------------------|-----------------|-------|
| ContentCard | `<Card>` | Wrapper for card styling |
| VisibilitySelector | `<Select>` + `<RadioGroup>` | Two display modes |
| SearchBar | `<TextField>` | With search icon |
| Pagination | `<Button variant="ghost">` | Navigation buttons |

#### Phase 3: Organisms (Priority 3)

| Current Component | Radix Component | Notes |
|-------------------|-----------------|-------|
| RoleChangeDialog | `<Dialog>` | Full modal with focus trap |
| SubmitForReviewButton modal | `<Dialog>` | Confirmation modal |
| VisibilitySelector dropdown | `<DropdownMenu>` | When in dropdown mode |
| DiffViewer | `<Table>` | Keep custom diff styling |
| AuditLogViewer | `<Table>` | Tabular data |

### Theme Toggle Component

Location: `AppHeader.tsx` in auth section

```tsx
// ThemeToggle component structure
<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    <Button variant="ghost" size="2">
      {/* Sun/Moon/Monitor icon based on current theme */}
    </Button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item onClick={() => setTheme('light')}>
      Light
    </DropdownMenu.Item>
    <DropdownMenu.Item onClick={() => setTheme('dark')}>
      Dark
    </DropdownMenu.Item>
    <DropdownMenu.Item onClick={() => setTheme('system')}>
      System
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

### ThemeProvider Integration

```tsx
// main.tsx provider order
<StrictMode>
  <Theme accentColor="blue" grayColor="slate" radius="medium">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>  {/* NEW */}
          <AppRouter />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </Theme>
</StrictMode>
```

---

## Verification Plan

### Unit Tests
- [ ] ThemeContext: preference state changes correctly
- [ ] ThemeContext: localStorage persistence works
- [ ] ThemeContext: system preference detection works
- [ ] useTheme hook: returns correct resolved theme

### Integration Tests
- [ ] Theme toggle updates all Radix components
- [ ] No CSS class conflicts between Tailwind layout and Radix colors
- [ ] Monaco editor respects theme changes

### E2E Tests
- [ ] Theme toggle is visible and clickable in AppHeader
- [ ] Light/dark/system selection persists across page reload
- [ ] System preference change (simulated) updates theme
- [ ] All critical pages render correctly in both themes

### Accessibility Tests
- [ ] axe-core audit passes in light mode
- [ ] axe-core audit passes in dark mode
- [ ] Keyboard navigation works for theme toggle
- [ ] Focus states visible in both themes

### Performance Tests
- [ ] Theme toggle response time <100ms
- [ ] Bundle size increase <20KB gzipped
- [ ] No layout shift on initial load

---

## Key Files to Modify

### New Files
- `frontend/src/context/ThemeContext.tsx`
- `frontend/src/hooks/useTheme.ts`
- `frontend/src/styles/monaco-bridge.css`
- `frontend/tests/unit/theme/ThemeContext.test.tsx`
- `frontend/tests/e2e/theme-toggle.spec.ts`

### Modified Files (Infrastructure)
- `frontend/package.json` - Add @radix-ui/themes dependency
- `frontend/src/main.tsx` - Add Theme and ThemeProvider wrappers
- `frontend/src/index.css` - Import Radix Themes CSS, configure Tailwind
- `frontend/src/components/layout/AppHeader.tsx` - Add theme toggle

### Modified Files (Component Migration - Phase 1)
- `frontend/src/components/auth/LoginButton.tsx`
- `frontend/src/components/auth/LogoutButton.tsx`
- `frontend/src/components/auth/RoleBadge.tsx`
- `frontend/src/components/branch/LifecycleStatus.tsx`
- `frontend/src/components/branch/PublishedBadge.tsx`

### Modified Files (Component Migration - Phase 2)
- `frontend/src/components/library/ContentCard.tsx`
- `frontend/src/components/branch/VisibilitySelector.tsx`
- `frontend/src/components/library/SearchBar.tsx`
- `frontend/src/components/library/Pagination.tsx`
- Form inputs across multiple components

### Modified Files (Component Migration - Phase 3)
- `frontend/src/components/users/RoleChangeDialog.tsx`
- `frontend/src/components/branch/SubmitForReviewButton.tsx`
- `frontend/src/components/diff/DiffViewer.tsx`
- `frontend/src/components/audit/AuditLogViewer.tsx`

---

## Next Steps

Run `/speckit.tasks` to generate the task breakdown with dependencies and estimates.
