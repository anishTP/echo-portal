import { z } from 'zod';
import type {
  ConvergenceOperation,
  NewConvergenceOperation,
} from '../db/schema/convergence.js';
import {
  ConvergenceStatus,
  type ConvergenceStatusType,
} from '@echo-portal/shared';
import type { ValidationResult, ConflictDetail } from '@echo-portal/shared';

/**
 * Validation schema for initiating a convergence operation
 */
export const createConvergenceSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
});

export type CreateConvergenceInput = z.infer<typeof createConvergenceSchema>;

/**
 * Validation schema for pre-convergence validation request
 */
export const validateConvergenceSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
});

export type ValidateConvergenceInput = z.infer<typeof validateConvergenceSchema>;

/**
 * Check if convergence can be started
 */
export function canStart(convergence: ConvergenceOperation): boolean {
  return convergence.status === ConvergenceStatus.PENDING;
}

/**
 * Check if convergence is in progress
 */
export function isInProgress(convergence: ConvergenceOperation): boolean {
  return (
    convergence.status === ConvergenceStatus.VALIDATING ||
    convergence.status === ConvergenceStatus.MERGING
  );
}

/**
 * Check if convergence is complete (success or failure)
 */
export function isComplete(convergence: ConvergenceOperation): boolean {
  return (
    convergence.status === ConvergenceStatus.SUCCEEDED ||
    convergence.status === ConvergenceStatus.FAILED ||
    convergence.status === ConvergenceStatus.ROLLED_BACK
  );
}

/**
 * Check if convergence succeeded
 */
export function isSucceeded(convergence: ConvergenceOperation): boolean {
  return convergence.status === ConvergenceStatus.SUCCEEDED;
}

/**
 * Check if convergence can be retried
 */
export function canRetry(convergence: ConvergenceOperation): boolean {
  return (
    convergence.status === ConvergenceStatus.FAILED ||
    convergence.status === ConvergenceStatus.ROLLED_BACK
  );
}

/**
 * Convergence model class for business logic
 */
export class ConvergenceModel {
  private data: ConvergenceOperation;

  constructor(data: ConvergenceOperation) {
    this.data = data;
  }

  get id(): string {
    return this.data.id;
  }

  get branchId(): string {
    return this.data.branchId;
  }

  get publisherId(): string {
    return this.data.publisherId;
  }

  get status(): ConvergenceStatusType {
    return this.data.status as ConvergenceStatusType;
  }

  get validationResults(): ValidationResult[] {
    return (this.data.validationResults as ValidationResult[]) || [];
  }

  get conflictDetected(): boolean {
    return this.data.conflictDetected;
  }

  get conflictDetails(): ConflictDetail[] | undefined {
    return this.data.conflictDetails as ConflictDetail[] | undefined;
  }

  get mergeCommit(): string | null {
    return this.data.mergeCommit;
  }

  get targetRef(): string {
    return this.data.targetRef;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  get startedAt(): Date | null {
    return this.data.startedAt;
  }

  get completedAt(): Date | null {
    return this.data.completedAt;
  }

  /**
   * Check if convergence can be started
   */
  canStart(): boolean {
    return canStart(this.data);
  }

  /**
   * Check if convergence is in progress
   */
  isInProgress(): boolean {
    return isInProgress(this.data);
  }

  /**
   * Check if convergence is complete
   */
  isComplete(): boolean {
    return isComplete(this.data);
  }

  /**
   * Check if convergence succeeded
   */
  isSucceeded(): boolean {
    return isSucceeded(this.data);
  }

  /**
   * Check if convergence can be retried
   */
  canRetry(): boolean {
    return canRetry(this.data);
  }

  /**
   * Check if all validations passed
   */
  allValidationsPassed(): boolean {
    return this.validationResults.every((r) => r.passed);
  }

  /**
   * Get failed validations
   */
  getFailedValidations(): ValidationResult[] {
    return this.validationResults.filter((r) => !r.passed);
  }

  /**
   * Get the raw data
   */
  toJSON(): ConvergenceOperation {
    return { ...this.data };
  }

  /**
   * Get a serializable representation for API responses
   */
  toResponse(): Record<string, unknown> {
    return {
      id: this.id,
      branchId: this.branchId,
      publisherId: this.publisherId,
      status: this.status,
      validationResults: this.validationResults,
      conflictDetected: this.conflictDetected,
      conflictDetails: this.conflictDetails,
      mergeCommit: this.mergeCommit,
      targetRef: this.targetRef,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString() ?? null,
      completedAt: this.completedAt?.toISOString() ?? null,
      permissions: {
        canStart: this.canStart(),
        canRetry: this.canRetry(),
      },
      summary: {
        isInProgress: this.isInProgress(),
        isComplete: this.isComplete(),
        isSucceeded: this.isSucceeded(),
        allValidationsPassed: this.allValidationsPassed(),
        failedValidationCount: this.getFailedValidations().length,
      },
    };
  }
}

/**
 * Create a ConvergenceModel from raw data
 */
export function createConvergenceModel(data: ConvergenceOperation): ConvergenceModel {
  return new ConvergenceModel(data);
}
