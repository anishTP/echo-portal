// __COMPONENT_NAME__.tsx
// Custom Radix Themes component template
// Replace __COMPONENT_NAME__ with your component name

import { forwardRef, type ReactNode, type ComponentPropsWithoutRef } from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import styles from "./__COMPONENT_NAME__.module.css";

// ============================================================================
// Types
// ============================================================================

type Variant = "solid" | "soft" | "outline" | "ghost";
type Size = "1" | "2" | "3";
type Color = "accent" | "gray" | "red" | "green" | "blue";

export interface __COMPONENT_NAME__Props extends ComponentPropsWithoutRef<"div"> {
  /** Visual variant of the component */
  variant?: Variant;
  /** Size of the component */
  size?: Size;
  /** Color scheme - uses accent by default */
  color?: Color;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Component content */
  children?: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export const __COMPONENT_NAME__ = forwardRef<HTMLDivElement, __COMPONENT_NAME__Props>(
  (
    {
      variant = "solid",
      size = "2",
      color = "accent",
      disabled = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`${styles.root} ${className || ""}`}
        data-variant={variant}
        data-size={size}
        data-color={color}
        data-disabled={disabled || undefined}
        {...props}
      >
        {children}
      </div>
    );
  }
);

__COMPONENT_NAME__.displayName = "__COMPONENT_NAME__";

// ============================================================================
// Subcomponents (if compound component)
// ============================================================================

// export const __COMPONENT_NAME__Header = ...
// export const __COMPONENT_NAME__Body = ...
// export const __COMPONENT_NAME__Footer = ...
