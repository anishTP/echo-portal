import { useState, useRef, useEffect } from 'react';

interface InlineCommentFormProps {
  path: string;
  line: number;
  side: 'old' | 'new';
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
  isReply?: boolean;
  placeholder?: string;
}

/**
 * Form for adding inline comments to diff lines
 */
export function InlineCommentForm({
  path,
  line,
  side,
  onSubmit,
  onCancel,
  isReply = false,
  placeholder = 'Add a comment...',
}: InlineCommentFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Cmd/Ctrl + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
    // Cancel on Escape
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`p-3 bg-white dark:bg-gray-800 border rounded-md shadow-sm ${
        isReply ? 'ml-4 border-l-2 border-l-blue-300' : ''
      }`}
    >
      {!isReply && (
        <div className="text-xs text-gray-500 mb-2 font-mono">
          {path}:{line} ({side === 'new' ? 'addition' : 'deletion'})
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
        disabled={isSubmitting}
      />

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          Ctrl+Enter to submit, Esc to cancel
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : isReply ? 'Reply' : 'Comment'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default InlineCommentForm;
