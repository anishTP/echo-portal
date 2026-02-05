/**
 * Comparison types for in-context review workflow (006-review-approval)
 *
 * These types define the structure for branch comparisons, file diffs,
 * and diff hunks used in the review interface.
 */

// ============================================
// BRANCH COMPARISON TYPES
// ============================================

export interface BranchComparison {
  branchId: string;
  baseCommit: string;                  // Git commit hash (40 chars)
  headCommit: string;                  // Git commit hash (40 chars)
  baseRef: string;                     // Human-readable base reference
  headRef: string;                     // Human-readable head reference
  files: FileDiff[];
  stats: DiffStats;
  baseState: 'current' | 'diverged';   // Whether base has moved since branch creation
  divergedCommit?: string;             // If diverged, the commit main moved to
}

// ============================================
// FILE DIFF TYPES
// ============================================

export interface FileDiff {
  path: string;
  contentId?: string;                  // Content UUID for DB-backed comparisons
  status: FileStatus;
  oldPath?: string;                    // Original path for renamed files
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  fullContent?: FullContentData;       // Full content for article-level diff views
}

/**
 * Full content data for article-level diff display.
 * Includes raw body content and structured metadata separately.
 */
export interface FullContentData {
  oldContent: string | null;           // null for added files
  newContent: string | null;           // null for deleted files
  metadata: {
    old: ContentMetadataSnapshot | null;
    new: ContentMetadataSnapshot | null;
  };
}

export interface ContentMetadataSnapshot {
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
}

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

// ============================================
// DIFF HUNK TYPES
// ============================================

export interface DiffHunk {
  id: string;                          // Unique hunk identifier for comment anchoring
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

// ============================================
// DIFF LINE TYPES
// ============================================

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;              // null for additions
  newLineNumber?: number;              // null for deletions
}

export type DiffLineType = 'context' | 'addition' | 'deletion';

// ============================================
// DIFF STATS TYPES
// ============================================

export interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

// ============================================
// COMPARISON REQUEST/RESPONSE TYPES
// ============================================

export interface ComparisonRequest {
  branchId: string;
  snapshotId?: string;                 // Optional: compare against specific snapshot
}

export interface FileDiffRequest {
  branchId: string;
  filePath: string;
  snapshotId?: string;
}

// ============================================
// CONTENT COMPARISON TYPES (DB-backed)
// ============================================

export interface ContentComparisonStats {
  branchId: string;
  items: ContentComparisonStatsItem[];
  totals: DiffStats;
}

export interface ContentComparisonStatsItem {
  contentId: string;
  title: string;
  status: 'added' | 'modified';
  additions: number;
  deletions: number;
}
