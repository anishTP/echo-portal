import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { Badge } from '@radix-ui/themes';
import { useContentBySlug } from '../hooks/usePublishedContent';
import { TableOfContents } from '../components/library';

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
      <div className="h-4 w-32 rounded bg-gray-200" />
      <div className="mt-4 h-8 w-3/4 rounded bg-gray-200" />
      <div className="mt-4 flex gap-4">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-4 w-24 rounded bg-gray-200" />
      </div>
      <div className="mt-8 space-y-3">
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-200" />
        <div className="h-4 w-4/6 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-3/4 rounded bg-gray-200" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg
        className="h-24 w-24 text-gray-300"
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
      <h2 className="mt-4 text-2xl font-bold text-gray-900">Content Not Found</h2>
      <p className="mt-2 text-gray-600">
        The content you're looking for doesn't exist or has been removed.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Back to Library
      </Link>
    </div>
  );
}

export default function ContentView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: content, isLoading, isError } = useContentBySlug(slug);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <LoadingSkeleton />
        </main>
      </div>
    );
  }

  if (isError || !content) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <NotFound />
        </main>
      </div>
    );
  }

  const publishedDate = content.publishedAt
    ? new Date(content.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const body = content.currentVersion?.body || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="hover:text-gray-700">
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
                className="hover:text-gray-700"
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
          <span className="text-gray-900">{content.title}</span>
        </nav>

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Content area */}
          <article className="lg:col-span-3">
            {/* Header */}
            <header className="mb-8 rounded-lg bg-white p-6 shadow-sm">
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
              <h1 className="mt-4 text-3xl font-bold text-gray-900">{content.title}</h1>

              {/* Description */}
              {content.description && (
                <p className="mt-3 text-lg text-gray-600">{content.description}</p>
              )}

              {/* Metadata */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Published {publishedDate}
                  </span>
                )}
              </div>
            </header>

            {/* Body content */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
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
                        className="text-blue-600 hover:underline"
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
                          <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                            <code>{children}</code>
                          </pre>
                        );
                      }
                      return (
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800">
                          {children}
                        </code>
                      );
                    },
                    blockquote: ({ children }) => (
                      <blockquote className="mb-4 border-l-4 border-gray-300 pl-4 italic text-gray-600">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {body}
                </Markdown>
              </div>

              {/* Tags */}
              {content.tags.length > 0 && (
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="mb-3 text-sm font-medium text-gray-500">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {content.tags.map((tag) => (
                      <Badge key={tag} color="gray" variant="soft" radius="full" size="2">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Back to Library */}
            <div className="mt-6">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
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

          {/* Sidebar - Table of Contents */}
          <aside className="hidden lg:block">
            <TableOfContents markdown={body} />
          </aside>
        </div>
      </main>
    </div>
  );
}
