import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconButton, Button } from '@radix-ui/themes';
import { Cross1Icon, PlusIcon } from '@radix-ui/react-icons';
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

  const getRoleBadge = (roles: string[]) => {
    if (roles.includes('administrator')) {
      return { label: 'Admin', className: 'bg-purple-100 text-purple-800' };
    }
    if (roles.includes('publisher')) {
      return { label: 'Publisher', className: 'bg-blue-100 text-blue-800' };
    }
    if (roles.includes('reviewer')) {
      return { label: 'Reviewer', className: 'bg-green-100 text-green-800' };
    }
    return { label: 'Contributor', className: 'bg-gray-100 text-gray-800' };
  };

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
            <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading collaborators...
            </div>
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
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge.className}`}
                    >
                      {roleBadge.label}
                    </span>
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
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by name or email to add collaborator..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searching && (
              <svg
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearching && searchQuery.length >= 2 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
              {searching ? (
                <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No users found matching "{searchQuery}"
                </div>
              ) : (
                <ul className="max-h-60 overflow-auto py-1">
                  {searchResults.map((member) => {
                    const roleBadge = getRoleBadge(member.roles);
                    return (
                      <li key={member.id}>
                        <Button
                          variant="ghost"
                          size="2"
                          onClick={() => handleAddCollaborator(member)}
                          disabled={addCollaborator.isPending}
                          style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 16px' }}
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
                            <div className="text-sm font-medium">
                              {member.displayName}
                            </div>
                            <div className="text-xs opacity-70">{member.email}</div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge.className}`}
                          >
                            {roleBadge.label}
                          </span>
                          <PlusIcon />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500">
        {disabled
          ? 'Collaborators can only be modified for draft branches.'
          : 'Add team members who can edit this branch. Collaborators have read-only access once submitted for review.'}
      </p>
    </div>
  );
}

export default CollaboratorPicker;
