import { useState } from 'react';
import type { ReviewComment } from '../../services/reviewService';
import { InlineCommentForm } from './InlineCommentForm';

interface CommentThreadProps {
  comment: ReviewComment;
  replies: ReviewComment[];
  currentUserId: string;
  branchAuthorId?: string;
  onReply: (content: string) => Promise<void>;
  onEdit?: (commentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onResolve?: (commentId: string) => Promise<void>;
  onUnresolve?: (commentId: string) => Promise<void>;
}

/**
 * Threaded comment display with reply support
 * Max 2 levels deep (comment → replies)
 */
export function CommentThread({
  comment,
  replies,
  currentUserId,
  branchAuthorId,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isResolving, setIsResolving] = useState(false);

  const isAuthor = comment.authorId === currentUserId;
  const isResolved = !!comment.resolvedAt;
  // Can resolve if: not a reply AND (branch author OR comment author)
  const canResolve = !comment.parentId && (
    currentUserId === branchAuthorId || currentUserId === comment.authorId
  );

  const handleReply = async (content: string) => {
    await onReply(content);
    setIsReplying(false);
  };

  const handleEdit = async () => {
    if (onEdit && editContent.trim() !== comment.content) {
      await onEdit(comment.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (onDelete && window.confirm('Are you sure you want to delete this comment?')) {
      await onDelete(comment.id);
    }
  };

  const handleResolve = async () => {
    if (onResolve && !isResolving) {
      setIsResolving(true);
      try {
        await onResolve(comment.id);
      } finally {
        setIsResolving(false);
      }
    }
  };

  const handleUnresolve = async () => {
    if (onUnresolve && !isResolving) {
      setIsResolving(true);
      try {
        await onUnresolve(comment.id);
      } finally {
        setIsResolving(false);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`${comment.isOutdated ? 'opacity-60' : ''} ${isResolved ? 'opacity-75' : ''}`}>
      {/* Main comment */}
      <div className={`p-3 bg-white dark:bg-gray-900 border rounded-md ${isResolved ? 'border-l-4 border-l-green-500' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-xs font-medium">
              {comment.authorId.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-medium">
              {isAuthor ? 'You' : `User ${comment.authorId.slice(0, 8)}`}
            </span>
            <span className="text-xs text-gray-500">
              {formatDate(comment.createdAt)}
            </span>
            {comment.isOutdated && (
              <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                Outdated
              </span>
            )}
            {isResolved && (
              <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                Resolved
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Resolve/Unresolve button */}
            {canResolve && (
              isResolved ? (
                <button
                  onClick={handleUnresolve}
                  disabled={isResolving}
                  className="p-1 text-gray-400 hover:text-orange-600 disabled:opacity-50"
                  title="Unresolve"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleResolve}
                  disabled={isResolving}
                  className="p-1 text-gray-400 hover:text-green-600 disabled:opacity-50"
                  title="Resolve"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              )
            )}
            {/* Edit/Delete buttons for comment author */}
            {isAuthor && !isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* File location */}
        {comment.path && (
          <div className="text-xs text-gray-500 font-mono mb-2">
            {comment.path}:{comment.line}
          </div>
        )}

        {/* Content */}
        {isEditing ? (
          <div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
                className="px-3 py-1.5 text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Reply button */}
        {!isReplying && !isEditing && (
          <button
            onClick={() => setIsReplying(true)}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
          >
            Reply
          </button>
        )}
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
          {replies.map((reply) => (
            <div
              key={reply.id}
              className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-xs">
                  {reply.authorId.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-medium">
                  {reply.authorId === currentUserId ? 'You' : `User ${reply.authorId.slice(0, 8)}`}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(reply.createdAt)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {isReplying && (
        <div className="ml-4 mt-2">
          <InlineCommentForm
            path={comment.path || ''}
            line={comment.line || 0}
            side={comment.side || 'new'}
            onSubmit={handleReply}
            onCancel={() => setIsReplying(false)}
            isReply
            placeholder="Write a reply..."
          />
        </div>
      )}
    </div>
  );
}

export default CommentThread;
