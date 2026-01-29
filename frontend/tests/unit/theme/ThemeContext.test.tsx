import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, useThemeContext } from '../../../src/context/ThemeContext';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

// Mock matchMedia
const matchMediaMock = vi.fn((query: string) => ({
  matches: query.includes('dark') ? false : true,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('matchMedia', matchMediaMock);
  localStorageMock.clear();
  document.documentElement.classList.remove('light', 'dark');
});

// Test component that uses the context
function TestComponent() {
  const { preference, resolvedTheme, setPreference } = useThemeContext();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setPreference('light')}>Light</button>
      <button onClick={() => setPreference('dark')}>Dark</button>
      <button onClick={() => setPreference('system')}>System</button>
    </div>
  );
}

describe('ThemeContext', () => {
  describe('Initial State', () => {
    it('defaults to system preference when no localStorage value', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('preference').textContent).toBe('system');
    });

    it('loads preference from localStorage if present', () => {
      localStorageMock.store['echo-portal-theme-preference'] = JSON.stringify({
        preference: 'dark',
        lastUpdated: new Date().toISOString(),
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('preference').textContent).toBe('dark');
    });
  });

  describe('Theme Switching', () => {
    it('switches to light theme when clicking Light button', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      act(() => {
        fireEvent.click(screen.getByText('Light'));
      });

      expect(screen.getByTestId('preference').textContent).toBe('light');
      expect(screen.getByTestId('resolved').textContent).toBe('light');
    });

    it('switches to dark theme when clicking Dark button', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      act(() => {
        fireEvent.click(screen.getByText('Dark'));
      });

      expect(screen.getByTestId('preference').textContent).toBe('dark');
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });

    it('switches to system theme when clicking System button', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // First switch to dark
      act(() => {
        fireEvent.click(screen.getByText('Dark'));
      });

      // Then switch to system
      act(() => {
        fireEvent.click(screen.getByText('System'));
      });

      expect(screen.getByTestId('preference').textContent).toBe('system');
    });
  });

  describe('localStorage Persistence', () => {
    it('saves preference to localStorage when changed', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      act(() => {
        fireEvent.click(screen.getByText('Dark'));
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'echo-portal-theme-preference',
        expect.stringContaining('"preference":"dark"')
      );
    });
  });

  describe('Document Class Updates', () => {
    it('adds light class to document when theme is light', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      act(() => {
        fireEvent.click(screen.getByText('Light'));
      });

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('adds dark class to document when theme is dark', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      act(() => {
        fireEvent.click(screen.getByText('Dark'));
      });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('throws error when useThemeContext is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useThemeContext must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });
});
