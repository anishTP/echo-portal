import { eq, and } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import type { ContentDiff, DiffChange, MetadataChange, UserSummary } from '@echo-portal/shared';

async function getUserSummary(userId: string): Promise<UserSummary> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  return {
    id: userId,
    displayName: user?.displayName ?? 'Unknown',
    avatarUrl: user?.avatarUrl ?? undefined,
  };
}

/**
 * Line-based diff using longest common subsequence (LCS) approach.
 * Returns structured diff output with add/remove/unchanged segments.
 */
function computeLineDiff(oldText: string, newText: string): DiffChange[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const changes: DiffChange[] = [];
  let i = m;
  let j = n;
  const rawChanges: { type: 'add' | 'remove' | 'unchanged'; line: number; content: string }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawChanges.unshift({ type: 'unchanged', line: j, content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawChanges.unshift({ type: 'add', line: j, content: newLines[j - 1] });
      j--;
    } else if (i > 0) {
      rawChanges.unshift({ type: 'remove', line: i, content: oldLines[i - 1] });
      i--;
    }
  }

  // Merge consecutive same-type changes into ranges
  let currentType: 'add' | 'remove' | 'unchanged' | null = null;
  let startLine = 0;
  let contentLines: string[] = [];

  for (const change of rawChanges) {
    if (change.type !== currentType) {
      if (currentType !== null) {
        changes.push({
          type: currentType,
          lineStart: startLine,
          lineEnd: startLine + contentLines.length - 1,
          content: contentLines.join('\n'),
        });
      }
      currentType = change.type;
      startLine = change.line;
      contentLines = [change.content];
    } else {
      contentLines.push(change.content);
    }
  }

  // Flush last segment
  if (currentType !== null) {
    changes.push({
      type: currentType,
      lineStart: startLine,
      lineEnd: startLine + contentLines.length - 1,
      content: contentLines.join('\n'),
    });
  }

  return changes;
}

/**
 * Compare metadata snapshots field by field.
 */
function computeMetadataDiff(
  oldMeta: Record<string, unknown>,
  newMeta: Record<string, unknown>
): MetadataChange[] {
  const changes: MetadataChange[] = [];
  const allKeys = new Set([...Object.keys(oldMeta), ...Object.keys(newMeta)]);

  for (const key of allKeys) {
    const oldVal = oldMeta[key];
    const newVal = newMeta[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }

  return changes;
}

export const diffService = {
  /**
   * Compare two versions of content by their ISO 8601 timestamps.
   */
  async diffVersions(
    contentId: string,
    fromTimestamp: string,
    toTimestamp: string
  ): Promise<ContentDiff> {
    const fromVersion = await db.query.contentVersions.findFirst({
      where: and(
        eq(schema.contentVersions.contentId, contentId),
        eq(schema.contentVersions.versionTimestamp, new Date(fromTimestamp))
      ),
    });
    if (!fromVersion) {
      throw new Error('Source version not found');
    }

    const toVersion = await db.query.contentVersions.findFirst({
      where: and(
        eq(schema.contentVersions.contentId, contentId),
        eq(schema.contentVersions.versionTimestamp, new Date(toTimestamp))
      ),
    });
    if (!toVersion) {
      throw new Error('Target version not found');
    }

    const [fromAuthor, toAuthor] = await Promise.all([
      getUserSummary(fromVersion.authorId),
      getUserSummary(toVersion.authorId),
    ]);

    const bodyChanges = computeLineDiff(fromVersion.body, toVersion.body);
    const metadataChanges = computeMetadataDiff(
      fromVersion.metadataSnapshot as Record<string, unknown>,
      toVersion.metadataSnapshot as Record<string, unknown>
    );

    const additions = bodyChanges.filter((c) => c.type === 'add').length;
    const deletions = bodyChanges.filter((c) => c.type === 'remove').length;

    return {
      contentId,
      from: {
        versionTimestamp: fromVersion.versionTimestamp.toISOString(),
        author: fromAuthor,
        changeDescription: fromVersion.changeDescription,
      },
      to: {
        versionTimestamp: toVersion.versionTimestamp.toISOString(),
        author: toAuthor,
        changeDescription: toVersion.changeDescription,
      },
      diff: {
        bodyChanges,
        metadataChanges,
      },
      summary: {
        additions,
        deletions,
        modifications: metadataChanges.length,
      },
    };
  },
};
