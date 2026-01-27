import { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

interface PermissionGateProps {
  children: ReactNode;
  /** Required role (administrator, publisher, reviewer, contributor) */
  requiredRole?: string | string[];
  /** Required permission from branch/resource permissions object */
  requiredPermission?: string;
  /** Custom permission check function */
  checkPermission?: () => boolean;
  /** Fallback content to show when permission is denied */
  fallback?: ReactNode;
  /** Show fallback or hide completely (default: hide) */
  showFallback?: boolean;
}

/**
 * PermissionGate - Conditionally render children based on user permissions
 *
 * Usage:
 * ```tsx
 * // Require specific role
 * <PermissionGate requiredRole="administrator">
 *   <AdminPanel />
 * </PermissionGate>
 *
 * // Require one of multiple roles
 * <PermissionGate requiredRole={['publisher', 'administrator']}>
 *   <PublishButton />
 * </PermissionGate>
 *
 * // Custom permission check
 * <PermissionGate checkPermission={() => branch.permissions.canEdit}>
 *   <EditButton />
 * </PermissionGate>
 *
 * // With fallback
 * <PermissionGate requiredRole="admin" fallback={<AccessDenied />} showFallback>
 *   <AdminPanel />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  children,
  requiredRole,
  requiredPermission,
  checkPermission,
  fallback,
  showFallback = false,
}: PermissionGateProps) {
  const { user } = useAuth();

  // Check authentication
  if (!user) {
    return showFallback && fallback ? <>{fallback}</> : null;
  }

  // Custom permission check
  if (checkPermission) {
    const hasPermission = checkPermission();
    if (!hasPermission) {
      return showFallback && fallback ? <>{fallback}</> : null;
    }
    return <>{children}</>;
  }

  // Role-based check
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const hasRole = roles.some((role) => user.roles?.includes(role));

    if (!hasRole) {
      return showFallback && fallback ? <>{fallback}</> : null;
    }
  }

  // Permission-based check (for specific permissions like canEdit, canPublish)
  if (requiredPermission) {
    // This would need access to the resource's permissions object
    // For now, we'll just render the children
    // In a real implementation, you'd pass the permissions object as a prop
  }

  return <>{children}</>;
}

/**
 * Hook to check permissions without rendering
 */
export function usePermissions() {
  const { user } = useAuth();

  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.some((r) => user.roles?.includes(r));
  };

  const hasAnyRole = (roles: string[]): boolean => {
    if (!user) return false;
    return roles.some((role) => user.roles?.includes(role));
  };

  const hasAllRoles = (roles: string[]): boolean => {
    if (!user) return false;
    return roles.every((role) => user.roles?.includes(role));
  };

  const isAdmin = (): boolean => {
    return hasRole('administrator');
  };

  const isPublisher = (): boolean => {
    return hasRole(['publisher', 'administrator']);
  };

  const isReviewer = (): boolean => {
    return hasRole(['reviewer', 'publisher', 'administrator']);
  };

  const isContributor = (): boolean => {
    return hasRole(['contributor', 'reviewer', 'publisher', 'administrator']);
  };

  return {
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isAdmin,
    isPublisher,
    isReviewer,
    isContributor,
    user,
  };
}

export default PermissionGate;
