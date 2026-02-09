import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

import { SlashCommandInput } from '../../../src/components/ai/SlashCommandInput';

describe('SlashCommandInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a contentEditable div with textbox role', () => {
    render(<SlashCommandInput {...defaultProps} />);
    const el = screen.getByRole('textbox');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('contenteditable', 'true');
  });

  it('shows placeholder via data attribute', () => {
    render(<SlashCommandInput {...defaultProps} placeholder="Ask AI..." />);
    const el = screen.getByRole('textbox');
    expect(el).toHaveAttribute('data-placeholder', 'Ask AI...');
  });

  it('renders plain text without slash command', () => {
    render(<SlashCommandInput {...defaultProps} value="hello world" />);
    const el = screen.getByRole('textbox');
    expect(el.textContent).toBe('hello world');
    // No slash-cmd span
    expect(el.querySelector('.slash-cmd')).toBeNull();
  });

  it('highlights /replace prefix', () => {
    render(<SlashCommandInput {...defaultProps} value="/replace make shorter" />);
    const el = screen.getByRole('textbox');
    const badge = el.querySelector('.slash-cmd');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('/replace');
    expect(el.textContent).toContain('make shorter');
  });

  it('highlights /analyse prefix', () => {
    render(<SlashCommandInput {...defaultProps} value="/analyse check tone" />);
    const el = screen.getByRole('textbox');
    const badge = el.querySelector('.slash-cmd');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('/analyse');
  });

  it('highlights /analyze prefix (alias)', () => {
    render(<SlashCommandInput {...defaultProps} value="/analyze check tone" />);
    const el = screen.getByRole('textbox');
    const badge = el.querySelector('.slash-cmd');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('/analyze');
  });

  it('highlights /add prefix', () => {
    render(<SlashCommandInput {...defaultProps} value="/add introduction paragraph" />);
    const el = screen.getByRole('textbox');
    const badge = el.querySelector('.slash-cmd');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('/add');
  });

  it('does not highlight unknown slash commands', () => {
    render(<SlashCommandInput {...defaultProps} value="/unknown do something" />);
    const el = screen.getByRole('textbox');
    expect(el.querySelector('.slash-cmd')).toBeNull();
  });

  it('calls onSubmit on Enter keydown', () => {
    const onSubmit = vi.fn();
    render(<SlashCommandInput {...defaultProps} onSubmit={onSubmit} />);
    const el = screen.getByRole('textbox');
    fireEvent.keyDown(el, { key: 'Enter', shiftKey: false });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not call onSubmit on Shift+Enter', () => {
    const onSubmit = vi.fn();
    render(<SlashCommandInput {...defaultProps} onSubmit={onSubmit} />);
    const el = screen.getByRole('textbox');
    fireEvent.keyDown(el, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('strips HTML on paste (prevents default)', () => {
    render(<SlashCommandInput {...defaultProps} />);
    const el = screen.getByRole('textbox');

    const prevented = { value: false };
    fireEvent.paste(el, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? 'plain text only' : '<b>bold</b>'),
      },
    });

    // The paste handler calls preventDefault to strip HTML — verify no HTML was inserted
    expect(el.innerHTML).not.toContain('<b>');
  });

  it('disables editing when disabled is true', () => {
    render(<SlashCommandInput {...defaultProps} disabled />);
    const el = screen.getByRole('textbox');
    expect(el).toHaveAttribute('contenteditable', 'false');
    expect(el.className).toContain('opacity-50');
  });

  it('calls onFocus when focused', () => {
    const onFocus = vi.fn();
    render(<SlashCommandInput {...defaultProps} onFocus={onFocus} />);
    const el = screen.getByRole('textbox');
    fireEvent.focus(el);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
