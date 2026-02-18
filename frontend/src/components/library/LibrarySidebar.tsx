import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon, PlusIcon } from '@radix-ui/react-icons';
import { ContextMenu } from '@radix-ui/themes';
import type { ContentSummary, BranchStateType } from '@echo-portal/shared';
import type { CategoryDTO } from '../../services/category-api';
import type { SubcategoryDTO } from '../../services/subcategory-api';
import styles from './LibrarySidebar.module.css';

// --- Props ---

export interface LibrarySidebarProps {
  /** Content items to display in sidebar */
  items?: ContentSummary[];
  /** Currently selected content slug (published mode) */
  selectedSlug?: string;
  /** Currently selected content ID (branch mode) */
  selectedContentId?: string;
  /** Handler for content selection in branch mode */
  onSelectContent?: (content: ContentSummary) => void;
  /** Whether we're in branch mode */
  branchMode?: boolean;
  /** State of the current branch */
  branchState?: BranchStateType;
  /** ID of the current branch */
  branchId?: string;
  /** Whether the user is the branch owner */
  isOwner?: boolean;
  /** Persistent categories (full DTOs) */
  persistentCategories?: CategoryDTO[];
  /** Subcategories for three-level hierarchy */
  subcategories?: SubcategoryDTO[];
  /** Whether the current user is an admin */
  isAdmin?: boolean;
  /** Current section filter */
  currentSection?: string;
  /** Callback when user clicks '+' to add content in a category (branch mode only) */
  onAddContent?: (category: string) => void;
  /** Callback when admin creates a new category */
  onAddCategory?: (name: string) => void;
  /** Callback when admin tries to add category but is not in a draft branch */
  onAddCategoryNeedsBranch?: () => void;
  /** Callback when admin renames a category */
  onRenameCategory?: (oldName: string, newName: string) => void;
  /** Callback when admin deletes a category */
  onDeleteCategory?: (name: string) => void;
  /** Callback when admin reorders categories */
  onReorderCategory?: (section: string, orderedNames: string[]) => void;
  /** Callback when user renames a content item */
  onRenameContent?: (contentId: string, newTitle: string) => void;
  /** Callback when user deletes a content item */
  onDeleteContent?: (contentId: string) => void;
  /** Whether the current user can manage content (admin or contributor) */
  canManageContent?: boolean;
}

// --- Tree data types ---

interface TreeSubcategory {
  type: 'subcategory';
  subcategory: SubcategoryDTO;
  contentItems: ContentSummary[];
}

interface TreeLooseContent {
  type: 'content';
  item: ContentSummary;
}

type TreeChild = TreeSubcategory | TreeLooseContent;

interface TreeCategory {
  id: string;
  name: string;
  children: TreeChild[];
}

// --- Icons ---

const FolderIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={styles.folderIcon}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

// --- Component ---

export function LibrarySidebar({
  items = [],
  selectedSlug,
  selectedContentId,
  onSelectContent,
  branchMode = false,
  branchState,
  isOwner = false,
  persistentCategories = [],
  subcategories = [],
  isAdmin = false,
  currentSection,
  onAddContent,
  onAddCategory,
  onAddCategoryNeedsBranch,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategory,
  onRenameContent,
  onDeleteContent,
  canManageContent = false,
}: LibrarySidebarProps) {
  const location = useLocation();

  // --- Tree data construction ---

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryDTO>();
    persistentCategories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [persistentCategories]);

  const treeCategories = useMemo(() => {
    const result: TreeCategory[] = [];

    // Build subcategory lookup by categoryId
    const subcatByCategoryId = new Map<string, SubcategoryDTO[]>();
    subcategories.forEach((sc) => {
      const existing = subcatByCategoryId.get(sc.categoryId) || [];
      existing.push(sc);
      subcatByCategoryId.set(sc.categoryId, existing);
    });

    // Build name→id lookup for fallback matching
    const categoryNameToId = new Map<string, string>();
    persistentCategories.forEach((cat) => categoryNameToId.set(cat.name, cat.id));

    const sortedCategories = [...persistentCategories].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );

    for (const cat of sortedCategories) {
      const catSubcategories = (subcatByCategoryId.get(cat.id) || []).sort(
        (a, b) => a.displayOrder - b.displayOrder
      );

      // Content belonging to this category
      const catContent = items.filter((item) => {
        if (item.categoryId) return item.categoryId === cat.id;
        return item.category === cat.name;
      });

      // Separate loose (no subcategoryId) from subcategorized content
      const looseContent = catContent
        .filter((item) => !item.subcategoryId)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

      const subcatContent = catContent.filter((item) => !!item.subcategoryId);

      // Build interleaved children array
      const children: TreeChild[] = [];

      for (const sc of catSubcategories) {
        const scItems = subcatContent
          .filter((item) => item.subcategoryId === sc.id)
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        children.push({ type: 'subcategory', subcategory: sc, contentItems: scItems });
      }

      for (const item of looseContent) {
        children.push({ type: 'content', item });
      }

      // Sort interleaved by displayOrder
      children.sort((a, b) => {
        const orderA = a.type === 'subcategory' ? a.subcategory.displayOrder : (a.item.displayOrder ?? 0);
        const orderB = b.type === 'subcategory' ? b.subcategory.displayOrder : (b.item.displayOrder ?? 0);
        return orderA - orderB;
      });

      result.push({ id: cat.id, name: cat.name, children });
    }

    // Handle uncategorized content
    const uncategorized = items.filter((item) => {
      if (item.categoryId) return !categoryMap.has(item.categoryId);
      if (item.category) return !categoryNameToId.has(item.category);
      return true;
    });

    if (uncategorized.length > 0) {
      result.push({
        id: '__uncategorized',
        name: 'Uncategorized',
        children: uncategorized
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .map((item) => ({ type: 'content' as const, item })),
      });
    }

    return result;
  }, [persistentCategories, subcategories, items, categoryMap]);

  // --- Active content detection ---

  const activeItem = useMemo(() => {
    if (branchMode && selectedContentId) {
      return items.find((item) => item.id === selectedContentId);
    }
    if (!branchMode && selectedSlug) {
      return items.find(
        (item) => item.slug === selectedSlug || location.pathname === `/library/${item.slug}`
      );
    }
    return undefined;
  }, [items, branchMode, selectedContentId, selectedSlug, location.pathname]);

  // --- Expand/collapse state ---

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Auto-expand ancestors of active content, and expand first category by default
  useEffect(() => {
    if (treeCategories.length === 0) return;

    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;

      if (activeItem) {
        for (const cat of treeCategories) {
          // Check if active item is loose content in this category
          const isLooseInCat = cat.children.some(
            (child) => child.type === 'content' && child.item.id === activeItem.id
          );
          if (isLooseInCat && !next.has(cat.id)) {
            next.add(cat.id);
            changed = true;
            break;
          }

          // Check subcategories
          for (const child of cat.children) {
            if (child.type === 'subcategory') {
              const isInSubcat = child.contentItems.some((c) => c.id === activeItem.id);
              if (isInSubcat) {
                if (!next.has(cat.id)) { next.add(cat.id); changed = true; }
                if (!next.has(child.subcategory.id)) { next.add(child.subcategory.id); changed = true; }
                break;
              }
            }
          }
          if (changed) break;
        }
      }

      // Default: expand first category if nothing is expanded
      if (next.size === 0 && treeCategories.length > 0) {
        next.add(treeCategories[0].id);
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [activeItem, treeCategories]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // --- Content interaction ---

  const handleContentClick = useCallback(
    (e: React.MouseEvent, item: ContentSummary) => {
      if (branchMode && onSelectContent) {
        e.preventDefault();
        onSelectContent(item);
      }
    },
    [branchMode, onSelectContent]
  );

  const isContentActive = useCallback(
    (item: ContentSummary) => {
      if (branchMode) return selectedContentId === item.id;
      return selectedSlug === item.slug || location.pathname === `/library/${item.slug}`;
    },
    [branchMode, selectedContentId, selectedSlug, location.pathname]
  );

  // --- Inline editing state (categories) ---

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

  // Rename category inline
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameCategoryValue, setRenameCategoryValue] = useState('');
  const renameCategoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingCategory && renameCategoryInputRef.current) {
      renameCategoryInputRef.current.focus();
      renameCategoryInputRef.current.select();
    }
  }, [renamingCategory]);

  const handleRenameCategorySubmit = useCallback(() => {
    const newName = renameCategoryValue.trim();
    if (newName && renamingCategory && newName !== renamingCategory) {
      onRenameCategory?.(renamingCategory, newName);
    }
    setRenamingCategory(null);
    setRenameCategoryValue('');
  }, [renameCategoryValue, renamingCategory, onRenameCategory]);

  // Rename content inline
  const [renamingContentId, setRenamingContentId] = useState<string | null>(null);
  const [renameContentValue, setRenameContentValue] = useState('');
  const renameContentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingContentId && renameContentInputRef.current) {
      renameContentInputRef.current.focus();
      renameContentInputRef.current.select();
    }
  }, [renamingContentId]);

  const handleRenameContentSubmit = useCallback(() => {
    const newTitle = renameContentValue.trim();
    if (newTitle && renamingContentId) {
      onRenameContent?.(renamingContentId, newTitle);
    }
    setRenamingContentId(null);
    setRenameContentValue('');
  }, [renameContentValue, renamingContentId, onRenameContent]);

  // Whether content context menu should appear
  const canManageContentItems = (canManageContent || isOwner) && branchMode && branchState === 'draft';
  const canAddContent = branchMode && branchState === 'draft' && !!onAddContent;

  // --- Render helpers ---

  const renderContentRow = (item: ContentSummary, indent: 'loose' | 'subcategorized') => {
    const isActive = isContentActive(item);
    const isRenaming = renamingContentId === item.id;

    if (isRenaming) {
      return (
        <div className={indent === 'subcategorized' ? styles.contentRowSubcategorized : styles.contentRow}>
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
      );
    }

    const link = (
      <Link
        to={branchMode ? '#' : `/library/${item.slug}`}
        className={indent === 'subcategorized' ? styles.contentRowSubcategorized : styles.contentRow}
        data-active={isActive}
        onClick={(e) => handleContentClick(e, item)}
      >
        <span className={styles.contentTitle}>{item.title}</span>
      </Link>
    );

    if (canManageContentItems) {
      return (
        <ContextMenu.Root>
          <ContextMenu.Trigger>
            <div>{link}</div>
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
            <ContextMenu.Item color="red" onSelect={() => onDeleteContent?.(item.id)}>
              Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Root>
      );
    }

    return link;
  };

  const renderCategoryRow = (cat: TreeCategory) => {
    const isCatExpanded = expandedIds.has(cat.id);
    const isRenamingThisCategory = renamingCategory === cat.name;

    // Category header row
    const categoryHeader = isRenamingThisCategory ? (
      <div className={styles.categoryRow}>
        <ChevronRightIcon
          className={styles.chevronIcon}
          data-expanded={isCatExpanded}
          width={14}
          height={14}
        />
        <FolderIcon />
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
      </div>
    ) : (
      <button
        type="button"
        className={styles.categoryRow}
        onClick={() => toggleExpanded(cat.id)}
        aria-label={`${isCatExpanded ? 'Collapse' : 'Expand'} ${cat.name}`}
      >
        <ChevronRightIcon
          className={styles.chevronIcon}
          data-expanded={isCatExpanded}
          width={14}
          height={14}
        />
        <FolderIcon />
        <span className={styles.nodeLabel}>{cat.name}</span>
        {canAddContent && (
          <span
            className={styles.addContentIcon}
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onAddContent!(cat.name);
            }}
            aria-label={`Add content to ${cat.name}`}
          >
            <PlusIcon width={14} height={14} />
          </span>
        )}
      </button>
    );

    // Wrap category in admin context menu if applicable
    const isAdminContextTarget =
      isAdmin && cat.id !== '__uncategorized' && !isRenamingThisCategory && branchMode && branchState === 'draft';

    const allCategoryNames = treeCategories
      .map((c) => c.name)
      .filter((name) => name !== 'Uncategorized');
    const posInAll = allCategoryNames.indexOf(cat.name);
    const isFirst = posInAll === 0;
    const isLast = posInAll === allCategoryNames.length - 1;
    const canReorder = !!onReorderCategory && !!currentSection && allCategoryNames.length > 1;

    const wrappedHeader = isAdminContextTarget ? (
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div>{categoryHeader}</div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item
            onSelect={() => {
              setRenamingCategory(cat.name);
              setRenameCategoryValue(cat.name);
            }}
          >
            Rename
          </ContextMenu.Item>
          {canReorder && (
            <>
              <ContextMenu.Separator />
              <ContextMenu.Item
                disabled={isFirst}
                onSelect={() => {
                  if (isFirst) return;
                  const names = [...allCategoryNames];
                  [names[posInAll - 1], names[posInAll]] = [names[posInAll], names[posInAll - 1]];
                  onReorderCategory!(currentSection!, names);
                }}
              >
                Move Up
              </ContextMenu.Item>
              <ContextMenu.Item
                disabled={isLast}
                onSelect={() => {
                  if (isLast) return;
                  const names = [...allCategoryNames];
                  [names[posInAll], names[posInAll + 1]] = [names[posInAll + 1], names[posInAll]];
                  onReorderCategory!(currentSection!, names);
                }}
              >
                Move Down
              </ContextMenu.Item>
            </>
          )}
          <ContextMenu.Separator />
          <ContextMenu.Item color="red" onSelect={() => onDeleteCategory?.(cat.name)}>
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    ) : (
      categoryHeader
    );

    return (
      <div key={cat.id} className={styles.treeNode} role="treeitem" aria-expanded={isCatExpanded}>
        {wrappedHeader}

        {isCatExpanded && (
          <div className={styles.categoryChildren} role="group">
            {cat.children.map((child) => {
              if (child.type === 'subcategory') {
                const isSubExpanded = expandedIds.has(child.subcategory.id);
                return (
                  <div
                    key={child.subcategory.id}
                    className={styles.treeNode}
                    role="treeitem"
                    aria-expanded={isSubExpanded}
                  >
                    <button
                      type="button"
                      className={styles.subcategoryRow}
                      onClick={() => toggleExpanded(child.subcategory.id)}
                      aria-label={`${isSubExpanded ? 'Collapse' : 'Expand'} ${child.subcategory.name}`}
                    >
                      <ChevronRightIcon
                        className={styles.chevronIcon}
                        data-expanded={isSubExpanded}
                        width={12}
                        height={12}
                      />
                      <span className={styles.nodeLabel}>{child.subcategory.name}</span>
                    </button>

                    {isSubExpanded && (
                      <div className={styles.subcategoryChildren} role="group">
                        {child.contentItems.map((item) => (
                          <div key={item.id} role="treeitem">
                            {renderContentRow(item, 'subcategorized')}
                          </div>
                        ))}
                        {child.contentItems.length === 0 && (
                          <div className={styles.emptyHint}>No content</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // Loose content
              return (
                <div key={child.item.id} role="treeitem">
                  {renderContentRow(child.item, 'loose')}
                </div>
              );
            })}

            {cat.children.length === 0 && (
              <div className={styles.emptyHint}>Empty category</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // --- Main render ---

  return (
    <nav className={styles.sidebar} aria-label="Library navigation" role="tree">
      <div className={styles.treeContainer}>
        {treeCategories.map((cat) => renderCategoryRow(cat))}

        {treeCategories.length === 0 && (
          <div className={styles.emptyNav}>
            <p>{branchMode ? 'No content in this branch yet.' : 'No published content yet.'}</p>
          </div>
        )}
      </div>

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
    </nav>
  );
}

export default LibrarySidebar;
