-- Migration 0008: Add AI context documents table
-- Stores admin-managed reference materials (brand guidelines, tone docs, etc.)
-- injected into AI system prompts when enabled.

CREATE TABLE IF NOT EXISTS ai_context_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching enabled docs in order (used on every AI request)
CREATE INDEX idx_ai_context_docs_enabled_sort ON ai_context_documents (enabled, sort_order)
  WHERE enabled = true;
