import { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, Flex, Text, Badge } from '@radix-ui/themes';
import type { ReviewComment } from '../../services/reviewService';
import styles from './ReviewCommentsSidebar.module.css';

type FilterMode = 'all' | 'unresolved' | 'outdated';

/** Number of comments to render per batch for windowed rendering */
const COMMENTS_PER_BATCH = 20;

/** Threshold for enabling windowed rendering */
const WINDOWED_THRESHOLD = 50;

interface ReviewCommentsSidebarProps {
  comments: ReviewComment[];
  onCommentClick?: (comment: ReviewComment) => void;
}

export function ReviewCommentsSidebar({
  comments,
  onCommentClick,
}: ReviewCommentsSidebarProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  // Separate top-level comments from replies
  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const c of comments) {
      if (c.parentId) {
        const existing = map.get(c.parentId) || [];
        existing.push(c);
        map.set(c.parentId, existing);
      }
    }
    return map;
  }, [comments]);

  // Apply filter
  const filteredComments = useMemo(() => {
    switch (filter) {
      case 'outdated':
        return topLevelComments.filter((c) => c.isOutdated);
      case 'unresolved':
        return topLevelComments.filter((c) => !c.isOutdated);
      default:
        return topLevelComments;
    }
  }, [topLevelComments, filter]);

  // Group by file
  const groupedByFile = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const c of filteredComments) {
      const key = c.path || '(general)';
      const existing = map.get(key) || [];
      existing.push(c);
      map.set(key, existing);
    }
    return map;
  }, [filteredComments]);

  const outdatedCount = topLevelComments.filter((c) => c.isOutdated).length;

  // Windowed rendering for large comment lists
  const [visibleCount, setVisibleCount] = useState(COMMENTS_PER_BATCH);
  const isWindowed = filteredComments.length > WINDOWED_THRESHOLD;

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(COMMENTS_PER_BATCH);
  }, [filter]);

  // When windowed, flatten grouped comments and limit the visible count
  const visibleGroupedByFile = useMemo(() => {
    if (!isWindowed) return groupedByFile;

    // Take only first `visibleCount` comments across all groups
    let remaining = visibleCount;
    const result = new Map<string, ReviewComment[]>();

    for (const [filePath, fileComments] of groupedByFile.entries()) {
      if (remaining <= 0) break;
      const slice = fileComments.slice(0, remaining);
      result.set(filePath, slice);
      remaining -= slice.length;
    }

    return result;
  }, [groupedByFile, isWindowed, visibleCount]);

  const totalVisible = useMemo(
    () => Array.from(visibleGroupedByFile.values()).reduce((sum, c) => sum + c.length, 0),
    [visibleGroupedByFile]
  );

  const hasMore = isWindowed && totalVisible < filteredComments.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + COMMENTS_PER_BATCH);
  }, []);

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <Flex justify="between" align="center">
          <Text size="2" weight="bold">
            Comments
          </Text>
          <Badge variant="soft" color="gray" size="1">
            {topLevelComments.length}
          </Badge>
        </Flex>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <button
          className={styles.filterButton}
          data-active={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={styles.filterButton}
          data-active={filter === 'unresolved'}
          onClick={() => setFilter('unresolved')}
        >
          Active
        </button>
        {outdatedCount > 0 && (
          <button
            className={styles.filterButton}
            data-active={filter === 'outdated'}
            onClick={() => setFilter('outdated')}
          >
            Outdated ({outdatedCount})
          </button>
        )}
      </div>

      {/* Comment list */}
      <div className={styles.commentList}>
        {filteredComments.length === 0 ? (
          <div className={styles.emptyState}>
            <Text size="2" color="gray">
              {filter === 'all'
                ? 'No comments yet. Click on a line in the diff to add a comment.'
                : `No ${filter} comments.`}
            </Text>
          </div>
        ) : (
          Array.from(visibleGroupedByFile.entries()).map(([filePath, fileComments]) => (
            <Box key={filePath}>
              {/* File path header */}
              {filePath !== '(general)' && (
                <div className={styles.filePath}>
                  {filePath}
                </div>
              )}

              {/* Comments for this file */}
              <Flex direction="column" gap="2" mt="2">
                {fileComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={styles.commentCard}
                    data-outdated={comment.isOutdated || undefined}
                    onClick={() => onCommentClick?.(comment)}
                    role={onCommentClick ? 'button' : undefined}
                    tabIndex={onCommentClick ? 0 : undefined}
                  >
                    <Flex direction="column" gap="1">
                      {/* Comment meta */}
                      <Flex justify="between" align="center">
                        <Flex align="center" gap="2">
                          <Text size="1" weight="medium">
                            {comment.authorName || 'Unknown'}
                          </Text>
                          {comment.line && (
                            <Text size="1" color="gray">
                              Line {comment.line}
                            </Text>
                          )}
                          {comment.isOutdated && (
                            <Badge size="1" color="orange" variant="soft">
                              Outdated
                            </Badge>
                          )}
                        </Flex>
                        <Text size="1" color="gray">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </Text>
                      </Flex>

                      {/* Comment content */}
                      <Text size="2">{comment.content}</Text>

                      {/* Replies */}
                      {repliesByParent.has(comment.id) && (
                        <div className={styles.replyThread}>
                          {repliesByParent.get(comment.id)!.map((reply) => (
                            <Flex key={reply.id} direction="column" gap="1">
                              <Flex align="center" gap="2">
                                <Text size="1" weight="medium">
                                  {reply.authorName || 'Unknown'}
                                </Text>
                                <Text size="1" color="gray">
                                  {new Date(reply.createdAt).toLocaleDateString()}
                                </Text>
                              </Flex>
                              <Text size="2">{reply.content}</Text>
                            </Flex>
                          ))}
                        </div>
                      )}
                    </Flex>
                  </div>
                ))}
              </Flex>
            </Box>
          ))
        )}

        {/* Show more button for windowed rendering */}
        {hasMore && (
          <div className={styles.showMore}>
            <button
              onClick={loadMore}
              className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
            >
              Show more ({filteredComments.length - totalVisible} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewCommentsSidebar;
