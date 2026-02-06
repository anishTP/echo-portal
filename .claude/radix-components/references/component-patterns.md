# Advanced Component Patterns

Complex patterns for building production-ready components with Radix Themes.

## Pattern 1: Full-Featured Form Field

A complete form field with label, input, error state, and description.

```tsx
// FormField.tsx
import { Flex, Text, Box } from "@radix-ui/themes";
import { forwardRef, useId } from "react";
import styles from "./FormField.module.css";

interface FormFieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; "aria-describedby"?: string }) => React.ReactNode;
}

export function FormField({ 
  label, 
  description, 
  error, 
  required, 
  children 
}: FormFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  
  return (
    <Flex direction="column" gap="1">
      <Text as="label" htmlFor={id} size="2" weight="medium">
        {label}
        {required && <Text color="red" aria-hidden> *</Text>}
      </Text>
      
      {description && (
        <Text id={descriptionId} size="1" color="gray">
          {description}
        </Text>
      )}
      
      <Box className={error ? styles.errorWrapper : undefined}>
        {children({ 
          id, 
          "aria-describedby": [descriptionId, errorId].filter(Boolean).join(" ") || undefined 
        })}
      </Box>
      
      {error && (
        <Text id={errorId} size="1" color="red" role="alert">
          {error}
        </Text>
      )}
    </Flex>
  );
}

// Usage
<FormField 
  label="Email" 
  description="We'll never share your email"
  error={errors.email}
  required
>
  {(props) => <TextField.Root {...props} type="email" />}
</FormField>
```

```css
/* FormField.module.css */
.errorWrapper :global(.rt-TextFieldRoot) {
  border-color: var(--red-7);
}

.errorWrapper :global(.rt-TextFieldRoot):focus-within {
  outline-color: var(--red-8);
}
```

## Pattern 2: Compound Component with Context

A tabs-like component using React Context for state sharing.

```tsx
// Stepper.tsx
import { createContext, useContext, useState, ReactNode } from "react";
import { Flex, Box, Text, Button } from "@radix-ui/themes";
import styles from "./Stepper.module.css";

interface StepperContextValue {
  activeStep: number;
  setActiveStep: (step: number) => void;
  totalSteps: number;
}

const StepperContext = createContext<StepperContextValue | null>(null);

function useStepper() {
  const context = useContext(StepperContext);
  if (!context) throw new Error("Stepper components must be used within Stepper.Root");
  return context;
}

// Root component
interface RootProps {
  defaultStep?: number;
  children: ReactNode;
}

function Root({ defaultStep = 0, children }: RootProps) {
  const [activeStep, setActiveStep] = useState(defaultStep);
  const totalSteps = Array.isArray(children) 
    ? children.filter((child: any) => child?.type === Step).length 
    : 0;

  return (
    <StepperContext.Provider value={{ activeStep, setActiveStep, totalSteps }}>
      <Box className={styles.root}>{children}</Box>
    </StepperContext.Provider>
  );
}

// Step component
interface StepProps {
  index: number;
  title: string;
  children: ReactNode;
}

function Step({ index, title, children }: StepProps) {
  const { activeStep } = useStepper();
  const isActive = index === activeStep;
  const isCompleted = index < activeStep;

  return (
    <Box 
      className={styles.step}
      data-state={isActive ? "active" : isCompleted ? "completed" : "pending"}
    >
      <Flex gap="3" align="center" className={styles.stepHeader}>
        <Box className={styles.stepIndicator}>
          {isCompleted ? "✓" : index + 1}
        </Box>
        <Text weight={isActive ? "bold" : "regular"}>{title}</Text>
      </Flex>
      {isActive && <Box className={styles.stepContent}>{children}</Box>}
    </Box>
  );
}

// Navigation component
function Navigation() {
  const { activeStep, setActiveStep, totalSteps } = useStepper();

  return (
    <Flex gap="3" justify="between" mt="4">
      <Button 
        variant="soft" 
        disabled={activeStep === 0}
        onClick={() => setActiveStep(activeStep - 1)}
      >
        Previous
      </Button>
      <Button 
        disabled={activeStep === totalSteps - 1}
        onClick={() => setActiveStep(activeStep + 1)}
      >
        {activeStep === totalSteps - 1 ? "Finish" : "Next"}
      </Button>
    </Flex>
  );
}

export const Stepper = { Root, Step, Navigation };

// Usage
<Stepper.Root>
  <Stepper.Step index={0} title="Account">
    <TextField.Root placeholder="Email" />
  </Stepper.Step>
  <Stepper.Step index={1} title="Profile">
    <TextField.Root placeholder="Name" />
  </Stepper.Step>
  <Stepper.Step index={2} title="Confirm">
    <Text>Review your information</Text>
  </Stepper.Step>
  <Stepper.Navigation />
</Stepper.Root>
```

```css
/* Stepper.module.css */
.root {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.step {
  border-left: 2px solid var(--gray-6);
  padding-left: var(--space-4);
}

.step[data-state="completed"] {
  border-left-color: var(--accent-9);
}

.step[data-state="active"] {
  border-left-color: var(--accent-9);
}

.stepHeader {
  padding: var(--space-2) 0;
}

.stepIndicator {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-1);
  font-weight: var(--font-weight-medium);
  background: var(--gray-3);
  color: var(--gray-11);
}

.step[data-state="active"] .stepIndicator {
  background: var(--accent-9);
  color: var(--accent-contrast);
}

.step[data-state="completed"] .stepIndicator {
  background: var(--accent-9);
  color: var(--accent-contrast);
}

.stepContent {
  padding: var(--space-4) 0;
}
```

## Pattern 3: Data Table with Sorting

```tsx
// DataTable.tsx
import { useState } from "react";
import { Table, Flex, Text, IconButton } from "@radix-ui/themes";
import { CaretSortIcon, CaretUpIcon, CaretDownIcon } from "@radix-ui/react-icons";
import styles from "./DataTable.module.css";

type SortDirection = "asc" | "desc" | null;

interface Column<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
}

export function DataTable<T extends Record<string, any>>({ 
  data, 
  columns 
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDir === "asc" ? comparison : -comparison;
  });

  return (
    <Table.Root className={styles.table}>
      <Table.Header>
        <Table.Row>
          {columns.map((col) => (
            <Table.ColumnHeaderCell key={String(col.key)}>
              {col.sortable ? (
                <Flex 
                  align="center" 
                  gap="1" 
                  className={styles.sortableHeader}
                  onClick={() => handleSort(col.key)}
                >
                  <Text>{col.header}</Text>
                  {sortKey === col.key ? (
                    sortDir === "asc" ? <CaretUpIcon /> : <CaretDownIcon />
                  ) : (
                    <CaretSortIcon className={styles.sortIcon} />
                  )}
                </Flex>
              ) : (
                col.header
              )}
            </Table.ColumnHeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sortedData.map((row, i) => (
          <Table.Row key={i}>
            {columns.map((col) => (
              <Table.Cell key={String(col.key)}>
                {col.render ? col.render(row[col.key], row) : String(row[col.key])}
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

// Usage
<DataTable
  data={users}
  columns={[
    { key: "name", header: "Name", sortable: true },
    { key: "email", header: "Email", sortable: true },
    { key: "role", header: "Role", render: (v) => <Badge>{v}</Badge> },
  ]}
/>
```

## Pattern 4: Toast Notifications System

```tsx
// Toast.tsx
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Box, Text, Flex, IconButton } from "@radix-ui/themes";
import { Cross2Icon } from "@radix-ui/react-icons";
import styles from "./Toast.module.css";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
    
    if (toast.duration !== 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toast.duration || 5000);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <Box className={styles.container}>
      {toasts.map((toast) => (
        <Box 
          key={toast.id} 
          className={styles.toast}
          data-type={toast.type}
        >
          <Flex justify="between" align="center" gap="3">
            <Text size="2">{toast.message}</Text>
            <IconButton 
              size="1" 
              variant="ghost" 
              onClick={() => removeToast(toast.id)}
            >
              <Cross2Icon />
            </IconButton>
          </Flex>
        </Box>
      ))}
    </Box>
  );
}

// Usage
function MyComponent() {
  const { addToast } = useToast();
  
  return (
    <Button onClick={() => addToast({ 
      message: "Saved successfully!", 
      type: "success" 
    })}>
      Save
    </Button>
  );
}
```

```css
/* Toast.module.css */
.container {
  position: fixed;
  bottom: var(--space-4);
  right: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 9999;
}

.toast {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-3);
  box-shadow: var(--shadow-4);
  min-width: 280px;
  max-width: 400px;
  animation: slideIn 0.2s ease-out;
}

.toast[data-type="success"] {
  background: var(--green-3);
  border: 1px solid var(--green-6);
}

.toast[data-type="error"] {
  background: var(--red-3);
  border: 1px solid var(--red-6);
}

.toast[data-type="info"] {
  background: var(--blue-3);
  border: 1px solid var(--blue-6);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

## Pattern 5: Controlled Component with Forwarded Ref

```tsx
// Select.tsx
import { forwardRef, useState, useImperativeHandle, useRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Theme, Text } from "@radix-ui/themes";
import { ChevronDownIcon, CheckIcon } from "@radix-ui/react-icons";
import styles from "./Select.module.css";

export interface SelectRef {
  focus: () => void;
  blur: () => void;
  value: string | undefined;
}

interface SelectProps {
  options: { value: string; label: string }[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export const Select = forwardRef<SelectRef, SelectProps>(
  ({ options, placeholder, value, defaultValue, onChange, disabled }, ref) => {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [internalValue, setInternalValue] = useState(defaultValue);
    
    const currentValue = value ?? internalValue;
    
    useImperativeHandle(ref, () => ({
      focus: () => triggerRef.current?.focus(),
      blur: () => triggerRef.current?.blur(),
      value: currentValue,
    }));

    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onChange?.(newValue);
    };

    return (
      <SelectPrimitive.Root 
        value={currentValue} 
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger ref={triggerRef} className={styles.trigger}>
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDownIcon />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        
        <SelectPrimitive.Portal>
          <Theme>
            <SelectPrimitive.Content className={styles.content}>
              <SelectPrimitive.Viewport>
                {options.map((option) => (
                  <SelectPrimitive.Item 
                    key={option.value} 
                    value={option.value}
                    className={styles.item}
                  >
                    <SelectPrimitive.ItemText>
                      {option.label}
                    </SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator>
                      <CheckIcon />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </Theme>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  }
);

Select.displayName = "Select";

// Usage with ref
const selectRef = useRef<SelectRef>(null);

<Select
  ref={selectRef}
  options={[
    { value: "1", label: "Option 1" },
    { value: "2", label: "Option 2" },
  ]}
  onChange={(v) => console.log(v)}
/>

<Button onClick={() => selectRef.current?.focus()}>
  Focus Select
</Button>
```

## Pattern 6: Skeleton Loading States

```tsx
// SkeletonCard.tsx
import { Skeleton, Box, Flex, Card } from "@radix-ui/themes";

interface SkeletonCardProps {
  loading?: boolean;
  children: React.ReactNode;
}

export function SkeletonCard({ loading, children }: SkeletonCardProps) {
  if (loading) {
    return (
      <Card>
        <Flex direction="column" gap="3">
          <Skeleton width="60%" height="24px" />
          <Skeleton width="100%" height="16px" />
          <Skeleton width="80%" height="16px" />
          <Flex gap="2" mt="2">
            <Skeleton width="80px" height="32px" />
            <Skeleton width="80px" height="32px" />
          </Flex>
        </Flex>
      </Card>
    );
  }
  
  return <Card>{children}</Card>;
}

// List skeleton pattern
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <Flex direction="column" gap="3">
      {Array.from({ length: count }).map((_, i) => (
        <Flex key={i} gap="3" align="center">
          <Skeleton width="40px" height="40px" style={{ borderRadius: "50%" }} />
          <Flex direction="column" gap="1" flexGrow="1">
            <Skeleton width="30%" height="16px" />
            <Skeleton width="60%" height="14px" />
          </Flex>
        </Flex>
      ))}
    </Flex>
  );
}
```

## Best Practices Summary

1. **Always wrap portal content with `<Theme>`** - Essential for tokens to work
2. **Use data attributes for variants** - Clean separation of styling
3. **Forward refs on custom components** - Required for asChild compatibility
4. **Use CSS modules or vanilla CSS** - Avoid Tailwind for complex overrides
5. **Leverage composition over configuration** - Build with smaller pieces
6. **Use semantic color tokens** - `--accent-9` not `--indigo-9` for flexibility
7. **Test in both light and dark modes** - Tokens handle this automatically
8. **Keep components focused** - Single responsibility principle
