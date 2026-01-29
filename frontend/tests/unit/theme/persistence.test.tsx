import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, useThemeContext } from '../../../src/context/ThemeContext';

const STORAGE_KEY = 'echo-portal-theme-preference';

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

// Test component
function TestComponent() {
  const { preference, setPreference } = useThemeContext();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <button onClick={() => setPreference('dark')}>Set Dark</button>
      <button onClick={() => setPreference('light')}>Set Light</button>
    </div>
  );
}

describe('localStorage Persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    localStorageMock.clear();
    document.documentElement.classList.remove('light', 'dark');
  });

  it('stores theme preference in localStorage when changed', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Set Dark'));
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String)
    );

    const storedValue = JSON.parse(localStorageMock.store[STORAGE_KEY]);
    expect(storedValue.preference).toBe('dark');
    expect(storedValue.lastUpdated).toBeDefined();
  });

  it('loads theme preference from localStorage on mount', () => {
    localStorageMock.store[STORAGE_KEY] = JSON.stringify({
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

  it('uses correct storage key (echo-portal-theme-preference)', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Set Light'));
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'echo-portal-theme-preference',
      expect.any(String)
    );
  });

  it('includes lastUpdated timestamp in stored value', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Set Dark'));
    });

    const storedValue = JSON.parse(localStorageMock.store[STORAGE_KEY]);
    expect(storedValue.lastUpdated).toBeDefined();
    // Verify it's a valid ISO date string
    expect(() => new Date(storedValue.lastUpdated)).not.toThrow();
  });

  it('handles invalid JSON in localStorage gracefully', () => {
    localStorageMock.store[STORAGE_KEY] = 'invalid-json';

    // Should not throw and default to 'system'
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('preference').textContent).toBe('system');
  });

  it('handles missing preference field gracefully', () => {
    localStorageMock.store[STORAGE_KEY] = JSON.stringify({
      // preference field is missing
      lastUpdated: new Date().toISOString(),
    });

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Should default to 'system'
    expect(screen.getByTestId('preference').textContent).toBe('system');
  });
});
