import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock Radix components
vi.mock('@radix-ui/themes', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock('@radix-ui/react-icons', () => ({
  Pencil1Icon: () => <svg data-testid="pencil-icon" />,
}));

// Mock ContentBreadcrumb
vi.mock('../../../src/components/library/ContentBreadcrumb', () => ({
  ContentBreadcrumb: ({ section, categoryName, contentTitle }: any) => (
    <div data-testid="breadcrumb">{section} / {categoryName} / {contentTitle}</div>
  ),
}));

// Mock LandingPageCardGrid
vi.mock('../../../src/components/library/LandingPageCardGrid', () => ({
  LandingPageCardGrid: ({ cards, onCardClick, emptyMessage }: any) => (
    <div data-testid="card-grid">
      {cards.length === 0 && <div>{emptyMessage}</div>}
      {cards.map((card: any) => (
        <div key={`${card.type}-${card.id}`} data-testid={`card-${card.type}-${card.id}`} onClick={() => onCardClick(card)}>
          {card.name || card.title}
        </div>
      ))}
    </div>
  ),
  contentSummaryToCardData: (content: any, isDraft?: boolean) => ({
    type: 'content',
    id: content.id,
    title: content.title,
    description: content.description,
    contentType: content.contentType,
    authorName: content.createdBy.displayName,
    isDraft,
  }),
}));

import { CategoryLandingPage } from '../../../src/components/library/CategoryLandingPage';
import type { CategoryDTO } from '../../../src/services/category-api';
import type { SubcategoryDTO } from '../../../src/services/subcategory-api';
import type { ContentSummary } from '@echo-portal/shared';

const makeCategory = (overrides: Partial<CategoryDTO> = {}): CategoryDTO => ({
  id: 'cat-1',
  name: 'Vehicles',
  section: 'brand',
  displayOrder: 0,
  createdBy: 'user-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
});

const makeSubcategory = (overrides: Partial<SubcategoryDTO> = {}): SubcategoryDTO => ({
  id: 'sub-1',
  name: 'SUVs',
  categoryId: 'cat-1',
  displayOrder: 0,
  body: '',
  createdBy: 'user-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
});

const makeContent = (overrides: Partial<ContentSummary> = {}): ContentSummary => ({
  id: 'content-1',
  branchId: 'branch-1',
  title: 'Test Content',
  slug: 'test-content',
  contentType: 'guideline',
  tags: [],
  isPublished: true,
  createdBy: { id: 'user-1', displayName: 'Test User', avatarUrl: null },
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  categoryId: 'cat-1',
  subcategoryId: null,
  ...overrides,
} as ContentSummary);

describe('CategoryLandingPage', () => {
  const defaultProps = {
    section: 'brand',
    category: makeCategory(),
    subcategories: [makeSubcategory()],
    contentItems: [
      makeContent({ id: 'c1', title: 'Guide 1', subcategoryId: null }),
      makeContent({ id: 'c2', title: 'Guide 2', subcategoryId: 'sub-1' }),
    ],
    body: '',
    canEdit: false,
    onCardClick: vi.fn(),
  };

  it('renders category title and breadcrumb with section', () => {
    render(<CategoryLandingPage {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vehicles');
    expect(screen.getByTestId('breadcrumb')).toHaveTextContent('brand / Vehicles / Vehicles');
  });

  it('renders mixed card grid (subcategory + content cards)', () => {
    render(<CategoryLandingPage {...defaultProps} />);
    // Subcategory card
    expect(screen.getByTestId('card-subcategory-sub-1')).toHaveTextContent('SUVs');
    // Loose content card (not in a subcategory)
    expect(screen.getByTestId('card-content-c1')).toHaveTextContent('Guide 1');
    // Content in subcategory should NOT appear as loose content card
    expect(screen.queryByTestId('card-content-c2')).not.toBeInTheDocument();
  });

  it('renders body content when present', () => {
    render(<CategoryLandingPage {...defaultProps} body="Category overview text" />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('Category overview text');
  });

  it('shows "Add overview" for editors when body empty in branch mode', () => {
    render(<CategoryLandingPage {...defaultProps} canEdit branchMode onEditRequest={vi.fn()} />);
    expect(screen.getByText('Add overview')).toBeInTheDocument();
  });

  it('hides body area for viewers when body empty', () => {
    render(<CategoryLandingPage {...defaultProps} />);
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
    expect(screen.queryByText('Add overview')).not.toBeInTheDocument();
  });

  it('edit button visible in branch mode for editors', () => {
    render(
      <CategoryLandingPage {...defaultProps} canEdit branchMode onEditRequest={vi.fn()} body="body" />
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('edit button hidden for non-editors', () => {
    render(<CategoryLandingPage {...defaultProps} body="body" />);
    const editButtons = screen.queryAllByRole('button').filter((b) => b.textContent?.includes('Edit'));
    expect(editButtons).toHaveLength(0);
  });

  it('has correct ARIA landmarks', () => {
    render(<CategoryLandingPage {...defaultProps} body="overview" />);
    expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'Vehicles category landing page');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Category overview' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Category contents' })).toBeInTheDocument();
  });

  it('handles onCardClick for subcategory card', () => {
    const onCardClick = vi.fn();
    render(<CategoryLandingPage {...defaultProps} onCardClick={onCardClick} />);
    fireEvent.click(screen.getByTestId('card-subcategory-sub-1'));
    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'subcategory', id: 'sub-1', name: 'SUVs' })
    );
  });
});
