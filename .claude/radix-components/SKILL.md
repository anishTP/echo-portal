---
name: radix-components
description: "Create and compose custom React components using Radix UI Themes for design systems. Use this skill when: (1) Creating new custom components that integrate with Radix Themes, (2) Building a design system on top of Radix UI, (3) Styling components using Radix theme tokens, (4) Composing Radix Primitives with theme styling, (5) Implementing responsive designs with Radix breakpoints, (6) Setting up dark mode with Radix color system, (7) Questions about Radix Themes architecture, tokens, or patterns."
---

# Radix UI Components Skill

Create custom, accessible React components using Radix UI Themes that seamlessly integrate with your design system.

## Quick Reference

| Task | Approach |
|------|----------|
| Create themed custom component | Use CSS variables + Reset component |
| Build interactive component | Use Radix Primitives + Theme wrapper |
| Style with design tokens | Use `var(--accent-*)`, `var(--space-*)`, etc. |
| Add responsive behavior | Use responsive object syntax `{{ initial: "1", md: "2" }}` |
| Implement dark mode | Use next-themes with `attribute="class"` |

## Core Workflow

### Step 1: Determine Component Type

```
┌─────────────────────────────────────────────────────────────┐
│ What kind of component do you need?                         │
├─────────────────────────────────────────────────────────────┤
│ Simple styled element  → Use Reset + CSS with tokens        │
│ Layout wrapper         → Use Box/Flex/Grid + asChild        │
│ Interactive behavior   → Use Radix Primitives + Theme       │
│ Existing + custom look → Compose Themes components          │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Set Up Base Structure

**For simple styled components:**
```tsx
import { Reset } from "@radix-ui/themes";
import styles from "./MyComponent.module.css";

export function MyComponent({ children }) {
  return (
    <Reset>
      <div className={styles.root}>{children}</div>
    </Reset>
  );
}
```

**For interactive components with Primitives:**
```tsx
import * as Primitive from "@radix-ui/react-primitive-name";
import { Theme } from "@radix-ui/themes";

export function MyComponent() {
  return (
    <Primitive.Root>
      <Primitive.Trigger />
      <Primitive.Portal>
        <Theme>  {/* CRITICAL: Wrap portal content */}
          <Primitive.Content />
        </Theme>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
```

### Step 3: Apply Theme Tokens

**Always use CSS variables for styling:**
```css
.root {
  /* Colors - use semantic tokens */
  background: var(--color-panel-solid);
  border: 1px solid var(--gray-6);
  color: var(--gray-12);
  
  /* Spacing - use scale tokens */
  padding: var(--space-4);
  gap: var(--space-3);
  
  /* Radius - respects theme setting */
  border-radius: var(--radius-3);
  
  /* Shadows */
  box-shadow: var(--shadow-2);
  
  /* Scaling support */
  width: calc(200px * var(--scaling));
}

/* Interactive states use color scale */
.root:hover {
  background: var(--accent-3);
}

.root:focus-visible {
  outline: 2px solid var(--focus-8);
  outline-offset: 2px;
}
```

### Step 4: Add Variants (Optional)

```tsx
interface MyComponentProps {
  variant?: "solid" | "soft" | "outline";
  size?: "1" | "2" | "3";
  color?: "accent" | "gray" | "red";
}

export function MyComponent({ 
  variant = "solid",
  size = "2",
  color = "accent",
  ...props 
}: MyComponentProps) {
  return (
    <div 
      className={styles.root}
      data-variant={variant}
      data-size={size}
      data-color={color}
      {...props}
    />
  );
}
```

```css
/* Variant styles */
.root[data-variant="solid"] {
  background: var(--accent-9);
  color: var(--accent-contrast);
}

.root[data-variant="soft"] {
  background: var(--accent-3);
  color: var(--accent-11);
}

.root[data-variant="outline"] {
  background: transparent;
  border: 1px solid var(--accent-7);
  color: var(--accent-11);
}

/* Size variants */
.root[data-size="1"] { padding: var(--space-1) var(--space-2); font-size: var(--font-size-1); }
.root[data-size="2"] { padding: var(--space-2) var(--space-3); font-size: var(--font-size-2); }
.root[data-size="3"] { padding: var(--space-3) var(--space-4); font-size: var(--font-size-3); }
```

## Essential Patterns

### Pattern 1: Composed Component with Radix Themes

```tsx
import { Box, Flex, Text, Button } from "@radix-ui/themes";

interface CardProps {
  title: string;
  children: React.ReactNode;
  onAction?: () => void;
}

export function Card({ title, children, onAction }: CardProps) {
  return (
    <Box
      p="4"
      style={{
        background: "var(--color-panel-solid)",
        borderRadius: "var(--radius-3)",
        border: "1px solid var(--gray-6)",
      }}
    >
      <Flex direction="column" gap="3">
        <Text size="4" weight="bold">{title}</Text>
        <Box>{children}</Box>
        {onAction && (
          <Button variant="soft" onClick={onAction}>
            Action
          </Button>
        )}
      </Flex>
    </Box>
  );
}
```

### Pattern 2: asChild for Element Polymorphism

```tsx
import { Flex, Button } from "@radix-ui/themes";

// Render Flex as a <label>
<Flex asChild align="center" gap="2">
  <label>
    <Checkbox />
    <Text>Accept terms</Text>
  </label>
</Flex>

// Render Button as a <Link>
<Button asChild>
  <Link href="/page">Navigate</Link>
</Button>
```

### Pattern 3: Responsive Props

```tsx
<Flex
  direction={{ initial: "column", sm: "row" }}
  gap={{ initial: "2", md: "4" }}
  p={{ initial: "3", lg: "5" }}
>
  <Box display={{ initial: "none", md: "block" }}>
    Desktop only
  </Box>
</Flex>
```

### Pattern 4: Custom Primitive with Theme Integration

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { Theme, Button, Flex, Text, Box } from "@radix-ui/themes";
import styles from "./CustomDialog.module.css";

export function CustomDialog({ trigger, title, children, onConfirm }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Theme>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.content}>
            <Dialog.Title asChild>
              <Text size="5" weight="bold" mb="4">{title}</Text>
            </Dialog.Title>
            <Box mb="4">{children}</Box>
            <Flex gap="3" justify="end">
              <Dialog.Close asChild>
                <Button variant="soft" color="gray">Cancel</Button>
              </Dialog.Close>
              <Button onClick={onConfirm}>Confirm</Button>
            </Flex>
          </Dialog.Content>
        </Theme>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

```css
/* CustomDialog.module.css */
.overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
}

.content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-panel-solid);
  padding: var(--space-5);
  border-radius: var(--radius-4);
  box-shadow: var(--shadow-5);
  max-width: 450px;
  width: 90vw;
}
```

## Token Quick Reference

See `references/token-reference.md` for complete token documentation.

**Most Used Tokens:**
```css
/* Colors */
--accent-1 to --accent-12     /* Primary color scale */
--gray-1 to --gray-12         /* Neutral scale */
--color-panel-solid           /* Card/panel backgrounds */
--color-background            /* Page background */

/* Spacing */
--space-1 (4px) to --space-9 (64px)

/* Typography */  
--font-size-1 (12px) to --font-size-9 (60px)

/* Radius */
--radius-1 to --radius-6

/* Shadows */
--shadow-1 to --shadow-6
```

## Common Mistakes to Avoid

1. **❌ Forgetting Theme wrapper in portals**
   ```tsx
   // BAD - loses theme context
   <Dialog.Portal>
     <Dialog.Content />
   </Dialog.Portal>
   
   // GOOD
   <Dialog.Portal>
     <Theme><Dialog.Content /></Theme>
   </Dialog.Portal>
   ```

2. **❌ Using z-index values**
   ```css
   /* BAD */
   .modal { z-index: 9999; }
   
   /* GOOD - let Radix handle stacking */
   .modal { /* no z-index needed */ }
   ```

3. **❌ Hardcoding colors instead of tokens**
   ```css
   /* BAD */
   .card { background: #f5f5f5; }
   
   /* GOOD */
   .card { background: var(--gray-2); }
   ```

4. **❌ Not forwarding refs with asChild**
   ```tsx
   // BAD - breaks asChild
   const MyButton = (props) => <button {...props} />;
   
   // GOOD
   const MyButton = React.forwardRef((props, ref) => (
     <button {...props} ref={ref} />
   ));
   ```

## References

- `references/best-practices.md` - Complete best practices guide
- `references/token-reference.md` - All CSS variable tokens
- `references/component-patterns.md` - Advanced component patterns

## Dependencies

Install required packages:
```bash
npm install @radix-ui/themes
# For primitives (as needed):
npm install @radix-ui/react-dialog @radix-ui/react-popover # etc.
# For dark mode:
npm install next-themes
```

Import CSS at app root:
```tsx
import "@radix-ui/themes/styles.css";
```
