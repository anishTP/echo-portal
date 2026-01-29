import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/api';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppRouter } from '@/router';
import './index.css';

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
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme
      accentColor="blue"   // T044: Primary color for buttons, links, focus states
      grayColor="slate"    // T045: Neutral scale for text, borders, backgrounds
      radius="medium"      // T046: Border radius for all components
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <AppRouter />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Theme>
  </StrictMode>
);
