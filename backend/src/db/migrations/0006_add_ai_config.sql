-- Migration: 0006_add_ai_config
-- Feature: 007-ai-assisted-authoring (Phase 2)
-- Creates ai_configurations table for admin AI constraint management

CREATE TABLE IF NOT EXISTS ai_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global',
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_config_scope_key_idx ON ai_configurations(scope, key);

-- Seed default global configuration
INSERT INTO ai_configurations (scope, key, value, updated_by)
SELECT 'global', 'enabled', 'true'::jsonb, id FROM users LIMIT 1
ON CONFLICT (scope, key) DO NOTHING;
