import { AIStreamDisplay } from './AIStreamDisplay.js';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

function UserMessageContent({ content }: { content: string }) {
  const match = content.match(/^(\/(?:replace|analyse|analyze|add))\s+([\s\S]*)$/);
  if (!match) {
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  }
  const [, command, rest] = match;
  return (
    <p className="text-sm whitespace-pre-wrap">
      <span
        className="inline-block text-xs font-mono font-semibold px-1.5 py-0.5 rounded mr-1"
        style={{ background: 'rgba(255,255,255,0.2)' }}
      >
        {command}
      </span>
      {rest}
    </p>
  );
}

interface AIChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  status?: string;
  selectionContext?: string;
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
  selectionContext,
  onAccept,
  onReject,
  onEdit,
}: AIChatMessageProps) {
  const isUser = role === 'user';
  const isPending = status === 'pending';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${isUser ? 'max-w-[80%] rounded-2xl' : 'w-full rounded-xl'} px-4 py-2`}
        style={
          isUser
            ? { background: 'var(--accent-9)', color: 'var(--accent-contrast)' }
            : {
                background: 'var(--color-surface)',
                border: '1px solid var(--gray-4)',
                boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)',
                color: 'var(--gray-12)',
              }
        }
      >
        {isUser && selectionContext && (
          <div
            className="text-xs mb-1.5 pb-1.5 truncate"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', opacity: 0.8 }}
          >
            Selection: {selectionContext}
          </div>
        )}
        {isUser ? (
          <UserMessageContent content={content} />
        ) : (
          <AIStreamDisplay content={content} isStreaming={isStreaming} />
        )}

        {/* Action buttons for pending AI content */}
        {!isUser && isPending && !isStreaming && (
          <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--gray-4)' }}>
            {onAccept && (
              <button
                onClick={onAccept}
                className="flex items-center gap-1 text-xs px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors"
                style={{ background: 'var(--green-9)' }}
              >
                <CheckIcon />
                Accept
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="text-xs px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Edit
              </button>
            )}
            {onReject && (
              <button
                onClick={onReject}
                className="flex items-center gap-1 text-xs px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors"
                style={{ background: 'var(--red-9)' }}
              >
                <Cross2Icon />
                Reject
              </button>
            )}
          </div>
        )}

        {/* Analysis mode label — no accept/reject buttons */}
        {!isUser && status === 'analysis' && !isStreaming && (
          <div className="mt-2 pt-2 text-xs italic" style={{ borderTop: '1px solid var(--gray-4)', color: 'var(--gray-9)' }}>
            Analysis only — no changes to apply
          </div>
        )}

        {/* Status indicator */}
        {!isUser && status && status !== 'pending' && status !== 'analysis' && !isStreaming && (
          <div className="mt-1 text-xs capitalize" style={{ color: 'var(--gray-9)' }}>{status}</div>
        )}
      </div>
    </div>
  );
}
