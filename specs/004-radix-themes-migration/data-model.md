# Data Model: Radix Themes Migration

**Feature**: 004-radix-themes-migration
**Date**: 2026-01-29

## Overview

This feature does not introduce new database entities. Theme preference is stored client-side in localStorage.

## Client-Side Storage

### Theme Preference (localStorage)

**Key**: `echo-portal-theme-preference`

**Schema**:
```typescript
interface StoredThemePreference {
  preference: 'light' | 'dark' | 'system';
  lastUpdated: string; // ISO 8601 timestamp
}
```

**Example**:
```json
{
  "preference": "dark",
  "lastUpdated": "2026-01-29T10:30:00.000Z"
}
```

### Behavior

| User Action | Storage Update | Resolved Theme |
|-------------|----------------|----------------|
| First visit (no storage) | None | System preference |
| Select "Light" | `{ preference: "light" }` | Light |
| Select "Dark" | `{ preference: "dark" }` | Dark |
| Select "System" | `{ preference: "system" }` | OS preference |
| Clear localStorage | Removed | System preference |

### Migration

No data migration required. Theme preference is a new client-side feature with sensible defaults.

## Type Definitions

```typescript
// frontend/src/context/ThemeContext.tsx

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}
```

## No Database Changes

The following remain unchanged:
- Users table
- Branches table
- Reviews table
- Audit logs table
- All other existing tables

Theme preference is intentionally not persisted to the database to:
1. Avoid unnecessary API calls on every page load
2. Allow instant theme switching without network latency
3. Respect user privacy (no tracking of UI preferences)
