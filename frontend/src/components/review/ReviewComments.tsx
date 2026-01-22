import { useState } from 'react';
import type { ReviewComment } from './ReviewPanel';

interface ReviewCommentsProps {
  comments: ReviewComment[];
  currentUserId: string;
  canAddComment: boolean;
  onAddComment: (content: string, path?: string, line?: number) => Promise<void>;
  showCommentForm: boolean;
  onToggleCommentForm: () => void;
}

export function ReviewComments({
  comments,
  currentUserId,
  canAddComment,
  onAddComment,
  showCommentForm,
  onToggleCommentForm,
}: ReviewCommentsProps) {
  const [content, setContent] = useState('');
  const [path, setPath] = useState('');
  const [line, setLine] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('Comment content is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAddComment(
        content,
        path || undefined,
        line ? parseInt(line, 10) : undefined
      );
      setContent('');
      setPath('');
      setLine('');
      onToggleCommentForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">
          Comments {comments.length > 0 && `(${comments.length})`}
        </h4>
        {canAddComment && !showCommentForm && (
          <button
            onClick={onToggleCommentForm}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Add Comment
          </button>
        )}
      </div>

      {/* Comment Form */}
      {showCommentForm && canAddComment && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-gray-50 p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comment <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your comment..."
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                File Path (optional)
              </label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="src/components/..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Line Number (optional)
              </label>
              <input
                type="number"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="42"
                min="1"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onToggleCommentForm}
              disabled={isSubmitting}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <p className="text-sm text-gray-500">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gray-300" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {comment.authorId === currentUserId ? 'You' : `User ${comment.authorId.slice(0, 8)}`}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {(comment.path || comment.line) && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  {comment.path && (
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono">
                      {comment.path}
                    </span>
                  )}
                  {comment.line && (
                    <span className="rounded bg-gray-200 px-1.5 py-0.5">
                      Line {comment.line}
                    </span>
                  )}
                </div>
              )}

              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReviewComments;
