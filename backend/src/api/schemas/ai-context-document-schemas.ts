import { z } from 'zod';
import { uuidSchema } from './common.js';

export const createContextDocSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(100_000),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateContextDocBody = z.infer<typeof createContextDocSchema>;

export const updateContextDocSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(100_000).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdateContextDocBody = z.infer<typeof updateContextDocSchema>;

export const contextDocIdParamSchema = z.object({
  id: uuidSchema,
});

export type ContextDocIdParam = z.infer<typeof contextDocIdParamSchema>;
