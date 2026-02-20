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
  ContentBreadcrumb: ({ section, contentTitle }: any) => (
    <div data-testid="breadcrumb">{section} / {contentTitle}</div>
  ),
}));

// Mock LandingPageCardGrid
vi.mock('../../../src/components/library/LandingPageCardGrid', () => ({
  LandingPageCardGrid: ({ cards, onCardClick, emptyMessage, isLoading }: any) => (
    <div data-testid="card-grid" data-loading={isLoading}>
      {cards.length === 0 && <div>{emptyMessage}</div>}
      {cards.map((card: any) => (
        <div key={card.id} data-testid={`card-${card.id}`} onClick={() => onCardClick(card)}>
          {card.name}
        </div>
      ))}
    </div>
  ),
}));

import { SectionLandingPage } from '../../../src/components/library/SectionLandingPage';
import type { CategoryDTO } from '../../../src/services/category-api';

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

describe('SectionLandingPage', () => {
  const defaultProps = {
    section: 'brand',
    categories: [makeCategory(), makeCategory({ id: 'cat-2', name: 'Fashion' })],
    categoryCounts: { Vehicles: 5, Fashion: 3 },
    body: '',
    canEdit: false,
    onCardClick: vi.fn(),
  };

  it('renders section title and breadcrumb', () => {
    render(<SectionLandingPage {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Brands');
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders body content when present', () => {
    render(<SectionLandingPage {...defaultProps} body="Welcome to Brands" />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('Welcome to Brands');
  });

  it('shows "Add overview" for editors when body empty in branch mode', () => {
    render(<SectionLandingPage {...defaultProps} canEdit branchMode onEditRequest={vi.fn()} />);
    expect(screen.getByText('Add overview')).toBeInTheDocument();
  });

  it('hides body area for viewers when body empty', () => {
    render(<SectionLandingPage {...defaultProps} />);
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
    expect(screen.queryByText('Add overview')).not.toBeInTheDocument();
  });

  it('renders category cards with counts', () => {
    render(<SectionLandingPage {...defaultProps} />);
    expect(screen.getByTestId('card-cat-1')).toHaveTextContent('Vehicles');
    expect(screen.getByTestId('card-cat-2')).toHaveTextContent('Fashion');
  });

  it('edit button visible for admins in draft branch', () => {
    render(
      <SectionLandingPage {...defaultProps} canEdit branchMode onEditRequest={vi.fn()} body="some body" />
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('edit button hidden for non-admins', () => {
    render(<SectionLandingPage {...defaultProps} body="some body" />);
    // Only the Edit button from the header, not the "Add overview" button
    const buttons = screen.queryAllByRole('button');
    const editButtons = buttons.filter((b) => b.textContent?.includes('Edit'));
    expect(editButtons).toHaveLength(0);
  });

  it('calls onEditRequest when Edit button is clicked', () => {
    const onEditRequest = vi.fn();
    render(
      <SectionLandingPage {...defaultProps} canEdit branchMode onEditRequest={onEditRequest} body="body" />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEditRequest).toHaveBeenCalledTimes(1);
  });

  it('calls onEditRequest when "Add overview" is clicked', () => {
    const onEditRequest = vi.fn();
    render(
      <SectionLandingPage {...defaultProps} canEdit branchMode onEditRequest={onEditRequest} />
    );
    fireEvent.click(screen.getByText('Add overview'));
    expect(onEditRequest).toHaveBeenCalledTimes(1);
  });

  it('has correct ARIA landmarks', () => {
    render(<SectionLandingPage {...defaultProps} body="overview" />);
    expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'Brands section landing page');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Section overview' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Categories' })).toBeInTheDocument();
  });

  it('handles onCardClick', () => {
    const onCardClick = vi.fn();
    render(<SectionLandingPage {...defaultProps} onCardClick={onCardClick} />);
    fireEvent.click(screen.getByTestId('card-cat-1'));
    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'category', id: 'cat-1', name: 'Vehicles' })
    );
  });
});
