import { useThemeContext, type ThemePreference, type ResolvedTheme } from '../context/ThemeContext';

export interface UseThemeReturn {
  /** The user's preference: 'light', 'dark', or 'system' */
  preference: ThemePreference;
  /** The actual theme being applied: 'light' or 'dark' */
  theme: ResolvedTheme;
  /** Set the theme preference */
  setTheme: (preference: ThemePreference) => void;
  /** Check if current theme is dark */
  isDark: boolean;
  /** Check if current theme is light */
  isLight: boolean;
  /** Check if using system preference */
  isSystem: boolean;
}

/**
 * Hook to access and control the application theme.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, setTheme, isDark } = useTheme();
 *
 *   return (
 *     <button onClick={() => setTheme(isDark ? 'light' : 'dark')}>
 *       Toggle theme
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme(): UseThemeReturn {
  const { preference, resolvedTheme, setPreference } = useThemeContext();

  return {
    preference,
    theme: resolvedTheme,
    setTheme: setPreference,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isSystem: preference === 'system',
  };
}
