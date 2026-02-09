-- Migration: 0007_add_request_mode
-- Feature: 007-ai-assisted-authoring
-- Adds response_mode column to ai_requests for slash command persistence

ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS response_mode TEXT;

-- Backfill: generation → 'add', transformation → 'replace'
UPDATE ai_requests SET response_mode = 'add' WHERE request_type = 'generation' AND response_mode IS NULL;
UPDATE ai_requests SET response_mode = 'replace' WHERE request_type = 'transformation' AND response_mode IS NULL;
