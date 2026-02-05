/**
 * FullArticleDiffView - Displays full article content with diff highlighting.
 *
 * Unified view: Renders as prose with markdown formatting, metadata highlighting.
 * Split view: Side-by-side prose panels showing old and new versions.
 */

import { Link } from 'react-router-dom';
import type { FileDiff } from '@echo-portal/shared';
import type { ReviewComment } from '../../services/reviewService';
import { DiffMarkdownRenderer } from './DiffMarkdownRenderer';
import { InlineCommentForm } from './InlineCommentForm';
import styles from './FullArticleDiffView.module.css';

interface FullArticleDiffViewProps {
  file: FileDiff;
  displayMode: 'unified' | 'split';
  getComments: (path: string, line: number, side: 'old' | 'new') => ReviewComment[];
  onLineClick?: (line: number, side: 'old' | 'new') => void;
  /** Currently active comment form location (path already filtered by parent) */
  commentingAt?: { line: number; side: 'old' | 'new' } | null;
  /** Called when user submits a comment */
  onSubmitComment?: (content: string) => Promise<void>;
  /** Called when user cancels the comment form */
  onCancelComment?: () => void;
}

export function FullArticleDiffView({
  file,
  displayMode,
  getComments,
  onLineClick,
  commentingAt,
  onSubmitComment,
  onCancelComment,
}: FullArticleDiffViewProps) {
  const { fullContent, hunks, additions, deletions } = file;

  if (!fullContent) {
    return (
      <div className={styles.error}>
        No full content available. Falling back to hunk view.
      </div>
    );
  }

  const { oldContent, newContent, metadata } = fullContent;

  // Render unified prose view
  if (displayMode === 'unified') {
    return (
      <UnifiedArticleView
        oldContent={oldContent}
        newContent={newContent}
        metadata={metadata}
        filePath={file.path}
        onLineClick={onLineClick}
        commentingAt={commentingAt}
        onSubmitComment={onSubmitComment}
        onCancelComment={onCancelComment}
      />
    );
  }

  // Render split view
  return (
    <SplitArticleView
      oldContent={oldContent}
      newContent={newContent}
      metadata={metadata}
      hunks={hunks}
      additions={additions}
      deletions={deletions}
      getComments={getComments}
      onLineClick={onLineClick}
      filePath={file.path}
    />
  );
}

/**
 * Unified view - Full rendered article as clean prose.
 * Metadata changes shown in header, body rendered without highlighting.
 * Changed content is clickable to add comments.
 */
function UnifiedArticleView({
  oldContent,
  newContent,
  metadata,
  filePath,
  onLineClick,
  commentingAt,
  onSubmitComment,
  onCancelComment,
}: {
  oldContent: string | null;
  newContent: string | null;
  metadata: {
    old: { title: string; description: string | null; category: string | null; tags: string[] } | null;
    new: { title: string; description: string | null; category: string | null; tags: string[] } | null;
  };
  filePath: string;
  onLineClick?: (line: number, side: 'old' | 'new') => void;
  commentingAt?: { line: number; side: 'old' | 'new' } | null;
  onSubmitComment?: (content: string) => Promise<void>;
  onCancelComment?: () => void;
}) {
  const currentMeta = metadata.new || metadata.old;
  const body = newContent || oldContent || '';

  // Check specific field changes for highlighting
  const titleChanged = metadata.old && metadata.new && metadata.old.title !== metadata.new.title;
  const descriptionChanged = metadata.old && metadata.new && metadata.old.description !== metadata.new.description;
  const categoryChanged = metadata.old && metadata.new && metadata.old.category !== metadata.new.category;

  // Line numbers for clickable elements (conventional assignments for metadata)
  const TITLE_LINE = 1;
  const DESCRIPTION_LINE = 2;
  const CATEGORY_LINE = 3;

  // Helper to make changed content clickable (className handled separately to preserve highlighting)
  const clickableProps = (line: number, side: 'old' | 'new') => {
    if (!onLineClick) return {};
    return {
      onClick: () => onLineClick(line, side),
      role: 'button' as const,
      tabIndex: 0,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onLineClick(line, side);
        }
      },
    };
  };

  // Check if comment form should show for a specific line
  const showCommentFormAt = (line: number) => {
    return commentingAt?.line === line;
  };

  return (
    <article className={styles.article}>
      {/* Category breadcrumb */}
      {(currentMeta?.category || (categoryChanged && metadata.old?.category)) && (
        <div className={styles.breadcrumb}>
          {categoryChanged && metadata.old?.category && (
            <span
              className={`${styles.highlightDeletion} ${onLineClick ? styles.clickableContent : ''}`}
              {...(categoryChanged ? clickableProps(CATEGORY_LINE, 'old') : {})}
            >
              {metadata.old.category}
            </span>
          )}
          {currentMeta?.category && (
            <Link
              to={`/?category=${encodeURIComponent(currentMeta.category)}`}
              className={`${categoryChanged ? styles.highlightAddition : ''} ${categoryChanged && onLineClick ? styles.clickableContent : ''}`}
              onClick={categoryChanged && onLineClick ? (e) => {
                e.preventDefault();
                onLineClick(CATEGORY_LINE, 'new');
              } : undefined}
            >
              {currentMeta.category}
            </Link>
          )}
        </div>
      )}

      {/* Comment form for category */}
      {showCommentFormAt(CATEGORY_LINE) && onSubmitComment && onCancelComment && (
        <div className={styles.commentFormContainer}>
          <InlineCommentForm
            path={filePath}
            line={CATEGORY_LINE}
            side={commentingAt!.side}
            onSubmit={onSubmitComment}
            onCancel={onCancelComment}
            placeholder="Add a comment about the category change..."
          />
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        {/* Title: show old (red) then new (green) if changed */}
        {titleChanged && metadata.old?.title && (
          <h1
            className={`${styles.title} ${styles.highlightDeletion} ${onLineClick ? styles.clickableContent : ''}`}
            {...clickableProps(TITLE_LINE, 'old')}
          >
            {metadata.old.title}
          </h1>
        )}
        <h1
          className={`${styles.title} ${titleChanged ? styles.highlightAddition : ''} ${titleChanged && onLineClick ? styles.clickableContent : ''}`}
          {...(titleChanged ? clickableProps(TITLE_LINE, 'new') : {})}
        >
          {currentMeta?.title}
        </h1>

        {/* Comment form for title */}
        {showCommentFormAt(TITLE_LINE) && onSubmitComment && onCancelComment && (
          <div className={styles.commentFormContainer}>
            <InlineCommentForm
              path={filePath}
              line={TITLE_LINE}
              side={commentingAt!.side}
              onSubmit={onSubmitComment}
              onCancel={onCancelComment}
              placeholder="Add a comment about the title change..."
            />
          </div>
        )}

        {/* Description: show old (red) then new (green) if changed */}
        {descriptionChanged && metadata.old?.description && (
          <p
            className={`${styles.description} ${styles.highlightDeletion} ${onLineClick ? styles.clickableContent : ''}`}
            {...clickableProps(DESCRIPTION_LINE, 'old')}
          >
            {metadata.old.description}
          </p>
        )}
        {currentMeta?.description && (
          <p
            className={`${styles.description} ${descriptionChanged ? styles.highlightAddition : ''} ${descriptionChanged && onLineClick ? styles.clickableContent : ''}`}
            {...(descriptionChanged ? clickableProps(DESCRIPTION_LINE, 'new') : {})}
          >
            {currentMeta.description}
          </p>
        )}

        {/* Comment form for description */}
        {showCommentFormAt(DESCRIPTION_LINE) && onSubmitComment && onCancelComment && (
          <div className={styles.commentFormContainer}>
            <InlineCommentForm
              path={filePath}
              line={DESCRIPTION_LINE}
              side={commentingAt!.side}
              onSubmit={onSubmitComment}
              onCancel={onCancelComment}
              placeholder="Add a comment about the description change..."
            />
          </div>
        )}
      </header>

      {/* Body rendered as clean prose */}
      <div className={styles.body}>
        <DiffMarkdownRenderer content={body} />
      </div>
    </article>
  );
}

/**
 * Split view - Side-by-side prose panels showing old and new versions.
 * Uses rendered markdown like the unified view.
 */
function SplitArticleView({
  oldContent,
  newContent,
  metadata,
  additions,
  deletions,
}: {
  oldContent: string | null;
  newContent: string | null;
  metadata: {
    old: { title: string; description: string | null; category: string | null; tags: string[] } | null;
    new: { title: string; description: string | null; category: string | null; tags: string[] } | null;
  };
  hunks: FileDiff['hunks'];
  additions: number;
  deletions: number;
  getComments: (path: string, line: number, side: 'old' | 'new') => ReviewComment[];
  onLineClick?: (line: number, side: 'old' | 'new') => void;
  filePath: string;
}) {
  // Check specific field changes for highlighting
  const titleChanged = metadata.old && metadata.new && metadata.old.title !== metadata.new.title;
  const descriptionChanged = metadata.old && metadata.new && metadata.old.description !== metadata.new.description;
  const categoryChanged = metadata.old && metadata.new && metadata.old.category !== metadata.new.category;

  const renderPanel = (side: 'old' | 'new') => {
    const isOld = side === 'old';
    const count = isOld ? deletions : additions;
    const label = isOld ? 'removals' : 'additions';
    const meta = isOld ? metadata.old : metadata.new;
    const body = isOld ? (oldContent || '') : (newContent || '');
    const highlightClass = isOld ? styles.highlightDeletion : styles.highlightAddition;

    return (
      <div className={`${styles.panel} ${isOld ? styles.panelOld : styles.panelNew}`}>
        {/* Panel header with counts */}
        {count > 0 && (
          <div className={`${styles.panelHeader} ${isOld ? styles.panelHeaderOld : styles.panelHeaderNew}`}>
            <span className={styles.panelHeaderIcon}>
              {isOld ? '\u2296' : '\u2295'}
            </span>
            <span className={styles.panelHeaderCount}>
              {count} {label}
            </span>
          </div>
        )}

        {/* Article content */}
        <article className={styles.splitArticle}>
          {/* Category */}
          {meta?.category && (
            <div className={`${styles.breadcrumb} ${categoryChanged ? highlightClass : ''}`}>
              {meta.category}
            </div>
          )}

          {/* Title */}
          {meta?.title && (
            <h1 className={`${styles.splitTitle} ${titleChanged ? highlightClass : ''}`}>
              {meta.title}
            </h1>
          )}

          {/* Description */}
          {meta?.description && (
            <p className={`${styles.splitDescription} ${descriptionChanged ? highlightClass : ''}`}>
              {meta.description}
            </p>
          )}

          {/* Body */}
          {body && (
            <div className={styles.splitBody}>
              <DiffMarkdownRenderer content={body} />
            </div>
          )}
        </article>
      </div>
    );
  };

  return (
    <div className={styles.splitContainer}>
      {renderPanel('old')}
      {renderPanel('new')}
    </div>
  );
}

export default FullArticleDiffView;
