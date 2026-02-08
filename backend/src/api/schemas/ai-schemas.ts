import { z } from 'zod';
import { uuidSchema } from './common.js';
import { AI_DEFAULTS } from '@echo-portal/shared';

/**
 * Zod validation schemas for AI-assisted authoring endpoints
 * Per contracts/ai-api.md
 */

// --- Generate ---

export const aiGenerateBodySchema = z.object({
  branchId: uuidSchema,
  contentId: uuidSchema.optional(),
  prompt: z.string().min(1, 'Prompt is required').max(AI_DEFAULTS.MAX_PROMPT_LENGTH),
  conversationId: uuidSchema.optional(),
});

export type AIGenerateBody = z.infer<typeof aiGenerateBodySchema>;

// --- Transform ---

export const aiTransformBodySchema = z.object({
  branchId: uuidSchema,
  contentId: uuidSchema,
  selectedText: z
    .string()
    .min(1, 'Selected text is required')
    .max(AI_DEFAULTS.MAX_SELECTED_TEXT_LENGTH),
  instruction: z
    .string()
    .min(1, 'Instruction is required')
    .max(AI_DEFAULTS.MAX_INSTRUCTION_LENGTH),
  conversationId: uuidSchema.optional(),
});

export type AITransformBody = z.infer<typeof aiTransformBodySchema>;

// --- Accept ---

export const aiAcceptBodySchema = z.object({
  contentId: uuidSchema,
  editedContent: z.string().optional(),
  changeDescription: z.string().max(1000).optional(),
});

export type AIAcceptBody = z.infer<typeof aiAcceptBodySchema>;

// --- Reject ---

export const aiRejectBodySchema = z.object({
  reason: z.string().max(1000).optional(),
});

export type AIRejectBody = z.infer<typeof aiRejectBodySchema>;

// --- Request ID param ---

export const aiRequestIdParamSchema = z.object({
  requestId: uuidSchema,
});

export type AIRequestIdParam = z.infer<typeof aiRequestIdParamSchema>;

// --- Conversation query ---

export const aiConversationQuerySchema = z.object({
  branchId: uuidSchema,
});

export type AIConversationQuery = z.infer<typeof aiConversationQuerySchema>;

// --- Conversation ID param ---

export const aiConversationIdParamSchema = z.object({
  conversationId: uuidSchema,
});

export type AIConversationIdParam = z.infer<typeof aiConversationIdParamSchema>;
