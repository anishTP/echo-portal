# Research: AI-Assisted Authoring and Controls

**Feature**: 007-ai-assisted-authoring | **Date**: 2026-02-08

## R1: SSE Streaming with Hono

**Decision**: Use Hono's built-in `streamSSE()` helper from `hono/streaming`.

**Rationale**: Hono 4.x natively supports SSE via `c.streamSSE()` which returns a `ReadableStream`-backed response with correct `Content-Type: text/event-stream` headers. This avoids external dependencies and integrates cleanly with the existing route handler pattern. The helper supports named events, data payloads, and automatic keep-alive.

**Pattern**:
```typescript
import { streamSSE } from 'hono/streaming';

app.get('/api/v1/ai/stream/:requestId', async (c) => {
  return streamSSE(c, async (stream) => {
    for await (const chunk of providerStream) {
      await stream.writeSSE({ data: JSON.stringify({ token: chunk.text }), event: 'token' });
    }
    await stream.writeSSE({ data: JSON.stringify({ status: 'complete' }), event: 'done' });
  });
});
```

**Client-side**: Use native `EventSource` API or `fetch()` with `ReadableStream` for more control (abort support). Given the need for auth headers (which `EventSource` doesn't support natively), use `fetch()` + `getReader()` pattern with `TextDecoderStream`.

**Alternatives considered**:
- WebSockets: Overkill for unidirectional streaming; adds connection management complexity
- Long polling: Higher latency, more complex client logic, no incremental delivery
- Third-party SSE library: Unnecessary given Hono's built-in support

## R2: AI Provider Interface Design

**Decision**: Define a `AIProvider` interface with `generate()` and `transform()` methods that return `AsyncIterable<AIStreamChunk>`. Registry pattern for provider management.

**Rationale**: An async iterable return type naturally supports both streaming and batch providers. The registry pattern allows runtime provider selection and aligns with Phase 2 admin configuration. Interface-first design means the mock provider for testing uses the same contract.

**Interface shape**:
```typescript
interface AIStreamChunk {
  type: 'token' | 'error' | 'done';
  content?: string;
  metadata?: { tokensUsed?: number; model?: string; finishReason?: string };
}

interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  generate(params: AIGenerateParams): AsyncIterable<AIStreamChunk>;
  transform(params: AITransformParams): AsyncIterable<AIStreamChunk>;
  validateConfig(): Promise<boolean>;
}

interface AIGenerateParams {
  prompt: string;
  context?: string;          // current document content
  conversationHistory?: ConversationTurn[];
  maxTokens?: number;
}

interface AITransformParams {
  selectedText: string;
  instruction: string;       // 'rewrite' | 'summarize' | 'expand' | 'change_tone' | custom
  context?: string;          // surrounding document content
  maxTokens?: number;
}
```

**Alternatives considered**:
- Single `complete()` method: Doesn't cleanly separate generation from transformation concerns
- Callback-based streaming: Less composable than async iterables; harder to test
- Abstract class: Interface preferred for flexibility; no shared implementation needed

## R3: Ephemeral Storage & Session Binding

**Decision**: New `ai_requests` PostgreSQL table with `expiresAt` column. Background cleanup via periodic job (or on-access lazy cleanup). Session binding via `sessionId` column matching the existing auth session.

**Rationale**: PostgreSQL storage (vs Redis/in-memory) keeps the tech stack simple and ensures pending content survives server restarts. The `expiresAt` column allows lazy cleanup without a dedicated scheduler. Session binding uses the existing session infrastructure.

**Cleanup strategy**: Two-pronged:
1. **Lazy cleanup**: On any AI request, delete expired rows for the requesting user (fast, indexed)
2. **Periodic cleanup**: Optional cron/interval that purges all expired rows (prevents table bloat)

**TTL**: Match existing session duration (typically 24h). Configurable in Phase 2.

**Alternatives considered**:
- Redis: Adds infrastructure dependency for ephemeral data that doesn't need sub-ms access
- Client-side IndexedDB: Can't support audit of rejected content; lost on cache clear
- In-memory Map: Lost on server restart; doesn't scale across instances

## R4: Milkdown Editor Integration for AI

**Decision**: Use Milkdown's plugin system for context menu and inline content manipulation. AI panel is a React component mounted alongside the editor (not inside Milkdown's plugin tree).

**Rationale**: Milkdown uses ProseMirror internally. Selection state and content manipulation are available through the ProseMirror editor view. The context menu triggers on `contextmenu` event with selection check. Inline replacement uses ProseMirror transactions (`tr.replaceSelection()`). The AI chat panel is external to the editor to keep concerns separated.

**Integration points**:
- **Selection access**: `editor.action(getSelectedText)` via Milkdown's `@milkdown/utils`
- **Content insertion**: `editor.action(replaceSelection(markdown))` for accepted content
- **Context menu**: Custom React portal positioned at selection coordinates via `view.coordsAtPos()`
- **Inline preview**: ProseMirror decoration plugin to highlight pending AI replacement with custom widget

**Alternatives considered**:
- Milkdown plugin for AI panel: Overly coupled; hard to manage React state within ProseMirror
- Floating UI for context menu: Viable but adds dependency; native positioning from ProseMirror coords is sufficient
- Shadow DOM for inline preview: Unnecessary complexity; ProseMirror decorations handle this natively

## R5: Rate Limiting Strategy

**Decision**: Sliding window counter using PostgreSQL. Key: `userId`, window: 1 hour, limit: 50. Check-and-increment in a single query.

**Rationale**: PostgreSQL-based rate limiting keeps the stack simple (no Redis needed). The `ai_requests` table itself serves as the rate limit counter — count rows per user in the last hour. This is accurate, transactional, and queryable for audit.

**Query pattern**:
```sql
SELECT COUNT(*) FROM ai_requests
WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour';
```

If count >= 50, reject with 429 status and `Retry-After` header.

**Alternatives considered**:
- Token bucket (Redis): More precise but adds infrastructure dependency
- Fixed window: Simpler but allows burst at window boundaries
- In-memory counter: Lost on restart; doesn't work across instances

## R6: Version-Level Attribution Flow

**Decision**: When AI content is accepted, call `versionService.createVersion()` with `authorType: 'system'` and store AI metadata (provider, model, requestId, conversationId) in the audit log via `initiatingUserId` (set to the accepting human) and `metadata` (JSON with AI details).

**Rationale**: This reuses 100% of existing infrastructure. The `authorType` field on `contentVersions` already supports 'system'. The audit log's `initiatingUserId` already links system actions to humans. No schema changes needed for attribution — only new audit event types.

**Attribution chain**:
1. AI generates → audit: `ai.content_generated` (actorType: system, initiatingUserId: requesting author)
2. Human accepts → audit: `ai.content_accepted` (actorType: user)
3. Version created → `contentVersions.authorType = 'system'`, `authorId` = AI system ID
4. Review interface → reads `authorType` from version → shows badge

**Alternatives considered**:
- Span-level tracking: Rejected per clarification — too complex, breaks on edit
- Separate AI attribution table: Unnecessary duplication when version + audit tables suffice
- Custom metadata column on versions: Would require schema migration for data already capturable in audit `metadata`

## R7: Frontend SSE Consumption

**Decision**: Custom `useSSEStream` hook using `fetch()` + `ReadableStream` with `TextDecoderStream`. Not `EventSource` API.

**Rationale**: `EventSource` doesn't support custom headers (needed for auth Bearer token) or POST requests. The `fetch()` approach with `getReader()` provides full control over abort (via `AbortController`), authentication, and error handling. The hook returns a reactive state with streaming content, status, and abort function.

**Hook shape**:
```typescript
function useSSEStream() {
  return {
    startStream: (url: string, options?: { body?: object }) => void;
    content: string;         // accumulated streamed text
    status: 'idle' | 'streaming' | 'complete' | 'error' | 'cancelled';
    error: Error | null;
    abort: () => void;
  };
}
```

**Alternatives considered**:
- `EventSource` + auth proxy: Adds unnecessary server-side complexity
- `@microsoft/fetch-event-source`: Viable third-party option but adds dependency for a simple pattern
- TanStack Query streaming: Not natively supported; would require custom query function anyway
