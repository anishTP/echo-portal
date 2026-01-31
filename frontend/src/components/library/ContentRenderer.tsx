import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { Badge, Button, Callout } from '@radix-ui/themes';
import { Pencil1Icon } from '@radix-ui/react-icons';
import type { ContentDetail } from '@echo-portal/shared';
import styles from './ContentRenderer.module.css';
import { useAuth } from '../../hooks/useAuth';

const typeBadgeColors: Record<string, 'green' | 'purple' | 'orange' | 'gray'> = {
  guideline: 'green',
  asset: 'purple',
  opinion: 'orange',
};

interface ContentRendererProps {
  content: ContentDetail | null;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  /** Callback when user clicks Edit button. If not provided, edit button is hidden. */
  onEditRequest?: () => void;
  /** Whether viewing content from a draft branch (enables Edit button for unpublished content) */
  branchMode?: boolean;
}

/**
 * Heading renderer that adds IDs for TOC linking
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

  const className = styles[`heading${level}` as keyof typeof styles];

  const props = { id, className };

  switch (level) {
    case 1: return <h1 {...props}>{children}</h1>;
    case 2: return <h2 {...props}>{children}</h2>;
    case 3: return <h3 {...props}>{children}</h3>;
    case 4: return <h4 {...props}>{children}</h4>;
    case 5: return <h5 {...props}>{children}</h5>;
    case 6: return <h6 {...props}>{children}</h6>;
    default: return <p {...props}>{children}</p>;
  }
}

function LoadingSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonBadge} />
      <div className={styles.skeletonTitle} />
      <div className={styles.skeletonDescription} />
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonLine} style={{ width: '100%' }} />
        <div className={styles.skeletonLine} style={{ width: '85%' }} />
        <div className={styles.skeletonLine} style={{ width: '70%' }} />
        <div className={styles.skeletonLine} style={{ width: '90%' }} />
        <div className={styles.skeletonLine} style={{ width: '75%' }} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <svg
        className={styles.emptyIcon}
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
      <h3 className={styles.emptyTitle}>Select content to view</h3>
      <p className={styles.emptyDescription}>
        Choose an item from the sidebar to view its documentation.
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
        <p className="mt-1">Something went wrong while loading this content.</p>
        {onRetry && (
          <Button color="red" size="2" onClick={onRetry} className="mt-3">
            Try Again
          </Button>
        )}
      </Callout.Text>
    </Callout.Root>
  );
}

/**
 * Renders published content as markdown documentation
 */
export function ContentRenderer({
  content,
  isLoading,
  isError,
  onRetry,
  onEditRequest,
  branchMode = false,
}: ContentRendererProps) {
  const { isAuthenticated, user } = useAuth();

  // Check if user can edit (authenticated with contributor role)
  const canEdit = isAuthenticated && user?.roles?.some(
    (role: string) => ['contributor', 'reviewer', 'publisher', 'administrator'].includes(role)
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return <ErrorState onRetry={onRetry} />;
  }

  if (!content) {
    return <EmptyState />;
  }

  const body = content.currentVersion?.body || '';

  return (
    <article className={styles.article}>
      {/* Breadcrumb */}
      {content.category && (
        <div className={styles.breadcrumb}>
          <Link to={`/?category=${encodeURIComponent(content.category)}`}>
            {content.category}
          </Link>
        </div>
      )}

      {/* Header with Edit button */}
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>{content.title}</h1>
          {canEdit && (content.isPublished || branchMode) && onEditRequest && (
            <Button
              variant="soft"
              size="2"
              onClick={onEditRequest}
              className={styles.editButton}
            >
              <Pencil1Icon />
              Edit
            </Button>
          )}
        </div>
        {content.description && (
          <p className={styles.description}>{content.description}</p>
        )}
      </header>

      {/* Body */}
      <div className={styles.body}>
        <Markdown
          components={{
            h1: ({ children }) => <HeadingRenderer level={1}>{children}</HeadingRenderer>,
            h2: ({ children }) => <HeadingRenderer level={2}>{children}</HeadingRenderer>,
            h3: ({ children }) => <HeadingRenderer level={3}>{children}</HeadingRenderer>,
            h4: ({ children }) => <HeadingRenderer level={4}>{children}</HeadingRenderer>,
            h5: ({ children }) => <HeadingRenderer level={5}>{children}</HeadingRenderer>,
            h6: ({ children }) => <HeadingRenderer level={6}>{children}</HeadingRenderer>,
            p: ({ children }) => <p className={styles.paragraph}>{children}</p>,
            ul: ({ children }) => <ul className={styles.list}>{children}</ul>,
            ol: ({ children }) => <ol className={styles.orderedList}>{children}</ol>,
            li: ({ children }) => <li className={styles.listItem}>{children}</li>,
            a: ({ href, children }) => (
              <a
                href={href}
                className={styles.link}
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
                  <pre className={styles.codeBlock}>
                    <code>{children}</code>
                  </pre>
                );
              }
              return <code className={styles.inlineCode}>{children}</code>;
            },
            blockquote: ({ children }) => (
              <blockquote className={styles.blockquote}>{children}</blockquote>
            ),
          }}
        >
          {body}
        </Markdown>
      </div>

      {/* Footer metadata */}
      <footer className={styles.footer}>
        <div className={styles.metadata}>
          <Badge
            color={typeBadgeColors[content.contentType] || 'gray'}
            variant="soft"
            radius="full"
            size="1"
          >
            {content.contentType.charAt(0).toUpperCase() + content.contentType.slice(1)}
          </Badge>
          <span className={styles.metaItem}>
            By {content.createdBy.displayName}
          </span>
          {content.publishedAt && (
            <span className={styles.metaItem}>
              {new Date(content.publishedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
        {content.tags.length > 0 && (
          <div className={styles.tags}>
            {content.tags.map((tag: string) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </footer>
    </article>
  );
}

export default ContentRenderer;
