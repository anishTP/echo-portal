import { z } from 'zod';
import { uuidSchema, convergenceStatusSchema } from './common.js';

/**
 * Schema for initiating a convergence operation
 */
export const createConvergenceBodySchema = z.object({
  branchId: uuidSchema,
});

export type CreateConvergenceBody = z.infer<typeof createConvergenceBodySchema>;

/**
 * Schema for validating a branch for convergence
 */
export const validateConvergenceBodySchema = z.object({
  branchId: uuidSchema,
});

export type ValidateConvergenceBody = z.infer<typeof validateConvergenceBodySchema>;

/**
 * Schema for convergence ID parameter
 */
export const convergenceIdParamSchema = z.object({
  id: uuidSchema,
});

export type ConvergenceIdParam = z.infer<typeof convergenceIdParamSchema>;

/**
 * Schema for validation result
 */
export const validationResultSchema = z.object({
  check: z.string(),
  passed: z.boolean(),
  message: z.string().optional(),
});

export type ValidationResultSchema = z.infer<typeof validationResultSchema>;

/**
 * Schema for conflict detail
 */
export const conflictDetailSchema = z.object({
  path: z.string(),
  type: z.enum(['content', 'rename', 'delete']),
  description: z.string(),
});

export type ConflictDetailSchema = z.infer<typeof conflictDetailSchema>;

/**
 * Schema for convergence response
 */
export const convergenceResponseSchema = z.object({
  id: uuidSchema,
  branchId: uuidSchema,
  publisherId: uuidSchema,
  status: convergenceStatusSchema,
  validationResults: z.array(validationResultSchema),
  conflictDetected: z.boolean(),
  conflictDetails: z.array(conflictDetailSchema).nullable(),
  mergeCommit: z.string().nullable(),
  targetRef: z.string(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  permissions: z.object({
    canStart: z.boolean(),
    canRetry: z.boolean(),
  }),
  summary: z.object({
    isInProgress: z.boolean(),
    isComplete: z.boolean(),
    isSucceeded: z.boolean(),
    allValidationsPassed: z.boolean(),
    failedValidationCount: z.number(),
  }),
});

export type ConvergenceResponse = z.infer<typeof convergenceResponseSchema>;

/**
 * Schema for validation check response
 */
export const validationCheckResponseSchema = z.object({
  isValid: z.boolean(),
  results: z.array(validationResultSchema),
  conflicts: z.array(conflictDetailSchema),
});

export type ValidationCheckResponse = z.infer<typeof validationCheckResponseSchema>;
