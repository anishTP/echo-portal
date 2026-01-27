import { z } from 'zod';
import {
  uuidSchema,
  paginationSchema,
  nameSchema,
  descriptionSchema,
  labelsSchema,
  visibilitySchema,
  branchStateSchema,
  baseRefSchema,
} from './common.js';

/**
 * Schema for creating a new branch
 */
export const createBranchBodySchema = z.object({
  name: nameSchema,
  baseRef: baseRefSchema.default('main'),
  description: descriptionSchema,
  visibility: visibilitySchema.default('private'),
  labels: labelsSchema,
});

export type CreateBranchBody = z.infer<typeof createBranchBodySchema>;

/**
 * Schema for updating a branch
 */
export const updateBranchBodySchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(10000).optional().nullable(),
  visibility: visibilitySchema.optional(),
  reviewers: z.array(uuidSchema).optional(),
  labels: labelsSchema.optional(),
});

export type UpdateBranchBody = z.infer<typeof updateBranchBodySchema>;

/**
 * Schema for branch ID parameter
 */
export const branchIdParamSchema = z.object({
  id: uuidSchema,
});

export type BranchIdParam = z.infer<typeof branchIdParamSchema>;

/**
 * Schema for listing branches with filters
 */
export const listBranchesQuerySchema = paginationSchema.extend({
  ownerId: uuidSchema.optional(),
  state: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : undefined)),
  visibility: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : undefined)),
  search: z.string().max(200).optional(),
});

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;

/**
 * Schema for adding reviewers to a branch
 */
export const addReviewersBodySchema = z.object({
  reviewerIds: z.array(uuidSchema).min(1, 'At least one reviewer is required'),
});

export type AddReviewersBody = z.infer<typeof addReviewersBodySchema>;

/**
 * Schema for removing a reviewer
 */
export const removeReviewerParamsSchema = z.object({
  id: uuidSchema,
  reviewerId: uuidSchema,
});

export type RemoveReviewerParams = z.infer<typeof removeReviewerParamsSchema>;

/**
 * Schema for adding collaborators to a branch
 */
export const addCollaboratorsBodySchema = z.object({
  collaboratorIds: z.array(uuidSchema).min(1, 'At least one collaborator is required'),
});

export type AddCollaboratorsBody = z.infer<typeof addCollaboratorsBodySchema>;

/**
 * Schema for removing a collaborator
 */
export const removeCollaboratorParamsSchema = z.object({
  id: uuidSchema,
  collaboratorId: uuidSchema,
});

export type RemoveCollaboratorParams = z.infer<typeof removeCollaboratorParamsSchema>;

/**
 * Schema for submit-for-review action
 */
export const submitForReviewBodySchema = z.object({
  reviewerIds: z.array(uuidSchema).min(1, 'At least one reviewer is required'),
  reason: z.string().max(500).optional(),
});

export type SubmitForReviewBody = z.infer<typeof submitForReviewBodySchema>;

/**
 * Schema for branch response
 */
export const branchResponseSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  gitRef: z.string(),
  baseRef: z.string(),
  baseCommit: z.string(),
  headCommit: z.string(),
  state: branchStateSchema,
  visibility: visibilitySchema,
  ownerId: uuidSchema,
  reviewers: z.array(uuidSchema),
  description: z.string().nullable(),
  labels: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  submittedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  permissions: z.object({
    canEdit: z.boolean(),
    canSubmitForReview: z.boolean(),
    canApprove: z.boolean(),
    canPublish: z.boolean(),
    canArchive: z.boolean(),
    validTransitions: z.array(branchStateSchema),
  }),
});

export type BranchResponse = z.infer<typeof branchResponseSchema>;

/**
 * Validate state filter values
 */
export function validateStateFilter(
  states: string[] | undefined
): ('draft' | 'review' | 'approved' | 'published' | 'archived')[] | undefined {
  if (!states) return undefined;
  const validStates: ('draft' | 'review' | 'approved' | 'published' | 'archived')[] = [
    'draft',
    'review',
    'approved',
    'published',
    'archived',
  ];
  return states.filter((s): s is 'draft' | 'review' | 'approved' | 'published' | 'archived' =>
    validStates.includes(s as any)
  );
}

/**
 * Validate visibility filter values
 */
export function validateVisibilityFilter(
  visibility: string[] | undefined
): ('private' | 'team' | 'public')[] | undefined {
  if (!visibility) return undefined;
  const validVisibility: ('private' | 'team' | 'public')[] = ['private', 'team', 'public'];
  return visibility.filter((v): v is 'private' | 'team' | 'public' =>
    validVisibility.includes(v as any)
  );
}
