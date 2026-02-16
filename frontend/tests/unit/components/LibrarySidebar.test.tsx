import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, onClick, ...props }: any) =>
    React.createElement('a', { href: to, onClick, ...props }, children),
  useLocation: () => ({ pathname: '/library' }),
}));

// Mock Radix icons
vi.mock('@radix-ui/react-icons', () => ({
  MagnifyingGlassIcon: (props: any) => React.createElement('svg', { 'data-testid': 'search-icon', ...props }),
  Pencil1Icon: (props: any) => React.createElement('svg', { 'data-testid': 'pencil-icon', ...props }),
  PlusIcon: (props: any) => React.createElement('svg', { 'data-testid': 'plus-icon', ...props }),
  ChevronRightIcon: (props: any) => React.createElement('svg', { 'data-testid': 'chevron-icon', ...props }),
}));

// Mock Radix ContextMenu
vi.mock('@radix-ui/themes', () => {
  const ContextMenu = {
    Root: ({ children }: any) => React.createElement('div', { 'data-testid': 'context-menu-root' }, children),
    Trigger: ({ children }: any) => React.createElement('div', { 'data-testid': 'context-menu-trigger' }, children),
    Content: ({ children }: any) => React.createElement('div', { 'data-testid': 'context-menu-content', role: 'menu' }, children),
    Item: ({ children, onSelect, color }: any) =>
      React.createElement('button', {
        role: 'menuitem',
        onClick: onSelect,
        'data-color': color,
      }, children),
    Separator: () => React.createElement('hr'),
  };
  return { ContextMenu };
});

// Mock Radix Collapsible (used by NavSection)
vi.mock('@radix-ui/react-collapsible', () => ({
  Root: ({ children, ...props }: any) => React.createElement('div', props, children),
  Trigger: ({ children, ...props }: any) =>
    React.createElement('button', { type: 'button', ...props }, children),
  Content: ({ children }: any) => React.createElement('div', null, children),
}));

// Mock CSS modules
vi.mock('../../../src/components/library/LibrarySidebar.module.css', () => ({
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

vi.mock('../../../src/components/library/NavSection.module.css', () => ({
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

// Mock LifecycleStatus and SubmitForReviewButton
vi.mock('../../../src/components/branch/LifecycleStatus', () => ({
  LifecycleStatus: ({ state }: any) => React.createElement('span', { 'data-testid': 'lifecycle-status' }, state),
}));

vi.mock('../../../src/components/branch/SubmitForReviewButton', () => ({
  SubmitForReviewButton: () => React.createElement('button', { 'data-testid': 'submit-for-review' }, 'Submit for Review'),
}));

import { LibrarySidebar, type LibrarySidebarProps } from '../../../src/components/library/LibrarySidebar';
import type { CategoryDTO } from '../../../src/services/category-api';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const UUID_1 = '00000000-0000-4000-a000-000000000001';
const UUID_2 = '00000000-0000-4000-a000-000000000002';
const UUID_3 = '00000000-0000-4000-a000-000000000003';

const mockItems = [
  {
    id: UUID_1,
    title: 'Brand Guidelines',
    slug: 'brand-guidelines',
    contentType: 'guideline' as const,
    category: 'Case Study',
    hasEdits: false,
    tags: [],
    branchId: 'branch-1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    version: 1,
    createdBy: 'user-1',
  },
  {
    id: UUID_2,
    title: 'Logo Usage',
    slug: 'logo-usage',
    contentType: 'asset' as const,
    category: 'Case Study',
    hasEdits: true,
    tags: [],
    branchId: 'branch-1',
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02',
    version: 1,
    createdBy: 'user-1',
  },
  {
    id: UUID_3,
    title: 'Color Theory',
    slug: 'color-theory',
    contentType: 'opinion' as const,
    category: 'Tutorial',
    hasEdits: false,
    tags: [],
    branchId: 'branch-1',
    createdAt: '2026-01-03',
    updatedAt: '2026-01-03',
    version: 1,
    createdBy: 'user-1',
  },
];

function makeCategoryDTO(name: string, displayOrder: number, id?: string): CategoryDTO {
  return {
    id: id || `00000000-0000-4000-a000-${String(displayOrder).padStart(12, '0')}`,
    name,
    section: 'brand',
    displayOrder,
    createdBy: 'user-1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function renderSidebar(overrides: Partial<LibrarySidebarProps> = {}) {
  const defaultProps: LibrarySidebarProps = {
    items: mockItems,
    ...overrides,
  };
  return render(<LibrarySidebar {...defaultProps} />);
}

describe('LibrarySidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- Rendering ----------

  describe('Rendering', () => {
    it('should render with sidebar navigation landmark', () => {
      renderSidebar();
      expect(screen.getByRole('navigation', { name: 'Library navigation' })).toBeInTheDocument();
    });

    it('should render search input', () => {
      renderSidebar();
      expect(screen.getByLabelText('Search content')).toBeInTheDocument();
    });

    it('should render content type filter pills', () => {
      renderSidebar();
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Guidelines')).toBeInTheDocument();
      expect(screen.getByText('Assets')).toBeInTheDocument();
      expect(screen.getByText('Opinions')).toBeInTheDocument();
    });

    it('should group items by category', () => {
      renderSidebar();
      // Category headers
      expect(screen.getByText('Case Study')).toBeInTheDocument();
      expect(screen.getByText('Tutorial')).toBeInTheDocument();
      // Content items
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
      expect(screen.getByText('Logo Usage')).toBeInTheDocument();
      expect(screen.getByText('Color Theory')).toBeInTheDocument();
    });

    it('should show Uncategorized for items without category', () => {
      const uncategorizedItems = [
        { ...mockItems[0], category: undefined },
      ];
      renderSidebar({ items: uncategorizedItems as any });
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    it('should show persistent categories even when they have no content', () => {
      renderSidebar({ persistentCategories: [makeCategoryDTO('Empty Category', 0)] });
      expect(screen.getByText('Empty Category')).toBeInTheDocument();
    });

    it('should sort persistent categories by displayOrder, not alphabetically', () => {
      renderSidebar({
        persistentCategories: [
          makeCategoryDTO('Zebra', 0),
          makeCategoryDTO('Alpha', 1),
        ],
      });
      const allText = screen.getByRole('navigation').textContent || '';
      const zebraIndex = allText.indexOf('Zebra');
      const alphaIndex = allText.indexOf('Alpha');
      // Zebra has displayOrder=0, Alpha has displayOrder=1 — Zebra should come first
      expect(zebraIndex).toBeLessThan(alphaIndex);
    });

    it('should sort persistent categories before non-persistent ones', () => {
      // mockItems have "Case Study" and "Tutorial" as content-derived categories
      // "Zeta" is persistent but should appear before non-persistent categories
      renderSidebar({
        persistentCategories: [makeCategoryDTO('Zeta', 0)],
      });
      const allText = screen.getByRole('navigation').textContent || '';
      const zetaIndex = allText.indexOf('Zeta');
      const caseStudyIndex = allText.indexOf('Case Study');
      const tutorialIndex = allText.indexOf('Tutorial');
      expect(zetaIndex).toBeLessThan(caseStudyIndex);
      expect(zetaIndex).toBeLessThan(tutorialIndex);
    });
  });

  // ---------- Empty States ----------

  describe('Empty states', () => {
    it('should show published empty state when no items and no filters', () => {
      renderSidebar({ items: [] });
      expect(screen.getByText('No published content yet.')).toBeInTheDocument();
    });

    it('should show branch empty state when no items in branch mode', () => {
      renderSidebar({ items: [], branchMode: true });
      expect(screen.getByText('No content in this branch yet.')).toBeInTheDocument();
    });

    it('should show filter empty state when no items match filters', () => {
      renderSidebar({ items: [], hasActiveFilters: true });
      expect(screen.getByText('No content matches your filters.')).toBeInTheDocument();
    });
  });

  // ---------- Search ----------

  describe('Search', () => {
    it('should call onSearchChange when typing', () => {
      const onSearchChange = vi.fn();
      renderSidebar({ onSearchChange });

      const input = screen.getByLabelText('Search content');
      fireEvent.change(input, { target: { value: 'brand' } });
      expect(onSearchChange).toHaveBeenCalledWith('brand');
    });

    it('should clear search on Escape', () => {
      const onSearchChange = vi.fn();
      renderSidebar({ search: 'brand', onSearchChange });

      const input = screen.getByLabelText('Search content');
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onSearchChange).toHaveBeenCalledWith('');
    });
  });

  // ---------- Content Type Filters ----------

  describe('Content type filters', () => {
    it('should call onContentTypeChange when filter is clicked', () => {
      const onContentTypeChange = vi.fn();
      renderSidebar({ onContentTypeChange });

      fireEvent.click(screen.getByText('Guidelines'));
      expect(onContentTypeChange).toHaveBeenCalledWith('guideline');
    });

    it('should mark active filter with aria-pressed', () => {
      renderSidebar({ contentType: 'guideline' });
      expect(screen.getByText('Guidelines')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('All')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // ---------- Branch Mode ----------

  describe('Branch mode', () => {
    it('should show branch indicator in branch mode', () => {
      renderSidebar({ branchMode: true, branchName: 'feature/test' });
      expect(screen.getByText('feature/test')).toBeInTheDocument();
    });

    it('should show lifecycle status with branch state', () => {
      renderSidebar({ branchMode: true, branchName: 'test', branchState: 'draft' });
      expect(screen.getByTestId('lifecycle-status')).toHaveTextContent('draft');
    });

    it('should show submit button for draft branches owned by user', () => {
      renderSidebar({
        branchMode: true,
        branchName: 'test',
        branchState: 'draft',
        branchId: 'branch-1',
        isOwner: true,
        canSubmitForReview: true,
      });
      expect(screen.getByTestId('submit-for-review')).toBeInTheDocument();
    });

    it('should show edited icon for modified content in branch mode', () => {
      renderSidebar({ branchMode: true, branchName: 'test' });
      // mockItems[1] has hasEdits=true
      expect(screen.getAllByTestId('pencil-icon').length).toBeGreaterThan(0);
    });

    it('should call onSelectContent in branch mode on click', () => {
      const onSelectContent = vi.fn();
      renderSidebar({ branchMode: true, branchName: 'test', onSelectContent });

      fireEvent.click(screen.getByText('Brand Guidelines'));
      expect(onSelectContent).toHaveBeenCalledWith(mockItems[0]);
    });
  });

  // ---------- Category Context Menu (Admin) ----------

  describe('Category context menu (admin)', () => {
    const adminDraftProps: Partial<LibrarySidebarProps> = {
      isAdmin: true,
      branchMode: true,
      branchState: 'draft',
      branchName: 'test',
    };

    it('should render context menus on category headers for admin in draft branch', () => {
      renderSidebar(adminDraftProps);
      const contextMenus = screen.getAllByTestId('context-menu-root');
      // Categories 'Case Study' and 'Tutorial' should have context menus
      expect(contextMenus.length).toBeGreaterThanOrEqual(2);
    });

    it('should not render context menus on Uncategorized', () => {
      const items = [{ ...mockItems[0], category: undefined }];
      renderSidebar({ ...adminDraftProps, items: items as any });
      // Uncategorized should not have a context menu
      const contextMenuContents = screen.queryAllByTestId('context-menu-content');
      const hasUncategorizedMenu = contextMenuContents.some(
        (el) => el.closest('[data-testid="context-menu-root"]')?.textContent?.includes('Uncategorized')
          && el.textContent?.includes('Rename')
      );
      expect(hasUncategorizedMenu).toBe(false);
    });

    it('should not render category context menus for non-admin users', () => {
      renderSidebar({ isAdmin: false, branchMode: true, branchState: 'draft', branchName: 'test' });
      // No context menus should exist on categories
      const contextMenuContents = screen.queryAllByRole('menu');
      expect(contextMenuContents.length).toBe(0);
    });

    it('should not render category context menus in published mode', () => {
      renderSidebar({ isAdmin: true });
      const contextMenuContents = screen.queryAllByRole('menu');
      expect(contextMenuContents.length).toBe(0);
    });

    it('should show Rename and Delete options in category context menu', () => {
      renderSidebar(adminDraftProps);
      const menuItems = screen.getAllByRole('menuitem');
      const menuTexts = menuItems.map((el) => el.textContent);
      expect(menuTexts).toContain('Rename');
      expect(menuTexts).toContain('Delete');
    });

    it('should enter rename mode when Rename is clicked', () => {
      renderSidebar(adminDraftProps);
      // Click the Rename button for the first category
      const renameButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Rename');
      fireEvent.click(renameButtons[0]);
      // Should show rename input
      const inputs = screen.getAllByPlaceholderText('Category name...');
      expect(inputs.length).toBe(1);
    });

    it('should call onRenameCategory when rename is submitted via Enter', () => {
      const onRenameCategory = vi.fn();
      renderSidebar({ ...adminDraftProps, onRenameCategory });

      // Enter rename mode
      const renameButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Rename');
      fireEvent.click(renameButtons[0]);

      const input = screen.getByPlaceholderText('Category name...');
      fireEvent.change(input, { target: { value: 'EICMA' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onRenameCategory).toHaveBeenCalledWith('Case Study', 'EICMA');
    });

    it('should cancel rename on Escape', () => {
      const onRenameCategory = vi.fn();
      renderSidebar({ ...adminDraftProps, onRenameCategory });

      const renameButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Rename');
      fireEvent.click(renameButtons[0]);

      const input = screen.getByPlaceholderText('Category name...');
      fireEvent.change(input, { target: { value: 'Changed' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onRenameCategory).not.toHaveBeenCalled();
      // Input should be gone
      expect(screen.queryByPlaceholderText('Category name...')).not.toBeInTheDocument();
    });

    it('should call onDeleteCategory when Delete is clicked', () => {
      const onDeleteCategory = vi.fn();
      renderSidebar({ ...adminDraftProps, onDeleteCategory });

      const deleteButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Delete');
      fireEvent.click(deleteButtons[0]);

      expect(onDeleteCategory).toHaveBeenCalledWith('Case Study');
    });
  });

  // ---------- Content Context Menu ----------

  describe('Content context menu', () => {
    const contentMenuProps: Partial<LibrarySidebarProps> = {
      canManageContent: true,
      branchMode: true,
      branchState: 'draft',
      branchName: 'test',
    };

    it('should render context menus on content items when canManageContent is true in draft branch', () => {
      renderSidebar(contentMenuProps);
      const contextMenus = screen.getAllByTestId('context-menu-root');
      expect(contextMenus.length).toBeGreaterThanOrEqual(3);
    });

    it('should not render content context menus when not in branch mode', () => {
      renderSidebar({ canManageContent: true, branchMode: false });
      expect(screen.queryAllByRole('menu').length).toBe(0);
    });

    it('should not render content context menus when branch is not draft', () => {
      renderSidebar({ canManageContent: true, branchMode: true, branchState: 'review', branchName: 'test' });
      expect(screen.queryAllByRole('menu').length).toBe(0);
    });

    it('should show content context menu for branch owner even without canManageContent', () => {
      renderSidebar({
        isOwner: true,
        branchMode: true,
        branchState: 'draft',
        branchName: 'test',
      });
      const contextMenus = screen.getAllByTestId('context-menu-root');
      expect(contextMenus.length).toBeGreaterThanOrEqual(3);
    });

    it('should enter content rename mode when Rename is clicked', () => {
      renderSidebar(contentMenuProps);
      const renameButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Rename');
      fireEvent.click(renameButtons[0]);

      // Should show a text input (rename input has no placeholder)
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    });

    it('should call onRenameContent when content rename is submitted', () => {
      const onRenameContent = vi.fn();
      renderSidebar({ ...contentMenuProps, onRenameContent });

      const renameButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Rename');
      fireEvent.click(renameButtons[0]);

      const inputs = screen.getAllByRole('textbox');
      const renameInput = inputs[inputs.length - 1]; // Last input is the rename input
      fireEvent.change(renameInput, { target: { value: 'Updated Title' } });
      fireEvent.keyDown(renameInput, { key: 'Enter' });

      expect(onRenameContent).toHaveBeenCalledWith(UUID_1, 'Updated Title');
    });

    it('should cancel content rename on Escape', () => {
      const onRenameContent = vi.fn();
      renderSidebar({ ...contentMenuProps, onRenameContent });

      const renameButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Rename');
      fireEvent.click(renameButtons[0]);

      const inputs = screen.getAllByRole('textbox');
      const renameInput = inputs[inputs.length - 1];
      fireEvent.keyDown(renameInput, { key: 'Escape' });

      expect(onRenameContent).not.toHaveBeenCalled();
    });

    it('should call onDeleteContent when Delete is clicked', () => {
      const onDeleteContent = vi.fn();
      renderSidebar({ ...contentMenuProps, onDeleteContent });

      const deleteButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Delete');
      fireEvent.click(deleteButtons[0]);

      expect(onDeleteContent).toHaveBeenCalledWith(UUID_1);
    });
  });

  // ---------- Add Category ----------

  describe('Add category', () => {
    const addCategoryProps: Partial<LibrarySidebarProps> = {
      isAdmin: true,
      currentSection: 'brand',
      branchMode: true,
      branchState: 'draft',
      branchName: 'test',
      onAddCategory: vi.fn(),
    };

    it('should show Add Category button for admin in draft branch', () => {
      renderSidebar(addCategoryProps);
      expect(screen.getByText('Add Category')).toBeInTheDocument();
    });

    it('should not show Add Category button for non-admin', () => {
      renderSidebar({ ...addCategoryProps, isAdmin: false });
      expect(screen.queryByText('Add Category')).not.toBeInTheDocument();
    });

    it('should show inline input when Add Category is clicked', () => {
      renderSidebar(addCategoryProps);
      fireEvent.click(screen.getByText('Add Category'));
      expect(screen.getByPlaceholderText('Category name...')).toBeInTheDocument();
    });

    it('should call onAddCategory when inline input is submitted', () => {
      const onAddCategory = vi.fn();
      renderSidebar({ ...addCategoryProps, onAddCategory });

      fireEvent.click(screen.getByText('Add Category'));
      const input = screen.getByPlaceholderText('Category name...');
      fireEvent.change(input, { target: { value: 'New Category' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onAddCategory).toHaveBeenCalledWith('New Category');
    });

    it('should cancel add category on Escape', () => {
      const onAddCategory = vi.fn();
      renderSidebar({ ...addCategoryProps, onAddCategory });

      fireEvent.click(screen.getByText('Add Category'));
      const input = screen.getByPlaceholderText('Category name...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onAddCategory).not.toHaveBeenCalled();
      // Input should be gone, button should be back
      expect(screen.queryByPlaceholderText('Category name...')).not.toBeInTheDocument();
    });

    it('should show Add Category prompt button when admin is not in branch mode', () => {
      const onAddCategoryNeedsBranch = vi.fn();
      renderSidebar({
        isAdmin: true,
        currentSection: 'brand',
        branchMode: false,
        onAddCategoryNeedsBranch,
      });

      const btn = screen.getByText('Add Category');
      fireEvent.click(btn);
      expect(onAddCategoryNeedsBranch).toHaveBeenCalled();
    });
  });

  // ---------- Category Reorder (Move Up/Down) ----------

  describe('Category reorder', () => {
    const reorderBaseProps: Partial<LibrarySidebarProps> = {
      isAdmin: true,
      branchMode: true,
      branchState: 'draft',
      branchName: 'test',
      currentSection: 'brand',
      onReorderCategory: vi.fn(),
    };

    it('should show Move Up and Move Down options in context menu for admin with 2+ categories', () => {
      renderSidebar(reorderBaseProps);
      const menuItems = screen.getAllByRole('menuitem');
      const menuTexts = menuItems.map((el) => el.textContent);
      expect(menuTexts).toContain('Move Up');
      expect(menuTexts).toContain('Move Down');
    });

    it('should not show Move Up/Down when there is only one category', () => {
      const singleCategoryItems = [mockItems[0]]; // Only "Case Study"
      renderSidebar({ ...reorderBaseProps, items: singleCategoryItems });
      const menuItems = screen.getAllByRole('menuitem');
      const menuTexts = menuItems.map((el) => el.textContent);
      expect(menuTexts).not.toContain('Move Up');
      expect(menuTexts).not.toContain('Move Down');
    });

    it('should call onReorderCategory with swapped names when Move Down is clicked', () => {
      const onReorderCategory = vi.fn();
      renderSidebar({ ...reorderBaseProps, onReorderCategory });

      const moveDownButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Move Down');
      fireEvent.click(moveDownButtons[0]);

      expect(onReorderCategory).toHaveBeenCalledWith('brand', ['Tutorial', 'Case Study']);
    });

    it('should call onReorderCategory with swapped names when Move Up is clicked on second category', () => {
      const onReorderCategory = vi.fn();
      renderSidebar({ ...reorderBaseProps, onReorderCategory });

      const moveUpButtons = screen.getAllByRole('menuitem').filter((el) => el.textContent === 'Move Up');
      // moveUpButtons[0] is Case Study's (disabled, first), moveUpButtons[1] is Tutorial's
      fireEvent.click(moveUpButtons[1]);

      expect(onReorderCategory).toHaveBeenCalledWith('brand', ['Tutorial', 'Case Study']);
    });
  });

  // ---------- Review and Feedback Buttons ----------

  describe('Review and feedback buttons', () => {
    it('should show Review Changes button in review state', () => {
      const onOpenReview = vi.fn();
      renderSidebar({
        branchMode: true,
        branchState: 'review',
        branchName: 'test',
        onOpenReview,
      });
      const btn = screen.getByText('Review Changes');
      fireEvent.click(btn);
      expect(onOpenReview).toHaveBeenCalled();
    });

    it('should show View Feedback button when feedback exists on draft', () => {
      const onViewFeedback = vi.fn();
      renderSidebar({
        branchMode: true,
        branchState: 'draft',
        branchName: 'test',
        hasFeedbackToView: true,
        onViewFeedback,
      });
      const btn = screen.getByText('View Feedback');
      fireEvent.click(btn);
      expect(onViewFeedback).toHaveBeenCalled();
    });
  });
});
