import { useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MagnifyingGlassIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { ContentSummary } from '@echo-portal/shared';
import { NavSection } from './NavSection';
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
}: LibrarySidebarProps) {
  const location = useLocation();

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
          <span className={styles.branchBadge}>Draft</span>
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
                      onClick={(e) => handleContentClick(e, item)}
                    >
                      <span className={styles.contentTitle}>{item.title}</span>
                      <span
                        className={styles.contentType}
                        data-type={item.contentType}
                      >
                        {item.contentType.charAt(0).toUpperCase()}
                      </span>
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
