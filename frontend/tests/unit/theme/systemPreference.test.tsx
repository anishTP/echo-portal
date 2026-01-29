import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, useThemeContext } from '../../../src/context/ThemeContext';

// Test component
function TestComponent() {
  const { preference, resolvedTheme } = useThemeContext();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
    </div>
  );
}

describe('System Preference Detection', () => {
  beforeEach(() => {
    // Clear localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    document.documentElement.classList.remove('light', 'dark');
  });

  it('detects dark system preference', () => {
    // Mock matchMedia to return dark preference
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('preference').textContent).toBe('system');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
  });

  it('detects light system preference', () => {
    // Mock matchMedia to return light preference
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: !query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('preference').textContent).toBe('system');
    expect(screen.getByTestId('resolved').textContent).toBe('light');
  });

  it('uses system preference when localStorage has no value', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Default should be 'system' which resolves based on OS preference
    expect(screen.getByTestId('preference').textContent).toBe('system');
  });
});
