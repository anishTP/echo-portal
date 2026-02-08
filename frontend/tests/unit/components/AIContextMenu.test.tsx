import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIContextMenu } from '../../../src/components/ai/AIContextMenu';

describe('AIContextMenu', () => {
  const defaultProps = {
    position: { x: 100, y: 200 },
    selectedText: 'Hello world',
    onTransform: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders predefined transform actions', () => {
    render(<AIContextMenu {...defaultProps} />);
    expect(screen.getByText('Rewrite')).toBeInTheDocument();
    expect(screen.getByText('Summarize')).toBeInTheDocument();
    expect(screen.getByText('Expand')).toBeInTheDocument();
    expect(screen.getByText('Change Tone')).toBeInTheDocument();
  });

  it('shows selected text character count', () => {
    render(<AIContextMenu {...defaultProps} />);
    expect(screen.getByText(/11 chars selected/)).toBeInTheDocument();
  });

  it('positions the menu at the given coordinates', () => {
    const { container } = render(<AIContextMenu {...defaultProps} />);
    const menu = container.firstChild as HTMLElement;
    expect(menu.style.left).toBe('100px');
    expect(menu.style.top).toBe('200px');
  });

  it('calls onTransform with correct instruction when action clicked', () => {
    render(<AIContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Rewrite'));
    expect(defaultProps.onTransform).toHaveBeenCalledWith('rewrite');
  });

  it('calls onTransform with "summarize" when Summarize clicked', () => {
    render(<AIContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Summarize'));
    expect(defaultProps.onTransform).toHaveBeenCalledWith('summarize');
  });

  it('closes on Escape key', () => {
    render(<AIContextMenu {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes on click outside', () => {
    render(<AIContextMenu {...defaultProps} />);
    fireEvent.mouseDown(document);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows custom instruction input when "Custom instruction..." clicked', () => {
    render(<AIContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Custom instruction...'));
    expect(screen.getByPlaceholderText('e.g., make it more formal')).toBeInTheDocument();
  });

  it('submits custom instruction', () => {
    render(<AIContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Custom instruction...'));

    const input = screen.getByPlaceholderText('e.g., make it more formal');
    fireEvent.change(input, { target: { value: 'make it funnier' } });
    fireEvent.submit(input.closest('form')!);

    expect(defaultProps.onTransform).toHaveBeenCalledWith('make it funnier');
  });

  it('does not submit empty custom instruction', () => {
    render(<AIContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Custom instruction...'));

    const input = screen.getByPlaceholderText('e.g., make it more formal');
    fireEvent.submit(input.closest('form')!);

    expect(defaultProps.onTransform).not.toHaveBeenCalled();
  });
});
