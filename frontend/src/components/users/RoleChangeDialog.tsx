import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Button, Select, TextArea, Text, Badge, Callout, Flex } from '@radix-ui/themes';
import { ExclamationTriangleIcon, CrossCircledIcon } from '@radix-ui/react-icons';
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

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>Change User Role</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          Changing role for <Text weight="bold">{user.displayName}</Text> ({user.email})
        </Dialog.Description>

        <Flex direction="column" gap="4" mt="4">
          {/* Current Role */}
          <div>
            <Text as="label" size="2" weight="medium">Current Role</Text>
            <Flex mt="1">
              <Badge color="gray" size="2">
                {RoleDisplayNames[currentRole] || currentRole}
              </Badge>
            </Flex>
          </div>

          {/* New Role Selector */}
          <div>
            <Text as="label" size="2" weight="medium" className="block mb-1">New Role</Text>
            <Select.Root
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as RoleType)}
            >
              <Select.Trigger style={{ width: '100%' }} />
              <Select.Content>
                {ALL_ROLES.map((role) => (
                  <Select.Item key={role} value={role}>
                    {RoleDisplayNames[role]} - {RoleDescriptions[role]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>

          {/* Escalation Warning */}
          {isEscalation && (
            <Callout.Root color="yellow">
              <Callout.Icon>
                <ExclamationTriangleIcon />
              </Callout.Icon>
              <Callout.Text>
                <Text weight="bold">Privilege Escalation Warning</Text>
                <Text as="p" size="2" mt="2">
                  You are granting <Text weight="bold">Administrator</Text> privileges. This role has
                  full system access including:
                </Text>
                <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                  <li>User management</li>
                  <li>Publishing content</li>
                  <li>Viewing audit logs</li>
                  <li>All branch operations</li>
                </ul>
              </Callout.Text>
            </Callout.Root>
          )}

          {/* Optional Reason */}
          <div>
            <Text as="label" size="2" weight="medium" className="block mb-1">Reason (optional)</Text>
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you changing this user's role?"
              rows={3}
            />
          </div>

          {/* Error Message */}
          {roleChangeMutation.isError && (
            <Callout.Root color="red">
              <Callout.Icon>
                <CrossCircledIcon />
              </Callout.Icon>
              <Callout.Text>
                {roleChangeMutation.error instanceof Error
                  ? roleChangeMutation.error.message
                  : 'Failed to change role'}
              </Callout.Text>
            </Callout.Root>
          )}
        </Flex>

        {/* Action Buttons */}
        <Flex gap="3" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="outline" disabled={roleChangeMutation.isPending}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button
            onClick={handleConfirm}
            disabled={roleChangeMutation.isPending || !hasChanges}
          >
            {roleChangeMutation.isPending ? 'Changing...' : 'Confirm Change'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
