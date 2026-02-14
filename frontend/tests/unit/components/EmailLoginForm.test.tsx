import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn();

// Mock Radix components
vi.mock('@radix-ui/themes', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} {...props}>{children}</button>
  ),
  TextField: {
    Root: ({ value, onChange, type, placeholder, required, disabled, ...props }: any) => (
      <input
        value={value}
        onChange={onChange}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        {...props}
      />
    ),
  },
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Spinner: () => <span data-testid="spinner">Loading...</span>,
  Callout: {
    Root: ({ children, ...props }: any) => <div role="alert" {...props}>{children}</div>,
    Text: ({ children }: any) => <span>{children}</span>,
  },
  Link: ({ children, onClick, ...props }: any) => (
    <a href="#" onClick={onClick} {...props}>{children}</a>
  ),
}));

import { EmailLoginForm } from '../../../src/components/auth/EmailLoginForm';

describe('EmailLoginForm', () => {
  it('renders email and password fields', () => {
    const onSubmit = vi.fn();
    render(<EmailLoginForm onSubmit={onSubmit} />);
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    const onSubmit = vi.fn();
    render(<EmailLoginForm onSubmit={onSubmit} />);
    expect(screen.getByText('Sign in with email')).toBeInTheDocument();
  });

  it('renders forgot password link when handler provided', () => {
    const onSubmit = vi.fn();
    const onForgotPassword = vi.fn();
    render(<EmailLoginForm onSubmit={onSubmit} onForgotPassword={onForgotPassword} />);
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });

  it('calls onSubmit with email and password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<EmailLoginForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'password123' },
    });

    fireEvent.submit(screen.getByText('Sign in with email').closest('form')!);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('displays error message on failed submit', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Invalid email or password'));
    render(<EmailLoginForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'wrong' },
    });

    fireEvent.submit(screen.getByText('Sign in with email').closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  it('shows verification message for needsVerification error', async () => {
    const error = Object.assign(new Error('Please verify your email'), { needsVerification: true });
    const onSubmit = vi.fn().mockRejectedValue(error);
    render(<EmailLoginForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'password' },
    });

    fireEvent.submit(screen.getByText('Sign in with email').closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Please verify your email')).toBeInTheDocument();
    });
  });

  it('disables form when disabled prop is true', () => {
    const onSubmit = vi.fn();
    render(<EmailLoginForm onSubmit={onSubmit} disabled />);
    expect(screen.getByPlaceholderText('you@example.com')).toBeDisabled();
    expect(screen.getByPlaceholderText('Enter your password')).toBeDisabled();
  });
});
