import { useMemo, useCallback } from 'react';
import { MagnifyingGlassIcon, Cross2Icon } from '@radix-ui/react-icons';
import { NavSection, type NavItem } from './NavSection';
import styles from './LibrarySidebar.module.css';

type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

const contentTypeFilters: { value: ContentType; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'gray' },
  { value: 'guideline', label: 'Guidelines', color: 'green' },
  { value: 'asset', label: 'Assets', color: 'purple' },
  { value: 'opinion', label: 'Opinions', color: 'orange' },
];

/** Design system navigation sections */
const designSystemSections = [
  {
    title: 'Foundations',
    items: ['Color', 'Typography', 'Icons', 'Spacing', 'Grid'],
  },
  {
    title: 'Components',
    items: ['Buttons', 'Forms', 'Cards', 'Navigation', 'Modals'],
  },
  {
    title: 'Patterns',
    items: ['Layouts', 'Data Display', 'Feedback', 'Loading States'],
  },
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
  /** Current category filter */
  category?: string;
  /** Category change handler */
  onCategoryChange?: (value: string) => void;
  /** Available categories (from API) */
  categories?: string[];
  /** Category counts (from API) */
  categoryCounts?: Record<string, number>;
  /** Handler to clear all filters */
  onClearFilters?: () => void;
  /** Whether any filters are active */
  hasActiveFilters?: boolean;
}

/**
 * Library left sidebar
 *
 * Contains:
 * - Search input with keyboard shortcut badge
 * - Content type filter pills
 * - Design system navigation sections
 * - Dynamic category navigation
 */
export function LibrarySidebar({
  search = '',
  onSearchChange,
  contentType = 'all',
  onContentTypeChange,
  category = '',
  onCategoryChange,
  categories = [],
  categoryCounts = {},
  onClearFilters,
  hasActiveFilters = false,
}: LibrarySidebarProps) {
  // Build category nav items
  const categoryItems: NavItem[] = useMemo(() => {
    return categories.map((cat) => ({
      id: cat,
      label: cat,
      count: categoryCounts[cat],
      onClick: () => onCategoryChange?.(cat === category ? '' : cat),
    }));
  }, [categories, categoryCounts, category, onCategoryChange]);

  // Build design system nav items with categories as items
  const foundationItems: NavItem[] = useMemo(() => {
    return designSystemSections[0].items.map((item) => ({
      id: item.toLowerCase(),
      label: item,
      onClick: () => onCategoryChange?.(item === category ? '' : item),
    }));
  }, [category, onCategoryChange]);

  const componentItems: NavItem[] = useMemo(() => {
    return designSystemSections[1].items.map((item) => ({
      id: item.toLowerCase(),
      label: item,
      onClick: () => onCategoryChange?.(item === category ? '' : item),
    }));
  }, [category, onCategoryChange]);

  const patternItems: NavItem[] = useMemo(() => {
    return designSystemSections[2].items.map((item) => ({
      id: item.toLowerCase(),
      label: item,
      onClick: () => onCategoryChange?.(item === category ? '' : item),
    }));
  }, [category, onCategoryChange]);

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

  return (
    <nav className={styles.sidebar} aria-label="Library navigation">
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

      {/* Navigation Sections */}
      <div className={styles.navSections}>
        {/* Design System Sections */}
        <NavSection
          title="Foundations"
          items={foundationItems}
          activeItemId={category.toLowerCase()}
          defaultOpen={true}
        />

        <NavSection
          title="Components"
          items={componentItems}
          activeItemId={category.toLowerCase()}
          defaultOpen={true}
        />

        <NavSection
          title="Patterns"
          items={patternItems}
          activeItemId={category.toLowerCase()}
          defaultOpen={false}
        />

        {/* Dynamic Categories from API */}
        {categoryItems.length > 0 && (
          <NavSection
            title="Categories"
            items={categoryItems}
            activeItemId={category}
            defaultOpen={true}
          />
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
