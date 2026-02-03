# Radix UI Themes: Best Practices Guide for Building Custom Design Systems

A comprehensive guide for composing custom components and building design systems with Radix UI Themes, based on official documentation and recommended patterns.

---

## Table of Contents

1. [Foundation & Architecture](#1-foundation--architecture)
2. [Token System](#2-token-system)
3. [Color System](#3-color-system)
4. [Typography System](#4-typography-system)
5. [Spacing & Layout](#5-spacing--layout)
6. [Creating Custom Components](#6-creating-custom-components)
7. [Composition Patterns](#7-composition-patterns)
8. [Responsive Design](#8-responsive-design)
9. [Dark Mode Implementation](#9-dark-mode-implementation)
10. [Styling Best Practices](#10-styling-best-practices)
11. [Common Pitfalls & Solutions](#11-common-pitfalls--solutions)
12. [Performance Considerations](#12-performance-considerations)

---

## 1. Foundation & Architecture

### Understanding Radix Themes Philosophy

Radix Themes is built on three core pillars:
- **Radix Primitives** — Accessible, unstyled component behaviors
- **Radix Colors** — A comprehensive color system
- **CSS Variables** — Token-based theming

**Key Principle:** Components are "relatively closed" — they come with predefined styles that are customizable through props and theme configuration, not through direct CSS overrides.

### Initial Setup

```tsx
// 1. Install the package
npm install @radix-ui/themes

// 2. Import CSS at root
import "@radix-ui/themes/styles.css";

// 3. Wrap your app with Theme
import { Theme } from "@radix-ui/themes";

export default function App() {
  return (
    <html>
      <body>
        <Theme>
          <MyApp />
        </Theme>
      </body>
    </html>
  );
}
```

### Theme Configuration

```tsx
<Theme
  accentColor="indigo"      // Primary interactive color
  grayColor="slate"         // Neutral color palette
  radius="medium"           // Border radius factor
  scaling="100%"            // UI density scaling
  panelBackground="solid"   // Panel background style
>
  <MyApp />
</Theme>
```

---

## 2. Token System

### Why Use Tokens?

Tokens provide direct access to theme values, ensuring your custom components remain consistent with the design system. **Changes to the token system are treated as breaking changes**, guaranteeing stability.

### Available Token Categories

| Category | CSS Variable Pattern | Example |
|----------|---------------------|---------|
| Colors | `--accent-1` to `--accent-12` | `var(--accent-9)` |
| Grays | `--gray-1` to `--gray-12` | `var(--gray-11)` |
| Spacing | `--space-1` to `--space-9` | `var(--space-4)` |
| Radius | `--radius-1` to `--radius-6` | `var(--radius-3)` |
| Shadows | `--shadow-1` to `--shadow-6` | `var(--shadow-2)` |
| Typography | Various | `var(--font-size-3)` |

### Using Tokens in Custom Components

```css
.my-custom-card {
  /* Colors */
  background-color: var(--color-panel-solid);
  border: 1px solid var(--gray-6);
  
  /* Spacing */
  padding: var(--space-4);
  gap: var(--space-3);
  
  /* Radius */
  border-radius: var(--radius-3);
  
  /* Shadows */
  box-shadow: var(--shadow-2);
  
  /* Scaling support */
  width: calc(200px * var(--scaling));
}
```

---

## 3. Color System

### 12-Step Color Scale Anatomy

Each color in Radix is a 12-step scale with specific use cases:

| Steps | Purpose | Example Usage |
|-------|---------|---------------|
| 1-2 | Backgrounds | Page backgrounds, subtle fills |
| 3-5 | Interactive components | Hover states, active states |
| 6-8 | Borders and separators | Dividers, outlines |
| 9-10 | Solid colors | Buttons, badges |
| 11-12 | Accessible text | High-contrast text |

### Accent Color Tokens

```css
/* Background colors */
var(--accent-1);  /* Subtle background */
var(--accent-2);  /* UI element background */

/* Interactive states */
var(--accent-3);  /* Hovered UI element */
var(--accent-4);  /* Active/selected element */
var(--accent-5);  /* Subtle border for interactives */

/* Borders */
var(--accent-6);  /* Subtle borders, separators */
var(--accent-7);  /* UI element border, focus ring */
var(--accent-8);  /* Hovered borders */

/* Solid colors */
var(--accent-9);  /* Solid backgrounds */
var(--accent-10); /* Hovered solid backgrounds */

/* Text */
var(--accent-11); /* Low-contrast text */
var(--accent-12); /* High-contrast text */

/* Functional */
var(--accent-surface);   /* Surface color */
var(--accent-indicator); /* For indicators */
var(--accent-track);     /* Track elements */
var(--accent-contrast);  /* Text on solid */
```

### Overriding Accent Colors per Component

```tsx
// Color prop cascades to children
<Callout.Root color="red">
  <Callout.Text>
    <Button variant="surface">Inherits red</Button>
  </Callout.Text>
</Callout.Root>
```

### Custom Brand Color

```css
.radix-themes {
  --my-brand-color: #3052f6;
  --indigo-9: var(--my-brand-color);
  --indigo-a9: var(--my-brand-color);
}
```

### Alpha Colors

Every color has an alpha variant for overlays:

```css
var(--red-a1);  /* Transparent red */
var(--red-a9);  /* Semi-transparent solid */
```

### Reducing Bundle Size with Individual Colors

```tsx
// Import only colors you need
import "@radix-ui/themes/tokens/base.css";
import "@radix-ui/themes/tokens/colors/ruby.css";
import "@radix-ui/themes/tokens/colors/teal.css";
import "@radix-ui/themes/tokens/colors/slate.css";
import "@radix-ui/themes/components.css";
import "@radix-ui/themes/utilities.css";
```

---

## 4. Typography System

### 9-Step Type Scale

```tsx
<Text size="1">12px - Tiny text</Text>
<Text size="2">14px - Small text (default body)</Text>
<Text size="3">16px - Regular text</Text>
<Text size="4">18px - Slightly larger</Text>
<Text size="5">20px - Medium heading</Text>
<Text size="6">24px - Section heading</Text>
<Text size="7">28px - Page heading</Text>
<Text size="8">35px - Hero text</Text>
<Text size="9">60px - Display text</Text>
```

Each step includes optimized line-height and letter-spacing.

### Font Weight Tokens

```css
.radix-themes {
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;
}
```

### Custom Fonts

```css
.radix-themes {
  --default-font-family: "Inter", sans-serif;
  --heading-font-family: "Cal Sans", sans-serif;
  --code-font-family: "Fira Code", monospace;
  --em-font-family: "Georgia", serif;
  --quote-font-family: "Georgia", serif;
}
```

### With next/font

```tsx
// layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* styles.css */
.radix-themes {
  --default-font-family: var(--font-inter);
}
```

### Advanced Typography Settings

```css
.radix-themes {
  --heading-font-size-adjust: 1.05;
  --heading-leading-trim-start: 0.42em;
  --heading-leading-trim-end: 0.38em;
  --heading-letter-spacing: -0.01em;
}
```

### Using trim for Precise Spacing

```tsx
// Removes leading space for optical alignment
<Text trim="both">
  Perfectly aligned text
</Text>
```

---

## 5. Spacing & Layout

### 9-Step Space Scale

| Step | Value |
|------|-------|
| 1 | 4px |
| 2 | 8px |
| 3 | 12px |
| 4 | 16px |
| 5 | 24px |
| 6 | 32px |
| 7 | 40px |
| 8 | 48px |
| 9 | 64px |

### Layout Components Philosophy

**Separation of Concerns:** Layout components handle positioning; content components handle interactivity.

```tsx
// Box - fundamental layout primitive
<Box p="4" />

// Flex - flexbox layouts
<Flex direction="column" gap="3" align="center" />

// Grid - grid layouts
<Grid columns="3" gap="4" />

// Section - vertical page sections
<Section size="2" />

// Container - max-width constraint
<Container size="3" />
```

### Common Layout Props

All layout components share these props:

```tsx
// Padding
<Box p="4" px="2" py="3" pt="1" pr="2" pb="3" pl="4" />

// Margin (available on most components)
<Button m="4" mx="auto" />

// Width/Height
<Box width="100px" height="50vh" />
<Box minWidth="200px" maxWidth="600px" />

// Positioning
<Box position="relative" top="4" left="0" />

// Flex child props
<Box flexBasis="100%" flexShrink="0" flexGrow="1" />

// Grid child props
<Box gridColumn="1 / 3" gridRow="span 2" />
```

### Scaling Factor

The `scaling` prop adjusts UI density uniformly:

```tsx
<Theme scaling="90%">  {/* Compact */}
<Theme scaling="100%"> {/* Default */}
<Theme scaling="110%"> {/* Spacious */}
```

```css
/* Use in custom components */
.my-component {
  width: calc(200px * var(--scaling));
}
```

---

## 6. Creating Custom Components

### The Right Approach

When creating custom components, use the same building blocks as Radix Themes:

1. **Theme tokens** — CSS variables for colors, spacing, etc.
2. **Radix Primitives** — Accessible, unstyled behaviors
3. **Radix Colors** — Color system
4. **Reset component** — Browser style normalization

### Using the Reset Component

```tsx
import { Reset } from "@radix-ui/themes";

function MyCustomButton({ children }) {
  return (
    <Reset>
      <button className="my-custom-button">
        {children}
      </button>
    </Reset>
  );
}
```

Reset provides:
- Removes opinionated browser styles
- Sets idiomatic layout defaults
- Applies cursor style from theme settings
- Adds `box-sizing: border-box`

### Example: Custom Card Component

```tsx
// MyCard.tsx
import { Box, Text, Flex } from "@radix-ui/themes";
import styles from "./MyCard.module.css";

interface MyCardProps {
  title: string;
  children: React.ReactNode;
  variant?: "surface" | "ghost";
}

export function MyCard({ title, children, variant = "surface" }: MyCardProps) {
  return (
    <Box className={styles.card} data-variant={variant}>
      <Text as="h3" size="4" weight="bold" mb="2">
        {title}
      </Text>
      <Flex direction="column" gap="2">
        {children}
      </Flex>
    </Box>
  );
}
```

```css
/* MyCard.module.css */
.card {
  padding: var(--space-4);
  border-radius: var(--radius-3);
  background: var(--color-panel-solid);
}

.card[data-variant="surface"] {
  border: 1px solid var(--gray-6);
  box-shadow: var(--shadow-2);
}

.card[data-variant="ghost"] {
  background: transparent;
}
```

### Building with Radix Primitives

For complex interactive components, use Primitives:

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { Theme, Button, Flex, Text } from "@radix-ui/themes";

function CustomDialog({ trigger, title, children }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {trigger}
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* IMPORTANT: Wrap portal content with Theme */}
        <Theme>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title asChild>
              <Text size="5" weight="bold">{title}</Text>
            </Dialog.Title>
            {children}
            <Dialog.Close asChild>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Theme>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

## 7. Composition Patterns

### The asChild Pattern

Use `asChild` to merge Radix functionality onto custom elements:

```tsx
// Change underlying element
<Tooltip.Trigger asChild>
  <a href="/link">Hover me</a>
</Tooltip.Trigger>

// Compose behaviors
<Tooltip.Trigger asChild>
  <Dialog.Trigger asChild>
    <Button>Open both!</Button>
  </Dialog.Trigger>
</Tooltip.Trigger>
```

### Layout Components with asChild

```tsx
// Make a flex container render as a label
<Flex asChild justify="between" align="center">
  <label>
    <Text>Enable notifications</Text>
    <Switch />
  </label>
</Flex>
```

### Requirements for Custom Components with asChild

```tsx
// Your component MUST forward refs and spread props
const MyButton = React.forwardRef((props, ref) => (
  <button {...props} ref={ref} />
));

// Now it works with asChild
<Dialog.Trigger asChild>
  <MyButton>Click me</MyButton>
</Dialog.Trigger>
```

### Using Slot for Custom asChild

```tsx
import { Slot } from "@radix-ui/themes";

function MyCustomTrigger({ asChild, children, ...props }) {
  const Comp = asChild ? Slot : "button";
  return <Comp {...props}>{children}</Comp>;
}
```

### Composing Typography

```tsx
<Text>
  The <Em>most</Em> important thing is to{" "}
  <Strong>stay positive</Strong> and keep{" "}
  <Code>coding</Code>.
</Text>
```

### Form Control Alignment

Text automatically aligns with form controls:

```tsx
<Text as="label" size="2">
  <Flex gap="2">
    <Checkbox />
    I agree to terms
  </Flex>
</Text>
```

---

## 8. Responsive Design

### Breakpoint System

| Name | Width | Key |
|------|-------|-----|
| initial | 0px+ | `initial` |
| xs | 520px+ | `xs` |
| sm | 768px+ | `sm` |
| md | 1024px+ | `md` |
| lg | 1280px+ | `lg` |
| xl | 1640px+ | `xl` |

### Responsive Object Syntax

Most props accept responsive objects:

```tsx
// Size changes at breakpoints
<Heading size={{ initial: "5", md: "7", xl: "9" }}>
  Responsive Heading
</Heading>

// Layout changes
<Flex
  direction={{ initial: "column", sm: "row" }}
  gap={{ initial: "2", md: "4" }}
>
  <Box />
  <Box />
</Flex>

// Grid columns
<Grid columns={{ initial: "1", sm: "2", lg: "4" }}>
  {items.map(item => <Card key={item.id} />)}
</Grid>

// Width with CSS values
<Flex width={{ initial: "100%", sm: "300px", md: "500px" }} />
```

### Hide/Show Content

```tsx
// Hide on mobile
<Box display={{ initial: "none", md: "block" }}>
  Desktop only content
</Box>

// Show only on mobile
<Box display={{ initial: "block", md: "none" }}>
  Mobile only content
</Box>
```

### How It Works (Performance)

Responsive props compile to CSS variables and utility classes:

```tsx
// This JSX:
<Flex width={{ initial: "100%", sm: "300px", md: "500px" }} />

// Renders as:
<div
  style={{
    "--width": "100%",
    "--width-sm": "300px",
    "--width-md": "500px"
  }}
  class="rt-Flex rt-r-w sm:rt-r-w md:rt-r-w"
/>
```

No runtime evaluation — works with SSR!

---

## 9. Dark Mode Implementation

### Basic Setup

```tsx
<Theme appearance="dark">
  <MyApp />
</Theme>
```

### With next-themes (Recommended)

```tsx
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

export default function App() {
  return (
    <ThemeProvider attribute="class">
      <Theme>
        <MyApp />
      </Theme>
    </ThemeProvider>
  );
}
```

**Important:** Do NOT set `appearance={resolvedTheme}`. Let next-themes handle class switching to prevent flash.

### Supported Class Names

Any library supporting these classes works:
- `className="light"`
- `className="light-theme"`
- `className="dark"`
- `className="dark-theme"`

### Custom Dark Mode Colors

```css
/* Light mode overrides */
.radix-themes {
  --my-brand-color: #3052f6;
  --indigo-9: var(--my-brand-color);
}

/* Dark mode overrides - MUST come after light */
.dark, .dark-theme {
  --my-brand-color: #5c7cfa;
  --indigo-9: var(--my-brand-color);
}
```

### Generate Custom Palettes

Use the [custom color palette tool](https://www.radix-ui.com/colors/custom) to generate both light and dark palettes.

---

## 10. Styling Best Practices

### Decision Framework

When you need custom styles, follow this order:

1. **Use existing props** — Check if the component has a prop for what you need
2. **Tweak token system** — Override CSS variables globally
3. **Create new component** — Build with Primitives + tokens
4. **Reconsider fit** — If overriding heavily, Radix Themes may not be right

### CSS Import Order

```tsx
// Correct order
import "@radix-ui/themes/styles.css";
import "./my-styles.css"; // Your styles AFTER
```

### Split CSS for Precise Control

```tsx
import "@radix-ui/themes/tokens.css";
import "@radix-ui/themes/components.css";
import "./my-component-styles.css"; // Your component styles
import "@radix-ui/themes/utilities.css"; // Utilities LAST
```

### Tailwind Integration Caveats

If using Tailwind:

1. Avoid `@tailwind base` or configure CSS layers
2. Set up postcss-import properly
3. Remember: Tailwind's paradigm may conflict with closed component philosophy

```css
/* Workaround for Tailwind base styles */
@layer tailwind {
  @tailwind base;
}
```

### Z-Index Management

**Best Practice:** Don't use z-index values other than `auto`, `0`, or `-1`.

```tsx
// Radix handles stacking automatically
// Popover inside Dialog inside Popover = just works
```

### Portals and Theme Context

Custom portals lose theme context. Always wrap:

```tsx
<Dialog.Portal>
  <Theme>
    <Dialog.Content>...</Dialog.Content>
  </Theme>
</Dialog.Portal>
```

---

## 11. Common Pitfalls & Solutions

### Next.js CSS Import Order

**Problem:** Next.js 13-14.1 doesn't guarantee CSS import order.

**Solution:**
```tsx
// Use postcss-import to merge CSS
// Or import in page.tsx instead of layout.tsx
```

### Tailwind Button Reset Conflict

**Problem:** Tailwind's button reset removes backgrounds.

**Solution:**
```css
/* Set up CSS layers */
@layer tailwind-base {
  @tailwind base;
}

@layer radix-themes {
  @import "@radix-ui/themes/styles.css";
}
```

### Missing Styles in Custom Portals

**Problem:** Portal content appears unstyled.

**Solution:** Always wrap portal content with `<Theme>`:

```tsx
<MyPortal>
  <Theme>
    <Content />
  </Theme>
</MyPortal>
```

### Complex CSS Precedence with asChild

**Problem:** Custom styles override utility props.

```tsx
// This doesn't work as expected
<Box asChild m="5">
  <p className="my-paragraph">Text</p>
</Box>
```

**Solution:** Import utilities.css after your styles:

```tsx
import "@radix-ui/themes/tokens.css";
import "@radix-ui/themes/components.css";
import "./my-styles.css";
import "@radix-ui/themes/utilities.css"; // AFTER custom
```

### Hydration Warnings

**Solution:**
```tsx
<html suppressHydrationWarning>
  <body>{children}</body>
</html>
```

---

## 12. Performance Considerations

### Tree Shaking

Components are tree-shakeable. Import only what you use:

```tsx
// Good - specific imports
import { Button, Flex, Text } from "@radix-ui/themes";

// Also good - namespace import (tree-shakes)
import * as Themes from "@radix-ui/themes";
```

### Layout-Only Usage

For minimal bundle, use only layout components:

```tsx
import "@radix-ui/themes/layout.css";
import { Box, Flex, Grid } from "@radix-ui/themes";

// Still need Theme wrapper for spacing tokens
<Theme>
  <Flex gap="3">...</Flex>
</Theme>
```

### Color Bundle Optimization

Colors are ~20% of CSS. Import individually:

```tsx
import "@radix-ui/themes/tokens/base.css";
import "@radix-ui/themes/tokens/colors/indigo.css";
import "@radix-ui/themes/tokens/colors/slate.css";
import "@radix-ui/themes/components.css";
import "@radix-ui/themes/utilities.css";
```

### No Runtime Overhead

- Responsive props compile to CSS variables
- No JavaScript evaluation for breakpoints
- SSR compatible
- No styling library overhead (vanilla CSS)

---

## Quick Reference: Token Cheat Sheet

### Colors
```css
--accent-1 to --accent-12    /* Accent scale */
--accent-a1 to --accent-a12  /* Alpha variants */
--gray-1 to --gray-12        /* Gray scale */
--color-background           /* Page background */
--color-panel-solid          /* Panel background */
--color-surface              /* Form backgrounds */
```

### Spacing
```css
--space-1 to --space-9       /* 4px to 64px */
--scaling                    /* Scaling factor */
```

### Typography
```css
--font-size-1 to --font-size-9
--font-weight-light/regular/medium/bold
--default-font-family
--heading-font-family
--code-font-family
```

### Radius
```css
--radius-1 to --radius-6
--radius-full
--radius-thumb
```

### Shadows
```css
--shadow-1 to --shadow-6
```

---

## Recommended Resources

- [Radix Themes Documentation](https://www.radix-ui.com/themes/docs)
- [Radix Primitives](https://www.radix-ui.com/primitives)
- [Radix Colors](https://www.radix-ui.com/colors)
- [Custom Color Palette Tool](https://www.radix-ui.com/colors/custom)
- [Theme Playground](https://www.radix-ui.com/themes/playground)
- [Source Code](https://github.com/radix-ui/themes)

---

*This guide is based on Radix UI Themes documentation as of January 2026. Always refer to the official documentation for the most up-to-date information.*
