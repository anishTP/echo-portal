# Quickstart: Inline Edit from Library

**Feature Branch**: `005-inline-edit`
**Date**: 2026-01-31

## Prerequisites

- Node.js 20 LTS
- pnpm 9.15.4+
- PostgreSQL running locally
- Git

## Setup

### 1. Clone and checkout feature branch

```bash
git checkout 005-inline-edit
pnpm install
```

### 2. Install new dependencies

```bash
# Frontend - Milkdown editor
cd frontend
pnpm add @milkdown/core @milkdown/react @milkdown/preset-commonmark @milkdown/preset-gfm
pnpm add @milkdown/theme-nord @milkdown/plugin-history @milkdown/plugin-clipboard
pnpm add @milkdown/plugin-listener @milkdown/plugin-prism

# Frontend - IndexedDB
pnpm add dexie dexie-react-hooks

cd ..
```

### 3. Start development servers

```bash
# From repo root
pnpm dev
```

This starts:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## Development Workflow

### Testing the Edit Flow

1. **View Library** - Navigate to http://localhost:5173/library
2. **Select content** - Click any published content item
3. **Initiate edit** - Click the "Edit" button (requires dev auth)
4. **Create branch** - Confirm branch name in dialog
5. **Edit content** - Use the inline WYSIWYG editor
6. **Auto-save** - Changes save locally within 2 seconds
7. **Manual save** - Click "Save Draft" for server sync with version

### Dev Authentication

Enable dev auth to test contributor workflows:

```javascript
// Browser console
localStorage.setItem('dev_auth', 'true');
location.reload();
```

This gives you contributor/reviewer/publisher/administrator roles.

### Testing IndexedDB

Open browser DevTools → Application → IndexedDB → EchoPortalDrafts

Tables to inspect:
- `drafts` - Work-in-progress content
- `editSessions` - Active editing sessions
- `syncQueue` - Pending server syncs

### Testing Offline Mode

1. Open DevTools → Network
2. Select "Offline" in throttling dropdown
3. Continue editing - changes save to IndexedDB
4. Go back online - watch auto-sync to server

## Key Files

### Frontend Components

| File | Purpose |
|------|---------|
| `src/components/editor/InlineEditor.tsx` | Milkdown WYSIWYG wrapper |
| `src/components/editor/EditorToolbar.tsx` | Formatting toolbar |
| `src/components/editor/EditorStatusBar.tsx` | Save status, branch info |
| `src/components/editor/BranchCreateDialog.tsx` | New branch prompt |
| `src/components/content/ContentEditor.tsx` | Updated to use InlineEditor |

### Frontend Services & Hooks

| File | Purpose |
|------|---------|
| `src/services/draft-db.ts` | Dexie.js database instance |
| `src/hooks/useAutoSave.ts` | Debounced IndexedDB save |
| `src/hooks/useDraftSync.ts` | Server sync with conflict detection |
| `src/hooks/useEditSession.ts` | Session tracking |

### Backend Routes

| File | Purpose |
|------|---------|
| `src/api/routes/contents.ts` | Add `POST /contents/:id/sync` |
| `src/api/routes/branches.ts` | Add `POST /branches/edit` |

### Shared Types

| File | Purpose |
|------|---------|
| `types/content.ts` | Add `DraftSyncInput`, `DraftSyncResult` |

## Running Tests

```bash
# Unit tests
pnpm test

# E2E tests (requires dev server running)
pnpm test:e2e

# Specific test file
pnpm test frontend/tests/unit/draft-db.test.ts
```

## Debugging

### Milkdown Editor Issues

```typescript
// Enable debug mode in InlineEditor.tsx
import { Editor } from '@milkdown/core';

const editor = Editor.make()
  .config(ctx => {
    ctx.set(editorViewOptionsCtx, {
      // Log all transactions
      handleDOMEvents: {
        keydown: (view, event) => {
          console.log('Keydown:', event.key);
          return false;
        }
      }
    });
  });
```

### IndexedDB Issues

```typescript
// Clear all draft data (browser console)
const db = await indexedDB.open('EchoPortalDrafts');
db.close();
indexedDB.deleteDatabase('EchoPortalDrafts');
location.reload();
```

### Sync Queue Issues

```typescript
// Check pending syncs (browser console)
const { draftDb } = await import('./src/services/draft-db');
const pending = await draftDb.syncQueue.toArray();
console.log('Pending syncs:', pending);
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interaction                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  InlineEditor (Milkdown)                                    │
│  - WYSIWYG markdown editing                                 │
│  - GFM output                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  useAutoSave Hook                                           │
│  - 2-second debounce                                        │
│  - Write to IndexedDB                                       │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│  IndexedDB (Dexie)      │    │  useDraftSync Hook          │
│  - drafts table         │───▶│  - Server sync              │
│  - syncQueue table      │    │  - Conflict detection       │
└─────────────────────────┘    └─────────────────────────────┘
                                              │
                                              ▼
                               ┌─────────────────────────────┐
                               │  Backend API                │
                               │  POST /contents/:id/sync    │
                               └─────────────────────────────┘
                                              │
                                              ▼
                               ┌─────────────────────────────┐
                               │  PostgreSQL                 │
                               │  contents, contentVersions  │
                               └─────────────────────────────┘
```

## Common Tasks

### Add a new Milkdown plugin

```typescript
// In InlineEditor.tsx
import { yourPlugin } from '@milkdown/plugin-your-plugin';

const editor = Editor.make()
  .config(...)
  .use(commonmark)
  .use(gfm)
  .use(yourPlugin)  // Add here
  .create();
```

### Modify auto-save interval

```typescript
// In useAutoSave.ts
const AUTO_SAVE_DELAY_MS = 2000;  // Change this value
```

### Add new draft metadata field

1. Update `Draft` interface in `draft-db.ts`
2. Update `DraftSyncInput` in `shared/types/content.ts`
3. Increment Dexie schema version with migration
4. Update `DraftSyncInput` zod schema on backend

## Troubleshooting

### "Cannot read property of undefined" in Milkdown

Ensure all plugins are imported correctly and `@milkdown/react` is used for the React wrapper.

### IndexedDB quota exceeded

Safari has a 50MB limit. For large documents, consider server-only saving.

### Sync conflicts not detected

Verify `expectedServerVersion` matches the `versionTimestamp` format from the server (ISO 8601).

### Editor not receiving focus

Check that `EditorToolbar` isn't stealing focus. Use `tabIndex={-1}` on toolbar buttons.
