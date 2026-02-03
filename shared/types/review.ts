import type { ReviewStatusType, ReviewDecisionType } from '../constants/states.js';
import type { DiffStats } from './comparison.js';
import type { UserSummary } from './content.js';

// Re-export imported types for convenience
export type { DiffStats, UserSummary };

// ============================================
// REVIEW COMMENT TYPES (Enhanced for 006-review-approval)
// ============================================

export interface ReviewComment {
  id: string;
  authorId: string;
  content: string;
  // Anchoring (all optional for general comments)
  path?: string;                       // File path
  line?: number;                       // Line number in diff
  hunkId?: string;                     // Diff hunk identifier for stable anchoring
  side?: 'old' | 'new';               // Which side of diff (deletion vs addition)
  // Threading
  parentId?: string;                   // Parent comment ID (null = top-level)
  // Staleness tracking
  isOutdated: boolean;                 // Default: false
  outdatedReason?: string;             // Why marked outdated
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  branchId: string;
  reviewerId: string;
  requestedById: string;
  status: ReviewStatusType;
  decision?: ReviewDecisionType;
  reviewCycle: number;                 // Which submission cycle (1, 2, 3...)
  snapshotId?: string;                 // FK to review_snapshots
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ReviewCreateInput {
  branchId: string;
  reviewerId: string;
}

export interface ReviewCommentInput {
  content: string;
  path?: string;
  line?: number;
  hunkId?: string;
  side?: 'old' | 'new';
}

// ============================================
// REVIEW SNAPSHOT TYPES (NEW for 006-review-approval)
// ============================================

export interface ReviewSnapshot {
  id: string;
  reviewId: string;
  branchId: string;
  baseCommit: string;
  headCommit: string;
  snapshotData: SnapshotData;
  createdAt: string;
}

export interface SnapshotData {
  files: FileSummary[];
  stats: DiffStats;
  baseRef: string;
  headRef: string;
}

export interface FileSummary {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  additions: number;
  deletions: number;
}

// DiffStats imported from comparison.ts

// ============================================
// REVIEW CYCLE TYPES (NEW for 006-review-approval)
// ============================================

export type CycleOutcome = 'pending' | 'approved' | 'changes_requested' | 'withdrawn';

export interface ReviewCycleSummary {
  cycleNumber: number;
  submittedAt: string;
  outcome: CycleOutcome;
  approvalCount: number;
  requiredApprovals: number;
  reviewerCount: number;
}

// ============================================
// REVIEW SUB-STATE TYPES (NEW for 006-review-approval)
// ============================================

export type ReviewSubState =
  | 'pending_review'
  | 'in_discussion'
  | 'changes_requested'
  | 'approved';

export interface ReviewStatusResponse {
  branchId: string;
  branchState: string;
  reviewSubState: ReviewSubState | null;
  approvalProgress: ApprovalProgress;
  hasBlockingChangesRequested: boolean;
  pendingReviewers?: UserSummary[];
  completedReviewers?: ReviewerDecision[];
}

export interface ApprovalProgress {
  approved: number;
  required: number;
  remaining: number;
}

// UserSummary imported from content.ts

export interface ReviewerDecision {
  reviewer: UserSummary;
  decision: ReviewDecisionType;
  decidedAt: string;
}
