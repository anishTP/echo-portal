import type { FileDiff, DiffHunk, DiffLine, BranchDiff } from './diff.js';

/**
 * Format a diff for display (unified diff format)
 */
export function formatUnifiedDiff(diff: BranchDiff): string {
  const lines: string[] = [];

  lines.push(`diff --git a/${diff.baseRef} b/${diff.headRef}`);
  lines.push(`--- a/${diff.baseRef}`);
  lines.push(`+++ b/${diff.headRef}`);
  lines.push('');

  for (const file of diff.files) {
    lines.push(...formatFileDiff(file));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a single file diff
 */
export function formatFileDiff(file: FileDiff): string[] {
  const lines: string[] = [];

  // File header
  if (file.status === 'added') {
    lines.push(`diff --git a/${file.path} b/${file.path}`);
    lines.push('new file mode 100644');
    lines.push('--- /dev/null');
    lines.push(`+++ b/${file.path}`);
  } else if (file.status === 'deleted') {
    lines.push(`diff --git a/${file.path} b/${file.path}`);
    lines.push('deleted file mode 100644');
    lines.push(`--- a/${file.path}`);
    lines.push('+++ /dev/null');
  } else if (file.status === 'renamed' && file.oldPath) {
    lines.push(`diff --git a/${file.oldPath} b/${file.path}`);
    lines.push(`rename from ${file.oldPath}`);
    lines.push(`rename to ${file.path}`);
    lines.push(`--- a/${file.oldPath}`);
    lines.push(`+++ b/${file.path}`);
  } else {
    lines.push(`diff --git a/${file.path} b/${file.path}`);
    lines.push(`--- a/${file.path}`);
    lines.push(`+++ b/${file.path}`);
  }

  // Hunks
  for (const hunk of file.hunks) {
    lines.push(...formatHunk(hunk));
  }

  return lines;
}

/**
 * Format a diff hunk
 */
export function formatHunk(hunk: DiffHunk): string[] {
  const lines: string[] = [];

  // Hunk header
  lines.push(
    `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
  );

  // Hunk content
  for (const line of hunk.lines) {
    lines.push(formatDiffLine(line));
  }

  return lines;
}

/**
 * Format a single diff line
 */
export function formatDiffLine(line: DiffLine): string {
  switch (line.type) {
    case 'addition':
      return `+${line.content}`;
    case 'deletion':
      return `-${line.content}`;
    case 'context':
      return ` ${line.content}`;
  }
}

/**
 * Convert diff to HTML with syntax highlighting classes
 */
export function formatDiffHtml(diff: BranchDiff): string {
  const html: string[] = [];

  html.push('<div class="diff">');

  for (const file of diff.files) {
    html.push('<div class="diff-file">');
    html.push(`<div class="diff-file-header">`);
    html.push(`<span class="diff-file-status diff-status-${file.status}">${file.status}</span>`);
    html.push(`<span class="diff-file-path">${escapeHtml(file.path)}</span>`);
    html.push(`<span class="diff-file-stats">+${file.additions} -${file.deletions}</span>`);
    html.push('</div>');

    html.push('<div class="diff-content">');
    for (const hunk of file.hunks) {
      html.push('<div class="diff-hunk">');
      html.push(
        `<div class="diff-hunk-header">@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@</div>`
      );

      for (const line of hunk.lines) {
        const lineClass = `diff-line diff-line-${line.type}`;
        const prefix =
          line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';
        html.push(
          `<div class="${lineClass}"><span class="diff-line-prefix">${prefix}</span><span class="diff-line-content">${escapeHtml(line.content)}</span></div>`
        );
      }

      html.push('</div>');
    }
    html.push('</div>');
    html.push('</div>');
  }

  html.push('</div>');

  return html.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get file extension for syntax highlighting
 */
export function getFileLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    yml: 'yaml',
    yaml: 'yaml',
    sql: 'sql',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
  };

  return languageMap[ext || ''] || 'plaintext';
}

/**
 * Split a diff into reviewable chunks for large files
 */
export function splitLargeDiff(
  diff: BranchDiff,
  maxLinesPerChunk: number = 500
): BranchDiff[] {
  const chunks: BranchDiff[] = [];
  let currentChunk: FileDiff[] = [];
  let currentLineCount = 0;

  for (const file of diff.files) {
    const fileLineCount = file.hunks.reduce(
      (sum, hunk) => sum + hunk.lines.length,
      0
    );

    if (currentLineCount + fileLineCount > maxLinesPerChunk && currentChunk.length > 0) {
      // Start a new chunk
      chunks.push({
        ...diff,
        files: currentChunk,
        stats: calculateStats(currentChunk),
      });
      currentChunk = [];
      currentLineCount = 0;
    }

    currentChunk.push(file);
    currentLineCount += fileLineCount;
  }

  // Add remaining files
  if (currentChunk.length > 0) {
    chunks.push({
      ...diff,
      files: currentChunk,
      stats: calculateStats(currentChunk),
    });
  }

  return chunks;
}

/**
 * Calculate stats for a set of files
 */
function calculateStats(files: FileDiff[]): BranchDiff['stats'] {
  return {
    filesChanged: files.length,
    additions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
  };
}
