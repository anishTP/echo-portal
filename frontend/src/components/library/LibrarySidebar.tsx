import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon, PlusIcon } from '@radix-ui/react-icons';
import { ContextMenu, AlertDialog, Button as RadixButton, Flex } from '@radix-ui/themes';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
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
  /** Callback when contributor creates a subcategory */
  onAddSubcategory?: (categoryId: string, name: string) => void;
  /** Callback when contributor renames a subcategory */
  onRenameSubcategory?: (subcategoryId: string, newName: string) => void;
  /** Callback when contributor deletes a subcategory (cascade-deletes content) */
  onDeleteSubcategory?: (subcategoryId: string) => void;
  /** Callback when contributor reorders interleaved items within a category */
  onReorderItems?: (categoryId: string, order: { type: 'subcategory' | 'content'; id: string }[]) => void;
  /** Callback when contributor moves content between subcategories */
  onMoveContent?: (contentId: string, subcategoryId: string | null, displayOrder: number) => void;
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

// --- Sortable wrapper for DnD ---

function SortableItem({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
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
  branchId: _branchId,
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
  onAddSubcategory,
  onRenameSubcategory,
  onDeleteSubcategory,
  onReorderItems,
  onMoveContent,
}: LibrarySidebarProps) {
  const location = useLocation();

  // --- Draft branch gating (T024) ---
  const isDraftBranch = branchMode && branchState === 'draft';

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

  const canAddCategoryDirectly = isAdmin && !!currentSection && !!onAddCategory && isDraftBranch;
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

  // --- Inline editing state (subcategories — T019, T020) ---

  // Add subcategory inline: which category is receiving a new subcategory
  const [addingSubcategoryForCategoryId, setAddingSubcategoryForCategoryId] = useState<string | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const addSubcategoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingSubcategoryForCategoryId && addSubcategoryInputRef.current) {
      addSubcategoryInputRef.current.focus();
    }
  }, [addingSubcategoryForCategoryId]);

  const handleAddSubcategorySubmit = useCallback(() => {
    const name = newSubcategoryName.trim();
    if (name && addingSubcategoryForCategoryId && onAddSubcategory) {
      onAddSubcategory(addingSubcategoryForCategoryId, name);
    }
    // Always clear — empty/duplicate silently cancels
    setNewSubcategoryName('');
    setAddingSubcategoryForCategoryId(null);
  }, [newSubcategoryName, addingSubcategoryForCategoryId, onAddSubcategory]);

  const handleStartAddSubcategory = useCallback((categoryId: string) => {
    setAddingSubcategoryForCategoryId(categoryId);
    setNewSubcategoryName('');
    // Auto-expand the category if collapsed
    setExpandedIds((prev) => {
      if (prev.has(categoryId)) return prev;
      const next = new Set(prev);
      next.add(categoryId);
      return next;
    });
  }, []);

  // Rename subcategory inline
  const [renamingSubcategoryId, setRenamingSubcategoryId] = useState<string | null>(null);
  const [renameSubcategoryValue, setRenameSubcategoryValue] = useState('');
  const renameSubcategoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingSubcategoryId && renameSubcategoryInputRef.current) {
      renameSubcategoryInputRef.current.focus();
      renameSubcategoryInputRef.current.select();
    }
  }, [renamingSubcategoryId]);

  const handleRenameSubcategorySubmit = useCallback(() => {
    const newName = renameSubcategoryValue.trim();
    if (newName && renamingSubcategoryId) {
      onRenameSubcategory?.(renamingSubcategoryId, newName);
    }
    // Empty or invalid silently reverts
    setRenamingSubcategoryId(null);
    setRenameSubcategoryValue('');
  }, [renameSubcategoryValue, renamingSubcategoryId, onRenameSubcategory]);

  // --- Delete subcategory confirmation dialog (T021) ---

  const [deleteSubcategoryTarget, setDeleteSubcategoryTarget] = useState<{
    id: string;
    name: string;
    contentCount: number;
  } | null>(null);

  const confirmDeleteSubcategory = useCallback(() => {
    if (deleteSubcategoryTarget && onDeleteSubcategory) {
      onDeleteSubcategory(deleteSubcategoryTarget.id);
    }
    setDeleteSubcategoryTarget(null);
  }, [deleteSubcategoryTarget, onDeleteSubcategory]);

  // --- Permission helpers (T024 gating) ---

  // Content management (rename/delete content): contributor+ in draft branch
  const canManageContentItems = (canManageContent || isOwner) && isDraftBranch;
  // Add content to category: draft branch + callback available
  const canAddContent = isDraftBranch && !!onAddContent;
  // Subcategory management (create/rename/delete): contributor+ in draft branch
  const canManageSubcategories = (canManageContent || isOwner) && isDraftBranch;

  // --- DnD state and handlers (T022, T023) ---

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Parse drag IDs: "reorder:{categoryId}:{type}:{itemId}" for interleaved reorder
  const parseDragId = useCallback((id: string) => {
    const parts = id.split(':');
    if (parts[0] === 'reorder' && parts.length === 4) {
      return { kind: 'reorder' as const, categoryId: parts[1], type: parts[2] as 'subcategory' | 'content', itemId: parts[3] };
    }
    return null;
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeInfo = parseDragId(String(active.id));
      const overInfo = parseDragId(String(over.id));

      if (!activeInfo || !overInfo) return;

      // Interleaved reorder within the same category
      if (activeInfo.kind === 'reorder' && overInfo.kind === 'reorder' && activeInfo.categoryId === overInfo.categoryId) {
        const cat = treeCategories.find((c) => c.id === activeInfo.categoryId);
        if (!cat || !onReorderItems) return;

        // Build current order as drag IDs
        const currentOrder = cat.children.map((child) =>
          child.type === 'subcategory'
            ? `reorder:${cat.id}:subcategory:${child.subcategory.id}`
            : `reorder:${cat.id}:content:${child.item.id}`
        );

        const oldIndex = currentOrder.indexOf(String(active.id));
        const newIndex = currentOrder.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) return;

        // Compute new order
        const reordered = [...currentOrder];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);

        // Convert back to API format
        const order = reordered.map((dragId) => {
          const info = parseDragId(dragId)!;
          return { type: info.type, id: info.itemId };
        });

        onReorderItems(activeInfo.categoryId, order);
      }
    },
    [parseDragId, treeCategories, onReorderItems]
  );

  // Determine if DnD is enabled
  const dndEnabled = isDraftBranch && (!!onReorderItems || !!onMoveContent);

  // Get drag overlay label
  const activeDragLabel = useMemo(() => {
    if (!activeDragId) return null;
    const info = parseDragId(activeDragId);
    if (!info) return null;
    if (info.type === 'subcategory') {
      const sc = subcategories.find((s) => s.id === info.itemId);
      return sc?.name || 'Subcategory';
    }
    const content = items.find((i) => i.id === info.itemId);
    return content?.title || 'Content';
  }, [activeDragId, parseDragId, subcategories, items]);

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
            aria-label="Rename content"
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

  const renderSubcategoryRow = (child: TreeSubcategory, categoryName: string) => {
    const isSubExpanded = expandedIds.has(child.subcategory.id);
    const isRenamingThisSubcategory = renamingSubcategoryId === child.subcategory.id;

    const subcategoryHeader = isRenamingThisSubcategory ? (
      <div className={styles.subcategoryRow}>
        <ChevronRightIcon
          className={styles.chevronIcon}
          data-expanded={isSubExpanded}
          width={12}
          height={12}
        />
        <input
          ref={renameSubcategoryInputRef}
          type="text"
          className={styles.renameInput}
          aria-label="Rename subcategory"
          value={renameSubcategoryValue}
          onChange={(e) => setRenameSubcategoryValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubcategorySubmit();
            else if (e.key === 'Escape') {
              setRenamingSubcategoryId(null);
              setRenameSubcategoryValue('');
            }
          }}
          onBlur={handleRenameSubcategorySubmit}
          placeholder="Subcategory name..."
        />
      </div>
    ) : (
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
    );

    // Wrap in context menu for contributors in draft branch (T018)
    const showSubcategoryContextMenu = canManageSubcategories && !isRenamingThisSubcategory;

    const wrappedHeader = showSubcategoryContextMenu ? (
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div>{subcategoryHeader}</div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          {canAddContent && (
            <ContextMenu.Item onSelect={() => onAddContent!(categoryName)}>
              Add Content
            </ContextMenu.Item>
          )}
          <ContextMenu.Item
            onSelect={() => {
              setRenamingSubcategoryId(child.subcategory.id);
              setRenameSubcategoryValue(child.subcategory.name);
            }}
          >
            Rename
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item
            color="red"
            onSelect={() =>
              setDeleteSubcategoryTarget({
                id: child.subcategory.id,
                name: child.subcategory.name,
                contentCount: child.contentItems.length,
              })
            }
          >
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    ) : (
      subcategoryHeader
    );

    return (
      <div
        key={child.subcategory.id}
        className={styles.treeNode}
        role="treeitem"
        aria-expanded={isSubExpanded}
        aria-level={2}
      >
        {wrappedHeader}

        {isSubExpanded && (
          <div className={styles.subcategoryChildren} role="group">
            {child.contentItems.map((item) => (
              <div key={item.id} role="treeitem" aria-level={3}>
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
  };

  const renderCategoryRow = (cat: TreeCategory) => {
    const isCatExpanded = expandedIds.has(cat.id);
    const isRenamingThisCategory = renamingCategory === cat.name;
    const isAddingSubcategoryHere = addingSubcategoryForCategoryId === cat.id;

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
          aria-label="Rename category"
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

    // Build context menu for category (T018 + existing admin actions)
    const isRealCategory = cat.id !== '__uncategorized';
    const showCategoryContextMenu =
      isRealCategory && !isRenamingThisCategory && isDraftBranch;

    // Admin reorder helpers
    const allCategoryNames = treeCategories
      .map((c) => c.name)
      .filter((name) => name !== 'Uncategorized');
    const posInAll = allCategoryNames.indexOf(cat.name);
    const isFirst = posInAll === 0;
    const isLast = posInAll === allCategoryNames.length - 1;
    const canReorder = !!onReorderCategory && !!currentSection && allCategoryNames.length > 1;

    const hasContributorActions = canManageSubcategories && !!onAddSubcategory;
    const hasAdminActions = isAdmin;

    const wrappedHeader = showCategoryContextMenu && (hasContributorActions || hasAdminActions) ? (
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div>{categoryHeader}</div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          {/* Contributor+ actions: Add Subcategory, Add Content */}
          {hasContributorActions && (
            <ContextMenu.Item onSelect={() => handleStartAddSubcategory(cat.id)}>
              Add Subcategory
            </ContextMenu.Item>
          )}
          {canAddContent && (
            <ContextMenu.Item onSelect={() => onAddContent!(cat.name)}>
              Add Content
            </ContextMenu.Item>
          )}

          {/* Admin-only actions: Rename, Reorder, Delete */}
          {hasAdminActions && (hasContributorActions || canAddContent) && (
            <ContextMenu.Separator />
          )}
          {hasAdminActions && (
            <ContextMenu.Item
              onSelect={() => {
                setRenamingCategory(cat.name);
                setRenameCategoryValue(cat.name);
              }}
            >
              Rename Category
            </ContextMenu.Item>
          )}
          {hasAdminActions && canReorder && (
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
          {hasAdminActions && (
            <>
              <ContextMenu.Separator />
              <ContextMenu.Item color="red" onSelect={() => onDeleteCategory?.(cat.name)}>
                Delete Category
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Root>
    ) : (
      categoryHeader
    );

    return (
      <div key={cat.id} className={styles.treeNode} role="treeitem" aria-expanded={isCatExpanded} aria-level={1}>
        {wrappedHeader}

        {isCatExpanded && (
          <div className={styles.categoryChildren} role="group">
            {/* Inline add subcategory input (T019) — appears at top of children list */}
            {isAddingSubcategoryHere && (
              <div className={styles.subcategoryRow}>
                <ChevronRightIcon
                  className={styles.chevronIcon}
                  width={12}
                  height={12}
                />
                <input
                  ref={addSubcategoryInputRef}
                  type="text"
                  className={styles.renameInput}
                  placeholder="Subcategory name..."
                  aria-label="New subcategory name"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubcategorySubmit();
                    else if (e.key === 'Escape') {
                      setNewSubcategoryName('');
                      setAddingSubcategoryForCategoryId(null);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click events to fire before cleanup
                    setTimeout(() => {
                      setNewSubcategoryName('');
                      setAddingSubcategoryForCategoryId(null);
                    }, 150);
                  }}
                />
              </div>
            )}

            {(() => {
              const sortableIds = dndEnabled
                ? cat.children.map((child) =>
                    child.type === 'subcategory'
                      ? `reorder:${cat.id}:subcategory:${child.subcategory.id}`
                      : `reorder:${cat.id}:content:${child.item.id}`
                  )
                : [];

              const childElements = cat.children.map((child) => {
                const dragId = child.type === 'subcategory'
                  ? `reorder:${cat.id}:subcategory:${child.subcategory.id}`
                  : `reorder:${cat.id}:content:${child.item.id}`;

                const content = child.type === 'subcategory' ? (
                  renderSubcategoryRow(child, cat.name)
                ) : (
                  <div key={child.item.id} role="treeitem" aria-level={2}>
                    {renderContentRow(child.item, 'loose')}
                  </div>
                );

                if (dndEnabled) {
                  return (
                    <SortableItem key={dragId} id={dragId}>
                      {content}
                    </SortableItem>
                  );
                }
                return child.type === 'subcategory'
                  ? content
                  : content;
              });

              if (dndEnabled && sortableIds.length > 0) {
                return (
                  <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    {childElements}
                  </SortableContext>
                );
              }
              return childElements;
            })()}

            {cat.children.length === 0 && !isAddingSubcategoryHere && (
              <div className={styles.emptyHint}>Empty category</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // --- Main render ---

  return (
    <>
      <nav className={styles.sidebar} aria-label="Library navigation" role="tree">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.treeContainer}>
            {treeCategories.map((cat) => renderCategoryRow(cat))}

            {treeCategories.length === 0 && (
              <div className={styles.emptyNav}>
                <p>{branchMode ? 'No content in this branch yet.' : 'No published content yet.'}</p>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeDragId && activeDragLabel ? (
              <div className={styles.dragOverlay}>{activeDragLabel}</div>
            ) : null}
          </DragOverlay>
        </DndContext>

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

      {/* Delete Subcategory Confirmation Dialog (T021) */}
      <AlertDialog.Root
        open={!!deleteSubcategoryTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteSubcategoryTarget(null);
        }}
      >
        <AlertDialog.Content>
          <AlertDialog.Title>Delete Subcategory</AlertDialog.Title>
          <AlertDialog.Description>
            {deleteSubcategoryTarget && (
              <>
                Are you sure you want to delete <strong>{deleteSubcategoryTarget.name}</strong>?
                {deleteSubcategoryTarget.contentCount > 0 && (
                  <>
                    {' '}This will also delete{' '}
                    <strong>
                      {deleteSubcategoryTarget.contentCount} content{' '}
                      {deleteSubcategoryTarget.contentCount === 1 ? 'piece' : 'pieces'}
                    </strong>{' '}
                    within it.
                  </>
                )}
                {' '}This action cannot be undone.
              </>
            )}
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <RadixButton variant="soft" color="gray">
                Cancel
              </RadixButton>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <RadixButton variant="solid" color="red" onClick={confirmDeleteSubcategory}>
                Delete
              </RadixButton>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}

export default LibrarySidebar;
