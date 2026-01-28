import { Link } from 'react-router-dom';
import type { ContentSummary } from '@echo-portal/shared';

interface ContentCardProps {
  content: ContentSummary;
}

const typeStyles: Record<string, string> = {
  guideline: 'bg-green-100 text-green-800',
  asset: 'bg-purple-100 text-purple-800',
  opinion: 'bg-amber-100 text-amber-800',
};

export function ContentCard({ content }: ContentCardProps) {
  const publishedDate = content.publishedAt
    ? new Date(content.publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Link
      to={`/library/${content.slug}`}
      className="group block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
    >
      {/* Type Badge */}
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeStyles[content.contentType] || 'bg-gray-100 text-gray-800'}`}
      >
        {content.contentType.charAt(0).toUpperCase() + content.contentType.slice(1)}
      </span>

      {/* Title */}
      <h3 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-blue-600">
        {content.title}
      </h3>

      {/* Description */}
      {content.description && (
        <p className="mt-2 line-clamp-3 text-sm text-gray-600">{content.description}</p>
      )}

      {/* Metadata */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
        {content.category && (
          <span className="inline-flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            {content.category}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {content.createdBy.displayName}
        </span>
        {publishedDate && (
          <span className="inline-flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {publishedDate}
          </span>
        )}
      </div>

      {/* Tags */}
      {content.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {content.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {tag}
            </span>
          ))}
          {content.tags.length > 3 && (
            <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              +{content.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

export default ContentCard;
