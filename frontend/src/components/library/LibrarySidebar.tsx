import { useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MagnifyingGlassIcon, Cross2Icon, Pencil1Icon } from '@radix-ui/react-icons';
import type { ContentSummary, BranchStateType, ContentComparisonStats } from '@echo-portal/shared';
import { NavSection } from './NavSection';
import { LifecycleStatus } from '../branch/LifecycleStatus';
import { SubmitForReviewButton } from '../branch/SubmitForReviewButton';
import styles from './LibrarySidebar.module.css';

type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

const contentTypeFilters: { value: ContentType; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'gray' },
  { value: 'guideline', label: 'Guidelines', color: 'green' },
  { value: 'asset', label: 'Assets', color: 'purple' },
  { value: 'opinion', label: 'Opinions', color: 'orange' },
];

export interface LibrarySidebarProps {
  /** Current search query */
  search?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Current content type filter */
  contentType?: ContentType;
  /** Content type change handler */
  onContentTypeChange?: (value: ContentType) => void;
  /** Content items to display in sidebar */
  items?: ContentSummary[];
  /** Currently selected content slug (for published mode) */
  selectedSlug?: string;
  /** Currently selected content ID (for branch mode) */
  selectedContentId?: string;
  /** Handler for content selection in branch mode */
  onSelectContent?: (content: ContentSummary) => void;
  /** Handler to clear all filters */
  onClearFilters?: () => void;
  /** Whether any filters are active */
  hasActiveFilters?: boolean;
  /** Whether we're in branch mode */
  branchMode?: boolean;
  /** Name of the current branch (when in branch mode) */
  branchName?: string;
  /** State of the current branch (when in branch mode) */
  branchState?: BranchStateType;
  /** ID of the current branch (when in branch mode, for submit for review) */
  branchId?: string;
  /** Whether the user is the branch owner (required for submit for review) */
  isOwner?: boolean;
  /** Whether the branch can be submitted for review (from API permissions) */
  canSubmitForReview?: boolean;
  /** Callback when submit for review succeeds */
  onSubmitForReviewSuccess?: () => void;
  /** Callback to open the in-context review overlay (when branch is in review state) */
  onOpenReview?: () => void;
  /** Content comparison stats for review mode (per-item +X/-Y display) */
  reviewStats?: ContentComparisonStats;
}

// Git branch icon for branch mode indicator
const BranchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

/**
 * Library left sidebar
 *
 * Contains:
 * - Branch mode indicator (when viewing branch content)
 * - Search input with keyboard shortcut badge
 * - Content type filter pills
 * - Content items grouped by category
 */
export function LibrarySidebar({
  search = '',
  onSearchChange,
  contentType = 'all',
  onContentTypeChange,
  items = [],
  selectedSlug,
  selectedContentId,
  onSelectContent,
  onClearFilters,
  hasActiveFilters = false,
  branchMode = false,
  branchName,
  branchState,
  branchId,
  isOwner = false,
  canSubmitForReview = false,
  onSubmitForReviewSuccess,
  onOpenReview,
  reviewStats,
}: LibrarySidebarProps) {
  const location = useLocation();

  // Check if any content has been edited (for visual indicator in items list)
  // This is only used for the per-item edit indicator, not for the submit button
  const hasAnyEditedItem = useMemo(() => {
    return items.some(item => item.hasEdits);
  }, [items]);

  // For submit button: use API-provided canSubmitForReview which properly detects
  // all branch changes (additions, modifications, deletions) via snapshot diff
  const hasEditedContent = canSubmitForReview || hasAnyEditedItem;

  // Show submit button for draft branches owned by user
  const showSubmitButton = branchMode && branchId && branchState === 'draft' && isOwner;

  // Show review button for branches in review state
  const showReviewButton = branchMode && branchState === 'review';

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, ContentSummary[]> = {};

    items.forEach((item) => {
      const category = item.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    // Sort categories alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange?.(e.target.value);
    },
    [onSearchChange]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        onSearchChange?.('');
      }
    },
    [onSearchChange]
  );

  const handleContentClick = useCallback(
    (e: React.MouseEvent, item: ContentSummary) => {
      // In branch mode, prevent default link behavior and use callback
      if (branchMode && onSelectContent) {
        e.preventDefault();
        onSelectContent(item);
      }
    },
    [branchMode, onSelectContent]
  );

  return (
    <nav className={styles.sidebar} aria-label="Library navigation">
      {/* Branch Mode Indicator */}
      {branchMode && branchName && (
        <div className={styles.branchIndicator}>
          <BranchIcon />
          <span className={styles.branchName}>{branchName}</span>
          {branchState && <LifecycleStatus state={branchState} size="sm" />}
        </div>
      )}

      {/* Submit for Review Button (branch mode only) */}
      {showSubmitButton && branchId && (
        <div className={styles.submitSection}>
          <SubmitForReviewButton
            branchId={branchId}
            disabled={!hasEditedContent}
            inlineReviewerSelection={true}
            onSuccess={onSubmitForReviewSuccess}
          />
          {!hasEditedContent && (
            <p className={styles.submitHint}>Edit content to enable submission</p>
          )}
        </div>
      )}

      {/* Review Changes Button (review state only) */}
      {showReviewButton && onOpenReview && (
        <div className={styles.reviewSection}>
          <button
            type="button"
            className={styles.reviewButton}
            onClick={onOpenReview}
          >
            Review Changes
          </button>
        </div>
      )}

      {/* Search */}
      <div className={styles.searchSection}>
        <div className={styles.searchWrapper}>
          <MagnifyingGlassIcon
            className={styles.searchIcon}
            width={14}
            height={14}
          />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search..."
            value={search}
            onChange={handleSearchInput}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search content"
          />
          <span className={styles.searchBadge}>⌘K</span>
        </div>
      </div>

      {/* Content Type Filters */}
      <div className={styles.filterSection} role="group" aria-label="Content type filters">
        {contentTypeFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={styles.filterPill}
            data-active={contentType === filter.value}
            data-color={filter.color}
            onClick={() => onContentTypeChange?.(filter.value)}
            aria-pressed={contentType === filter.value}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Content Navigation by Category */}
      <div className={styles.navSections}>
        {groupedItems.map(([category, categoryItems]) => (
          <NavSection
            key={category}
            title={category}
            items={[]} // We'll use custom children instead
            defaultOpen={true}
          >
            <ul className={styles.contentList}>
              {categoryItems.map((item) => {
                // Determine if this item is active based on mode
                const isActive = branchMode
                  ? selectedContentId === item.id
                  : selectedSlug === item.slug || location.pathname === `/library/${item.slug}`;

                return (
                  <li key={item.id}>
                    <Link
                      to={branchMode ? '#' : `/library/${item.slug}`}
                      className={styles.contentItem}
                      data-active={isActive}
                      data-edited={branchMode && item.hasEdits}
                      onClick={(e) => handleContentClick(e, item)}
                    >
                      {/* Edited indicator for branch mode */}
                      {branchMode && item.hasEdits && (
                        <Pencil1Icon className={styles.editedIcon} width={12} height={12} />
                      )}
                      <span className={styles.contentTitle}>{item.title}</span>
                      <span
                        className={styles.contentType}
                        data-type={item.contentType}
                      >
                        {item.contentType.charAt(0).toUpperCase()}
                      </span>
                      {reviewStats && (() => {
                        const stat = reviewStats.items.find(s => s.contentId === item.id);
                        if (!stat) return null;
                        return (
                          <span className={styles.diffStats}>
                            {stat.additions > 0 && <span className={styles.additions}>+{stat.additions}</span>}
                            {stat.deletions > 0 && <span className={styles.deletions}>-{stat.deletions}</span>}
                          </span>
                        );
                      })()}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </NavSection>
        ))}

        {/* Empty state when no items */}
        {groupedItems.length === 0 && !hasActiveFilters && (
          <div className={styles.emptyNav}>
            <p>{branchMode ? 'No content in this branch yet.' : 'No published content yet.'}</p>
          </div>
        )}

        {groupedItems.length === 0 && hasActiveFilters && (
          <div className={styles.emptyNav}>
            <p>No content matches your filters.</p>
          </div>
        )}
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          type="button"
          className={styles.clearFilters}
          onClick={onClearFilters}
        >
          <Cross2Icon width={12} height={12} />
          Clear filters
        </button>
      )}
    </nav>
  );
}

export default LibrarySidebar;
