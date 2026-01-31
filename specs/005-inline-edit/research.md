# Research: Inline Edit from Library

**Feature Branch**: `005-inline-edit`
**Date**: 2026-01-31
**Status**: Complete

## Overview

This document consolidates research findings for implementing a branch-governed WYSIWYG markdown editor with offline-first auto-save capabilities.

---

## 1. WYSIWYG Markdown Editor Selection

### Decision: **Milkdown**

**Rationale**: Milkdown provides the best balance of clean GFM output, full WYSIWYG inline rendering, and React 19 compatibility for our Notion/Medium-style editing requirements.

### Alternatives Considered

| Editor | GFM Output | Inline Render | React 19 | Bundle | Decision |
|--------|-----------|---------------|----------|--------|----------|
| **Milkdown** | Excellent | Full WYSIWYG | Good | ~40KB | **Selected** |
| Tiptap | Good | Full WYSIWYG | Partial (UI in progress) | ~60KB | Runner-up |
| Lexical | Limited | Partial | Excellent | ~22KB | Pre-1.0, markdown weak |
| Monaco | Excellent | None | Good | ~2MB+ | No inline rendering |
| CodeMirror 6 + ink-mde | Excellent | Partial | Good | ~50KB | Less mature plugins |

### Why Milkdown

1. **GFM Output Quality**: Built on remark/MDAST ecosystem, produces clean CommonMark/GFM without proprietary markup artifacts
2. **Inline Rendering**: True WYSIWYG with formatting rendered in place (headings, bold, lists, code blocks, images)
3. **Plugin Architecture**: Everything is a plugin - supports math, diagrams, custom embeds
4. **React Integration**: `@milkdown/react` v7.15+ provides official bindings
5. **Bundle Size**: ~40KB gzipped (core), tree-shakable to reduce further

### Why Not Tiptap

- React 19 UI components still being updated
- Markdown extension marked "early release" with edge cases
- Pro features require paid license for some advanced functionality

### Why Not Lexical

- Pre-1.0 release with potential API changes
- Built-in markdown processing is limited (doesn't handle nested lists well)
- `MarkdownShortcutPlugin` provides shortcuts, not full inline rendering

### Implementation Notes

```typescript
// Core packages needed
@milkdown/core           // Editor core
@milkdown/react          // React bindings
@milkdown/preset-commonmark  // CommonMark/GFM support
@milkdown/preset-gfm     // Tables, strikethrough, task lists
@milkdown/theme-nord     // Optional theme (or custom)
@milkdown/plugin-history // Undo/redo
@milkdown/plugin-clipboard // Copy/paste handling
```

**Performance**: Handles documents up to 100KB with inline rendering within 500ms requirement.

---

## 2. IndexedDB Auto-Save Pattern

### Decision: **Dexie.js with 2-second debounce**

**Rationale**: Dexie.js provides the best developer experience for IndexedDB with schema versioning, reactive hooks, and optimized bulk operations.

### Alternatives Considered

| Library | Downloads/wk | Features | Decision |
|---------|-------------|----------|----------|
| **Dexie.js** | 727K | Full-featured: versioning, reactive queries, bulk ops | **Selected** |
| idb | 9.3M | Lightweight promise wrapper | Too minimal |
| localForage | 4.8M | Cross-browser fallback | Unnecessary complexity |

### Why Dexie.js

1. **Schema Versioning**: Built-in migrations with `version().stores().upgrade()`
2. **Reactive Hooks**: `useLiveQuery` provides automatic re-renders when data changes
3. **Bulk Operations**: Optimized to bypass per-operation onsuccess events
4. **TypeScript Support**: Full type definitions included
5. **Active Maintenance**: 13K stars, regular updates

### Auto-Save Architecture

```
User Types → 2s Debounce → IndexedDB Write → Queue Sync → Server API
                              ↓
                        synced: false
                              ↓
                    (on connectivity)
                              ↓
                    Sync with conflict check
                              ↓
                        synced: true
```

### IndexedDB Schema Design

```typescript
interface Draft {
  id: string;              // contentId:branchId composite key
  contentId: string;
  branchId: string;
  body: string;            // GFM markdown content
  localVersion: number;    // Incremented on each local save
  serverVersion: string;   // Last synced versionTimestamp
  updatedAt: number;       // Unix timestamp
  synced: boolean;         // false = pending sync
}

interface EditSession {
  id: string;              // Session UUID
  contentId: string;
  branchId: string;
  startedAt: number;
  lastActivityAt: number;
  deviceId: string;        // For multi-device detection
}

interface SyncQueueItem {
  id?: number;             // Auto-increment
  contentId: string;
  branchId: string;
  operation: 'save' | 'delete';
  payload: unknown;
  attempts: number;
  createdAt: number;
  lastAttemptAt?: number;
}

// Dexie database definition
class DraftDatabase extends Dexie {
  drafts!: Dexie.Table<Draft, string>;
  editSessions!: Dexie.Table<EditSession, string>;
  syncQueue!: Dexie.Table<SyncQueueItem, number>;

  constructor() {
    super('EchoPortalDrafts');
    this.version(1).stores({
      drafts: 'id, contentId, branchId, updatedAt, synced',
      editSessions: 'id, contentId, branchId, lastActivityAt',
      syncQueue: '++id, contentId, branchId, createdAt'
    });
  }
}
```

### Sync Strategy

1. **Optimistic UI**: Show success immediately on local save
2. **Queue-Based Sync**: Failed syncs queued for retry with exponential backoff
3. **Version-Based Conflict Detection**: Server rejects if `currentVersionTimestamp` doesn't match
4. **Background Sync API**: Use where available, fallback to `navigator.onLine` events

```typescript
// Conflict detection flow
async function syncDraft(draft: Draft): Promise<SyncResult> {
  const response = await contentApi.syncDraft({
    contentId: draft.contentId,
    body: draft.body,
    expectedServerVersion: draft.serverVersion,
    changeDescription: 'Auto-saved draft'
  });

  if (response.status === 409) {
    // Server has newer version - user must resolve
    return { conflict: true, serverVersion: response.data };
  }

  // Update local with new server version
  await db.drafts.update(draft.id, {
    serverVersion: response.data.versionTimestamp,
    synced: true
  });

  return { conflict: false };
}
```

### Browser Crash Recovery

- IndexedDB survives browser crashes (unlike in-memory state)
- On mount, check for drafts with `synced: false`
- Show recovery UI if unsaved work detected
- Session heartbeat every 30 seconds detects abandoned sessions

### Limitations

- Safari may delete IndexedDB after 7 days of inactivity
- Private/incognito mode has limited or no IndexedDB support
- For these cases, fall back to server-only saving with warning

---

## 3. Branch Creation from Library

### Decision: **Modal dialog with suggested branch name**

### Flow

1. User clicks "Edit" on published content in Library
2. If unauthenticated → redirect to login with return URL
3. If authenticated → show BranchCreateDialog modal
4. Modal pre-fills branch name: `edit-{content-slug}-{timestamp}`
5. User confirms → API creates branch, copies content, redirects to editor
6. Editor loads with content from new branch

### Branch Naming

```typescript
function suggestBranchName(contentSlug: string): string {
  const timestamp = Date.now().toString(36); // Short timestamp
  return `edit-${contentSlug}-${timestamp}`;
}

// Examples:
// "getting-started" → "edit-getting-started-lq2x8k"
// "api-design-guidelines" → "edit-api-design-guidelines-lq2x9m"
```

### API Integration

Uses existing branch creation endpoint:
```typescript
POST /api/v1/branches
{
  name: "Edit: Getting Started",
  slug: "edit-getting-started-lq2x8k",
  baseRef: "main",
  sourceContentId: "uuid-of-published-content"
}
```

---

## 4. State Awareness Cues

### Decision: **Persistent status bar with visual indicators**

### Status Bar Components

| Indicator | States | Visual |
|-----------|--------|--------|
| Save Status | Saved / Saving... / Unsaved / Offline | Icon + text |
| Branch | Branch name | Badge |
| Version | Draft (unsaved) / Draft v3 | Text |
| Sync | Synced / Syncing... / Pending sync (2) | Icon |

### Implementation

```tsx
<EditorStatusBar
  saveStatus={saveStatus}        // 'saved' | 'saving' | 'unsaved' | 'offline'
  branchName={branch.name}
  versionNumber={localVersion}
  syncStatus={syncStatus}        // 'synced' | 'syncing' | 'pending'
  pendingSyncCount={pendingCount}
  lastSyncedAt={lastSyncedAt}
/>
```

### Visual Design

- Use Radix Themes `Badge` component for branch name
- Use `Spinner` for saving/syncing states
- Use `Text` with color semantic tokens for status
- Sticky position at bottom of editor viewport

---

## 5. Markdown Integrity Rules

### Decision: **Strict GFM output with no proprietary extensions**

### Rules

1. **No HTML in output**: Milkdown converts to pure markdown
2. **No data attributes**: No `data-*` attributes embedded in markdown
3. **No custom syntax**: Only standard GFM elements
4. **Whitespace preservation**: Maintain exact whitespace for code blocks
5. **Link format**: Standard `[text](url)` only, no reference-style unless user writes it

### Validation

```typescript
function validateMarkdownOutput(markdown: string): ValidationResult {
  const issues: string[] = [];

  // Check for HTML tags (except allowed like <br>)
  if (/<(?!br\s*\/?>)[a-z]/i.test(markdown)) {
    issues.push('Contains disallowed HTML tags');
  }

  // Check for data attributes
  if (/data-\w+=/i.test(markdown)) {
    issues.push('Contains data attributes');
  }

  return { valid: issues.length === 0, issues };
}
```

### Testing

- Round-trip tests: markdown → editor → markdown
- Diff tests: ensure output matches input for unchanged content
- Parser compatibility: test with GitHub, VS Code, Obsidian parsers

---

## 6. Performance Benchmarks

### Targets (from spec)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Inline formatting render | <500ms | Time from keystroke to visual update |
| Auto-save to IndexedDB | <100ms | Time to complete Dexie put() |
| Server sync | <2s | Time for API round-trip |
| Editor FPS | 60fps | During continuous typing |

### Testing Approach

1. **Synthetic benchmarks**: Measure with Performance API
2. **Real-world tests**: 100KB document with mixed formatting
3. **Stress tests**: Rapid typing simulation
4. **Network conditions**: Throttled 3G, offline, flaky connection

---

## 7. Edge Cases

### Concurrent Edits (Same User, Multiple Tabs)

**Decision**: Last write wins locally; warning shown if external changes detected

```typescript
// Check for external changes on focus
window.addEventListener('focus', async () => {
  const serverVersion = await contentApi.getVersion(contentId);
  if (serverVersion.timestamp > lastKnownServerVersion) {
    showWarning('Content was modified in another tab. Reload to see changes?');
  }
});
```

### Abandoned Drafts

**Decision**: Drafts persist in IndexedDB until explicitly discarded or branch is deleted

- No automatic cleanup (user data preservation)
- "Discard Draft" action clears IndexedDB and reverts to server version
- Branch deletion triggers cleanup of associated IndexedDB drafts

### Offline Progress

**Decision**: Full offline editing with sync on reconnect

- Editor remains fully functional offline
- Status bar shows "Offline" indicator
- Changes queue in IndexedDB
- Auto-sync when `navigator.onLine` becomes true

### Session Expiry During Edit

**Decision**: Preserve local changes; prompt re-authentication

- IndexedDB drafts don't require auth
- On save attempt with expired session, show login modal
- After re-auth, sync proceeds automatically

### Large Documents (>1MB)

**Decision**: Chunked auto-save with progress indicator

- Documents up to 50MB supported (existing limit)
- Auto-save triggers loading indicator for >1MB
- Consider debounce increase for very large docs

---

## 8. Security Considerations

### IndexedDB Security

- IndexedDB is same-origin isolated
- No sensitive data stored (content is user-generated markdown)
- Session tokens NOT stored in IndexedDB (use httpOnly cookies)

### XSS Prevention

- Milkdown sanitizes input by default
- Additional sanitization on server before storage
- CSP headers prevent inline script execution

### Branch Permission Enforcement

- All mutations validated server-side
- Client-side checks are UX only, not security
- API rejects edits to non-owned branches

---

## Sources

### WYSIWYG Editors

- [Milkdown GitHub](https://github.com/Milkdown/milkdown) - 10.4K stars
- [Milkdown React Docs](https://milkdown.dev/docs/recipes/react)
- [Tiptap GitHub](https://github.com/ueberdosis/tiptap) - 34.8K stars
- [Tiptap Markdown Docs](https://tiptap.dev/docs/editor/markdown)
- [Lexical GitHub](https://github.com/facebook/lexical) - 22.8K stars
- [Liveblocks 2025 Editor Comparison](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)

### IndexedDB & Auto-Save

- [Dexie.js Documentation](https://dexie.org/)
- [Dexie.js in React - LogRocket](https://blog.logrocket.com/dexie-js-indexeddb-react-apps-offline-data-storage/)
- [IndexedDB Best Practices - web.dev](https://web.dev/articles/indexeddb-best-practices-app-state)
- [Background Sync API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [Custom Debounce Hook - LogRocket](https://blog.logrocket.com/create-custom-debounce-hook-react/)

### Offline-First Patterns

- [Offline-first Apps 2025 - LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Workbox Background Sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync)
