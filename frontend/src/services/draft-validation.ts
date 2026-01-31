import { z } from 'zod';

/**
 * Zod schema for draft metadata.
 */
export const draftMetadataSchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
});

/**
 * Zod schema for validating drafts stored in IndexedDB.
 */
export const draftSchema = z.object({
  id: z.string().regex(/^[a-f0-9-]+:[a-f0-9-]+$/, 'Invalid draft ID format (expected UUID:UUID)'),
  contentId: z.string().uuid(),
  branchId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(50 * 1024 * 1024), // 50MB limit
  metadata: draftMetadataSchema,
  localVersion: z.number().int().positive(),
  serverVersionTimestamp: z.string().datetime().nullable(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  synced: z.boolean(),
});

/**
 * Zod schema for draft sync input.
 */
export const draftSyncInputSchema = z.object({
  branchId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(50 * 1024 * 1024),
  metadata: draftMetadataSchema.optional(),
  expectedServerVersion: z.string().datetime().nullable(),
  changeDescription: z.string().min(1).max(500),
});

/**
 * Zod schema for edit session stored in IndexedDB.
 */
export const editSessionSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().uuid(),
  branchId: z.string().uuid(),
  userId: z.string().uuid(),
  startedAt: z.number().int().positive(),
  lastActivityAt: z.number().int().positive(),
  deviceId: z.string().min(1),
});

/**
 * Zod schema for sync queue item.
 */
export const syncQueueItemSchema = z.object({
  id: z.number().int().positive().optional(),
  draftId: z.string().regex(/^[a-f0-9-]+:[a-f0-9-]+$/),
  operation: z.enum(['sync', 'delete']),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().positive(),
  nextRetryAt: z.number().int().positive(),
  lastError: z.string().optional(),
  createdAt: z.number().int().positive(),
});

export type DraftInput = z.infer<typeof draftSchema>;
export type DraftSyncInputValidated = z.infer<typeof draftSyncInputSchema>;
export type EditSessionInput = z.infer<typeof editSessionSchema>;
export type SyncQueueItemInput = z.infer<typeof syncQueueItemSchema>;
