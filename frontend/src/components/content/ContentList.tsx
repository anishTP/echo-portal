import { memo } from 'react';
import type { ContentSummary, ContentTypeValue } from '@echo-portal/shared';

interface ContentListProps {
  contents: ContentSummary[];
  isLoading?: boolean;
  emptyMessage?: string;
  onSelect?: (content: ContentSummary) => void;
}

const typeLabels: Record<ContentTypeValue, string> = {
  guideline: 'Guideline',
  asset: 'Asset',
  opinion: 'Opinion',
};

const typeColors: Record<ContentTypeValue, string> = {
  guideline: 'bg-green-100 text-green-800',
  asset: 'bg-purple-100 text-purple-800',
  opinion: 'bg-amber-100 text-amber-800',
};

export function ContentList({
  contents,
  isLoading,
  emptyMessage = 'No content items found',
  onSelect,
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
        <ContentListItem key={content.id} content={content} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface ContentListItemProps {
  content: ContentSummary;
  onSelect?: (content: ContentSummary) => void;
}

const ContentListItem = memo(function ContentListItem({
  content,
  onSelect,
}: ContentListItemProps) {
  const formattedDate = new Date(content.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <button
      type="button"
      onClick={() => onSelect?.(content)}
      className="block w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-medium text-gray-900">{content.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[content.contentType]}`}
            >
              {typeLabels[content.contentType]}
            </span>
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
                <span
                  key={tag}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {tag}
                </span>
              ))}
              {content.tags.length > 5 && (
                <span className="text-xs text-gray-400">+{content.tags.length - 5} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

export default ContentList;
