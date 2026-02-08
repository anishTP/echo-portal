import React, { useEffect, useRef } from 'react';

interface AIContextMenuProps {
  /** Screen position to render the menu */
  position: { x: number; y: number };
  /** The text currently selected in the editor */
  selectedText: string;
  /** Called with the chosen transformation action */
  onTransform: (instruction: string) => void;
  /** Close the menu */
  onClose: () => void;
}

const TRANSFORM_ACTIONS = [
  { label: 'Rewrite', instruction: 'rewrite', description: 'Rephrase the text' },
  { label: 'Summarize', instruction: 'summarize', description: 'Make it shorter' },
  { label: 'Expand', instruction: 'expand', description: 'Add more detail' },
  { label: 'Change Tone', instruction: 'change_tone', description: 'Adjust formality' },
];

/**
 * AIContextMenu — right-click context menu on selected text (FR-014)
 *
 * Shows transformation actions positioned at the selection coordinates.
 * Supports predefined actions and a custom instruction input.
 */
export function AIContextMenu({ position, selectedText, onTransform, onClose }: AIContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showCustom, setShowCustom] = React.useState(false);
  const [customInstruction, setCustomInstruction] = React.useState('');

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInstruction.trim()) {
      onTransform(customInstruction.trim());
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-48"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-gray-200 dark:border-gray-700">
        AI Transform ({selectedText.length} chars selected)
      </div>

      {TRANSFORM_ACTIONS.map((action) => (
        <button
          key={action.instruction}
          onClick={() => onTransform(action.instruction)}
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex justify-between items-center"
        >
          <span>{action.label}</span>
          <span className="text-xs text-muted-foreground">{action.description}</span>
        </button>
      ))}

      <div className="border-t border-gray-200 dark:border-gray-700">
        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-blue-600"
          >
            Custom instruction...
          </button>
        ) : (
          <form onSubmit={handleCustomSubmit} className="p-2 flex gap-1">
            <input
              autoFocus
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="e.g., make it more formal"
              className="flex-1 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!customInstruction.trim()}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Go
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
