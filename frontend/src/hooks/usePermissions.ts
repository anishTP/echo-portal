import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { RoleType } from '@echo-portal/shared';

interface PermissionCacheEntry {
  granted: boolean;
  timestamp: number;
}

const CACHE_TTL = 5000; // 5 seconds cache

export function usePermissions() {
  const { user, isAuthenticated } = useAuth();
  const [cache, setCache] = useState<Map<string, PermissionCacheEntry>>(new Map());

  // Clear cache when user changes
  useEffect(() => {
    setCache(new Map());
  }, [user?.id]);

  const checkPermissionCached = useCallback(
    (key: string, checkFn: () => Promise<boolean>): Promise<boolean> => {
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return Promise.resolve(cached.granted);
      }

      return checkFn().then((granted) => {
        setCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(key, { granted, timestamp: Date.now() });
          return newCache;
        });
        return granted;
      });
    },
    [cache]
  );

  const canEdit = useCallback(
    async (branchId: string): Promise<boolean> => {
      if (!isAuthenticated || !user) return false;

      return checkPermissionCached(`edit:${branchId}`, async () => {
        try {
          // Call permission check API or compute locally based on role
          const response = await fetch(`/api/v1/branches/${branchId}/permissions`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            return data.data?.canEdit ?? false;
          }
          return false;
        } catch {
          return false;
        }
      });
    },
    [isAuthenticated, user, checkPermissionCached]
  );

  const canSubmitForReview = useCallback(
    async (branchId: string): Promise<boolean> => {
      if (!isAuthenticated || !user) return false;

      return checkPermissionCached(`submit:${branchId}`, async () => {
        try {
          const response = await fetch(`/api/v1/branches/${branchId}/permissions`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            return data.data?.canSubmitForReview ?? false;
          }
          return false;
        } catch {
          return false;
        }
      });
    },
    [isAuthenticated, user, checkPermissionCached]
  );

  const canApprove = useCallback(
    async (branchId: string): Promise<boolean> => {
      if (!isAuthenticated || !user) return false;

      return checkPermissionCached(`approve:${branchId}`, async () => {
        try {
          const response = await fetch(`/api/v1/branches/${branchId}/permissions`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            return data.data?.canApprove ?? false;
          }
          return false;
        } catch {
          return false;
        }
      });
    },
    [isAuthenticated, user, checkPermissionCached]
  );

  const canManageCollaborators = useCallback(
    async (branchId: string): Promise<boolean> => {
      if (!isAuthenticated || !user) return false;

      return checkPermissionCached(`collab:${branchId}`, async () => {
        try {
          const response = await fetch(`/api/v1/branches/${branchId}/permissions`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            return data.data?.canManageCollaborators ?? false;
          }
          return false;
        } catch {
          return false;
        }
      });
    },
    [isAuthenticated, user, checkPermissionCached]
  );

  const canPublish = useCallback(
    async (branchId: string): Promise<boolean> => {
      if (!isAuthenticated || !user) return false;

      // Publishing requires administrator role
      if (!user.roles.includes('administrator')) {
        return false;
      }

      return checkPermissionCached(`publish:${branchId}`, async () => {
        try {
          const response = await fetch(`/api/v1/branches/${branchId}/permissions`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            return data.data?.canPublish ?? false;
          }
          return false;
        } catch {
          return false;
        }
      });
    },
    [isAuthenticated, user, checkPermissionCached]
  );

  const canDelete = useCallback(
    async (branchId: string): Promise<boolean> => {
      if (!isAuthenticated || !user) return false;

      // Deletion requires administrator role
      if (!user.roles.includes('administrator')) {
        return false;
      }

      return checkPermissionCached(`delete:${branchId}`, async () => {
        try {
          const response = await fetch(`/api/v1/branches/${branchId}/permissions`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            return data.data?.canDelete ?? false;
          }
          return false;
        } catch {
          return false;
        }
      });
    },
    [isAuthenticated, user, checkPermissionCached]
  );

  const hasRole = useCallback(
    (role: RoleType): boolean => {
      return user?.roles.includes(role) ?? false;
    },
    [user]
  );

  const hasAnyRole = useCallback(
    (...roles: RoleType[]): boolean => {
      return roles.some((role) => user?.roles.includes(role));
    },
    [user]
  );

  return {
    canEdit,
    canSubmitForReview,
    canApprove,
    canManageCollaborators,
    canPublish,
    canDelete,
    hasRole,
    hasAnyRole,
    isAuthenticated,
  };
}
