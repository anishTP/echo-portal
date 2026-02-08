import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock radix-ui components for testing
vi.mock('@radix-ui/themes', () => ({
  Badge: ({ children, color, variant, size, ...props }: any) => (
    <span data-testid="badge" data-color={color} data-variant={variant} data-size={size} {...props}>
      {children}
    </span>
  ),
  Tooltip: ({ children, content }: any) => (
    <div data-testid="tooltip" data-content={content}>
      {children}
    </div>
  ),
}));

import { AIAttributionBadge } from '../../../src/components/ai/AIAttributionBadge';

describe('AIAttributionBadge', () => {
  it('renders "AI Generated" text', () => {
    render(<AIAttributionBadge />);
    expect(screen.getByText('AI Generated')).toBeInTheDocument();
  });

  it('renders badge with purple color', () => {
    render(<AIAttributionBadge />);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveAttribute('data-color', 'purple');
    expect(badge).toHaveAttribute('data-variant', 'soft');
  });

  it('renders without tooltip when compact=true', () => {
    render(<AIAttributionBadge compact providerId="anthropic" />);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    expect(screen.getByText('AI Generated')).toBeInTheDocument();
  });

  it('renders without tooltip when no detail props provided', () => {
    render(<AIAttributionBadge />);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('renders with tooltip when providerId is set', () => {
    render(<AIAttributionBadge providerId="anthropic" />);
    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.getAttribute('data-content')).toContain('Provider: anthropic');
  });

  it('includes all details in tooltip', () => {
    render(
      <AIAttributionBadge
        providerId="anthropic"
        modelId="claude-sonnet"
        approverName="Jane Doe"
        generatedAt="2026-01-15T12:00:00Z"
      />
    );
    const tooltip = screen.getByTestId('tooltip');
    const content = tooltip.getAttribute('data-content') ?? '';
    expect(content).toContain('Provider: anthropic');
    expect(content).toContain('Model: claude-sonnet');
    expect(content).toContain('Approved by: Jane Doe');
    expect(content).toContain('Generated:');
  });

  it('shows tooltip with approverName even without providerId', () => {
    render(<AIAttributionBadge approverName="John" />);
    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip.getAttribute('data-content')).toContain('Approved by: John');
  });
});
