# Quickstart: AI-Assisted Authoring

**Feature**: 007-ai-assisted-authoring | **Date**: 2026-02-08

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 16 running with existing echo-portal schema
- `npm install` completed for all workspaces

## Phase 1 Implementation Order

### Step 1: Shared Types

Create `shared/types/ai.ts` with request/response types used by both backend and frontend.

Key types: `AIRequestType`, `AIRequestStatus`, `AIStreamEvent`, `AIConversationDetail`, `AIRequestDetail`

### Step 2: Database Schema

1. Add `backend/src/db/schema/ai-conversations.ts` (ai_conversations table)
2. Add `backend/src/db/schema/ai-requests.ts` (ai_requests table)
3. Update `backend/src/db/schema/index.ts` to export new tables
4. Create migration `backend/src/db/migrations/0005_add_ai_requests.sql`
5. Run migration: `npx drizzle-kit push`

### Step 3: AI Provider Interface

1. Create `backend/src/services/ai/provider-interface.ts` — `AIProvider` interface with `generate()` and `transform()` returning `AsyncIterable<AIStreamChunk>`
2. Create `backend/src/services/ai/provider-registry.ts` — Registry for managing providers
3. Create `backend/src/services/ai/providers/echo-provider.ts` — Default mock provider that echoes prompts (for testing/development)

### Step 4: Core AI Service

1. Create `backend/src/services/ai/conversation-service.ts` — CRUD for conversations, turn counting, session cleanup
2. Create `backend/src/services/ai/rate-limiter.ts` — Per-user rate limit check (50/hour)
3. Create `backend/src/services/ai/ai-service.ts` — Orchestration: validate → create request → stream from provider → store result → audit log

### Step 5: Backend API Routes

1. Create `backend/src/api/middleware/ai-rate-limit.ts` — Rate limit middleware
2. Create `backend/src/api/routes/ai.ts` — All Phase 1 endpoints:
   - POST `/generate` (SSE stream)
   - POST `/transform` (SSE stream)
   - POST `/requests/:id/accept`
   - POST `/requests/:id/reject`
   - POST `/requests/:id/cancel`
   - GET `/conversation`
   - DELETE `/conversation/:id`
   - GET `/requests/:id`
3. Register routes in the main Hono app

### Step 6: Frontend Shared Hooks & Services

1. Create `frontend/src/services/ai-api.ts` — API wrapper for AI endpoints
2. Create `frontend/src/hooks/useSSEStream.ts` — SSE streaming hook with abort support
3. Create `frontend/src/stores/aiStore.ts` — Zustand store for panel state, conversation, pending content

### Step 7: Frontend AI Components

1. Create `frontend/src/components/ai/AIStreamDisplay.tsx` — Streaming text renderer with markdown
2. Create `frontend/src/components/ai/AIChatMessage.tsx` — Message bubble (user prompt / AI response)
3. Create `frontend/src/components/ai/AIChatPanel.tsx` — Side panel with conversation UI
4. Create `frontend/src/components/ai/AIContextMenu.tsx` — Right-click transform menu
5. Create `frontend/src/components/ai/AIInlinePreview.tsx` — Inline replacement with Accept/Reject toolbar

### Step 8: Editor Integration

1. Modify `frontend/src/components/editor/EditorToolbar.tsx` — Add AI panel toggle button
2. Modify `frontend/src/components/editor/InlineEditor.tsx` — Wire context menu and inline preview
3. Modify `frontend/src/components/content/ContentEditor.tsx` — Mount AIChatPanel alongside editor
4. Ensure `useAutoSave` does NOT trigger for pending AI content

### Step 9: Review Attribution (P2)

1. Create `frontend/src/components/ai/AIAttributionBadge.tsx` — "AI Generated" badge component
2. Modify `frontend/src/components/review/DiffView.tsx` — Show attribution badge on AI-generated versions
3. Modify `frontend/src/components/content/VersionHistory.tsx` — Show AI badge on AI versions
4. Modify `frontend/src/components/review/ReviewDetail.tsx` — AI content summary in review header

### Step 10: Tests

1. Unit tests: provider interface, AI service, rate limiter, conversation service
2. Integration tests: generate → accept flow, transform → reject flow, rate limiting, session cleanup
3. Component tests: AIChatPanel, AIAttributionBadge, AIContextMenu
4. E2E tests: Full authoring flow, review attribution visibility

## Verification Checklist

```
[ ] Author can open AI panel and generate content via chat
[ ] Author can select text and transform via context menu
[ ] Streaming tokens appear in real-time
[ ] Author can cancel mid-stream
[ ] Author can accept AI content → new version created with authorType='system'
[ ] Author can reject AI content → discarded
[ ] Multi-turn conversation works (refine output)
[ ] Session end discards pending content
[ ] Branch switch clears conversation
[ ] Rate limit enforced (50/hour)
[ ] Turn limit enforced (20/session)
[ ] Generation size limit enforced (~4000 tokens)
[ ] Reviewer sees AI attribution badge in DiffView
[ ] Version history shows AI badge
[ ] All AI events appear in audit log
[ ] Auto-save does NOT save pending AI content
```

## Key Commands

```bash
# Run backend tests
cd backend && npx vitest run --reporter=verbose

# Run frontend tests
cd frontend && npx vitest run --reporter=verbose

# Run e2e tests
cd frontend && npx playwright test

# Run database migration
cd backend && npx drizzle-kit push

# Full lint + test
npm test && npm run lint
```
