import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconButton, Button, TextField, Spinner, Badge, Popover, Flex, Text, Box } from '@radix-ui/themes';
import { Cross1Icon, PlusIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { api } from '../../services/api';

export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  roles: string[];
}

interface CollaboratorPickerProps {
  branchId: string;
  currentCollaborators?: string[];
  disabled?: boolean;
  onCollaboratorsChange?: (collaborators: TeamMember[]) => void;
}

export function CollaboratorPicker({
  branchId,
  disabled = false,
  onCollaboratorsChange,
}: CollaboratorPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current collaborators with details
  const { data: collaborators = [], isLoading: loadingCollaborators } = useQuery<TeamMember[]>({
    queryKey: ['branch-collaborators', branchId],
    queryFn: () => api.get<TeamMember[]>(`/branches/${branchId}/collaborators`),
  });

  // Search for potential collaborators
  const { data: searchResults = [], isFetching: searching } = useQuery<TeamMember[]>({
    queryKey: ['search-collaborators', branchId, searchQuery],
    queryFn: () =>
      api.get<TeamMember[]>(
        `/branches/${branchId}/collaborators/search?q=${encodeURIComponent(searchQuery)}`
      ),
    enabled: searchQuery.length >= 2 && isSearching,
  });

  // Add collaborator mutation
  const addCollaborator = useMutation({
    mutationFn: (collaboratorId: string) =>
      api.post<TeamMember[]>(`/branches/${branchId}/collaborators`, {
        collaboratorIds: [collaboratorId],
      }),
    onSuccess: (updatedCollaborators) => {
      queryClient.setQueryData(['branch-collaborators', branchId], updatedCollaborators);
      setSearchQuery('');
      setIsSearching(false);
      onCollaboratorsChange?.(updatedCollaborators);
    },
    onError: (error: any) => {
      // Show error notification
      console.error('Failed to add collaborator:', error);
    },
  });

  // Remove collaborator mutation
  const removeCollaborator = useMutation({
    mutationFn: (collaboratorId: string) =>
      api.delete<TeamMember[]>(`/branches/${branchId}/collaborators/${collaboratorId}`),
    onSuccess: (updatedCollaborators) => {
      queryClient.setQueryData(['branch-collaborators', branchId], updatedCollaborators);
      onCollaboratorsChange?.(updatedCollaborators);
    },
    onError: (error: any) => {
      // Show error notification
      console.error('Failed to remove collaborator:', error);
    },
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearching(value.length >= 2);
  }, []);

  const handleAddCollaborator = useCallback(
    (member: TeamMember) => {
      if (!disabled) {
        addCollaborator.mutate(member.id);
      }
    },
    [addCollaborator, disabled]
  );

  const handleRemoveCollaborator = useCallback(
    (collaboratorId: string) => {
      if (!disabled) {
        removeCollaborator.mutate(collaboratorId);
      }
    },
    [removeCollaborator, disabled]
  );

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (roles: string[]): { label: string; color: 'purple' | 'blue' | 'green' | 'gray' } => {
    if (roles.includes('administrator')) {
      return { label: 'Admin', color: 'purple' };
    }
    if (roles.includes('publisher')) {
      return { label: 'Publisher', color: 'blue' };
    }
    if (roles.includes('reviewer')) {
      return { label: 'Reviewer', color: 'green' };
    }
    return { label: 'Contributor', color: 'gray' };
  };

  // Compute popover open state based on search query
  const popoverShouldBeOpen = searchQuery.length >= 2 && isSearching;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Collaborators
          {collaborators.length > 0 && (
            <span className="ml-2 text-gray-400">({collaborators.length})</span>
          )}
        </label>

        {/* Current Collaborators */}
        <div className="mt-2 space-y-2">
          {loadingCollaborators ? (
            <Flex align="center" gap="2" py="2">
              <Spinner size="1" />
              <Text size="2" color="gray">Loading collaborators...</Text>
            </Flex>
          ) : collaborators.length === 0 ? (
            <p className="py-2 text-sm text-gray-500">No collaborators assigned yet.</p>
          ) : (
            collaborators.map((collaborator) => {
              const roleBadge = getRoleBadge(collaborator.roles);
              return (
                <div
                  key={collaborator.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {collaborator.avatarUrl ? (
                      <img
                        src={collaborator.avatarUrl}
                        alt={collaborator.displayName}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                        {getInitials(collaborator.displayName)}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {collaborator.displayName}
                      </div>
                      <div className="text-xs text-gray-500">{collaborator.email}</div>
                    </div>
                    <Badge color={roleBadge.color} variant="soft" size="1" radius="full">
                      {roleBadge.label}
                    </Badge>
                  </div>
                  {!disabled && (
                    <IconButton
                      variant="ghost"
                      size="1"
                      color="gray"
                      onClick={() => handleRemoveCollaborator(collaborator.id)}
                      disabled={removeCollaborator.isPending}
                    >
                      <Cross1Icon />
                    </IconButton>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Collaborator Search */}
      {!disabled && (
        <Popover.Root open={popoverShouldBeOpen}>
          <Popover.Trigger>
            <Box style={{ width: '100%' }}>
              <TextField.Root
                size="2"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by name or email to add collaborator..."
              >
                <TextField.Slot>
                  <MagnifyingGlassIcon height="16" width="16" />
                </TextField.Slot>
                <TextField.Slot>
                  {searching && <Spinner size="1" />}
                </TextField.Slot>
              </TextField.Root>
            </Box>
          </Popover.Trigger>
          <Popover.Content
            style={{ width: 'var(--radix-popover-trigger-width)', padding: 0 }}
            align="start"
            sideOffset={4}
          >
            {searching ? (
              <Flex align="center" gap="2" p="3">
                <Spinner size="1" />
                <Text size="2" color="gray">Searching...</Text>
              </Flex>
            ) : searchResults.length === 0 ? (
              <Text size="2" color="gray" style={{ padding: '12px 16px', display: 'block' }}>
                No users found matching "{searchQuery}"
              </Text>
            ) : (
              <Box style={{ maxHeight: '240px', overflowY: 'auto' }}>
                {searchResults.map((member) => {
                  const roleBadge = getRoleBadge(member.roles);
                  return (
                    <Button
                      key={member.id}
                      variant="ghost"
                      size="2"
                      onClick={() => handleAddCollaborator(member)}
                      disabled={addCollaborator.isPending}
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 16px', borderRadius: 0 }}
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.displayName}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                          {getInitials(member.displayName)}
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <Text size="2" weight="medium">{member.displayName}</Text>
                        <Text size="1" color="gray">{member.email}</Text>
                      </div>
                      <Badge color={roleBadge.color} variant="soft" size="1" radius="full">
                        {roleBadge.label}
                      </Badge>
                      <PlusIcon />
                    </Button>
                  );
                })}
              </Box>
            )}
          </Popover.Content>
        </Popover.Root>
      )}

      {/* Help Text */}
      <Text size="1" color="gray">
        {disabled
          ? 'Collaborators can only be modified for draft branches.'
          : 'Add team members who can edit this branch. Collaborators have read-only access once submitted for review.'}
      </Text>
    </div>
  );
}

export default CollaboratorPicker;
