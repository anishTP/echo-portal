import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, TextField, TextArea, Select, Callout } from '@radix-ui/themes';
import { useBranch, useUpdateBranch } from '../hooks/useBranch';
import { BranchDetail } from '../components/branch/BranchDetail';
import { BranchReviewSection } from '../components/review/BranchReviewSection';
import { ContentList, ContentEditor, VersionHistory, VersionDiff } from '../components/content';
import { AccessDenied } from '../components/common/AccessDenied';
import { useContentList, useContent } from '../hooks/useContent';
import { useAuth } from '../context/AuthContext';
import type { BranchUpdateInput, VisibilityType, ContentSummary } from '@echo-portal/shared';

type ContentView =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; contentId: string }
  | { mode: 'diff'; contentId: string; fromTimestamp: string; toTimestamp: string };

export default function BranchWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: branch, isLoading, error } = useBranch(id);
  const updateBranch = useUpdateBranch();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<BranchUpdateInput>({});
  const [contentView, setContentView] = useState<ContentView>({ mode: 'list' });

  const selectedContentId = contentView.mode === 'edit' || contentView.mode === 'diff'
    ? contentView.contentId
    : undefined;

  const { data: contentListData, isLoading: isContentListLoading } = useContentList(id);
  const { data: selectedContent, isLoading: isContentLoading } = useContent(selectedContentId);

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">No branch ID provided</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-100" />
            <div className="h-32 rounded bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !branch) {
    // Check if it's an access denied error
    const isAccessDenied = error instanceof Error && (
      error.message.includes('ACCESS_DENIED') ||
      error.message.includes('access denied') ||
      error.message.includes('permission') ||
      error.message.includes('forbidden')
    );

    if (isAccessDenied) {
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-4xl px-4 py-8">
            <AccessDenied
              message="Access Denied"
              guidance={{
                reason: error?.message || 'You do not have permission to view this branch',
                action: 'Please sign in with an account that has access to this branch, or contact the branch owner.',
              }}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Callout.Root color="red" size="2">
            <Callout.Icon>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </Callout.Icon>
            <Callout.Text>
              <strong>Branch Not Found</strong>
              <p className="mt-1">
                {error instanceof Error ? error.message : 'The requested branch could not be found.'}
              </p>
              <Link
                to="/dashboard"
                className="mt-2 inline-block text-sm font-medium underline"
              >
                Return to Dashboard
              </Link>
            </Callout.Text>
          </Callout.Root>
        </div>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditForm({
      name: branch.name,
      description: branch.description || '',
      visibility: branch.visibility as VisibilityType,
      labels: branch.labels,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      await updateBranch.mutateAsync({ id: branch.id, input: editForm });
      setIsEditing(false);
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSelectContent = (content: ContentSummary) => {
    setContentView({ mode: 'edit', contentId: content.id });
  };

  const handleCreateContent = () => {
    setContentView({ mode: 'create' });
  };

  const handleContentSaved = () => {
    setContentView({ mode: 'list' });
  };

  const handleContentCancel = () => {
    setContentView({ mode: 'list' });
  };

  const handleSelectDiff = (fromTimestamp: string, toTimestamp: string) => {
    if (contentView.mode === 'edit') {
      setContentView({
        mode: 'diff',
        contentId: contentView.contentId,
        fromTimestamp,
        toTimestamp,
      });
    }
  };

  const handleCloseDiff = () => {
    if (contentView.mode === 'diff') {
      setContentView({ mode: 'edit', contentId: contentView.contentId });
    }
  };

  const handleBackToList = () => {
    setContentView({ mode: 'list' });
  };

  const canEdit = branch.permissions.canEdit && branch.state === 'draft';
  const isReadOnly = !canEdit;
  const containerMaxWidth = contentView.mode === 'edit' ? 'max-w-6xl' : 'max-w-4xl';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className={`mx-auto ${containerMaxWidth} px-4 py-4`}>
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/dashboard" className="hover:text-gray-700">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-900">{branch.name}</span>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className={`mx-auto ${containerMaxWidth} px-4 py-8`}>
        {isEditing ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Edit Branch</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <TextField.Root
                  id="edit-name"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  size="2"
                />
              </div>

              <div>
                <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <TextArea
                  id="edit-description"
                  rows={3}
                  value={editForm.description || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  size="2"
                />
              </div>

              <div>
                <label htmlFor="edit-visibility" className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <Select.Root
                  value={editForm.visibility || 'private'}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      visibility: value as VisibilityType,
                    }))
                  }
                  size="2"
                >
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    <Select.Item value="private">Private</Select.Item>
                    <Select.Item value="team">Team</Select.Item>
                    <Select.Item value="public">Public</Select.Item>
                  </Select.Content>
                </Select.Root>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" size="2" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button size="2" onClick={handleSaveEdit} disabled={updateBranch.isPending}>
                {updateBranch.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <BranchDetail branch={branch} onEdit={handleStartEdit} />
        )}

        {/* Review Section — shown for reviewers or when reviews exist */}
        {!isEditing && user?.id && (
          branch.reviewers?.includes(user.id) || (branch.reviews && branch.reviews.length > 0)
        ) && (
          <BranchReviewSection
            reviews={branch.reviews || []}
            currentUserId={user.id}
            branchState={branch.state}
          />
        )}

        {/* Content Workspace */}
        {!isEditing && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Content</h3>
              <div className="flex gap-2">
                {contentView.mode !== 'list' && (
                  <Button variant="outline" size="2" onClick={handleBackToList}>
                    Back to list
                  </Button>
                )}
                {contentView.mode === 'list' && canEdit && (
                  <Button size="2" onClick={handleCreateContent}>
                    New Content
                  </Button>
                )}
              </div>
            </div>

            {contentView.mode === 'list' && (
              <ContentList
                contents={contentListData?.items ?? []}
                isLoading={isContentListLoading}
                onSelect={handleSelectContent}
                emptyMessage="No content in this branch yet"
              />
            )}

            {contentView.mode === 'create' && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <ContentEditor
                  branchId={branch.id}
                  onSave={handleContentSaved}
                  onCancel={handleContentCancel}
                />
              </div>
            )}

            {contentView.mode === 'edit' && (
              isContentLoading ? (
                <div className="animate-pulse space-y-4 rounded-lg border border-gray-200 bg-white p-6">
                  <div className="h-6 w-1/3 rounded bg-gray-200" />
                  <div className="h-4 w-2/3 rounded bg-gray-100" />
                  <div className="h-40 rounded bg-gray-100" />
                </div>
              ) : selectedContent ? (
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-6">
                    <ContentEditor
                      key={selectedContent.id}
                      branchId={branch.id}
                      content={selectedContent}
                      onSave={handleContentSaved}
                      onCancel={handleBackToList}
                      onDelete={handleBackToList}
                    />
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <VersionHistory
                      contentId={selectedContent.id}
                      onSelectDiff={handleSelectDiff}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                </div>
              ) : (
                <Callout.Root color="red" size="2">
                  <Callout.Icon>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </Callout.Icon>
                  <Callout.Text>
                    Content not found
                    <Button
                      variant="ghost"
                      size="1"
                      color="red"
                      onClick={handleBackToList}
                      className="ml-2"
                    >
                      Return to list
                    </Button>
                  </Callout.Text>
                </Callout.Root>
              )
            )}

            {contentView.mode === 'diff' && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <VersionDiff
                  contentId={contentView.contentId}
                  fromTimestamp={contentView.fromTimestamp}
                  toTimestamp={contentView.toTimestamp}
                  onClose={handleCloseDiff}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
