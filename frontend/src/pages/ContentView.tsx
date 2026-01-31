import { useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { Badge } from '@radix-ui/themes';
import { useContentBySlug, useCategories } from '../hooks/usePublishedContent';
import { DocumentationLayout } from '../components/layout';
import { LibrarySidebar, ContentMetadataSidebar } from '../components/library';

type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

const typeBadgeColors: Record<string, 'green' | 'purple' | 'orange' | 'gray'> = {
  guideline: 'green',
  asset: 'purple',
  opinion: 'orange',
};

/**
 * Custom heading renderer that adds IDs for TOC linking
 */
function HeadingRenderer({
  level,
  children,
}: {
  level: number;
  children: React.ReactNode;
}) {
  const text = String(children);
  const id = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');

  const styles: Record<number, string> = {
    1: 'text-3xl font-bold mt-8 mb-4',
    2: 'text-2xl font-bold mt-6 mb-3',
    3: 'text-xl font-semibold mt-5 mb-2',
    4: 'text-lg font-semibold mt-4 mb-2',
    5: 'text-base font-semibold mt-3 mb-1',
    6: 'text-sm font-semibold mt-3 mb-1',
  };

  const className = styles[level];

  switch (level) {
    case 1:
      return <h1 id={id} className={className}>{children}</h1>;
    case 2:
      return <h2 id={id} className={className}>{children}</h2>;
    case 3:
      return <h3 id={id} className={className}>{children}</h3>;
    case 4:
      return <h4 id={id} className={className}>{children}</h4>;
    case 5:
      return <h5 id={id} className={className}>{children}</h5>;
    case 6:
      return <h6 id={id} className={className}>{children}</h6>;
    default:
      return <p id={id} className={className}>{children}</p>;
  }
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-32 rounded" style={{ background: 'var(--gray-4)' }} />
      <div className="mt-4 h-8 w-3/4 rounded" style={{ background: 'var(--gray-4)' }} />
      <div className="mt-4 flex gap-4">
        <div className="h-4 w-24 rounded" style={{ background: 'var(--gray-4)' }} />
        <div className="h-4 w-24 rounded" style={{ background: 'var(--gray-4)' }} />
      </div>
      <div className="mt-8 space-y-3">
        <div className="h-4 w-full rounded" style={{ background: 'var(--gray-4)' }} />
        <div className="h-4 w-5/6 rounded" style={{ background: 'var(--gray-4)' }} />
        <div className="h-4 w-4/6 rounded" style={{ background: 'var(--gray-4)' }} />
        <div className="h-4 w-full rounded" style={{ background: 'var(--gray-4)' }} />
        <div className="h-4 w-3/4 rounded" style={{ background: 'var(--gray-4)' }} />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg
        className="h-24 w-24"
        style={{ color: 'var(--gray-6)' }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h2 className="mt-4 text-2xl font-bold" style={{ color: 'var(--gray-12)' }}>Content Not Found</h2>
      <p className="mt-2" style={{ color: 'var(--gray-11)' }}>
        The content you're looking for doesn't exist or has been removed.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: 'var(--accent-9)' }}
      >
        Back to Library
      </Link>
    </div>
  );
}

/**
 * Sidebar wrapper for ContentView page
 * Provides navigation context while viewing content
 */
function ContentViewSidebar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, categoryCounts } = useCategories();

  const type = (searchParams.get('type') as ContentType) || 'all';
  const category = searchParams.get('category') || '';
  const search = searchParams.get('q') || '';

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === '' || value === 'all') {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        });
        return next;
      });
    },
    [setSearchParams]
  );

  return (
    <LibrarySidebar
      search={search}
      onSearchChange={(v) => updateParams({ q: v })}
      contentType={type}
      onContentTypeChange={(v) => updateParams({ type: v })}
      category={category}
      onCategoryChange={(v) => updateParams({ category: v === '' ? null : v })}
      categories={categories}
      categoryCounts={categoryCounts}
      onClearFilters={() => updateParams({ type: null, category: null, q: null })}
      hasActiveFilters={type !== 'all' || category !== '' || search !== ''}
    />
  );
}

export default function ContentView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: content, isLoading, isError } = useContentBySlug(slug);

  // Loading state
  if (isLoading) {
    return (
      <DocumentationLayout sidebar={<ContentViewSidebar />}>
        <LoadingSkeleton />
      </DocumentationLayout>
    );
  }

  // Error/not found state
  if (isError || !content) {
    return (
      <DocumentationLayout sidebar={<ContentViewSidebar />}>
        <NotFound />
      </DocumentationLayout>
    );
  }

  const publishedDate = content.publishedAt
    ? new Date(content.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : undefined;

  const body = content.currentVersion?.body || '';

  return (
    <DocumentationLayout
      sidebar={<ContentViewSidebar />}
      rightSidebar={
        <ContentMetadataSidebar
          author={{
            name: content.createdBy.displayName,
            avatarUrl: content.createdBy.avatarUrl,
          }}
          publishedDate={publishedDate}
          category={content.category}
          tags={content.tags}
          markdown={body}
        />
      }
    >
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm" style={{ color: 'var(--gray-10)' }}>
        <Link to="/" style={{ color: 'var(--gray-10)' }} className="hover:underline">
          Library
        </Link>
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {content.category && (
          <>
            <Link
              to={`/?category=${encodeURIComponent(content.category)}`}
              style={{ color: 'var(--gray-10)' }}
              className="hover:underline"
            >
              {content.category}
            </Link>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </>
        )}
        <span style={{ color: 'var(--gray-12)' }}>{content.title}</span>
      </nav>

      {/* Article Content */}
      <article>
        {/* Header */}
        <header className="mb-8">
          {/* Type badge */}
          <Badge
            color={typeBadgeColors[content.contentType] || 'gray'}
            variant="soft"
            radius="full"
            size="2"
          >
            {content.contentType.charAt(0).toUpperCase() + content.contentType.slice(1)}
          </Badge>

          {/* Title */}
          <h1 className="mt-4 text-3xl font-bold" style={{ color: 'var(--gray-12)' }}>
            {content.title}
          </h1>

          {/* Description */}
          {content.description && (
            <p className="mt-3 text-lg" style={{ color: 'var(--gray-11)' }}>
              {content.description}
            </p>
          )}
        </header>

        {/* Body content */}
        <div className="prose prose-gray max-w-none">
          <Markdown
            components={{
              h1: ({ children }) => <HeadingRenderer level={1}>{children}</HeadingRenderer>,
              h2: ({ children }) => <HeadingRenderer level={2}>{children}</HeadingRenderer>,
              h3: ({ children }) => <HeadingRenderer level={3}>{children}</HeadingRenderer>,
              h4: ({ children }) => <HeadingRenderer level={4}>{children}</HeadingRenderer>,
              h5: ({ children }) => <HeadingRenderer level={5}>{children}</HeadingRenderer>,
              h6: ({ children }) => <HeadingRenderer level={6}>{children}</HeadingRenderer>,
              p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="mb-4 list-disc pl-6">{children}</ul>,
              ol: ({ children }) => <ol className="mb-4 list-decimal pl-6">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  style={{ color: 'var(--accent-11)' }}
                  className="hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                if (isBlock) {
                  return (
                    <pre
                      className="mb-4 overflow-x-auto rounded-lg p-4 text-sm"
                      style={{ background: 'var(--gray-2)', color: 'var(--gray-12)' }}
                    >
                      <code>{children}</code>
                    </pre>
                  );
                }
                return (
                  <code
                    className="rounded px-1.5 py-0.5 text-sm"
                    style={{ background: 'var(--gray-3)', color: 'var(--gray-12)' }}
                  >
                    {children}
                  </code>
                );
              },
              blockquote: ({ children }) => (
                <blockquote
                  className="mb-4 border-l-4 pl-4 italic"
                  style={{ borderColor: 'var(--gray-6)', color: 'var(--gray-11)' }}
                >
                  {children}
                </blockquote>
              ),
            }}
          >
            {body}
          </Markdown>
        </div>

        {/* Back to Library */}
        <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--gray-4)' }}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: 'var(--accent-11)' }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Library
          </Link>
        </div>
      </article>
    </DocumentationLayout>
  );
}
