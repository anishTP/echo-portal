-- Migration: Add review_cycle column to reviews table
-- Feature: 006-review-approval
-- Date: 2026-02-03

-- Add review_cycle column to track which submission cycle a review belongs to
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_cycle INTEGER NOT NULL DEFAULT 1;

-- Create index for efficient branch + cycle queries
CREATE INDEX IF NOT EXISTS idx_reviews_branch_cycle ON reviews(branch_id, review_cycle);

-- Add comment for documentation
COMMENT ON COLUMN reviews.review_cycle IS 'Tracks which submission cycle this review belongs to (increments when branch returns to draft and is resubmitted)';
