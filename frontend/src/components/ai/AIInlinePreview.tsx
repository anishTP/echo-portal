import { AIStreamDisplay } from './AIStreamDisplay.js';

interface AIInlinePreviewProps {
  /** The AI-generated replacement content */
  content: string;
  /** Whether content is still streaming */
  isStreaming: boolean;
  /** Original text that was selected for transformation */
  originalText: string;
  /** Accept the AI content */
  onAccept: () => void;
  /** Reject and restore original text */
  onReject: () => void;
  /** Cancel in-progress streaming */
  onCancel?: () => void;
}

/**
 * AIInlinePreview — inline replacement with Accept/Reject toolbar (FR-014)
 *
 * Shows transformed text with a visual highlight indicating pending AI content.
 * Floating toolbar offers Accept/Reject. Rejecting restores original text.
 */
export function AIInlinePreview({
  content,
  isStreaming,
  originalText,
  onAccept,
  onReject,
  onCancel,
}: AIInlinePreviewProps) {
  return (
    <div className="ai-inline-preview relative border-2 border-blue-400 rounded bg-blue-50 dark:bg-blue-900/20 p-2 my-1">
      {/* AI content indicator */}
      <div className="absolute -top-3 left-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
        AI Suggestion
      </div>

      {/* Content display */}
      <div className="mt-2">
        <AIStreamDisplay content={content} isStreaming={isStreaming} />
      </div>

      {/* Floating toolbar */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-300 dark:border-blue-700">
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              onClick={onAccept}
              className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={onReject}
              className="text-xs px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Reject
            </button>
            <span className="text-xs text-muted-foreground ml-auto">
              Original: {originalText.length} → AI: {content.length} chars
            </span>
          </>
        )}
      </div>
    </div>
  );
}
