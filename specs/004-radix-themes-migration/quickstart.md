# Quickstart: Radix Themes Migration

**Feature**: 004-radix-themes-migration
**Date**: 2026-01-29

## Prerequisites

- Node.js 20 LTS
- pnpm 9.15.4+
- Echo Portal repository cloned

## Setup

### 1. Install Dependencies

```bash
cd frontend
pnpm add @radix-ui/themes
```

### 2. Configure CSS (index.css)

```css
/* Import Radix Themes before Tailwind */
@import "@radix-ui/themes/styles.css";
@import "tailwindcss";
```

### 3. Wrap App with Theme Provider (main.tsx)

```tsx
import { Theme } from '@radix-ui/themes';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme accentColor="blue" grayColor="slate" radius="medium">
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
```

### 4. Create ThemeContext (context/ThemeContext.tsx)

```tsx
import { createContext, useContext, useEffect, useState } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'echo-portal-theme-preference';

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { preference } = JSON.parse(stored);
      if (['light', 'dark', 'system'].includes(preference)) {
        return preference;
      }
    }
  } catch {}
  return 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    preference === 'system' ? getSystemTheme() : preference
  );

  useEffect(() => {
    const resolved = preference === 'system' ? getSystemTheme() : preference;
    setResolvedTheme(resolved);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolved);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [preference]);

  const setPreference = (newPreference: ThemePreference) => {
    setPreferenceState(newPreference);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      preference: newPreference,
      lastUpdated: new Date().toISOString()
    }));
  };

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

### 5. Add Theme Toggle to AppHeader

```tsx
import { DropdownMenu, Button } from '@radix-ui/themes';
import { useTheme } from '../context/ThemeContext';

function ThemeToggle() {
  const { preference, setPreference, resolvedTheme } = useTheme();

  const icon = resolvedTheme === 'dark' ? '🌙' : '☀️';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button variant="ghost" size="2">
          {icon}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onClick={() => setPreference('light')}>
          ☀️ Light {preference === 'light' && '✓'}
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => setPreference('dark')}>
          🌙 Dark {preference === 'dark' && '✓'}
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => setPreference('system')}>
          💻 System {preference === 'system' && '✓'}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
```

## Verification

### Manual Testing

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. Open http://localhost:5173

3. Verify theme toggle in header:
   - Click toggle → dropdown appears
   - Select "Dark" → UI switches to dark mode
   - Select "Light" → UI switches to light mode
   - Select "System" → UI follows OS preference

4. Verify persistence:
   - Set theme to "Dark"
   - Refresh page
   - Theme should remain "Dark"

### Automated Testing

```bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

## Component Migration Pattern

When migrating a component from Tailwind to Radix:

### Before (Tailwind)
```tsx
<button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
  Click me
</button>
```

### After (Radix Themes)
```tsx
import { Button } from '@radix-ui/themes';

<Button variant="solid" size="2">
  Click me
</Button>
```

### Keeping Layout Utilities
```tsx
// Keep Tailwind for layout, use Radix for component styling
<div className="flex items-center gap-4">
  <Button variant="solid">Primary</Button>
  <Button variant="outline">Secondary</Button>
</div>
```

## Design Token Customization

Radix Themes provides centralized design tokens that propagate to all components automatically.

### Available Theme Props

```tsx
<Theme
  accentColor="blue"    // Primary brand color
  grayColor="slate"     // Neutral/gray scale
  radius="medium"       // Border radius scale
  scaling="100%"        // Size scaling factor
  panelBackground="solid" // Panel background style
>
```

### Accent Colors

The `accentColor` prop controls the primary brand color used for:
- Buttons (solid variant)
- Links
- Focus rings
- Selected states
- Progress indicators

Available values: `gray`, `gold`, `bronze`, `brown`, `yellow`, `amber`, `orange`, `tomato`, `red`, `ruby`, `crimson`, `pink`, `plum`, `purple`, `violet`, `iris`, `indigo`, `blue`, `cyan`, `teal`, `jade`, `green`, `grass`, `lime`, `mint`, `sky`

**Example - Change to purple:**
```tsx
<Theme accentColor="purple">
```

### Gray Scales

The `grayColor` prop controls the neutral color scale used for:
- Text colors
- Borders
- Backgrounds
- Disabled states

Available values: `gray`, `mauve`, `slate`, `sage`, `olive`, `sand`

**Example - Change to sage (greenish gray):**
```tsx
<Theme grayColor="sage">
```

### Border Radius

The `radius` prop controls the border radius of all components:

| Value | Description |
|-------|-------------|
| `none` | No border radius (0px) |
| `small` | Subtle rounding (3px) |
| `medium` | Default rounding (6px) |
| `large` | Prominent rounding (9px) |
| `full` | Fully rounded (9999px for pills) |

**Example - More rounded corners:**
```tsx
<Theme radius="large">
```

### Scaling

The `scaling` prop applies a size multiplier to all components:

| Value | Effect |
|-------|--------|
| `90%` | Compact UI |
| `95%` | Slightly compact |
| `100%` | Default size |
| `105%` | Slightly larger |
| `110%` | Larger UI |

### Verifying Token Propagation

To verify tokens propagate correctly:

1. **Accent Color Test**: Change `accentColor` and verify:
   - All `Button` components change color
   - All `Badge` components with no explicit color change
   - Focus rings match the new color

2. **Gray Scale Test**: Change `grayColor` and verify:
   - Text colors update across the app
   - Borders and backgrounds update
   - `Card` and `Callout` backgrounds update

3. **Radius Test**: Change `radius` and verify:
   - Button corners update
   - Card corners update
   - Input field corners update
   - Dialog corners update

### Example: Complete Theme Configuration

```tsx
// main.tsx
<Theme
  accentColor="indigo"
  grayColor="mauve"
  radius="large"
  scaling="100%"
  panelBackground="translucent"
>
  {/* All components inherit these tokens */}
</Theme>
```

## Troubleshooting

### Theme not applying
- Ensure `Theme` component wraps the entire app
- Check that `@radix-ui/themes/styles.css` is imported first

### CSS conflicts
- Remove Tailwind color classes (bg-blue-*, text-gray-*, etc.)
- Keep only layout utilities (flex, grid, gap-*, p-*, m-*)

### Monaco editor not theming
- Import `monaco-bridge.css` after Radix styles
- Ensure Monaco container has the theme class
