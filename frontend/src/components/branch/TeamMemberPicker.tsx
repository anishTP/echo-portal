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

interface TeamMemberPickerProps {
  branchId: string;
  currentReviewers?: string[];
  disabled?: boolean;
  onReviewersChange?: (reviewers: TeamMember[]) => void;
}

export function TeamMemberPicker({
  branchId,
  disabled = false,
  onReviewersChange,
}: TeamMemberPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current reviewers with details
  const { data: reviewers = [], isLoading: loadingReviewers } = useQuery<TeamMember[]>({
    queryKey: ['branch-reviewers', branchId],
    queryFn: () => api.get<TeamMember[]>(`/branches/${branchId}/reviewers`),
  });

  // Search for potential reviewers
  const { data: searchResults = [], isFetching: searching } = useQuery<TeamMember[]>({
    queryKey: ['search-reviewers', branchId, searchQuery],
    queryFn: () =>
      api.get<TeamMember[]>(
        `/branches/${branchId}/reviewers/search?q=${encodeURIComponent(searchQuery)}`
      ),
    enabled: searchQuery.length >= 2 && isSearching,
  });

  // Add reviewer mutation
  const addReviewer = useMutation({
    mutationFn: (reviewerId: string) =>
      api.post<TeamMember[]>(`/branches/${branchId}/reviewers`, { reviewerIds: [reviewerId] }),
    onSuccess: (updatedReviewers) => {
      queryClient.setQueryData(['branch-reviewers', branchId], updatedReviewers);
      setSearchQuery('');
      setIsSearching(false);
      onReviewersChange?.(updatedReviewers);
    },
  });

  // Remove reviewer mutation
  const removeReviewer = useMutation({
    mutationFn: (reviewerId: string) =>
      api.delete<TeamMember[]>(`/branches/${branchId}/reviewers/${reviewerId}`),
    onSuccess: (updatedReviewers) => {
      queryClient.setQueryData(['branch-reviewers', branchId], updatedReviewers);
      onReviewersChange?.(updatedReviewers);
    },
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearching(value.length >= 2);
  }, []);

  const handleAddReviewer = useCallback(
    (member: TeamMember) => {
      if (!disabled) {
        addReviewer.mutate(member.id);
      }
    },
    [addReviewer, disabled]
  );

  const handleRemoveReviewer = useCallback(
    (reviewerId: string) => {
      if (!disabled) {
        removeReviewer.mutate(reviewerId);
      }
    },
    [removeReviewer, disabled]
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
          Reviewers
          {reviewers.length > 0 && (
            <span className="ml-2 text-gray-400">({reviewers.length})</span>
          )}
        </label>

        {/* Current Reviewers */}
        <div className="mt-2 space-y-2">
          {loadingReviewers ? (
            <Flex align="center" gap="2" py="2">
              <Spinner size="1" />
              <Text size="2" color="gray">Loading reviewers...</Text>
            </Flex>
          ) : reviewers.length === 0 ? (
            <p className="py-2 text-sm text-gray-500">No reviewers assigned yet.</p>
          ) : (
            reviewers.map((reviewer) => {
              const roleBadge = getRoleBadge(reviewer.roles);
              return (
                <div
                  key={reviewer.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {reviewer.avatarUrl ? (
                      <img
                        src={reviewer.avatarUrl}
                        alt={reviewer.displayName}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                        {getInitials(reviewer.displayName)}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {reviewer.displayName}
                      </div>
                      <div className="text-xs text-gray-500">{reviewer.email}</div>
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
                      onClick={() => handleRemoveReviewer(reviewer.id)}
                      disabled={removeReviewer.isPending}
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

      {/* Add Reviewer Search */}
      {!disabled && (
        <Popover.Root open={popoverShouldBeOpen}>
          <Popover.Trigger>
            <Box style={{ width: '100%' }}>
              <TextField.Root
                size="2"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by name or email to add reviewer..."
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
                      onClick={() => handleAddReviewer(member)}
                      disabled={addReviewer.isPending}
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
          ? 'Reviewers can only be modified for draft branches.'
          : 'Add team members who will review this branch before publication.'}
      </Text>
    </div>
  );
}

export default TeamMemberPicker;
