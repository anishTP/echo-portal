/**
 * FullArticleDiffView - Displays full article content with diff highlighting.
 *
 * Unified view: Renders as prose with markdown formatting, metadata highlighting.
 * Split view: Side-by-side prose panels showing old and new versions.
 *
 * Commenting is selection-based: select any text to add a comment.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { FileDiff } from '@echo-portal/shared';
import type { TextSelection } from '../../hooks/useTextSelection';
import type { ReviewComment } from '../../services/reviewService';
import { useTextSelection } from '../../hooks/useTextSelection';
import { DiffMarkdownRenderer } from './DiffMarkdownRenderer';
import { CommentPopover } from './CommentPopover';
import { CommentHighlights } from './CommentHighlights';
import styles from './FullArticleDiffView.module.css';

interface FullArticleDiffViewProps {
  file: FileDiff;
  displayMode: 'unified' | 'split';
  /** Comments for this file (used to display highlights) */
  comments?: ReviewComment[];
  /** Called when user submits a comment on selected text */
  onSubmitComment?: (content: string, selection: TextSelection) => Promise<void>;
}

export function FullArticleDiffView({
  file,
  displayMode,
  comments,
  onSubmitComment,
}: FullArticleDiffViewProps) {
  const { fullContent, additions, deletions } = file;

  // Filter comments for this file
  const fileComments = comments?.filter((c) => c.path === file.path) || [];

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
        comments={fileComments}
        onSubmitComment={onSubmitComment}
      />
    );
  }

  // Render split view
  return (
    <SplitArticleView
      oldContent={oldContent}
      newContent={newContent}
      metadata={metadata}
      additions={additions}
      deletions={deletions}
      comments={fileComments}
      onSubmitComment={onSubmitComment}
    />
  );
}

/**
 * Unified view - Full rendered article as clean prose.
 * Metadata changes shown in header, body rendered without highlighting.
 * Select any text to add comments.
 */
function UnifiedArticleView({
  oldContent,
  newContent,
  metadata,
  comments,
  onSubmitComment,
}: {
  oldContent: string | null;
  newContent: string | null;
  metadata: {
    old: { title: string; description: string | null; category: string | null; tags: string[] } | null;
    new: { title: string; description: string | null; category: string | null; tags: string[] } | null;
  };
  comments?: ReviewComment[];
  onSubmitComment?: (content: string, selection: TextSelection) => Promise<void>;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const { selection, clearSelection } = useTextSelection(articleRef);

  const currentMeta = metadata.new || metadata.old;
  const body = newContent || oldContent || '';

  // Check specific field changes for highlighting
  const titleChanged = metadata.old && metadata.new && metadata.old.title !== metadata.new.title;
  const descriptionChanged = metadata.old && metadata.new && metadata.old.description !== metadata.new.description;
  const categoryChanged = metadata.old && metadata.new && metadata.old.category !== metadata.new.category;

  const handleSubmitComment = async (content: string) => {
    if (selection && onSubmitComment) {
      await onSubmitComment(content, selection);
      clearSelection();
    }
  };

  return (
    <article ref={articleRef} className={styles.article}>
      {/* Category breadcrumb */}
      {(currentMeta?.category || (categoryChanged && metadata.old?.category)) && (
        <div className={styles.breadcrumb}>
          {categoryChanged && metadata.old?.category && (
            <span className={styles.highlightDeletion}>
              {metadata.old.category}
            </span>
          )}
          {currentMeta?.category && (
            <Link
              to={`/?category=${encodeURIComponent(currentMeta.category)}`}
              className={categoryChanged ? styles.highlightAddition : undefined}
            >
              {currentMeta.category}
            </Link>
          )}
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        {/* Title: show old (red) then new (green) if changed */}
        {titleChanged && metadata.old?.title && (
          <h1 className={`${styles.title} ${styles.highlightDeletion}`}>
            {metadata.old.title}
          </h1>
        )}
        <h1 className={`${styles.title} ${titleChanged ? styles.highlightAddition : ''}`}>
          {currentMeta?.title}
        </h1>

        {/* Description: show old (red) then new (green) if changed */}
        {descriptionChanged && metadata.old?.description && (
          <p className={`${styles.description} ${styles.highlightDeletion}`}>
            {metadata.old.description}
          </p>
        )}
        {currentMeta?.description && (
          <p className={`${styles.description} ${descriptionChanged ? styles.highlightAddition : ''}`}>
            {currentMeta.description}
          </p>
        )}
      </header>

      {/* Body rendered as clean prose */}
      <div className={styles.body}>
        <DiffMarkdownRenderer content={body} />
      </div>

      {/* Comment highlight overlays */}
      {comments && comments.length > 0 && (
        <CommentHighlights
          comments={comments}
          containerRef={articleRef}
        />
      )}

      {/* Floating comment popover on text selection */}
      {selection && onSubmitComment && (
        <CommentPopover
          selection={selection}
          onSubmit={handleSubmitComment}
          onCancel={clearSelection}
        />
      )}
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
  comments,
  onSubmitComment,
}: {
  oldContent: string | null;
  newContent: string | null;
  metadata: {
    old: { title: string; description: string | null; category: string | null; tags: string[] } | null;
    new: { title: string; description: string | null; category: string | null; tags: string[] } | null;
  };
  additions: number;
  deletions: number;
  comments?: ReviewComment[];
  onSubmitComment?: (content: string, selection: TextSelection) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(containerRef);

  // Check specific field changes for highlighting
  const titleChanged = metadata.old && metadata.new && metadata.old.title !== metadata.new.title;
  const descriptionChanged = metadata.old && metadata.new && metadata.old.description !== metadata.new.description;
  const categoryChanged = metadata.old && metadata.new && metadata.old.category !== metadata.new.category;

  const handleSubmitComment = async (content: string) => {
    if (selection && onSubmitComment) {
      await onSubmitComment(content, selection);
      clearSelection();
    }
  };

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
    <div ref={containerRef} className={styles.splitContainer}>
      {renderPanel('old')}
      {renderPanel('new')}

      {/* Note: Comment highlights are disabled in split view because the character
          offsets are calculated for unified view's single-column layout. Comments
          can be viewed and added in unified view. */}

      {/* Floating comment popover on text selection */}
      {selection && onSubmitComment && (
        <CommentPopover
          selection={selection}
          onSubmit={handleSubmitComment}
          onCancel={clearSelection}
        />
      )}
    </div>
  );
}

export default FullArticleDiffView;
