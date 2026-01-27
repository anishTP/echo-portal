import { api } from './api';
import type { ConvergenceStatusType } from '@echo-portal/shared';

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

export interface ConvergenceResponse {
  id: string;
  branchId: string;
  publisherId: string;
  status: ConvergenceStatusType;
  validationResults: ValidationResult[];
  conflictDetected: boolean;
  conflictDetails: ConflictDetail[] | null;
  mergeCommit: string | null;
  targetRef: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  permissions: {
    canStart: boolean;
    canRetry: boolean;
  };
  summary: {
    isInProgress: boolean;
    isComplete: boolean;
    isSucceeded: boolean;
    allValidationsPassed: boolean;
    failedValidationCount: number;
  };
}

export interface ValidationCheckResponse {
  isValid: boolean;
  results: ValidationResult[];
  conflicts: ConflictDetail[];
}

export interface ConvergenceStatusResponse {
  id: string;
  status: ConvergenceStatusType;
  isInProgress: boolean;
  isComplete: boolean;
  isSucceeded: boolean;
  conflictDetected: boolean;
  mergeCommit: string | null;
}

export const convergenceService = {
  /**
   * Initiate a convergence operation
   */
  create: (branchId: string): Promise<ConvergenceResponse> => {
    return api.post<ConvergenceResponse>('/convergence', { branchId });
  },

  /**
   * Get a convergence operation by ID
   */
  getById: (id: string): Promise<ConvergenceResponse> => {
    return api.get<ConvergenceResponse>(`/convergence/${id}`);
  },

  /**
   * Get the status of a convergence operation
   */
  getStatus: (id: string): Promise<ConvergenceStatusResponse> => {
    return api.get<ConvergenceStatusResponse>(`/convergence/${id}/status`);
  },

  /**
   * Validate a branch for convergence (pre-check)
   */
  validate: (branchId: string): Promise<ValidationCheckResponse> => {
    return api.post<ValidationCheckResponse>('/convergence/validate', { branchId });
  },

  /**
   * Execute a pending convergence operation
   */
  execute: (id: string): Promise<ConvergenceResponse> => {
    return api.post<ConvergenceResponse>(`/convergence/${id}/execute`);
  },

  /**
   * Cancel a pending convergence operation
   */
  cancel: (id: string): Promise<ConvergenceResponse> => {
    return api.post<ConvergenceResponse>(`/convergence/${id}/cancel`);
  },

  /**
   * Get convergence operations for a branch
   */
  getByBranch: (branchId: string): Promise<ConvergenceResponse[]> => {
    return api.get<ConvergenceResponse[]>(`/convergence/branch/${branchId}`);
  },

  /**
   * Get the latest convergence operation for a branch
   */
  getLatest: (branchId: string): Promise<ConvergenceResponse> => {
    return api.get<ConvergenceResponse>(`/convergence/branch/${branchId}/latest`);
  },

  /**
   * Initiate and execute convergence in one step
   */
  publish: async (branchId: string): Promise<ConvergenceResponse> => {
    // Create the convergence operation
    const operation = await convergenceService.create(branchId);

    // Execute it
    return convergenceService.execute(operation.id);
  },
};

export default convergenceService;
