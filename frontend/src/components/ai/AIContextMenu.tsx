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
      className="fixed z-50 rounded-lg py-1 min-w-48"
      style={{
        left: position.x,
        top: position.y,
        background: 'var(--color-background)',
        border: '1px solid var(--gray-6)',
        boxShadow: 'var(--shadow-4)',
      }}
    >
      <div
        className="px-3 py-1.5 text-xs"
        style={{ color: 'var(--gray-9)', borderBottom: '1px solid var(--gray-6)' }}
      >
        AI Transform ({selectedText.length} chars selected)
      </div>

      {TRANSFORM_ACTIONS.map((action) => (
        <button
          key={action.instruction}
          onClick={() => onTransform(action.instruction)}
          className="w-full text-left px-3 py-2 text-sm transition-colors flex justify-between items-center"
          style={{ color: 'var(--gray-12)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-3)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span>{action.label}</span>
          <span className="text-xs" style={{ color: 'var(--gray-9)' }}>{action.description}</span>
        </button>
      ))}

      <div style={{ borderTop: '1px solid var(--gray-6)' }}>
        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full text-left px-3 py-2 text-sm transition-colors"
            style={{ color: 'var(--accent-11)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
              className="flex-1 text-sm px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--gray-6)',
                color: 'var(--gray-12)',
              }}
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
