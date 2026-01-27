import type { Context } from 'hono';

export interface SuccessResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Send a successful response with data
 */
export function success<T>(c: Context, data: T, status: 200 | 201 = 200): Response {
  const requestId = c.get('requestId');
  const response: SuccessResponse<T> = {
    data,
    requestId,
  };
  return c.json(response, status);
}

/**
 * Send a successful response with paginated data
 */
export function paginated<T>(
  c: Context,
  data: T[],
  pagination: PaginationMeta
): Response {
  const requestId = c.get('requestId');
  const response: SuccessResponse<T[]> = {
    data,
    meta: pagination,
    requestId,
  };
  return c.json(response, 200);
}

/**
 * Send a created response
 */
export function created<T>(c: Context, data: T): Response {
  return success(c, data, 201);
}

/**
 * Send a no content response
 */
export function noContent(c: Context): Response {
  return c.body(null, 204);
}

/**
 * Calculate pagination meta from query params and total count
 */
export function getPagination(
  c: Context,
  total: number
): { page: number; limit: number; offset: number; meta: PaginationMeta } {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
    meta: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  };
}
