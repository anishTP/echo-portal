import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

describe('OS Theme Change Listener', () => {
  let mediaQueryListeners: ((e: { matches: boolean }) => void)[] = [];

  beforeEach(() => {
    mediaQueryListeners = [];

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: false, // Start with light mode
      media: query,
      onchange: null,
      addEventListener: vi.fn((event: string, callback: (e: { matches: boolean }) => void) => {
        if (event === 'change') {
          mediaQueryListeners.push(callback);
        }
      }),
      removeEventListener: vi.fn((event: string, callback: (e: { matches: boolean }) => void) => {
        if (event === 'change') {
          mediaQueryListeners = mediaQueryListeners.filter(cb => cb !== callback);
        }
      }),
      dispatchEvent: vi.fn(),
    })));

    document.documentElement.classList.remove('light', 'dark');
  });

  it('registers listener for prefers-color-scheme changes when preference is system', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Should register a listener since default preference is 'system'
    expect(mediaQueryListeners.length).toBeGreaterThan(0);
  });

  it('updates resolved theme when OS preference changes', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Initially light (matches: false)
    expect(screen.getByTestId('resolved').textContent).toBe('light');

    // Simulate OS theme change to dark
    act(() => {
      mediaQueryListeners.forEach(listener => {
        listener({ matches: true }); // dark mode
      });
    });

    expect(screen.getByTestId('resolved').textContent).toBe('dark');
  });

  it('updates document class when OS preference changes', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Simulate OS theme change to dark
    act(() => {
      mediaQueryListeners.forEach(listener => {
        listener({ matches: true }); // dark mode
      });
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('responds to multiple OS theme changes', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Change to dark
    act(() => {
      mediaQueryListeners.forEach(listener => {
        listener({ matches: true });
      });
    });
    expect(screen.getByTestId('resolved').textContent).toBe('dark');

    // Change back to light
    act(() => {
      mediaQueryListeners.forEach(listener => {
        listener({ matches: false });
      });
    });
    expect(screen.getByTestId('resolved').textContent).toBe('light');

    // Change to dark again
    act(() => {
      mediaQueryListeners.forEach(listener => {
        listener({ matches: true });
      });
    });
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
  });
});
