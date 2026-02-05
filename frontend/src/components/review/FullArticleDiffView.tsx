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
import styles from './FullArticleDiffView.module.css';

interface FullArticleDiffViewProps {
  file: FileDiff;
  displayMode: 'unified' | 'split';
  getComments: (path: string, line: number, side: 'old' | 'new') => ReviewComment[];
  onLineClick?: (line: number, side: 'old' | 'new') => void;
}

export function FullArticleDiffView({
  file,
  displayMode,
  getComments,
  onLineClick,
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
 */
function UnifiedArticleView({
  oldContent,
  newContent,
  metadata,
}: {
  oldContent: string | null;
  newContent: string | null;
  metadata: {
    old: { title: string; description: string | null; category: string | null; tags: string[] } | null;
    new: { title: string; description: string | null; category: string | null; tags: string[] } | null;
  };
}) {
  const currentMeta = metadata.new || metadata.old;
  const body = newContent || oldContent || '';

  // Check specific field changes for highlighting
  const titleChanged = metadata.old && metadata.new && metadata.old.title !== metadata.new.title;
  const descriptionChanged = metadata.old && metadata.new && metadata.old.description !== metadata.new.description;
  const categoryChanged = metadata.old && metadata.new && metadata.old.category !== metadata.new.category;

  return (
    <article className={styles.article}>
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
              className={categoryChanged ? styles.highlightAddition : ''}
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
