import type { ConvergenceStatusType } from '../constants/states.js';

export interface ValidationResult {
  check: string;
  passed: boolean;
  message?: string;
}

export interface ConflictDetail {
  path: string;
  type: 'content' | 'rename' | 'delete';
  description: string;
}

export interface Convergence {
  id: string;
  branchId: string;
  publisherId: string;
  status: ConvergenceStatusType;
  validationResults: ValidationResult[];
  conflictDetected: boolean;
  conflictDetails?: ConflictDetail[];
  mergeCommit?: string;
  targetRef: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ConvergenceCreateInput {
  branchId: string;
}
