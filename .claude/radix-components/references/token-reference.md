# Radix Themes Token Reference

Complete CSS variable reference for styling custom components.

## Color Tokens

### Accent Colors (Primary)
```css
/* Backgrounds */
var(--accent-1)   /* Subtle background */
var(--accent-2)   /* UI element background */

/* Interactive components */
var(--accent-3)   /* Hovered UI element */
var(--accent-4)   /* Active/selected */
var(--accent-5)   /* Subtle borders on interactive */

/* Borders and separators */
var(--accent-6)   /* Subtle borders */
var(--accent-7)   /* UI element border, focus rings */
var(--accent-8)   /* Hovered element border */

/* Solid colors */
var(--accent-9)   /* Solid backgrounds (buttons) */
var(--accent-10)  /* Hovered solid backgrounds */

/* Text */
var(--accent-11)  /* Low-contrast text */
var(--accent-12)  /* High-contrast text */

/* Alpha variants (transparent) */
var(--accent-a1) to var(--accent-a12)

/* Functional */
var(--accent-surface)    /* Surface color */
var(--accent-indicator)  /* Indicators */
var(--accent-track)      /* Track elements */
var(--accent-contrast)   /* Text on solid accent */
```

### Gray Colors (Neutral)
```css
var(--gray-1) to var(--gray-12)   /* Same pattern as accent */
var(--gray-a1) to var(--gray-a12) /* Alpha variants */
var(--gray-surface)
var(--gray-indicator)
var(--gray-track)
var(--gray-contrast)
```

### Individual Colors
Access any Radix color directly:
```css
var(--red-1) to var(--red-12)
var(--blue-1) to var(--blue-12)
var(--green-1) to var(--green-12)
/* etc. for: tomato, crimson, pink, plum, purple, violet, 
   iris, indigo, cyan, teal, jade, grass, lime, mint, 
   sky, yellow, amber, orange, brown, bronze, gold */
```

### Background Colors
```css
var(--color-background)        /* Page background */
var(--color-panel-solid)       /* Solid panel background */
var(--color-panel-translucent) /* Translucent panel */
var(--color-surface)           /* Form component backgrounds */
var(--color-overlay)           /* Dialog/modal overlays */
```

### Focus Colors
```css
var(--focus-1) to var(--focus-12)
var(--focus-a1) to var(--focus-a12)
/* Most components use --focus-8 for outline */
```

## Spacing Tokens

### Space Scale
```css
var(--space-1)  /* 4px */
var(--space-2)  /* 8px */
var(--space-3)  /* 12px */
var(--space-4)  /* 16px */
var(--space-5)  /* 24px */
var(--space-6)  /* 32px */
var(--space-7)  /* 40px */
var(--space-8)  /* 48px */
var(--space-9)  /* 64px */
```

### Scaling Factor
```css
var(--scaling)  /* Theme scaling multiplier (0.9 - 1.1) */

/* Usage for custom sizing */
width: calc(200px * var(--scaling));
```

## Typography Tokens

### Font Sizes
```css
var(--font-size-1)  /* 12px */
var(--font-size-2)  /* 14px */
var(--font-size-3)  /* 16px */
var(--font-size-4)  /* 18px */
var(--font-size-5)  /* 20px */
var(--font-size-6)  /* 24px */
var(--font-size-7)  /* 28px */
var(--font-size-8)  /* 35px */
var(--font-size-9)  /* 60px */
```

### Line Heights
```css
var(--line-height-1)  /* 16px */
var(--line-height-2)  /* 20px */
var(--line-height-3)  /* 24px */
var(--line-height-4)  /* 26px */
var(--line-height-5)  /* 28px */
var(--line-height-6)  /* 30px */
var(--line-height-7)  /* 36px */
var(--line-height-8)  /* 40px */
var(--line-height-9)  /* 60px */
```

### Letter Spacing
```css
var(--letter-spacing-1)  /* 0.0025em */
var(--letter-spacing-2)  /* 0em */
var(--letter-spacing-3)  /* 0em */
var(--letter-spacing-4)  /* -0.0025em */
var(--letter-spacing-5)  /* -0.005em */
var(--letter-spacing-6)  /* -0.00625em */
var(--letter-spacing-7)  /* -0.0075em */
var(--letter-spacing-8)  /* -0.01em */
var(--letter-spacing-9)  /* -0.025em */
```

### Font Weights
```css
var(--font-weight-light)    /* 300 */
var(--font-weight-regular)  /* 400 */
var(--font-weight-medium)   /* 500 */
var(--font-weight-bold)     /* 700 */
```

### Font Families
```css
var(--default-font-family)  /* System font stack */
var(--heading-font-family)  /* Heading font */
var(--code-font-family)     /* Monospace font */
var(--em-font-family)       /* Emphasis font */
var(--quote-font-family)    /* Quote font */
var(--strong-font-family)   /* Strong font */
```

## Radius Tokens

```css
var(--radius-1)     /* Small radius */
var(--radius-2)
var(--radius-3)     /* Medium (common) */
var(--radius-4)
var(--radius-5)
var(--radius-6)     /* Large radius */
var(--radius-full)  /* Fully rounded (pill) */
var(--radius-thumb) /* For thumbs/handles */
```

## Shadow Tokens

```css
var(--shadow-1)  /* Subtle shadow */
var(--shadow-2)  /* Light elevation */
var(--shadow-3)  /* Medium elevation */
var(--shadow-4)  /* High elevation */
var(--shadow-5)  /* Modal/dialog level */
var(--shadow-6)  /* Maximum elevation */
```

## Breakpoints

Used in responsive object syntax:
```
initial: 0px+
xs: 520px+
sm: 768px+
md: 1024px+
lg: 1280px+
xl: 1640px+
```

## Usage Examples

### Complete Button Example
```css
.custom-button {
  /* Typography */
  font-family: var(--default-font-family);
  font-size: var(--font-size-2);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-2);
  
  /* Colors */
  background: var(--accent-9);
  color: var(--accent-contrast);
  
  /* Spacing */
  padding: var(--space-2) var(--space-4);
  
  /* Shape */
  border-radius: var(--radius-2);
  border: none;
  
  /* Interaction */
  cursor: pointer;
  transition: background 0.1s;
}

.custom-button:hover {
  background: var(--accent-10);
}

.custom-button:focus-visible {
  outline: 2px solid var(--focus-8);
  outline-offset: 2px;
}

.custom-button:disabled {
  background: var(--gray-3);
  color: var(--gray-8);
  cursor: not-allowed;
}
```

### Complete Card Example
```css
.custom-card {
  /* Background */
  background: var(--color-panel-solid);
  
  /* Border */
  border: 1px solid var(--gray-6);
  border-radius: var(--radius-4);
  
  /* Shadow */
  box-shadow: var(--shadow-2);
  
  /* Spacing */
  padding: var(--space-5);
}

.custom-card-title {
  font-size: var(--font-size-5);
  font-weight: var(--font-weight-bold);
  color: var(--gray-12);
  margin-bottom: var(--space-2);
}

.custom-card-body {
  font-size: var(--font-size-2);
  color: var(--gray-11);
  line-height: var(--line-height-2);
}
```

### Responsive Custom Component
```css
.responsive-container {
  padding: var(--space-3);
  gap: var(--space-2);
}

@media (min-width: 768px) {
  .responsive-container {
    padding: var(--space-5);
    gap: var(--space-4);
  }
}

@media (min-width: 1024px) {
  .responsive-container {
    padding: var(--space-6);
    gap: var(--space-5);
  }
}
```
