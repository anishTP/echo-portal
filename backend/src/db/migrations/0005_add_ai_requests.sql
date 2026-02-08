-- Migration: 0005_add_ai_requests
-- Feature: 007-ai-assisted-authoring
-- Creates ai_conversations and ai_requests tables for AI-assisted authoring

-- ai_conversations: multi-turn conversation sessions scoped to user + branch + session
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  turn_count INTEGER NOT NULL DEFAULT 0,
  max_turns INTEGER NOT NULL DEFAULT 20,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_conv_user_branch_idx ON ai_conversations(user_id, branch_id);
CREATE INDEX IF NOT EXISTS ai_conv_session_idx ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS ai_conv_expires_idx ON ai_conversations(expires_at);

-- Partial unique: one active conversation per user per branch (FR-017)
CREATE UNIQUE INDEX IF NOT EXISTS ai_conv_active_unique
  ON ai_conversations(user_id, branch_id)
  WHERE status = 'active';

-- ai_requests: individual AI generation/transformation requests (ephemeral, session-bound TTL)
CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  content_id UUID REFERENCES contents(id),
  request_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  selected_text TEXT,
  context_snapshot TEXT,
  generated_content TEXT,
  status TEXT NOT NULL DEFAULT 'generating',
  provider_id TEXT,
  model_id TEXT,
  tokens_used INTEGER,
  error_message TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_req_conversation_idx ON ai_requests(conversation_id);
CREATE INDEX IF NOT EXISTS ai_req_user_branch_status_idx ON ai_requests(user_id, branch_id, status);
CREATE INDEX IF NOT EXISTS ai_req_expires_idx ON ai_requests(expires_at);
CREATE INDEX IF NOT EXISTS ai_req_rate_limit_idx ON ai_requests(user_id, created_at);
