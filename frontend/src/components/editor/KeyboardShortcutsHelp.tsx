import { useState } from 'react';
import { Dialog, Button, Table, Text, Kbd, Flex, Box, Badge } from '@radix-ui/themes';
import { KeyboardIcon } from '@radix-ui/react-icons';

interface ShortcutDefinition {
  keys: string[];
  description: string;
  category: 'formatting' | 'structure' | 'navigation' | 'actions';
}

const shortcuts: ShortcutDefinition[] = [
  // Formatting shortcuts
  { keys: ['Ctrl/⌘', 'B'], description: 'Bold text', category: 'formatting' },
  { keys: ['Ctrl/⌘', 'I'], description: 'Italic text', category: 'formatting' },
  { keys: ['Ctrl/⌘', 'U'], description: 'Underline text', category: 'formatting' },
  { keys: ['Ctrl/⌘', '`'], description: 'Inline code', category: 'formatting' },
  { keys: ['Ctrl/⌘', 'K'], description: 'Insert link', category: 'formatting' },

  // Structure shortcuts
  { keys: ['#', 'Space'], description: 'Heading 1', category: 'structure' },
  { keys: ['##', 'Space'], description: 'Heading 2', category: 'structure' },
  { keys: ['###', 'Space'], description: 'Heading 3', category: 'structure' },
  { keys: ['-', 'Space'], description: 'Bullet list', category: 'structure' },
  { keys: ['1.', 'Space'], description: 'Numbered list', category: 'structure' },
  { keys: ['>', 'Space'], description: 'Blockquote', category: 'structure' },
  { keys: ['```'], description: 'Code block', category: 'structure' },
  { keys: ['---'], description: 'Horizontal rule', category: 'structure' },

  // Navigation shortcuts
  { keys: ['Ctrl/⌘', 'Z'], description: 'Undo', category: 'navigation' },
  { keys: ['Ctrl/⌘', 'Shift', 'Z'], description: 'Redo', category: 'navigation' },
  { keys: ['Ctrl/⌘', 'A'], description: 'Select all', category: 'navigation' },
  { keys: ['Tab'], description: 'Indent list item', category: 'navigation' },
  { keys: ['Shift', 'Tab'], description: 'Outdent list item', category: 'navigation' },

  // Action shortcuts
  { keys: ['Ctrl/⌘', 'S'], description: 'Save draft', category: 'actions' },
  { keys: ['Ctrl/⌘', 'Enter'], description: 'Submit for review', category: 'actions' },
  { keys: ['Escape'], description: 'Exit edit mode', category: 'actions' },
];

const categoryLabels: Record<ShortcutDefinition['category'], string> = {
  formatting: 'Text Formatting',
  structure: 'Document Structure',
  navigation: 'Navigation & Editing',
  actions: 'Actions',
};

const categoryColors: Record<ShortcutDefinition['category'], 'blue' | 'green' | 'orange' | 'purple'> = {
  formatting: 'blue',
  structure: 'green',
  navigation: 'orange',
  actions: 'purple',
};

function ShortcutKey({ keys }: { keys: string[] }) {
  return (
    <Flex gap="1" align="center">
      {keys.map((key, index) => (
        <span key={index}>
          <Kbd size="1">{key}</Kbd>
          {index < keys.length - 1 && (
            <Text size="1" color="gray" mx="1">
              +
            </Text>
          )}
        </span>
      ))}
    </Flex>
  );
}

interface KeyboardShortcutsHelpProps {
  /** Custom trigger button. If not provided, shows icon button. */
  trigger?: React.ReactNode;
  /** Whether to show the dialog in compact mode (fewer categories) */
  compact?: boolean;
}

/**
 * T057: Keyboard shortcuts help component
 * Displays available keyboard shortcuts for the inline editor.
 */
export function KeyboardShortcutsHelp({ trigger, compact = false }: KeyboardShortcutsHelpProps) {
  const [open, setOpen] = useState(false);

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<ShortcutDefinition['category'], ShortcutDefinition[]>
  );

  const categories: ShortcutDefinition['category'][] = compact
    ? ['formatting', 'actions']
    : ['formatting', 'structure', 'navigation', 'actions'];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        {trigger || (
          <Button
            variant="ghost"
            size="1"
            title="Keyboard shortcuts"
            aria-label="Show keyboard shortcuts"
          >
            <KeyboardIcon />
          </Button>
        )}
      </Dialog.Trigger>

      <Dialog.Content maxWidth="550px">
        <Dialog.Title>Keyboard Shortcuts</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Use these shortcuts to speed up your editing workflow.
        </Dialog.Description>

        <Box>
          {categories.map((category) => {
            const categoryShortcuts = groupedShortcuts[category];
            if (!categoryShortcuts || categoryShortcuts.length === 0) return null;

            return (
              <Box key={category} mb="4">
                <Flex align="center" gap="2" mb="2">
                  <Badge color={categoryColors[category]} size="1">
                    {categoryLabels[category]}
                  </Badge>
                </Flex>
                <Table.Root size="1" variant="ghost">
                  <Table.Body>
                    {categoryShortcuts.map((shortcut, index) => (
                      <Table.Row key={index}>
                        <Table.Cell width="140px">
                          <ShortcutKey keys={shortcut.keys} />
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{shortcut.description}</Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            );
          })}
        </Box>

        <Flex gap="2" mt="4" justify="end">
          <Text size="1" color="gray">
            Press <Kbd size="1">?</Kbd> to toggle this dialog
          </Text>
        </Flex>

        <Dialog.Close>
          <Button variant="soft" mt="4">
            Close
          </Button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/**
 * Hook to register the ? keyboard shortcut for showing help.
 * Call this at the editor level to enable pressing ? to open shortcuts help.
 */
export function useKeyboardShortcutsHelpToggle(onToggle: () => void) {
  // Register ? key handler
  const handleKeyDown = (event: KeyboardEvent) => {
    // Only trigger on ? key when not in an input field
    if (
      event.key === '?' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLTextAreaElement) &&
      !(event.target as HTMLElement)?.getAttribute('contenteditable')
    ) {
      event.preventDefault();
      onToggle();
    }
  };

  return {
    register: () => {
      window.addEventListener('keydown', handleKeyDown);
    },
    unregister: () => {
      window.removeEventListener('keydown', handleKeyDown);
    },
  };
}

export default KeyboardShortcutsHelp;
