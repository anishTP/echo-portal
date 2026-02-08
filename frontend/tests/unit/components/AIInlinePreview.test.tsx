import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIInlinePreview } from '../../../src/components/ai/AIInlinePreview';

// Mock AIStreamDisplay used internally
vi.mock('../../../src/components/ai/AIStreamDisplay', () => ({
  AIStreamDisplay: ({ content, isStreaming }: any) => (
    <div data-testid="stream-display" data-streaming={isStreaming}>
      {content}
    </div>
  ),
}));

describe('AIInlinePreview', () => {
  const defaultProps = {
    content: 'AI suggested content here',
    isStreaming: false,
    originalText: 'Original text',
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders the AI content via AIStreamDisplay', () => {
    render(<AIInlinePreview {...defaultProps} />);
    expect(screen.getByTestId('stream-display')).toHaveTextContent('AI suggested content here');
  });

  it('shows "AI Suggestion" label', () => {
    render(<AIInlinePreview {...defaultProps} />);
    expect(screen.getByText('AI Suggestion')).toBeInTheDocument();
  });

  it('shows Accept and Reject buttons when not streaming', () => {
    render(<AIInlinePreview {...defaultProps} />);
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('shows Cancel button when streaming', () => {
    render(<AIInlinePreview {...defaultProps} isStreaming={true} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('calls onAccept when Accept clicked', () => {
    render(<AIInlinePreview {...defaultProps} />);
    fireEvent.click(screen.getByText('Accept'));
    expect(defaultProps.onAccept).toHaveBeenCalled();
  });

  it('calls onReject when Reject clicked', () => {
    render(<AIInlinePreview {...defaultProps} />);
    fireEvent.click(screen.getByText('Reject'));
    expect(defaultProps.onReject).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel clicked during streaming', () => {
    render(<AIInlinePreview {...defaultProps} isStreaming={true} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('displays character count comparison', () => {
    render(<AIInlinePreview {...defaultProps} />);
    expect(screen.getByText(/Original: 13 → AI: 25 chars/)).toBeInTheDocument();
  });
});
