import type { BranchStateType, VisibilityType, ActorTypeValue } from '../constants/states.js';

export interface Branch {
  id: string;
  name: string;
  slug: string;
  gitRef: string;
  baseRef: string;
  baseCommit: string;
  headCommit: string;
  state: BranchStateType;
  visibility: VisibilityType;
  ownerId: string;
  reviewers: string[];
  description?: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  requiredApprovals?: number;
  approvedAt?: string;
  publishedAt?: string;
  archivedAt?: string;
}

export interface BranchCreateInput {
  name: string;
  baseRef: 'main' | 'dev';
  description?: string;
  visibility?: VisibilityType;
  labels?: string[];
}

export interface BranchUpdateInput {
  name?: string;
  description?: string;
  visibility?: VisibilityType;
  reviewers?: string[];
  labels?: string[];
}

export interface BranchStateTransition {
  id: string;
  branchId: string;
  fromState: BranchStateType;
  toState: BranchStateType;
  actorId: string;
  actorType: ActorTypeValue;
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
