import { memo, useState } from 'react';
import { Card, Badge, IconButton } from '@radix-ui/themes';
import { TrashIcon } from '@radix-ui/react-icons';
import { DeleteContentDialog } from './DeleteContentDialog';
import { useDeleteContent } from '../../hooks/useContent';
import type { ContentSummary, ContentTypeValue } from '@echo-portal/shared';

interface ContentListProps {
  contents: ContentSummary[];
  isLoading?: boolean;
  emptyMessage?: string;
  onSelect?: (content: ContentSummary) => void;
  onDelete?: (content: ContentSummary) => void;
  showActions?: boolean;
}

const typeLabels: Record<ContentTypeValue, string> = {
  guideline: 'Guideline',
  asset: 'Asset',
  opinion: 'Opinion',
};

const typeBadgeColors: Record<ContentTypeValue, 'green' | 'purple' | 'orange'> = {
  guideline: 'green',
  asset: 'purple',
  opinion: 'orange',
};

export function ContentList({
  contents,
  isLoading,
  emptyMessage = 'No content items found',
  onSelect,
  onDelete,
  showActions = false,
}: ContentListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="h-5 w-1/3 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-2/3 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contents.map((content) => (
        <ContentListItem
          key={content.id}
          content={content}
          onSelect={onSelect}
          onDelete={onDelete}
          showActions={showActions}
        />
      ))}
    </div>
  );
}

interface ContentListItemProps {
  content: ContentSummary;
  onSelect?: (content: ContentSummary) => void;
  onDelete?: (content: ContentSummary) => void;
  showActions?: boolean;
}

const ContentListItem = memo(function ContentListItem({
  content,
  onSelect,
  onDelete,
  showActions = false,
}: ContentListItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMutation = useDeleteContent(content.branchId);

  const formattedDate = new Date(content.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(content.id);
      setShowDeleteDialog(false);
      onDelete?.(content);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete content');
    }
  };

  return (
    <>
      <Card style={{ cursor: 'pointer' }}>
        <div className="flex items-start justify-between">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onSelect?.(content)}
          >
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-medium text-gray-900">{content.title}</h3>
              <Badge color={typeBadgeColors[content.contentType]} variant="soft" radius="full" size="1">
                {typeLabels[content.contentType]}
              </Badge>
            </div>

            {content.description && (
              <p className="mt-1 truncate text-sm text-gray-500">{content.description}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {content.category && (
                <>
                  <span>{content.category}</span>
                  <span>&middot;</span>
                </>
              )}
              <span>by {content.createdBy.displayName}</span>
              <span>&middot;</span>
              <span>Updated {formattedDate}</span>
            </div>

            {content.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {content.tags.slice(0, 5).map((tag) => (
                  <Badge key={tag} color="gray" variant="soft" size="1">
                    {tag}
                  </Badge>
                ))}
                {content.tags.length > 5 && (
                  <span className="text-xs text-gray-400">+{content.tags.length - 5} more</span>
                )}
              </div>
            )}
          </button>

          {showActions && (
            <IconButton
              variant="ghost"
              color="red"
              title="Delete content"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <TrashIcon />
            </IconButton>
          )}
        </div>
      </Card>

      <DeleteContentDialog
        contentTitle={content.title}
        isOpen={showDeleteDialog}
        isDeleting={deleteMutation.isPending}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </>
  );
});

export default ContentList;
