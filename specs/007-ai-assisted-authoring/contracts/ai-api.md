# API Contracts: AI-Assisted Authoring

**Base path**: `/api/v1/ai`
**Auth**: All endpoints require `requireAuth` middleware (Bearer JWT)

---

## Phase 1 Endpoints

### POST /api/v1/ai/generate

Start an AI content generation request with streaming response.

**Middleware**: `requireAuth`, `aiRateLimit`, `auditContextMiddleware`

**Request Body** (JSON):
```typescript
{
  branchId: string;        // Target branch (must be in 'draft' state)
  contentId?: string;      // Target content (for inserting into existing content)
  prompt: string;          // User's generation instruction
  conversationId?: string; // Existing conversation (for multi-turn)
}
```

**Validation** (Zod):
- `branchId`: uuid, required
- `contentId`: uuid, optional
- `prompt`: string, min 1, max 10000 chars
- `conversationId`: uuid, optional

**Authorization checks**:
1. User has edit permission on branch (`checkBranchEditContextual`)
2. Branch is in 'draft' state
3. No existing pending/generating request for this user+branch (FR-017)
4. Rate limit not exceeded (FR-021)
5. Conversation turn limit not exceeded if conversationId provided (FR-020)

**Response**: SSE stream (`Content-Type: text/event-stream`)

SSE Events:
```
event: meta
data: {"requestId":"uuid","conversationId":"uuid","providerId":"...","modelId":"..."}

event: token
data: {"content":"partial text"}

event: token
data: {"content":"more text"}

event: done
data: {"requestId":"uuid","tokensUsed":1234,"fullContent":"complete generated text"}

event: error
data: {"code":"PROVIDER_ERROR","message":"..."}
```

**Error responses**:
- `400` — Invalid input, missing prompt
- `403` — No edit permission on branch
- `409` — Branch not in draft state, or pending request exists
- `429` — Rate limit exceeded (include `Retry-After` header)
- `503` — AI provider unavailable

**Audit events**:
- `ai.requested` on request start
- `ai.generated` on successful completion
- `ai.cancelled` if client disconnects mid-stream

---

### POST /api/v1/ai/transform

Start an AI content transformation with streaming response.

**Middleware**: `requireAuth`, `aiRateLimit`, `auditContextMiddleware`

**Request Body** (JSON):
```typescript
{
  branchId: string;        // Target branch
  contentId: string;       // Content being transformed
  selectedText: string;    // Text to transform
  instruction: string;     // 'rewrite' | 'summarize' | 'expand' | 'change_tone' | custom string
  conversationId?: string; // Existing conversation
}
```

**Validation**:
- `branchId`: uuid, required
- `contentId`: uuid, required
- `selectedText`: string, min 1, max 50000 chars
- `instruction`: string, min 1, max 5000 chars
- `conversationId`: uuid, optional

**Authorization**: Same as generate.

**Response**: Same SSE stream format as generate.

**Audit events**: Same as generate with `requestType: 'transformation'`.

---

### POST /api/v1/ai/requests/:requestId/accept

Accept pending AI-generated content, creating a new content version.

**Middleware**: `requireAuth`, `auditContextMiddleware`

**Request Body** (JSON):
```typescript
{
  contentId: string;           // Target content to update
  editedContent?: string;      // If author edited before accepting (optional)
  changeDescription?: string;  // Optional version description
}
```

**Authorization**:
1. Request belongs to the authenticated user
2. Request is in 'pending' status
3. User has edit permission on branch

**Response** (`200`):
```typescript
{
  success: true;
  contentVersion: ContentVersionDetail;  // Newly created version
  requestId: string;
}
```

**Side effects**:
1. Updates `ai_requests.status` to 'accepted'
2. Calls `versionService.createVersion()` with `authorType: 'system'`
3. Updates `content.currentVersionId` to new version
4. Logs `ai.accepted` audit event with `initiatingUserId` = accepting user

**Error responses**:
- `400` — Invalid input
- `403` — Not the requesting user, or no edit permission
- `404` — Request not found
- `409` — Request not in 'pending' status

---

### POST /api/v1/ai/requests/:requestId/reject

Reject pending AI-generated content, discarding it.

**Middleware**: `requireAuth`, `auditContextMiddleware`

**Request Body** (JSON):
```typescript
{
  reason?: string;  // Optional rejection reason
}
```

**Authorization**: Request belongs to authenticated user.

**Response** (`200`):
```typescript
{
  success: true;
  requestId: string;
}
```

**Side effects**:
1. Updates `ai_requests.status` to 'rejected'
2. Logs `ai.rejected` audit event

---

### POST /api/v1/ai/requests/:requestId/cancel

Cancel an in-progress streaming generation.

**Middleware**: `requireAuth`

**Authorization**: Request belongs to authenticated user.

**Response** (`200`):
```typescript
{
  success: true;
  requestId: string;
}
```

**Side effects**:
1. Signals abort to the streaming provider
2. Updates `ai_requests.status` to 'cancelled'
3. Discards partial content
4. Logs `ai.cancelled` audit event

---

### GET /api/v1/ai/conversation

Get the active conversation for the current user + branch.

**Middleware**: `requireAuth`

**Query params**:
- `branchId`: uuid, required

**Response** (`200`):
```typescript
{
  conversation: {
    id: string;
    branchId: string;
    status: 'active' | 'ended';
    turnCount: number;
    maxTurns: number;
    createdAt: string;
    requests: Array<{
      id: string;
      requestType: 'generation' | 'transformation';
      prompt: string;
      generatedContent: string | null;
      status: string;
      createdAt: string;
    }>;
  } | null;
}
```

---

### DELETE /api/v1/ai/conversation/:conversationId

End and clear a conversation.

**Middleware**: `requireAuth`, `auditContextMiddleware`

**Authorization**: Conversation belongs to authenticated user.

**Response** (`200`):
```typescript
{
  success: true;
}
```

**Side effects**:
1. Sets conversation status to 'ended', endReason to 'explicit_clear'
2. Discards any pending request in the conversation
3. Logs `ai.conversation_ended` audit event

---

### GET /api/v1/ai/requests/:requestId

Get a specific AI request detail (for reload/refresh scenarios).

**Middleware**: `requireAuth`

**Authorization**: Request belongs to authenticated user.

**Response** (`200`):
```typescript
{
  request: {
    id: string;
    conversationId: string;
    requestType: 'generation' | 'transformation';
    prompt: string;
    selectedText: string | null;
    generatedContent: string | null;
    status: string;
    providerId: string | null;
    modelId: string | null;
    tokensUsed: number | null;
    createdAt: string;
  };
}
```

---

## Phase 2 Endpoints

### GET /api/v1/ai/config

Get AI configuration (admin only).

**Middleware**: `requireAuth`, `requirePermission('administrator')`

**Response** (`200`):
```typescript
{
  config: {
    global: { enabled: boolean; maxTokens: number; rateLimit: number; maxTurns: number };
    roles: Record<string, { enabled: boolean }>;
    providers: Array<{ id: string; displayName: string; enabled: boolean }>;
    contentTypes: Record<string, { aiEnabled: boolean }>;
  };
}
```

### PUT /api/v1/ai/config

Update AI configuration (admin only).

**Middleware**: `requireAuth`, `requirePermission('administrator')`, `auditContextMiddleware`

**Request Body**: Partial config object (merge semantics).

**Side effects**: Logs `ai.config_changed` audit event.

### GET /api/v1/ai/audit

Query AI-specific audit events with filtering.

**Middleware**: `requireAuth`, `requirePermission('administrator')`

**Query params**: `userId`, `providerId`, `action`, `dateFrom`, `dateTo`, `page`, `limit`

**Response**: Paginated list of AI audit events.
