import { z } from 'zod';
import { uuidSchema, paginationSchema } from './common.js';

// Content type enum
export const contentTypeSchema = z.enum(['guideline', 'asset', 'opinion']);

// Content section enum
export const contentSectionSchema = z.enum(['brand', 'product', 'experience']);

// Body format enum
export const bodyFormatSchema = z.enum(['markdown', 'structured', 'rich_text']);

// Max content body size: 50 MB
const MAX_BODY_BYTES = 52_428_800;

/**
 * Schema for creating new content
 */
export const createContentBodySchema = z.object({
  branchId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or less'),
  contentType: contentTypeSchema,
  section: contentSectionSchema.optional(),
  category: z.string().max(200).optional(), // Deprecated: use categoryId/subcategoryId
  categoryId: uuidSchema.optional(),
  subcategoryId: uuidSchema.optional().nullable(),
  tags: z.array(z.string().max(100)).max(20).default([]),
  description: z.string().max(5000).optional(),
  body: z.string().min(1, 'Body is required'),
  bodyFormat: bodyFormatSchema.default('markdown'),
  changeDescription: z
    .string()
    .min(1, 'Change description is required')
    .max(2000, 'Change description must be 2000 characters or less'),
});

export type CreateContentBody = z.infer<typeof createContentBodySchema>;

/**
 * Schema for updating content (creates new version)
 */
export const updateContentBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  section: contentSectionSchema.optional().nullable(),
  category: z.string().max(200).optional().nullable(), // Deprecated: use categoryId/subcategoryId
  categoryId: uuidSchema.optional().nullable(),
  subcategoryId: uuidSchema.optional().nullable(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  description: z.string().max(5000).optional().nullable(),
  body: z.string().min(1, 'Body is required'),
  bodyFormat: bodyFormatSchema.optional(),
  changeDescription: z.string().min(1).max(2000),
  currentVersionTimestamp: z.string().datetime().optional(),
});

export type UpdateContentBody = z.infer<typeof updateContentBodySchema>;

/**
 * Schema for reverting content to a previous version
 */
export const revertContentBodySchema = z.object({
  targetVersionId: z.string().uuid().optional(),
  targetVersionTimestamp: z.string().datetime().optional(),
  changeDescription: z.string().min(1).max(2000),
}).refine(
  (data) => data.targetVersionId || data.targetVersionTimestamp,
  { message: 'Either targetVersionId or targetVersionTimestamp is required' }
);

export type RevertContentBody = z.infer<typeof revertContentBodySchema>;

/**
 * Schema for content ID parameter
 */
export const contentIdParamSchema = z.object({
  contentId: uuidSchema,
});

export type ContentIdParam = z.infer<typeof contentIdParamSchema>;

/**
 * Schema for content slug parameter
 */
export const contentSlugParamSchema = z.object({
  slug: z.string().min(1).max(600),
});

export type ContentSlugParam = z.infer<typeof contentSlugParamSchema>;

/**
 * Schema for version ID parameter
 */
export const versionIdParamSchema = z.object({
  contentId: uuidSchema,
  versionId: uuidSchema,
});

export type VersionIdParam = z.infer<typeof versionIdParamSchema>;

/**
 * Schema for listing contents in a branch
 */
export const listContentsQuerySchema = paginationSchema.extend({
  branchId: uuidSchema,
  contentType: contentTypeSchema.optional(),
  section: contentSectionSchema.optional(),
  category: z.string().optional(),
});

export type ListContentsQuery = z.infer<typeof listContentsQuerySchema>;

/**
 * Schema for listing published content
 */
export const listPublishedQuerySchema = paginationSchema.extend({
  contentType: contentTypeSchema.optional(),
  section: contentSectionSchema.optional(),
  category: z.string().optional(),
});

export type ListPublishedQuery = z.infer<typeof listPublishedQuerySchema>;

/**
 * Schema for searching content
 */
export const searchContentsQuerySchema = paginationSchema.extend({
  q: z.string().min(1, 'Search query is required'),
  contentType: contentTypeSchema.optional(),
  section: contentSectionSchema.optional(),
});

export type SearchContentsQuery = z.infer<typeof searchContentsQuerySchema>;

/**
 * Schema for diff query
 */
export const diffQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export type DiffQuery = z.infer<typeof diffQuerySchema>;

/**
 * Schema for version list query
 */
export const versionListQuerySchema = paginationSchema.extend({});

export type VersionListQuery = z.infer<typeof versionListQuerySchema>;

/**
 * Validate body size (application-level check for 50 MB limit)
 */
export function validateBodySize(body: string): { valid: boolean; byteSize: number } {
  const byteSize = Buffer.byteLength(body, 'utf8');
  return {
    valid: byteSize <= MAX_BODY_BYTES,
    byteSize,
  };
}

/**
 * Schema for draft sync input (auto-save and manual save)
 */
export const draftSyncInputSchema = z.object({
  branchId: uuidSchema,
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(MAX_BODY_BYTES),
  metadata: z
    .object({
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      description: z.string().max(500).optional(),
    })
    .optional(),
  expectedServerVersion: z.string().datetime().nullable(),
  changeDescription: z.string().min(1).max(500),
});

export type DraftSyncInput = z.infer<typeof draftSyncInputSchema>;

/**
 * Schema for moving content between subcategories (drag-and-drop reassignment)
 */
export const moveContentBodySchema = z.object({
  branchId: uuidSchema,
  subcategoryId: uuidSchema.nullable(),
  displayOrder: z.number().int().min(0),
});

export type MoveContentBody = z.infer<typeof moveContentBodySchema>;
