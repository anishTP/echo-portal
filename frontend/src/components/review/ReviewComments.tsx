import { useState } from 'react';
import { Button, TextArea, TextField, Callout } from '@radix-ui/themes';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
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
          <Button variant="ghost" size="1" onClick={onToggleCommentForm}>
            Add Comment
          </Button>
        )}
      </div>

      {/* Comment Form */}
      {showCommentForm && canAddComment && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-gray-50 p-4">
          <div>
            <label className="block text-sm font-medium text-[var(--gray-12)]">
              Comment <span className="text-[var(--red-9)]">*</span>
            </label>
            <TextArea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your comment..."
              rows={3}
              style={{ marginTop: '4px' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--gray-12)]">
                File Path (optional)
              </label>
              <TextField.Root
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="src/components/..."
                style={{ marginTop: '4px' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--gray-12)]">
                Line Number (optional)
              </label>
              <TextField.Root
                type="number"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="42"
                min={1}
                style={{ marginTop: '4px' }}
              />
            </div>
          </div>

          {error && (
            <Callout.Root color="red" size="1">
              <Callout.Icon>
                <ExclamationTriangleIcon />
              </Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="2"
              onClick={onToggleCommentForm}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="2" disabled={isSubmitting}>
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </Button>
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
                  {comment.authorAvatarUrl ? (
                    <img
                      src={comment.authorAvatarUrl}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-300" />
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {comment.authorId === currentUserId ? 'You' : (comment.authorName || `User ${comment.authorId.slice(0, 8)}`)}
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
