/**
 * Line mapping utility for full article diff display.
 * Maps line numbers to their diff status (addition/deletion/context).
 */

import type { DiffHunk, DiffLine } from '@echo-portal/shared';

export type LineDiffType = 'context' | 'addition' | 'deletion';

export interface LineDiffInfo {
  type: LineDiffType;
  lineNumber: number;
  pairedLineNumber?: number; // For split view alignment
  content: string;
}

export interface LineDiffMaps {
  oldMap: Map<number, LineDiffInfo>;
  newMap: Map<number, LineDiffInfo>;
}

/**
 * Build line-to-diff mappings from hunks.
 * Returns maps for both old and new content sides.
 */
export function buildLineDiffMap(hunks: DiffHunk[]): LineDiffMaps {
  const oldMap = new Map<number, LineDiffInfo>();
  const newMap = new Map<number, LineDiffInfo>();

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'deletion' && line.oldLineNumber !== undefined) {
        oldMap.set(line.oldLineNumber, {
          type: 'deletion',
          lineNumber: line.oldLineNumber,
          content: line.content,
        });
      } else if (line.type === 'addition' && line.newLineNumber !== undefined) {
        newMap.set(line.newLineNumber, {
          type: 'addition',
          lineNumber: line.newLineNumber,
          content: line.content,
        });
      } else if (line.type === 'context') {
        if (line.oldLineNumber !== undefined) {
          oldMap.set(line.oldLineNumber, {
            type: 'context',
            lineNumber: line.oldLineNumber,
            pairedLineNumber: line.newLineNumber,
            content: line.content,
          });
        }
        if (line.newLineNumber !== undefined) {
          newMap.set(line.newLineNumber, {
            type: 'context',
            lineNumber: line.newLineNumber,
            pairedLineNumber: line.oldLineNumber,
            content: line.content,
          });
        }
      }
    }
  }

  return { oldMap, newMap };
}

/**
 * Get the diff type for a specific line in a content body.
 * If the line is not in the diff hunks, it's treated as context.
 */
export function getLineDiffType(
  lineNumber: number,
  side: 'old' | 'new',
  maps: LineDiffMaps
): LineDiffType {
  const map = side === 'old' ? maps.oldMap : maps.newMap;
  const info = map.get(lineNumber);
  return info?.type || 'context';
}

/**
 * Check if a paragraph (by index) has any changes.
 * Used for unified view to determine paragraph-level highlighting.
 */
export function paragraphHasChanges(
  paragraphLines: string[],
  startLineNumber: number,
  side: 'old' | 'new',
  maps: LineDiffMaps
): { hasAdditions: boolean; hasDeletions: boolean } {
  let hasAdditions = false;
  let hasDeletions = false;

  for (let i = 0; i < paragraphLines.length; i++) {
    const lineNum = startLineNumber + i;
    const type = getLineDiffType(lineNum, side, maps);
    if (type === 'addition') hasAdditions = true;
    if (type === 'deletion') hasDeletions = true;
  }

  return { hasAdditions, hasDeletions };
}

/**
 * Build aligned line pairs for split view display.
 * Pairs deletions with additions and handles context lines.
 */
export function buildAlignedLinePairs(
  oldLines: string[],
  newLines: string[],
  hunks: DiffHunk[]
): Array<{ old: DiffLine | null; new: DiffLine | null }> {
  const pairs: Array<{ old: DiffLine | null; new: DiffLine | null }> = [];

  // Build maps to track which lines are changes vs context
  const { oldMap, newMap } = buildLineDiffMap(hunks);

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLineNum = oldIdx + 1;
    const newLineNum = newIdx + 1;

    const oldInfo = oldMap.get(oldLineNum);
    const newInfo = newMap.get(newLineNum);

    // Case 1: Both are context or unchanged - pair them
    if (
      (oldIdx < oldLines.length && !oldInfo) &&
      (newIdx < newLines.length && !newInfo)
    ) {
      pairs.push({
        old: {
          type: 'context',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        },
        new: {
          type: 'context',
          content: newLines[newIdx],
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        },
      });
      oldIdx++;
      newIdx++;
      continue;
    }

    // Case 2: Both are in diff - handle based on type
    if (oldInfo?.type === 'deletion' && newInfo?.type === 'addition') {
      // Paired deletion/addition
      pairs.push({
        old: {
          type: 'deletion',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
        },
        new: {
          type: 'addition',
          content: newLines[newIdx],
          newLineNumber: newLineNum,
        },
      });
      oldIdx++;
      newIdx++;
      continue;
    }

    // Case 3: Only old side has deletion
    if (oldInfo?.type === 'deletion') {
      pairs.push({
        old: {
          type: 'deletion',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
        },
        new: null,
      });
      oldIdx++;
      continue;
    }

    // Case 4: Only new side has addition
    if (newInfo?.type === 'addition') {
      pairs.push({
        old: null,
        new: {
          type: 'addition',
          content: newLines[newIdx],
          newLineNumber: newLineNum,
        },
      });
      newIdx++;
      continue;
    }

    // Case 5: Context lines (paired)
    if (oldInfo?.type === 'context' || newInfo?.type === 'context') {
      pairs.push({
        old: oldIdx < oldLines.length ? {
          type: 'context',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        } : null,
        new: newIdx < newLines.length ? {
          type: 'context',
          content: newLines[newIdx],
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        } : null,
      });
      oldIdx++;
      newIdx++;
      continue;
    }

    // Fallback: advance both
    if (oldIdx < oldLines.length && newIdx < newLines.length) {
      pairs.push({
        old: {
          type: 'context',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
        },
        new: {
          type: 'context',
          content: newLines[newIdx],
          newLineNumber: newLineNum,
        },
      });
      oldIdx++;
      newIdx++;
    } else if (oldIdx < oldLines.length) {
      pairs.push({
        old: {
          type: 'context',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
        },
        new: null,
      });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      pairs.push({
        old: null,
        new: {
          type: 'context',
          content: newLines[newIdx],
          newLineNumber: newLineNum,
        },
      });
      newIdx++;
    }
  }

  return pairs;
}
