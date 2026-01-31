import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/api';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider, useThemeContext } from '@/context/ThemeContext';
import { AppRouter } from '@/router';
import './index.css';
import './styles/brand-colors.css';

/**
 * Radix Theme Configuration
 *
 * Design tokens are configured here and propagate to all Radix components.
 *
 * Available options:
 * - accentColor: blue, purple, green, red, orange, etc. (25+ colors)
 * - grayColor: gray, slate, sage, olive, mauve, sand
 * - radius: none, small, medium, large, full
 * - scaling: 90%, 95%, 100%, 105%, 110%
 *
 * Change any value below to see it propagate to all components.
 * See specs/004-radix-themes-migration/quickstart.md for full documentation.
 */

function ThemedApp() {
  const { resolvedTheme } = useThemeContext();

  return (
    <Theme
      appearance={resolvedTheme}
      accentColor="orange"  // Brand orange (#FF5310) - overridden in brand-colors.css
      grayColor="sand"      // Warm neutral scale for text, borders, backgrounds
      radius="medium"       // T046: Border radius for all components
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </QueryClientProvider>
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </StrictMode>
);
