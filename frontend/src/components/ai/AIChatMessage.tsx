import { AIStreamDisplay } from './AIStreamDisplay.js';

interface AIChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  status?: string;
  onAccept?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
}

/**
 * AIChatMessage — message bubble for user prompts and AI responses
 *
 * User messages show as right-aligned. AI messages show as left-aligned with
 * accept/reject/edit actions when the content is pending.
 */
export function AIChatMessage({
  role,
  content,
  isStreaming = false,
  status,
  onAccept,
  onReject,
  onEdit,
}: AIChatMessageProps) {
  const isUser = role === 'user';
  const isPending = status === 'pending';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className="max-w-[80%] rounded-lg px-4 py-2"
        style={
          isUser
            ? { background: 'var(--accent-9)', color: 'var(--accent-contrast)' }
            : { background: 'var(--gray-3)', border: '1px solid var(--gray-6)', color: 'var(--gray-12)' }
        }
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <AIStreamDisplay content={content} isStreaming={isStreaming} />
        )}

        {/* Action buttons for pending AI content */}
        {!isUser && isPending && !isStreaming && (
          <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--gray-6)' }}>
            {onAccept && (
              <button
                onClick={onAccept}
                className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Accept
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="text-xs px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Edit
              </button>
            )}
            {onReject && (
              <button
                onClick={onReject}
                className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Reject
              </button>
            )}
          </div>
        )}

        {/* Status indicator */}
        {!isUser && status && status !== 'pending' && !isStreaming && (
          <div className="mt-1 text-xs capitalize" style={{ color: 'var(--gray-9)' }}>{status}</div>
        )}
      </div>
    </div>
  );
}
