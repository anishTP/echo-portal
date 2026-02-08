# Data Model: AI-Assisted Authoring and Controls

**Feature**: 007-ai-assisted-authoring | **Date**: 2026-02-08

## New Tables

### ai_conversations

Tracks multi-turn conversation sessions, scoped to a user + branch + session.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Conversation identifier |
| `userId` | uuid | NOT NULL, FK → users | Requesting author |
| `branchId` | uuid | NOT NULL, FK → branches | Branch context |
| `sessionId` | text | NOT NULL | Auth session identifier |
| `status` | text | NOT NULL, default 'active' | 'active' \| 'ended' |
| `turnCount` | integer | NOT NULL, default 0 | Number of completed turns |
| `maxTurns` | integer | NOT NULL, default 20 | Turn limit for this conversation |
| `endReason` | text | NULL | 'session_end' \| 'branch_switch' \| 'explicit_clear' \| 'turn_limit' |
| `createdAt` | timestamp with tz | NOT NULL, default now() | Creation time |
| `updatedAt` | timestamp with tz | NOT NULL, default now() | Last activity |
| `expiresAt` | timestamp with tz | NOT NULL | Session-bound TTL |

**Indexes**:
- `ai_conv_user_branch_idx` (userId, branchId) — find active conversation
- `ai_conv_session_idx` (sessionId) — cleanup on session end
- `ai_conv_expires_idx` (expiresAt) — TTL cleanup

**Unique constraint**: One active conversation per user per branch:
- `ai_conv_active_unique` UNIQUE (userId, branchId) WHERE status = 'active'

### ai_requests

Tracks individual AI generation/transform requests within a conversation. Ephemeral — cleaned up on session end.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Request identifier |
| `conversationId` | uuid | NOT NULL, FK → ai_conversations | Parent conversation |
| `userId` | uuid | NOT NULL, FK → users | Requesting author |
| `branchId` | uuid | NOT NULL, FK → branches | Branch context |
| `contentId` | uuid | NULL, FK → contents | Target content (for transforms) |
| `requestType` | text | NOT NULL | 'generation' \| 'transformation' |
| `prompt` | text | NOT NULL | User's instruction/prompt |
| `selectedText` | text | NULL | Original selected text (transforms only) |
| `contextSnapshot` | text | NULL | Document content at time of request |
| `generatedContent` | text | NULL | AI-generated output |
| `status` | text | NOT NULL, default 'pending' | 'generating' \| 'pending' \| 'accepted' \| 'rejected' \| 'discarded' \| 'cancelled' |
| `providerId` | text | NULL | AI provider identifier |
| `modelId` | text | NULL | AI model identifier |
| `tokensUsed` | integer | NULL | Token count for generation |
| `errorMessage` | text | NULL | Error details if generation failed |
| `resolvedAt` | timestamp with tz | NULL | When accepted/rejected/discarded |
| `resolvedBy` | text | NULL | 'user' \| 'system' (who resolved) |
| `createdAt` | timestamp with tz | NOT NULL, default now() | Request time |
| `expiresAt` | timestamp with tz | NOT NULL | Session-bound TTL |

**Indexes**:
- `ai_req_conversation_idx` (conversationId) — list requests in conversation
- `ai_req_user_branch_status_idx` (userId, branchId, status) — find pending request
- `ai_req_expires_idx` (expiresAt) — TTL cleanup
- `ai_req_rate_limit_idx` (userId, createdAt) — rate limit counting

**Constraint**: One pending/generating request per user per branch:
- Check constraint or application-level enforcement

### ai_configurations (Phase 2)

System-wide and per-role AI configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Config entry identifier |
| `scope` | text | NOT NULL, default 'global' | 'global' \| 'role:{roleName}' |
| `key` | text | NOT NULL | Config key (e.g., 'enabled', 'max_tokens', 'rate_limit') |
| `value` | jsonb | NOT NULL | Config value |
| `updatedBy` | uuid | NOT NULL, FK → users | Last modifier |
| `updatedAt` | timestamp with tz | NOT NULL, default now() | Last modification |
| `createdAt` | timestamp with tz | NOT NULL, default now() | Creation time |

**Indexes**:
- `ai_config_scope_key_idx` UNIQUE (scope, key) — one value per scope+key

## Existing Table Modifications

### contentVersions — No Schema Changes

The existing `authorType` column (enum: 'user' | 'system') and `authorId` column are sufficient for AI attribution. When AI content is accepted:
- `authorType` = 'system'
- `authorId` = AI system UUID (a reserved system user)
- Human approver tracked in audit log's `initiatingUserId`

### auditLogs — No Schema Changes

The existing columns handle all AI audit events:
- `actorType` = 'system' for AI-initiated events
- `initiatingUserId` = requesting human author
- `metadata` (jsonb) stores AI-specific data:
  ```json
  {
    "requestId": "uuid",
    "conversationId": "uuid",
    "providerId": "anthropic",
    "modelId": "claude-sonnet-4-5-20250929",
    "requestType": "generation|transformation",
    "tokensUsed": 1234,
    "promptHash": "sha256:..."
  }
  ```

New audit action types (added to application code, not schema):
- `ai.requested`, `ai.generated`, `ai.accepted`, `ai.rejected`, `ai.discarded`, `ai.cancelled`
- `ai.conversation_started`, `ai.conversation_ended`
- `ai.config_changed` (Phase 2)

## Entity Relationships

```
users ──1:N── ai_conversations ──1:N── ai_requests
                    │                        │
                    └── branches ─────────────┘
                                             │
                                     contents (optional, for transforms)

On accept:
  ai_requests.status = 'accepted'
  → versionService.createVersion(contentId, { body, authorType: 'system' })
  → auditLogger.log({ action: 'ai.accepted', initiatingUserId: userId })
```

## Validation Rules

| Entity | Rule | Source |
|--------|------|--------|
| ai_conversations | Max 1 active per user per branch | FR-017, unique constraint |
| ai_conversations | Max 20 turns | FR-020 |
| ai_requests | Max 1 pending/generating per user per branch | FR-017 |
| ai_requests | Max ~4,000 tokens output | FR-020 |
| ai_requests | 50 requests/user/hour | FR-021 |
| ai_requests | Branch must be in 'draft' state | FR-001, FR-009 |
| ai_requests | User must have edit permission on branch | FR-008 |
| ai_requests | Prompt must be non-empty | Input validation |
| ai_requests | selectedText required for transformations | Input validation |

## State Machine: AI Request Lifecycle

```
                    ┌─── cancelled (user cancels mid-stream)
                    │
[new] → generating ─┤─── pending (generation complete, awaiting user action)
                    │       │
                    │       ├── accepted (user approves → creates content version)
                    │       ├── rejected (user declines)
                    │       └── discarded (system: session end, branch switch)
                    │
                    └─── error (provider failure → can retry)
```

Valid transitions:
- `generating` → `pending` (generation complete)
- `generating` → `cancelled` (user abort)
- `generating` → `error` (provider failure)
- `pending` → `accepted` (user action)
- `pending` → `rejected` (user action)
- `pending` → `discarded` (system action)
- `error` → `generating` (retry)

**Note**: The `error` state is transient — the request can be retried (→ `generating`).
`Reverted` is NOT a request-level status. It is a version-level operation where a
previously accepted AI version is undone via `versionService.revertVersion()`.
See spec.md Lifecycle States for the full two-level model.
