import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LibrarySidebarProps } from '../../src/components/library/LibrarySidebar';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, onClick, ...props }: any) =>
    React.createElement('a', { href: to, onClick, ...props }, children),
  useLocation: () => ({ pathname: '/library' }),
}));

// Mock Radix UI icons
vi.mock('@radix-ui/react-icons', () => ({
  ChevronRightIcon: (props: any) =>
    React.createElement('svg', { 'data-testid': 'chevron-icon', ...props }),
  PlusIcon: (props: any) =>
    React.createElement('svg', { 'data-testid': 'plus-icon', ...props }),
}));

// Mock Radix UI themes ContextMenu
vi.mock('@radix-ui/themes', () => {
  const ContextMenu = {
    Root: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'context-menu-root' }, children),
    Trigger: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'context-menu-trigger' }, children),
    Content: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'context-menu-content' }, children),
    Item: ({ children, onSelect, ...props }: any) =>
      React.createElement(
        'div',
        {
          'data-testid': 'context-menu-item',
          onClick: onSelect,
          role: 'menuitem',
          ...props,
        },
        children
      ),
    Separator: () => React.createElement('hr', { 'data-testid': 'context-menu-separator' }),
  };
  return { ContextMenu };
});

// Mock CSS modules with Proxy
vi.mock('../../src/components/library/LibrarySidebar.module.css', () => ({
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

// Polyfill scrollIntoView for jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Import after mocks
const { LibrarySidebar } = await import('../../src/components/library/LibrarySidebar');

// --- Test Data ---

const UUID_CATEGORY_1 = '00000000-0000-4000-a000-000000000010';
const UUID_CATEGORY_2 = '00000000-0000-4000-a000-000000000011';
const UUID_SUBCATEGORY_1 = '00000000-0000-4000-a000-000000000020';
const UUID_SUBCATEGORY_2 = '00000000-0000-4000-a000-000000000021';
const UUID_CONTENT_1 = '00000000-0000-4000-a000-000000000030';
const UUID_CONTENT_2 = '00000000-0000-4000-a000-000000000031';
const UUID_CONTENT_3 = '00000000-0000-4000-a000-000000000032';
const UUID_CONTENT_4 = '00000000-0000-4000-a000-000000000033';

const mockCategories = [
  {
    id: UUID_CATEGORY_1,
    name: 'Vehicles',
    section: 'brand',
    displayOrder: 0,
    createdBy: 'user1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: UUID_CATEGORY_2,
    name: 'Reference Docs',
    section: 'brand',
    displayOrder: 1,
    createdBy: 'user1',
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02',
  },
];

const mockSubcategories = [
  {
    id: UUID_SUBCATEGORY_1,
    name: 'V1 Models',
    categoryId: UUID_CATEGORY_1,
    displayOrder: 0,
    createdBy: 'user1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: UUID_SUBCATEGORY_2,
    name: 'V2 Models',
    categoryId: UUID_CATEGORY_1,
    displayOrder: 2,
    createdBy: 'user1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

function makeContentItem(overrides: Partial<any> = {}): any {
  return {
    id: UUID_CONTENT_1,
    branchId: 'branch-1',
    title: 'Test Content',
    slug: 'test-content',
    contentType: 'guideline',
    section: 'brand',
    category: 'Vehicles',
    categoryId: UUID_CATEGORY_1,
    subcategoryId: null,
    displayOrder: 1,
    tags: [],
    visibility: 'public',
    isPublished: true,
    createdBy: { id: 'user1', displayName: 'User One' },
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    hasEdits: false,
    ...overrides,
  };
}

const mockItems = [
  makeContentItem({
    id: UUID_CONTENT_1,
    title: 'Case Study',
    slug: 'case-study',
    categoryId: UUID_CATEGORY_1,
    subcategoryId: UUID_SUBCATEGORY_1,
    displayOrder: 0,
  }),
  makeContentItem({
    id: UUID_CONTENT_2,
    title: 'Branding Guide',
    slug: 'branding-guide',
    categoryId: UUID_CATEGORY_1,
    subcategoryId: UUID_SUBCATEGORY_1,
    displayOrder: 1,
  }),
  makeContentItem({
    id: UUID_CONTENT_3,
    title: 'Overview Doc',
    slug: 'overview-doc',
    categoryId: UUID_CATEGORY_1,
    subcategoryId: null,
    displayOrder: 1,
    category: 'Vehicles',
  }),
  makeContentItem({
    id: UUID_CONTENT_4,
    title: 'Style Reference',
    slug: 'style-reference',
    categoryId: UUID_CATEGORY_2,
    subcategoryId: null,
    displayOrder: 0,
    category: 'Reference Docs',
  }),
];

function renderSidebar(overrides: Partial<LibrarySidebarProps> = {}) {
  const defaultProps: LibrarySidebarProps = {
    items: mockItems,
    persistentCategories: mockCategories,
    subcategories: mockSubcategories,
    ...overrides,
  };
  return render(<LibrarySidebar {...defaultProps} />);
}

// --- Tests ---

describe('LibrarySidebar — Three-Level Tree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tree Rendering', () => {
    it('renders the sidebar with tree role and accessible name', () => {
      renderSidebar();
      const tree = screen.getByRole('tree', { name: 'Library navigation' });
      expect(tree).toBeInTheDocument();
    });

    it('renders categories as top-level tree items', () => {
      renderSidebar();
      expect(screen.getByText('Vehicles')).toBeInTheDocument();
      expect(screen.getByText('Reference Docs')).toBeInTheDocument();
    });

    it('renders subcategories within their parent category when expanded', () => {
      renderSidebar();
      // First category auto-expands, so V1 Models and V2 Models should be visible
      expect(screen.getByText('V1 Models')).toBeInTheDocument();
      expect(screen.getByText('V2 Models')).toBeInTheDocument();
    });

    it('renders content pieces under their subcategory when expanded', () => {
      renderSidebar();
      // Expand V1 Models subcategory (Vehicles is already auto-expanded)
      fireEvent.click(screen.getByRole('button', { name: /V1 Models/i }));

      expect(screen.getByText('Case Study')).toBeInTheDocument();
      expect(screen.getByText('Branding Guide')).toBeInTheDocument();
    });

    it('renders loose content (no subcategory) at category level', () => {
      renderSidebar();
      // Vehicles auto-expanded → Overview Doc should be visible as loose content
      expect(screen.getByText('Overview Doc')).toBeInTheDocument();
    });

    it('shows empty state when no categories or content', () => {
      renderSidebar({ items: [], persistentCategories: [], subcategories: [] });
      expect(screen.getByText('No published content yet.')).toBeInTheDocument();
    });

    it('shows branch mode empty state', () => {
      renderSidebar({
        items: [],
        persistentCategories: [],
        subcategories: [],
        branchMode: true,
      });
      expect(screen.getByText('No content in this branch yet.')).toBeInTheDocument();
    });
  });

  describe('Removed Elements (T011)', () => {
    it('does not render a search bar', () => {
      renderSidebar();
      expect(screen.queryByLabelText('Search content')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });

    it('does not render content type filter pills', () => {
      renderSidebar();
      // Check there is no filter group
      expect(screen.queryByRole('group', { name: 'Content type filters' })).not.toBeInTheDocument();
      // "All" was a filter pill, not a category name
      expect(screen.queryByText('All')).not.toBeInTheDocument();
    });

    it('does not render content type badges (G/A/O)', () => {
      renderSidebar();
      // Expand V1 Models subcategory to see content
      fireEvent.click(screen.getByRole('button', { name: /V1 Models/i }));

      // Content should render as plain text without type badges
      const caseStudyLink = screen.getByText('Case Study').closest('a');
      expect(caseStudyLink?.querySelector('[data-type]')).toBeNull();
    });

    it('does not render branch status banner', () => {
      renderSidebar({
        branchMode: true,
        branchState: 'draft',
      });
      // No branch indicator with lifecycle status badge
      expect(screen.queryByTestId('lifecycle-status')).not.toBeInTheDocument();
    });

    it('does not render Submit for Review button', () => {
      renderSidebar({
        branchMode: true,
        branchState: 'draft',
      });
      expect(screen.queryByText('Submit for Review')).not.toBeInTheDocument();
    });

    it('does not render Review Changes button', () => {
      renderSidebar({
        branchMode: true,
        branchState: 'review',
      });
      expect(screen.queryByText('Review Changes')).not.toBeInTheDocument();
    });

    it('does not render View Feedback button', () => {
      renderSidebar({
        branchMode: true,
        branchState: 'draft',
      });
      expect(screen.queryByText('View Feedback')).not.toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('auto-expands first category on initial render', () => {
      renderSidebar();
      // First category (Vehicles) should be auto-expanded, showing its children
      expect(screen.getByText('V1 Models')).toBeInTheDocument();
      expect(screen.getByText('Overview Doc')).toBeInTheDocument();
    });

    it('toggles category expand/collapse on click', () => {
      renderSidebar();
      const vehiclesBtn = screen.getByRole('button', { name: /Collapse Vehicles/i });

      // Initially expanded (auto-expand first category) — label says "Collapse"
      expect(screen.getByText('V1 Models')).toBeInTheDocument();

      // Collapse
      fireEvent.click(vehiclesBtn);
      expect(screen.queryByText('V1 Models')).not.toBeInTheDocument();

      // Re-expand (label now says "Expand")
      fireEvent.click(screen.getByRole('button', { name: /Expand Vehicles/i }));
      expect(screen.getByText('V1 Models')).toBeInTheDocument();
    });

    it('toggles subcategory expand/collapse on click', () => {
      renderSidebar();
      // Vehicles is auto-expanded, V1 Models subcategory is visible but collapsed
      const v1Btn = screen.getByRole('button', { name: /Expand V1 Models/i });

      // Click to expand subcategory
      fireEvent.click(v1Btn);
      expect(screen.getByText('Case Study')).toBeInTheDocument();

      // Click to collapse subcategory
      fireEvent.click(screen.getByRole('button', { name: /Collapse V1 Models/i }));
      expect(screen.queryByText('Case Study')).not.toBeInTheDocument();
    });

    it('auto-expands active content ancestors on load', () => {
      renderSidebar({
        selectedSlug: 'case-study',
      });
      // Case Study is in Vehicles → V1 Models
      // Both should be auto-expanded
      expect(screen.getByText('V1 Models')).toBeInTheDocument();
      expect(screen.getByText('Case Study')).toBeInTheDocument();
    });

    it('auto-expands active content ancestors in branch mode', () => {
      renderSidebar({
        branchMode: true,
        selectedContentId: UUID_CONTENT_1,
      });
      // Content 1 (Case Study) is in Vehicles → V1 Models
      expect(screen.getByText('V1 Models')).toBeInTheDocument();
      expect(screen.getByText('Case Study')).toBeInTheDocument();
    });
  });

  describe('Selected Content Highlighting', () => {
    it('marks active content with data-active in published mode', async () => {
      const { container } = renderSidebar({
        selectedSlug: 'style-reference',
      });
      // Wait for auto-expand effect to flush, then expand if needed
      // (React 18 effects may be deferred in jsdom)
      const refDocsNode = container.querySelector('[aria-expanded]');
      const refDocsBtn = screen.getByRole('button', { name: /Reference Docs/i });
      if (refDocsBtn.closest('[aria-expanded="false"]')) {
        fireEvent.click(refDocsBtn);
      }

      const link = screen.getByText('Style Reference').closest('a');
      expect(link).toHaveAttribute('data-active', 'true');
    });

    it('marks active content with data-active in branch mode', () => {
      renderSidebar({
        branchMode: true,
        selectedContentId: UUID_CONTENT_1,
      });

      // Auto-expand should make Case Study visible in V1 Models subcategory
      const link = screen.getByText('Case Study').closest('a');
      expect(link).toHaveAttribute('data-active', 'true');
    });

    it('does not mark non-selected content as active', () => {
      renderSidebar({
        branchMode: true,
        selectedContentId: UUID_CONTENT_1,
      });

      // Branding Guide is in the same subcategory but not selected
      const brandingLink = screen.getByText('Branding Guide').closest('a');
      expect(brandingLink).toHaveAttribute('data-active', 'false');
    });
  });

  describe('Content Interaction', () => {
    it('calls onSelectContent when clicking in branch mode', () => {
      const onSelectContent = vi.fn();
      renderSidebar({
        branchMode: true,
        onSelectContent,
      });
      // V1 Models subcategory is visible (Vehicles auto-expanded)
      // Expand V1 Models to see content
      fireEvent.click(screen.getByRole('button', { name: /V1 Models/i }));

      fireEvent.click(screen.getByText('Case Study'));
      expect(onSelectContent).toHaveBeenCalledWith(
        expect.objectContaining({ id: UUID_CONTENT_1, title: 'Case Study' })
      );
    });

    it('renders content as links in published mode', () => {
      renderSidebar();
      // Overview Doc is loose content in Vehicles (auto-expanded)
      const link = screen.getByText('Overview Doc').closest('a');
      expect(link).toHaveAttribute('href', '/library/overview-doc');
    });
  });

  describe('Content Context Menus', () => {
    it('shows rename/delete context menu for content in draft branch mode', () => {
      renderSidebar({
        branchMode: true,
        branchState: 'draft',
        canManageContent: true,
        onRenameContent: vi.fn(),
        onDeleteContent: vi.fn(),
      });

      // Expand V1 Models to see content items with context menus
      fireEvent.click(screen.getByRole('button', { name: /V1 Models/i }));

      // Find context menu items (mocked as divs with role=menuitem)
      const menuItems = screen.getAllByTestId('context-menu-item');
      const renameItems = menuItems.filter((el) => el.textContent === 'Rename');
      const deleteItems = menuItems.filter((el) => el.textContent === 'Delete');

      expect(renameItems.length).toBeGreaterThanOrEqual(1);
      expect(deleteItems.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show content context menus when not in draft branch mode', () => {
      renderSidebar({
        branchMode: false,
        canManageContent: true,
      });

      // Expand V1 Models to see content
      fireEvent.click(screen.getByRole('button', { name: /V1 Models/i }));

      // Content links should not have context menu wrappers
      const contentLink = screen.getByText('Case Study').closest('a');
      // The parent should not be a context menu trigger
      const trigger = contentLink?.closest('[data-testid="context-menu-trigger"]');
      expect(trigger).toBeNull();
    });
  });

  describe('Uncategorized Content', () => {
    it('groups uncategorized items under Uncategorized category', () => {
      const uncategorizedItem = makeContentItem({
        id: '00000000-0000-4000-a000-000000000099',
        title: 'Orphan Content',
        slug: 'orphan-content',
        categoryId: null,
        category: null,
      });

      renderSidebar({
        items: [...mockItems, uncategorizedItem],
      });

      // Expand Uncategorized
      const uncatBtn = screen.getByRole('button', { name: /Uncategorized/i });
      expect(uncatBtn).toBeInTheDocument();
      fireEvent.click(uncatBtn);

      expect(screen.getByText('Orphan Content')).toBeInTheDocument();
    });
  });
});
