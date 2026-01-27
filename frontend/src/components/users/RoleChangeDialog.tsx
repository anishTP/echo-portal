import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RoleDisplayNames, RoleDescriptions, ALL_ROLES } from '@echo-portal/shared';
import type { User, RoleType } from '@echo-portal/shared';

interface RoleChangeDialogProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * T097: RoleChangeDialog Component
 *
 * Dialog for changing user roles with confirmation and escalation warnings.
 * Shows role selector, confirmation, and warnings for privilege escalation.
 */
export function RoleChangeDialog({
  user,
  isOpen,
  onClose,
  onSuccess,
}: RoleChangeDialogProps) {
  const [selectedRole, setSelectedRole] = useState<RoleType>(user.roles[0] as RoleType);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Role change mutation
  const roleChangeMutation = useMutation({
    mutationFn: async (role: RoleType) => {
      const response = await fetch(`/api/v1/users/${user.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change role');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate users queries to refresh list
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
      setReason('');
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error('Failed to change role:', error);
    },
  });

  const handleConfirm = useCallback(() => {
    roleChangeMutation.mutate(selectedRole);
  }, [roleChangeMutation, selectedRole]);

  const handleCancel = useCallback(() => {
    onClose();
    setReason('');
    setSelectedRole(user.roles[0] as RoleType);
  }, [onClose, user.roles]);

  // Check if this is a privilege escalation
  const currentRole = user.roles[0];
  const isEscalation = selectedRole === 'administrator' && currentRole !== 'administrator';
  const hasChanges = selectedRole !== currentRole;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Change User Role</h2>

        <div className="mt-4">
          <p className="text-sm text-gray-600">
            Changing role for <strong>{user.displayName}</strong> ({user.email})
          </p>

          {/* Current Role */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Current Role
            </label>
            <div className="mt-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                {RoleDisplayNames[currentRole] || currentRole}
              </span>
            </div>
          </div>

          {/* New Role Selector */}
          <div className="mt-4">
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              New Role
            </label>
            <select
              id="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as RoleType)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {RoleDisplayNames[role]} - {RoleDescriptions[role]}
                </option>
              ))}
            </select>
          </div>

          {/* Escalation Warning */}
          {isEscalation && (
            <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Privilege Escalation Warning
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      You are granting <strong>Administrator</strong> privileges. This role has
                      full system access including:
                    </p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li>User management</li>
                      <li>Publishing content</li>
                      <li>Viewing audit logs</li>
                      <li>All branch operations</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Optional Reason */}
          <div className="mt-4">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
              Reason (optional)
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you changing this user's role?"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          {/* Error Message */}
          {roleChangeMutation.isError && (
            <div className="mt-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">
                    {roleChangeMutation.error instanceof Error
                      ? roleChangeMutation.error.message
                      : 'Failed to change role'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={roleChangeMutation.isPending}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={roleChangeMutation.isPending || !hasChanges}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {roleChangeMutation.isPending ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Changing...
              </>
            ) : (
              'Confirm Change'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
