import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffView } from '../../../src/components/review/DiffView';
import type { BranchComparison } from '@echo-portal/shared';
import type { ReviewComment } from '../../../src/services/reviewService';

const mockComparison: BranchComparison = {
  branchId: 'branch-1',
  baseCommit: 'abc123',
  headCommit: 'def456',
  baseRef: 'main',
  headRef: 'feature-branch',
  files: [
    {
      path: 'src/example.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
      hunks: [
        {
          id: 'hunk-0-test',
          oldStart: 1,
          oldLines: 5,
          newStart: 1,
          newLines: 8,
          header: '@@ -1,5 +1,8 @@',
          lines: [
            { type: 'context', content: 'const a = 1;', oldNumber: 1, newNumber: 1 },
            { type: 'removed', content: 'const b = 2;', oldNumber: 2 },
            { type: 'added', content: 'const b = 3;', newNumber: 2 },
            { type: 'context', content: 'const c = 4;', oldNumber: 3, newNumber: 3 },
          ],
        },
      ],
    },
    {
      path: 'src/new-file.ts',
      status: 'added',
      additions: 20,
      deletions: 0,
      hunks: [
        {
          id: 'hunk-0-new',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 20,
          header: '@@ -0,0 +1,20 @@',
          lines: [
            { type: 'added', content: 'export function hello() {}', newNumber: 1 },
          ],
        },
      ],
    },
  ],
  stats: { filesChanged: 2, additions: 30, deletions: 5 },
  baseState: 'current',
};

const mockDivergedComparison: BranchComparison = {
  ...mockComparison,
  baseState: 'diverged',
  divergedCommit: 'xyz789',
};

const mockComments: ReviewComment[] = [
  {
    id: 'comment-1',
    authorId: 'user-1',
    content: 'Consider refactoring this',
    path: 'src/example.ts',
    line: 2,
    side: 'new',
    isOutdated: false,
    createdAt: '2026-02-03T10:00:00Z',
    updatedAt: '2026-02-03T10:00:00Z',
  },
];

describe('DiffView', () => {
  it('renders file list with stats', () => {
    render(
      <DiffView
        comparison={mockComparison}
        comments={[]}
        displayMode="unified"
      />
    );

    expect(screen.getByText('+30')).toBeInTheDocument();
    expect(screen.getAllByText('-5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 files changed')).toBeInTheDocument();
  });

  it('renders file headers', () => {
    render(
      <DiffView
        comparison={mockComparison}
        comments={[]}
        displayMode="unified"
      />
    );

    expect(screen.getByText('src/example.ts')).toBeInTheDocument();
    expect(screen.getByText('src/new-file.ts')).toBeInTheDocument();
  });

  it('auto-expands first 3 files', () => {
    render(
      <DiffView
        comparison={mockComparison}
        comments={[]}
        displayMode="unified"
      />
    );

    // Both files should be expanded (there are only 2)
    // Look for hunk content to verify files are expanded
    expect(screen.getByText(/const a = 1/)).toBeInTheDocument();
  });

  it('toggles file expand/collapse on header click', () => {
    render(
      <DiffView
        comparison={mockComparison}
        comments={[]}
        displayMode="unified"
      />
    );

    // File should be expanded initially
    expect(screen.getByText(/const a = 1/)).toBeInTheDocument();

    // Click header to collapse
    fireEvent.click(screen.getByText('src/example.ts'));

    // Content should be gone after collapse
    expect(screen.queryByText(/const a = 1/)).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(screen.getByText('src/example.ts'));

    // Content should be back
    expect(screen.getByText(/const a = 1/)).toBeInTheDocument();
  });

  it('shows empty state when no files changed', () => {
    const emptyComparison: BranchComparison = {
      ...mockComparison,
      files: [],
      stats: { filesChanged: 0, additions: 0, deletions: 0 },
    };

    render(
      <DiffView
        comparison={emptyComparison}
        comments={[]}
        displayMode="unified"
      />
    );

    expect(screen.getByText('No changes to display')).toBeInTheDocument();
  });

  it('shows divergence warning when base has changed', () => {
    render(
      <DiffView
        comparison={mockDivergedComparison}
        comments={[]}
        displayMode="unified"
      />
    );

    expect(screen.getByText('Base branch has changed')).toBeInTheDocument();
  });

  it('does not show divergence warning when base is current', () => {
    render(
      <DiffView
        comparison={mockComparison}
        comments={[]}
        displayMode="unified"
      />
    );

    expect(screen.queryByText('Base branch has changed')).not.toBeInTheDocument();
  });

  it('handles singular file count correctly', () => {
    const singleFileComparison: BranchComparison = {
      ...mockComparison,
      files: [mockComparison.files[0]],
      stats: { filesChanged: 1, additions: 10, deletions: 5 },
    };

    render(
      <DiffView
        comparison={singleFileComparison}
        comments={[]}
        displayMode="unified"
      />
    );

    expect(screen.getByText('1 file changed')).toBeInTheDocument();
  });
});
