import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MagnifyingGlassIcon, Pencil1Icon, PlusIcon } from '@radix-ui/react-icons';
import { ContextMenu } from '@radix-ui/themes';
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
  /** Whether there is feedback from a completed review with changes_requested */
  hasFeedbackToView?: boolean;
  /** Callback to view feedback from a completed review */
  onViewFeedback?: () => void;
  /** Callback when user clicks '+' to add content in a category (branch mode only) */
  onAddContent?: (category: string) => void;
  /** Whether the current user is an admin (for category management) */
  isAdmin?: boolean;
  /** Current section filter (for add category context) */
  currentSection?: string;
  /** Callback when admin creates a new category */
  onAddCategory?: (name: string) => void;
  /** Callback when admin tries to add category but is not in a draft branch */
  onAddCategoryNeedsBranch?: () => void;
  /** Persistent category names to show even when they have no content */
  persistentCategories?: string[];
  /** Callback when admin renames a category */
  onRenameCategory?: (oldName: string, newName: string) => void;
  /** Callback when admin deletes a category */
  onDeleteCategory?: (name: string) => void;
  /** Callback when user renames a content item */
  onRenameContent?: (contentId: string, newTitle: string) => void;
  /** Callback when user deletes a content item */
  onDeleteContent?: (contentId: string) => void;
  /** Whether the current user can manage content (admin or contributor) */
  canManageContent?: boolean;
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
  hasFeedbackToView = false,
  onViewFeedback,
  onAddContent,
  isAdmin = false,
  currentSection,
  onAddCategory,
  onAddCategoryNeedsBranch,
  persistentCategories = [],
  onRenameCategory,
  onDeleteCategory,
  onRenameContent,
  onDeleteContent,
  canManageContent = false,
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

  // Show feedback button for draft branches that have completed review feedback
  const showFeedbackButton = branchMode && branchState === 'draft' && hasFeedbackToView;

  // Show add content button in draft branches
  const canAddContent = branchMode && branchState === 'draft' && !!onAddContent;

  // Group items by category, including persistent (empty) categories
  const groupedItems = useMemo(() => {
    const groups: Record<string, ContentSummary[]> = {};

    // Seed with persistent categories so they appear even when empty
    persistentCategories.forEach((name) => {
      if (!groups[name]) {
        groups[name] = [];
      }
    });

    items.forEach((item) => {
      const category = item.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    // Sort categories alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [items, persistentCategories]);

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

  // Add Category inline input state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const addCategoryInputRef = useRef<HTMLInputElement>(null);

  const canAddCategoryDirectly = isAdmin && !!currentSection && !!onAddCategory && branchMode && branchState === 'draft';
  const canPromptForBranch = isAdmin && !!currentSection && !branchMode && !!onAddCategoryNeedsBranch;

  useEffect(() => {
    if (isAddingCategory && addCategoryInputRef.current) {
      addCategoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  const handleAddCategorySubmit = useCallback(() => {
    const name = newCategoryName.trim();
    if (name && onAddCategory) {
      onAddCategory(name);
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  }, [newCategoryName, onAddCategory]);

  const handleAddCategoryKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleAddCategorySubmit();
      } else if (e.key === 'Escape') {
        setNewCategoryName('');
        setIsAddingCategory(false);
      }
    },
    [handleAddCategorySubmit]
  );

  // Rename category inline input state
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameCategoryValue, setRenameCategoryValue] = useState('');
  const renameCategoryInputRef = useRef<HTMLInputElement>(null);

  // Rename content inline input state
  const [renamingContentId, setRenamingContentId] = useState<string | null>(null);
  const [renameContentValue, setRenameContentValue] = useState('');
  const renameContentInputRef = useRef<HTMLInputElement>(null);

  // Whether content context menu should appear
  const canManageContentItems = canManageContent && branchMode && branchState === 'draft';

  useEffect(() => {
    if (renamingCategory && renameCategoryInputRef.current) {
      renameCategoryInputRef.current.focus();
      renameCategoryInputRef.current.select();
    }
  }, [renamingCategory]);

  useEffect(() => {
    if (renamingContentId && renameContentInputRef.current) {
      renameContentInputRef.current.focus();
      renameContentInputRef.current.select();
    }
  }, [renamingContentId]);

  const handleRenameCategorySubmit = useCallback(() => {
    const newName = renameCategoryValue.trim();
    if (newName && renamingCategory && newName !== renamingCategory) {
      onRenameCategory?.(renamingCategory, newName);
    }
    setRenamingCategory(null);
    setRenameCategoryValue('');
  }, [renameCategoryValue, renamingCategory, onRenameCategory]);

  const handleRenameContentSubmit = useCallback(() => {
    const newTitle = renameContentValue.trim();
    if (newTitle && renamingContentId) {
      onRenameContent?.(renamingContentId, newTitle);
    }
    setRenamingContentId(null);
    setRenameContentValue('');
  }, [renameContentValue, renamingContentId, onRenameContent]);

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

      {/* View Feedback Button (draft state with completed feedback) */}
      {showFeedbackButton && onViewFeedback && (
        <div className={styles.feedbackSection}>
          <button
            type="button"
            className={styles.feedbackButton}
            onClick={onViewFeedback}
          >
            View Feedback
          </button>
          <p className={styles.feedbackHint}>A reviewer has requested changes</p>
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
        {groupedItems.map(([category, categoryItems]) => {
          const isRenamingThisCategory = renamingCategory === category;

          const categoryNavSection = (
            <NavSection
              key={category}
              title={category}
              items={[]}
              defaultOpen={true}
              onAdd={canAddContent ? () => onAddContent!(category) : undefined}
              titleElement={isRenamingThisCategory ? (
                <input
                  ref={renameCategoryInputRef}
                  type="text"
                  className={styles.renameInput}
                  value={renameCategoryValue}
                  onChange={(e) => setRenameCategoryValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameCategorySubmit();
                    else if (e.key === 'Escape') {
                      setRenamingCategory(null);
                      setRenameCategoryValue('');
                    }
                  }}
                  onBlur={handleRenameCategorySubmit}
                  placeholder="Category name..."
                />
              ) : undefined}
            >
              <ul className={styles.contentList}>
                {categoryItems.map((item) => {
                  const isActive = branchMode
                    ? selectedContentId === item.id
                    : selectedSlug === item.slug || location.pathname === `/library/${item.slug}`;

                  const isRenaming = renamingContentId === item.id;

                  const contentInner = isRenaming ? (
                    <div className={styles.contentItem}>
                      <input
                        ref={renameContentInputRef}
                        type="text"
                        className={styles.renameInput}
                        value={renameContentValue}
                        onChange={(e) => setRenameContentValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameContentSubmit();
                          else if (e.key === 'Escape') {
                            setRenamingContentId(null);
                            setRenameContentValue('');
                          }
                        }}
                        onBlur={handleRenameContentSubmit}
                      />
                    </div>
                  ) : (
                    <Link
                      to={branchMode ? '#' : `/library/${item.slug}`}
                      className={styles.contentItem}
                      data-active={isActive}
                      data-edited={branchMode && item.hasEdits}
                      onClick={(e) => handleContentClick(e, item)}
                    >
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
                  );

                  // Wrap content item in context menu if user can manage content
                  if (canManageContentItems && !isRenaming) {
                    return (
                      <li key={item.id}>
                        <ContextMenu.Root>
                          <ContextMenu.Trigger>
                            <div>{contentInner}</div>
                          </ContextMenu.Trigger>
                          <ContextMenu.Content>
                            <ContextMenu.Item
                              onSelect={() => {
                                setRenamingContentId(item.id);
                                setRenameContentValue(item.title);
                              }}
                            >
                              Rename
                            </ContextMenu.Item>
                            <ContextMenu.Separator />
                            <ContextMenu.Item
                              color="red"
                              onSelect={() => onDeleteContent?.(item.id)}
                            >
                              Delete
                            </ContextMenu.Item>
                          </ContextMenu.Content>
                        </ContextMenu.Root>
                      </li>
                    );
                  }

                  return <li key={item.id}>{contentInner}</li>;
                })}
              </ul>
            </NavSection>
          );

          // Wrap category section in context menu if admin
          if (isAdmin && category !== 'Uncategorized' && !isRenamingThisCategory) {
            return (
              <ContextMenu.Root key={category}>
                <ContextMenu.Trigger>
                  <div>{categoryNavSection}</div>
                </ContextMenu.Trigger>
                <ContextMenu.Content>
                  <ContextMenu.Item
                    onSelect={() => {
                      setRenamingCategory(category);
                      setRenameCategoryValue(category);
                    }}
                  >
                    Rename
                  </ContextMenu.Item>
                  <ContextMenu.Separator />
                  <ContextMenu.Item
                    color="red"
                    onSelect={() => onDeleteCategory?.(category)}
                  >
                    Delete
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Root>
            );
          }

          return categoryNavSection;
        })}

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

        {/* Add Category (admin-only, draft branch) */}
        {canAddCategoryDirectly && (
          <div className={styles.addCategorySection}>
            {isAddingCategory ? (
              <div className={styles.addCategoryRow}>
                <input
                  ref={addCategoryInputRef}
                  type="text"
                  className={styles.addCategoryInput}
                  placeholder="Category name..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={handleAddCategoryKeyDown}
                  onBlur={() => {
                    // Small delay to allow click on confirm button
                    setTimeout(() => {
                      if (!newCategoryName.trim()) {
                        setIsAddingCategory(false);
                      }
                    }, 150);
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                className={styles.addCategoryButton}
                onClick={() => setIsAddingCategory(true)}
              >
                <PlusIcon width={12} height={12} />
                Add Category
              </button>
            )}
          </div>
        )}

        {/* Add Category prompt (admin-only, not in branch mode) */}
        {canPromptForBranch && (
          <div className={styles.addCategorySection}>
            <button
              type="button"
              className={styles.addCategoryButton}
              onClick={onAddCategoryNeedsBranch}
            >
              <PlusIcon width={12} height={12} />
              Add Category
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default LibrarySidebar;
