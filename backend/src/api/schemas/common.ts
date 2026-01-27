import { z } from 'zod';

// Common UUID validation
export const uuidSchema = z.string().uuid();

// Pagination query params
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Common ID param
export const idParamSchema = z.object({
  id: uuidSchema,
});

// Timestamps in responses
export const timestampSchema = z.string().datetime();

// Slug validation (URL-safe identifier)
export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

// Name validation
export const nameSchema = z.string().min(1).max(200);

// Description validation
export const descriptionSchema = z.string().max(10000).optional();

// Labels validation
export const labelsSchema = z.array(z.string().max(50)).max(20).default([]);

// Visibility enum
export const visibilitySchema = z.enum(['private', 'team', 'public']);

// Branch state enum
export const branchStateSchema = z.enum(['draft', 'review', 'approved', 'published', 'archived']);

// Role enum
export const roleSchema = z.enum(['contributor', 'reviewer', 'publisher', 'administrator']);

// Base ref enum (where to branch from)
export const baseRefSchema = z.enum(['main', 'dev']);

// Review status enum
export const reviewStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);

// Review decision enum
export const reviewDecisionSchema = z.enum(['approved', 'changes_requested']);

// Convergence status enum
export const convergenceStatusSchema = z.enum([
  'pending',
  'validating',
  'merging',
  'succeeded',
  'failed',
  'rolled_back',
]);

// Error response schema
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  requestId: z.string().optional(),
});

// Success response wrapper
export function successResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: z
      .object({
        page: z.number().optional(),
        limit: z.number().optional(),
        total: z.number().optional(),
        hasMore: z.boolean().optional(),
      })
      .optional(),
    requestId: z.string().optional(),
  });
}

// Paginated response wrapper
export function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      hasMore: z.boolean(),
    }),
    requestId: z.string().optional(),
  });
}
