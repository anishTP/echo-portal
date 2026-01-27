import { z } from 'zod';
import { Role } from '@echo-portal/shared';

/**
 * Role enum schema
 */
export const RoleSchema = z.enum([
  Role.VIEWER,
  Role.CONTRIBUTOR,
  Role.REVIEWER,
  Role.ADMINISTRATOR,
]);

/**
 * User role change schema (FR-009, FR-010)
 */
export const UserRoleChangeSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  newRole: RoleSchema,
  reason: z.string().min(1).max(500).optional(),
});

/**
 * User status update schema
 */
export const UserStatusUpdateSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  isActive: z.boolean(),
  reason: z.string().min(1).max(500).optional(),
});

/**
 * User list query parameters
 */
export const UserListQuerySchema = z.object({
  role: RoleSchema.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true';
    }),
  search: z.string().optional(),
  limit: z
    .string()
    .optional()
    .default('50')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  offset: z
    .string()
    .optional()
    .default('0')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 0, 'Offset must be non-negative'),
  sortBy: z.enum(['createdAt', 'lastLoginAt', 'displayName', 'email']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * User detail response schema
 */
export const UserDetailSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  avatarUrl: z.string().url().optional(),
  role: RoleSchema,
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  lastLoginAt: z.string().or(z.date()).optional(),
  failedLoginCount: z.number().int().min(0).optional(),
  lastFailedLoginAt: z.string().or(z.date()).optional(),
  lockedUntil: z.string().or(z.date()).nullable().optional(),
  provider: z.enum(['github', 'google', 'saml', 'api_token']),
  externalId: z.string(),
});

/**
 * User list response schema
 */
export const UserListResponseSchema = z.object({
  users: z.array(UserDetailSchema),
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
});

/**
 * User unlock schema (admin function to clear lockout)
 */
export const UserUnlockSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  reason: z.string().min(1).max(500).optional(),
});

/**
 * Role change validation errors
 */
export const RoleChangeErrorSchema = z.object({
  error: z.literal('FORBIDDEN'),
  code: z.enum([
    'SELF_ESCALATION',
    'INSUFFICIENT_PERMISSION',
    'USER_NOT_FOUND',
    'INVALID_ROLE',
  ]),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

/**
 * User statistics schema (for admin dashboard)
 */
export const UserStatsSchema = z.object({
  totalUsers: z.number().int().min(0),
  activeUsers: z.number().int().min(0),
  byRole: z.object({
    [Role.VIEWER]: z.number().int().min(0),
    [Role.CONTRIBUTOR]: z.number().int().min(0),
    [Role.REVIEWER]: z.number().int().min(0),
    [Role.ADMINISTRATOR]: z.number().int().min(0),
  }),
  lockedAccounts: z.number().int().min(0),
  recentLogins: z.number().int().min(0), // Last 24 hours
});

// Export types
export type RoleType = z.infer<typeof RoleSchema>;
export type UserRoleChange = z.infer<typeof UserRoleChangeSchema>;
export type UserStatusUpdate = z.infer<typeof UserStatusUpdateSchema>;
export type UserListQuery = z.infer<typeof UserListQuerySchema>;
export type UserDetail = z.infer<typeof UserDetailSchema>;
export type UserListResponse = z.infer<typeof UserListResponseSchema>;
export type UserUnlock = z.infer<typeof UserUnlockSchema>;
export type RoleChangeError = z.infer<typeof RoleChangeErrorSchema>;
export type UserStats = z.infer<typeof UserStatsSchema>;
