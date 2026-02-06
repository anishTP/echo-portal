-- Migration: Add review_snapshots table for in-context review workflow
-- Feature: 006-review-approval
-- Date: 2026-02-03

-- Create review_snapshots table to capture comparison state at review submission time
CREATE TABLE IF NOT EXISTS review_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  base_commit VARCHAR(40) NOT NULL,
  head_commit VARCHAR(40) NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_review_snapshots_review ON review_snapshots(review_id);
CREATE INDEX IF NOT EXISTS idx_review_snapshots_branch ON review_snapshots(branch_id);

-- Add comment for documentation
COMMENT ON TABLE review_snapshots IS 'Captures comparison state at review submission time for audit compliance (FR-003)';
COMMENT ON COLUMN review_snapshots.base_commit IS 'Git commit hash (40 chars) of the base reference at submission';
COMMENT ON COLUMN review_snapshots.head_commit IS 'Git commit hash (40 chars) of the branch head at submission';
COMMENT ON COLUMN review_snapshots.snapshot_data IS 'JSONB containing file summaries, stats, and reference names';
