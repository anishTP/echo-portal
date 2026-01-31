# Implementation Plan: Inline Edit from Library

**Branch**: `005-inline-edit` | **Date**: 2026-01-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-inline-edit/spec.md`

## Summary

This feature enables contributors to transition from passive content consumption in the library to governed contribution by initiating edits directly from the content preview. The implementation delivers:

1. **Branch-governed editing**: Published content on main is immutable; any edit requires creating a new branch
2. **WYSIWYG markdown editor**: Milkdown-based inline editing with live formatting while preserving clean GFM output
3. **Offline-first auto-save**: Dexie.js-powered IndexedDB persistence with 2-second debounce and server sync
4. **Version tracking**: Every save creates an attributable version with full history traversal

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node.js 20 LTS
**Primary Dependencies**:
- Frontend: React 19.2.0, @radix-ui/themes 3.2.1, Milkdown 7.x (WYSIWYG markdown), Dexie.js 4.x (IndexedDB)
- Backend: Hono 4.8.2, Drizzle ORM 0.44.0, zod 3.24.2
- Existing: react-markdown 10.1.0 (library rendering), @tanstack/react-query 5.75.5

**Storage**:
- Server: PostgreSQL (existing schema: contents, contentVersions, branches)
- Client: IndexedDB via Dexie.js (drafts, editSessions, syncQueue)

**Testing**: vitest 3.1.3 (unit/integration), @playwright/test 1.52.0 (e2e), @testing-library/react 16.3.2
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
**Project Type**: Web application (monorepo: backend + frontend + shared)
**Performance Goals**:
- Inline formatting render: <500ms
- Auto-save to IndexedDB: <100ms
- Server sync: <2s for documents <1MB
- Editor responsiveness: 60fps during typing

**Constraints**:
- Documents up to 50MB (existing MAX_CONTENT_BYTE_SIZE)
- Offline-capable with automatic sync on reconnect
- Clean GFM output (no proprietary markup)
- Branch isolation: edits cannot leak between branches

**Scale/Scope**: Single-user editing per branch (collaborative editing out of scope)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.1):

- [x] **Explicit Change Control (I)**: All state changes explicit, attributable, intentional
  - Every edit creates a ContentVersion with author, timestamp, changeDescription
  - Auto-save explicitly tracked with synced flag; no silent mutations to published state
  - Audit events logged for branch creation, draft save, session start

- [x] **Single Source of Truth (II)**: Published content protection mechanisms defined
  - Published content immutable: clicking Edit on published content requires branch creation
  - API enforces branch.state === 'draft' for content mutations
  - No auto-save to published state; only to draft branches via IndexedDB → server sync

- [x] **Branch-First Collaboration (III)**: Isolated workspaces and lifecycle stages defined
  - Mandatory branch creation before any edit to published content
  - States: Draft → In Review → Approved → Published (existing workflow)
  - Branch isolation enforced at database level (unique: branchId + slug)

- [x] **Separation of Concerns (IV)**: Clear read/write boundary between consumption and contribution
  - Library view (consumption): public, no auth required, read-only
  - Editor view (contribution): auth required, branch-scoped, creates versions
  - UI clearly distinguishes modes with visual state indicators

- [x] **Role-Driven Governance (V)**: Actors, roles, and permissions explicitly defined
  - Anonymous: view published only
  - Contributor: create branches, edit on own branches, save drafts, submit for review
  - Existing permission middleware enforces branch ownership/collaboration

- [x] **Open by Default (VI)**: Public read access maintained unless justified restriction
  - Published content remains publicly readable
  - Draft content visible only to branch owner, collaborators, admins
  - No new restrictions added

- [x] **Layered Architecture (VII)**: Core workflows stable, changes don't break contracts
  - Uses existing content API contracts (create, update, versions, diff, revert)
  - Adds new IndexedDB layer without modifying server contracts
  - Editor component replaces textarea but produces same GFM output

- [x] **Specification Completeness (VIII)**: All required sections present (see spec-template.md)
  - Actors and permissions: defined in spec
  - Lifecycle states and transitions: defined in spec
  - Visibility boundaries: defined in spec
  - Auditability and traceability: audit events specified
  - Success outcomes and verification: acceptance criteria defined

- [x] **Clarity Over Breadth (IX)**: Complexity justified in Complexity Tracking table
  - Milkdown adds complexity but is required for WYSIWYG markdown editing
  - IndexedDB adds complexity but is required for offline-first auto-save
  - No over-engineering: single-user editing, no CRDTs, no real-time collaboration

- [x] **Testing as Contract (X)**: Test strategy defined, TDD approach confirmed
  - Unit tests: editor state, IndexedDB operations, sync logic
  - Integration tests: edit workflow, version creation, offline recovery
  - E2E tests: library → edit → save → version history flow
  - Target: 80% coverage on core workflows

## Project Structure

### Documentation (this feature)

```text
specs/005-inline-edit/
├── plan.md              # This file
├── research.md          # Phase 0: Editor and IndexedDB research
├── data-model.md        # Phase 1: IndexedDB schema, sync queue design
├── quickstart.md        # Phase 1: Developer setup guide
├── contracts/           # Phase 1: API contracts for new endpoints
│   └── draft-sync.yaml  # Draft sync endpoint contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── routes/
│   │       └── contents.ts          # Existing - add draft sync endpoint
│   ├── services/
│   │   └── content/
│   │       ├── content-service.ts   # Existing - add sync conflict detection
│   │       └── version-service.ts   # Existing - no changes needed
│   └── db/
│       └── schema/
│           └── contents.ts          # Existing - no schema changes needed
└── tests/
    └── integration/
        └── draft-sync.test.ts       # New - sync conflict tests

frontend/
├── src/
│   ├── components/
│   │   ├── content/
│   │   │   └── ContentEditor.tsx    # Existing - replace textarea with Milkdown
│   │   └── editor/                  # New directory
│   │       ├── InlineEditor.tsx     # Milkdown WYSIWYG wrapper
│   │       ├── EditorToolbar.tsx    # Formatting toolbar
│   │       ├── EditorStatusBar.tsx  # Save status, branch info
│   │       └── BranchCreateDialog.tsx # New branch prompt
│   ├── services/
│   │   ├── content-api.ts           # Existing - add syncDraft method
│   │   └── draft-db.ts              # New - Dexie.js database
│   ├── hooks/
│   │   ├── useContent.ts            # Existing - no changes
│   │   ├── useAutoSave.ts           # New - debounced IndexedDB save
│   │   ├── useDraftSync.ts          # New - server sync with conflict detection
│   │   └── useEditSession.ts        # New - session tracking
│   ├── stores/
│   │   └── contentStore.ts          # Existing - add offline draft state
│   └── pages/
│       ├── Library.tsx              # Existing - add Edit button
│       └── BranchWorkspace.tsx      # Existing - integrate new editor
└── tests/
    ├── unit/
    │   ├── draft-db.test.ts         # New - IndexedDB operations
    │   └── auto-save.test.ts        # New - debounce logic
    ├── integration/
    │   └── edit-workflow.test.ts    # New - full edit flow
    └── e2e/
        └── inline-edit.spec.ts      # New - Playwright tests

shared/
└── types/
    └── content.ts                   # Existing - add DraftSyncInput type
```

**Structure Decision**: Web application structure with frontend/backend/shared monorepo. The inline edit feature primarily affects the frontend with minimal backend changes (draft sync endpoint for conflict detection).

## Complexity Tracking

| Complexity Added | Why Needed | Simpler Alternative Rejected Because |
|-----------------|------------|-------------------------------------|
| Milkdown editor (~40KB) | WYSIWYG markdown editing is a core requirement (FR-006) | Plain textarea doesn't provide inline formatting |
| Dexie.js + IndexedDB | Offline-first auto-save required (FR-010-012) | localStorage limited to 5MB, no structured queries |
| Sync queue pattern | Reliable server sync with retry (FR-011) | Direct fetch fails silently on network issues |

All complexity is directly required by functional requirements and cannot be simplified without removing core features.
