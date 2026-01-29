# Research: Radix Themes Migration

**Feature**: 004-radix-themes-migration
**Date**: 2026-01-29

## Research Questions

### 1. Radix Themes + Tailwind v4 Coexistence

**Question**: How to configure both systems to work together without CSS conflicts?

**Decision**: Use Radix Themes for component styling, Tailwind for layout utilities only

**Rationale**:
- Radix Themes provides complete component library with built-in dark mode support
- Tailwind v4 layout utilities (flex, grid, gap-*, position) don't conflict with Radix
- Color and typography classes from Tailwind conflict with Radix tokens and must be removed

**Implementation**:
```css
/* index.css - Import order matters */
@import "@radix-ui/themes/styles.css";
@import "tailwindcss";
```

**Alternatives Considered**:
1. Full Tailwind + Radix Primitives (headless) - Rejected: More work, less consistent theming
2. Keep both fully active - Rejected: CSS specificity conflicts

---

### 2. Theme Persistence with System Preference Detection

**Question**: Best practices for implementing `prefers-color-scheme` detection with localStorage override?

**Decision**: Use `prefers-color-scheme` media query with localStorage override

**Rationale**:
- System preference respected by default (meets FR-001)
- Manual override persists in localStorage
- `matchMedia` listener handles real-time OS changes

**Implementation**:
```typescript
type ThemePreference = 'light' | 'dark' | 'system';

function getResolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

// Listen for OS theme changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', (e) => {
  if (preference === 'system') {
    updateTheme(e.matches ? 'dark' : 'light');
  }
});
```

**Storage Key**: `echo-portal-theme-preference`

**Alternatives Considered**:
1. Server-side theme detection via cookie - Rejected: Out of scope, adds complexity
2. CSS-only approach without JS - Rejected: Cannot persist preference

---

### 3. Monaco Editor CSS Variable Bridge

**Question**: CSS variable requirements for Monaco editor dark mode?

**Decision**: Create custom CSS file mapping Radix tokens to Monaco CSS variables

**Rationale**:
- Monaco editor uses VS Code's theming API with `--vscode-*` CSS variables
- Cannot directly use Radix tokens; need bridge layer
- Bridge allows Monaco to automatically respect theme changes

**Implementation**:
```css
/* monaco-bridge.css */
.monaco-editor {
  --vscode-editor-background: var(--color-background);
  --vscode-editor-foreground: var(--gray-12);
  --vscode-editorLineNumber-foreground: var(--gray-11);
  --vscode-editorCursor-foreground: var(--accent-11);
  --vscode-editor-selectionBackground: var(--accent-5);
}

/* Dark mode overrides */
:root[class~="dark"] .monaco-editor,
.dark .monaco-editor {
  --vscode-editor-background: var(--gray-1);
  --vscode-editor-foreground: var(--gray-12);
}
```

**Key Monaco Variables to Bridge**:
- `--vscode-editor-background` - Editor background color
- `--vscode-editor-foreground` - Default text color
- `--vscode-editorLineNumber-foreground` - Line number color
- `--vscode-editorCursor-foreground` - Cursor color
- `--vscode-editor-selectionBackground` - Selection highlight

**Alternatives Considered**:
1. Use Monaco's JavaScript theming API - Rejected: Harder to sync with CSS theme
2. Create completely custom Monaco theme - Rejected: More maintenance burden

---

### 4. Bundle Size Optimization

**Question**: How to minimize bundle size impact from Radix Themes?

**Decision**: Import only used Radix Themes components, not entire library

**Rationale**:
- `@radix-ui/themes` supports tree-shaking when using named imports
- Full library is ~50KB, but individual components are much smaller
- Estimated bundle increase: ~15KB gzipped (within 20KB budget)

**Implementation**:
```typescript
// Good - tree-shakeable
import { Button, Badge, Dialog, DropdownMenu } from '@radix-ui/themes';

// Bad - imports entire library
import * as Themes from '@radix-ui/themes';
```

**Bundle Size Estimates**:
| Component | Approximate Size (gzipped) |
|-----------|---------------------------|
| Theme provider | ~3KB |
| Button | ~1KB |
| Badge | ~0.5KB |
| Dialog | ~3KB |
| DropdownMenu | ~2KB |
| TextField | ~1.5KB |
| Select | ~2KB |
| Table | ~1.5KB |
| **Total used** | ~15KB |

**Alternatives Considered**:
1. Use Radix Primitives with custom styling - Rejected: More code, inconsistent theming
2. Cherry-pick from multiple packages - Rejected: Version management complexity

---

## Unresolved Questions

None. All research questions have been resolved.

## References

- [Radix Themes Documentation](https://www.radix-ui.com/themes/docs)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Monaco Editor Theming](https://microsoft.github.io/monaco-editor/docs.html#interfaces/editor.IStandaloneThemeData.html)
- [prefers-color-scheme MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
