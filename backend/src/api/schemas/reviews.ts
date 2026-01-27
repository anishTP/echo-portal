import { z } from 'zod';
import {
  uuidSchema,
  paginationSchema,
  reviewStatusSchema,
  reviewDecisionSchema,
} from './common.js';

/**
 * Schema for creating a new review request
 */
export const createReviewBodySchema = z.object({
  branchId: uuidSchema,
  reviewerId: uuidSchema,
});

export type CreateReviewBody = z.infer<typeof createReviewBodySchema>;

/**
 * Schema for submitting a review decision
 */
export const submitReviewDecisionBodySchema = z.object({
  decision: reviewDecisionSchema,
  reason: z.string().max(10000).optional(),
});

export type SubmitReviewDecisionBody = z.infer<typeof submitReviewDecisionBodySchema>;

/**
 * Schema for adding a review comment
 */
export const addReviewCommentBodySchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(10000),
  path: z.string().max(500).optional(),
  line: z.coerce.number().int().positive().optional(),
});

export type AddReviewCommentBody = z.infer<typeof addReviewCommentBodySchema>;

/**
 * Schema for updating a review comment
 */
export const updateReviewCommentBodySchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(10000),
});

export type UpdateReviewCommentBody = z.infer<typeof updateReviewCommentBodySchema>;

/**
 * Schema for review ID parameter
 */
export const reviewIdParamSchema = z.object({
  id: uuidSchema,
});

export type ReviewIdParam = z.infer<typeof reviewIdParamSchema>;

/**
 * Schema for review comment ID parameter
 */
export const reviewCommentIdParamSchema = z.object({
  id: uuidSchema,
  commentId: uuidSchema,
});

export type ReviewCommentIdParam = z.infer<typeof reviewCommentIdParamSchema>;

/**
 * Schema for listing reviews with filters
 */
export const listReviewsQuerySchema = paginationSchema.extend({
  branchId: uuidSchema.optional(),
  reviewerId: uuidSchema.optional(),
  requestedById: uuidSchema.optional(),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : undefined)),
});

export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

/**
 * Schema for review comment response
 */
export const reviewCommentResponseSchema = z.object({
  id: uuidSchema,
  authorId: uuidSchema,
  content: z.string(),
  path: z.string().nullable().optional(),
  line: z.number().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ReviewCommentResponse = z.infer<typeof reviewCommentResponseSchema>;

/**
 * Schema for review response
 */
export const reviewResponseSchema = z.object({
  id: uuidSchema,
  branchId: uuidSchema,
  reviewerId: uuidSchema,
  requestedById: uuidSchema,
  status: reviewStatusSchema,
  decision: reviewDecisionSchema.nullable(),
  comments: z.array(reviewCommentResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  permissions: z.object({
    canAddComment: z.boolean(),
    canComplete: z.boolean(),
    canCancel: z.boolean(),
  }),
});

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

/**
 * Validate review status filter values
 */
export function validateReviewStatusFilter(
  statuses: string[] | undefined
): string[] | undefined {
  if (!statuses) return undefined;
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  return statuses.filter((s) => validStatuses.includes(s));
}

/**
 * Schema for branch transition request
 */
export const transitionBranchBodySchema = z.object({
  event: z.enum([
    'SUBMIT_FOR_REVIEW',
    'REQUEST_CHANGES',
    'APPROVE',
    'PUBLISH',
    'ARCHIVE',
  ]),
  reason: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TransitionBranchBody = z.infer<typeof transitionBranchBodySchema>;

/**
 * Schema for transition response
 */
export const transitionResponseSchema = z.object({
  success: z.boolean(),
  fromState: z.string(),
  toState: z.string().optional(),
  transitionId: uuidSchema.optional(),
  error: z.string().optional(),
});

export type TransitionResponse = z.infer<typeof transitionResponseSchema>;
