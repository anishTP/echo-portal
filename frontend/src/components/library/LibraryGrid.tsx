import { Button, Callout } from '@radix-ui/themes';
import type { ContentSummary } from '@echo-portal/shared';
import { ContentCard } from './ContentCard';

interface LibraryGridProps {
  items: ContentSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-5"
        >
          <div className="h-5 w-20 rounded bg-gray-200" />
          <div className="mt-3 h-6 w-3/4 rounded bg-gray-200" />
          <div className="mt-2 space-y-2">
            <div className="h-4 w-full rounded bg-gray-200" />
            <div className="h-4 w-5/6 rounded bg-gray-200" />
            <div className="h-4 w-4/6 rounded bg-gray-200" />
          </div>
          <div className="mt-4 flex gap-4">
            <div className="h-3 w-16 rounded bg-gray-200" />
            <div className="h-3 w-20 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
      <svg
        className="h-16 w-16 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900">No content found</h3>
      <p className="mt-2 text-sm text-gray-500">
        Try adjusting your search or filters to find what you're looking for.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Callout.Root color="red" size="3">
      <Callout.Icon>
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </Callout.Icon>
      <Callout.Text>
        <strong>Failed to load content</strong>
        <p className="mt-1">Something went wrong while loading the content library.</p>
        {onRetry && (
          <Button color="red" size="2" onClick={onRetry} className="mt-3">
            Try Again
          </Button>
        )}
      </Callout.Text>
    </Callout.Root>
  );
}

export function LibraryGrid({ items, isLoading, isError, onRetry }: LibraryGridProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return <ErrorState onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ContentCard key={item.id} content={item} />
      ))}
    </div>
  );
}

export default LibraryGrid;
