import { z } from 'zod';

/**
 * Query parameters for listing audit logs
 */
export const auditQuerySchema = z.object({
  resourceType: z
    .enum(['branch', 'review', 'convergence', 'user'])
    .optional()
    .describe('Filter by resource type'),
  resourceId: z.string().uuid().optional().describe('Filter by specific resource ID'),
  actorId: z.string().uuid().optional().describe('Filter by actor ID'),
  actions: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : undefined))
    .describe('Comma-separated list of action types to filter'),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .describe('Filter events after this date (ISO 8601)'),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .describe('Filter events before this date (ISO 8601)'),
  page: z.coerce.number().int().min(1).default(1).describe('Page number'),
  limit: z.coerce.number().int().min(1).max(100).default(50).describe('Items per page'),
});

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;

/**
 * Path parameters for branch history
 */
export const branchHistoryParamsSchema = z.object({
  id: z.string().uuid().describe('Branch ID'),
});

export type BranchHistoryParams = z.infer<typeof branchHistoryParamsSchema>;

/**
 * Query parameters for branch history
 */
export const branchHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100).describe('Max events to return'),
  includeRelated: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .describe('Include related review and convergence events'),
});

export type BranchHistoryQuery = z.infer<typeof branchHistoryQuerySchema>;

/**
 * Query parameters for audit stats
 */
export const auditStatsQuerySchema = z.object({
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  resourceType: z.enum(['branch', 'review', 'convergence', 'user']).optional(),
});

export type AuditStatsQuery = z.infer<typeof auditStatsQuerySchema>;

/**
 * Query parameters for lineage
 */
export const lineageQuerySchema = z.object({
  includeArchived: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .describe('Include archived branches in lineage'),
});

export type LineageQuery = z.infer<typeof lineageQuerySchema>;

/**
 * Query parameters for branch tree
 */
export const branchTreeQuerySchema = z.object({
  baseRef: z.string().default('main').describe('Base reference to show branches from'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  includeArchived: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type BranchTreeQuery = z.infer<typeof branchTreeQuerySchema>;
