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
  ContentBreadcrumb: ({ section, categoryName, subcategoryName, contentTitle }: any) => (
    <div data-testid="breadcrumb">{section} / {categoryName} / {subcategoryName} / {contentTitle}</div>
  ),
}));

// Mock LandingPageCardGrid
vi.mock('../../../src/components/library/LandingPageCardGrid', () => ({
  LandingPageCardGrid: ({ cards, onCardClick, emptyMessage }: any) => (
    <div data-testid="card-grid">
      {cards.length === 0 && <div>{emptyMessage}</div>}
      {cards.map((card: any) => (
        <div key={card.id} data-testid={`card-${card.id}`} onClick={() => onCardClick(card)}>
          {card.title}
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

import { SubcategoryLandingPage } from '../../../src/components/library/SubcategoryLandingPage';
import type { SubcategoryDTO } from '../../../src/services/subcategory-api';
import type { ContentSummary } from '@echo-portal/shared';

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
  subcategoryId: 'sub-1',
  ...overrides,
} as ContentSummary);

describe('SubcategoryLandingPage', () => {
  const defaultProps = {
    section: 'brand',
    categoryName: 'Vehicles',
    subcategory: makeSubcategory(),
    contentItems: [
      makeContent({ id: 'c1', title: 'SUV Guide' }),
      makeContent({ id: 'c2', title: 'SUV Reviews' }),
    ],
    canEdit: false,
    onCardClick: vi.fn(),
  };

  it('renders subcategory title and breadcrumb with full hierarchy', () => {
    render(<SubcategoryLandingPage {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SUVs');
    expect(screen.getByTestId('breadcrumb')).toHaveTextContent('brand / Vehicles / SUVs / SUVs');
  });

  it('renders content item cards', () => {
    render(<SubcategoryLandingPage {...defaultProps} />);
    expect(screen.getByTestId('card-c1')).toHaveTextContent('SUV Guide');
    expect(screen.getByTestId('card-c2')).toHaveTextContent('SUV Reviews');
  });

  it('renders body content when present', () => {
    render(
      <SubcategoryLandingPage
        {...defaultProps}
        subcategory={makeSubcategory({ body: 'Overview of SUVs' })}
      />
    );
    expect(screen.getByTestId('markdown')).toHaveTextContent('Overview of SUVs');
  });

  it('shows "Add overview" for editors when body empty in branch mode', () => {
    render(
      <SubcategoryLandingPage {...defaultProps} canEdit branchMode onEditRequest={vi.fn()} />
    );
    expect(screen.getByText('Add overview')).toBeInTheDocument();
  });

  it('hides body area for viewers when body empty', () => {
    render(<SubcategoryLandingPage {...defaultProps} />);
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
    expect(screen.queryByText('Add overview')).not.toBeInTheDocument();
  });

  it('edit button visible in branch mode for editors', () => {
    render(
      <SubcategoryLandingPage
        {...defaultProps}
        canEdit
        branchMode
        onEditRequest={vi.fn()}
        subcategory={makeSubcategory({ body: 'body' })}
      />
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('edit button hidden for non-editors', () => {
    render(
      <SubcategoryLandingPage
        {...defaultProps}
        subcategory={makeSubcategory({ body: 'body' })}
      />
    );
    const editButtons = screen.queryAllByRole('button').filter((b) => b.textContent?.includes('Edit'));
    expect(editButtons).toHaveLength(0);
  });

  it('has correct ARIA landmarks', () => {
    render(
      <SubcategoryLandingPage
        {...defaultProps}
        subcategory={makeSubcategory({ body: 'overview' })}
      />
    );
    expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'SUVs subcategory landing page');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Subcategory overview' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Content items' })).toBeInTheDocument();
  });

  it('handles onCardClick', () => {
    const onCardClick = vi.fn();
    render(<SubcategoryLandingPage {...defaultProps} onCardClick={onCardClick} />);
    fireEvent.click(screen.getByTestId('card-c1'));
    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'content', id: 'c1', title: 'SUV Guide' })
    );
  });

  it('renders empty state when no content items', () => {
    render(<SubcategoryLandingPage {...defaultProps} contentItems={[]} />);
    expect(screen.getByText('No content yet')).toBeInTheDocument();
  });
});
