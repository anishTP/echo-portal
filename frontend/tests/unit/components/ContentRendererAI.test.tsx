import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('@radix-ui/themes', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  Callout: {
    Root: ({ children }: any) => <div>{children}</div>,
    Icon: ({ children }: any) => <div>{children}</div>,
    Text: ({ children }: any) => <div>{children}</div>,
  },
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('@radix-ui/react-icons', () => ({
  Pencil1Icon: () => <span data-testid="pencil-icon" />,
}));

vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: vi.fn().mockReturnValue({
    isAuthenticated: true,
    user: { roles: ['contributor'] },
  }),
}));

vi.mock('../../../src/components/editor/VideoEmbed', () => ({
  VideoEmbed: () => null,
  detectVideoType: () => 'unknown',
}));

vi.mock('../../../src/components/library/ContentRenderer.module.css', () => ({
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('rehype-raw', () => ({ default: () => {} }));

vi.mock('animejs', () => ({
  animate: vi.fn().mockReturnValue({ cancel: vi.fn() }),
}));

import { ContentRenderer } from '../../../src/components/library/ContentRenderer';

const mockContent: any = {
  id: 'content-1',
  title: 'Test Content',
  description: 'A description',
  slug: 'test-content',
  contentType: 'guideline',
  category: 'Brand',
  tags: ['test'],
  isPublished: true,
  publishedAt: '2025-01-01T00:00:00Z',
  createdBy: { displayName: 'Test User', avatarUrl: null },
  currentVersion: { body: '# Hello' },
};

describe('ContentRenderer AI FAB', () => {
  it('renders AI FAB button when onToggleAI is provided', () => {
    const onToggleAI = vi.fn();
    render(
      <MemoryRouter>
        <ContentRenderer
          content={mockContent}
          isLoading={false}
          isError={false}
          onToggleAI={onToggleAI}
          aiPanelOpen={false}
        />
      </MemoryRouter>
    );
    const fab = screen.getByLabelText('Open AI Analysis');
    expect(fab).toBeInTheDocument();
    expect(fab).toHaveTextContent('AI');
  });

  it('calls onToggleAI when FAB is clicked', () => {
    const onToggleAI = vi.fn();
    render(
      <MemoryRouter>
        <ContentRenderer
          content={mockContent}
          isLoading={false}
          isError={false}
          onToggleAI={onToggleAI}
          aiPanelOpen={false}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Open AI Analysis'));
    expect(onToggleAI).toHaveBeenCalledTimes(1);
  });

  it('disables FAB interaction when AI panel is open', () => {
    const onToggleAI = vi.fn();
    render(
      <MemoryRouter>
        <ContentRenderer
          content={mockContent}
          isLoading={false}
          isError={false}
          onToggleAI={onToggleAI}
          aiPanelOpen={true}
        />
      </MemoryRouter>
    );
    // FAB stays in DOM for animation but is non-interactive
    const fab = screen.getByLabelText('Open AI Analysis');
    expect(fab).toBeInTheDocument();
    expect(fab).toHaveStyle({ pointerEvents: 'none' });
  });

  it('does not render FAB when onToggleAI is not provided', () => {
    render(
      <MemoryRouter>
        <ContentRenderer
          content={mockContent}
          isLoading={false}
          isError={false}
        />
      </MemoryRouter>
    );
    expect(screen.queryByLabelText('Open AI Analysis')).not.toBeInTheDocument();
  });
});
