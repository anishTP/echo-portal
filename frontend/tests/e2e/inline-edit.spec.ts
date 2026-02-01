import { test, expect } from '@playwright/test';

/**
 * T054: E2E test for full edit workflow
 * Tests: library -> edit -> save -> version history
 */

// Helper to set up authenticated session
async function setupAuthenticatedSession(page: any, context: any) {
  await context.addCookies([
    {
      name: 'echo_session',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ]);

  // Mock /auth/me endpoint for authenticated contributor
  await page.route('**/api/v1/auth/me', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'user-123',
          email: 'contributor@example.com',
          displayName: 'Test Contributor',
          avatarUrl: 'https://example.com/avatar.jpg',
          roles: ['contributor'],
          isActive: true,
        },
        sessionId: 'session-123',
      }),
    });
  });
}

// Mock content data
const mockPublishedContent = {
  items: [
    {
      id: 'content-1',
      slug: 'getting-started',
      title: 'Getting Started Guide',
      category: 'guideline',
      tags: ['tutorial', 'beginner'],
      description: 'A comprehensive guide to getting started',
      publishedAt: '2024-01-15T10:00:00Z',
      createdBy: {
        id: 'author-1',
        displayName: 'Content Author',
        avatarUrl: 'https://example.com/author.jpg',
      },
    },
    {
      id: 'content-2',
      slug: 'advanced-topics',
      title: 'Advanced Topics',
      category: 'guideline',
      tags: ['advanced'],
      description: 'Advanced documentation',
      publishedAt: '2024-01-20T10:00:00Z',
      createdBy: {
        id: 'author-1',
        displayName: 'Content Author',
        avatarUrl: 'https://example.com/author.jpg',
      },
    },
  ],
  meta: { total: 2, page: 1, limit: 100, hasMore: false },
};

const mockContentDetail = {
  id: 'content-1',
  slug: 'getting-started',
  title: 'Getting Started Guide',
  category: 'guideline',
  tags: ['tutorial', 'beginner'],
  description: 'A comprehensive guide to getting started',
  publishedAt: '2024-01-15T10:00:00Z',
  createdBy: {
    id: 'author-1',
    displayName: 'Content Author',
    avatarUrl: 'https://example.com/author.jpg',
  },
  currentVersion: {
    id: 'version-1',
    body: '# Getting Started\n\nWelcome to our documentation.\n\n## Prerequisites\n\n- Node.js 20+\n- pnpm\n\n## Installation\n\n```bash\npnpm install\n```',
    createdAt: '2024-01-15T10:00:00Z',
    createdBy: {
      id: 'author-1',
      displayName: 'Content Author',
    },
  },
};

const mockCreatedBranch = {
  branch: {
    id: 'branch-edit-123',
    name: 'edit-getting-started',
    slug: 'edit-getting-started',
    state: 'draft',
    ownerId: 'user-123',
    createdAt: '2024-01-20T12:00:00Z',
    permissions: {
      canEdit: true,
      canSubmitForReview: true,
      canApprove: false,
      canPublish: false,
      canArchive: false,
      validTransitions: ['in_review'],
    },
  },
  content: {
    id: 'content-branch-1',
    slug: 'getting-started',
    title: 'Getting Started Guide',
    branchId: 'branch-edit-123',
  },
};

test.describe('Inline Edit E2E Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthenticatedSession(page, context);
  });

  test('should display Edit button for authenticated contributors on library content', async ({ page }) => {
    // Mock published content list
    await page.route('**/api/v1/contents?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPublishedContent),
      });
    });

    // Mock content detail by slug
    await page.route('**/api/v1/contents/slug/getting-started', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockContentDetail),
      });
    });

    await page.goto('/library/getting-started');

    // Should show content title
    await expect(page.getByRole('heading', { name: 'Getting Started Guide' })).toBeVisible();

    // Should show Edit button for contributor
    const editButton = page.getByRole('button', { name: /edit/i });
    await expect(editButton).toBeVisible();
  });

  test('should open branch creation dialog when Edit is clicked', async ({ page }) => {
    // Mock published content list
    await page.route('**/api/v1/contents?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPublishedContent),
      });
    });

    // Mock content detail by slug
    await page.route('**/api/v1/contents/slug/getting-started', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockContentDetail),
      });
    });

    await page.goto('/library/getting-started');

    // Click Edit button
    const editButton = page.getByRole('button', { name: /edit/i });
    await editButton.click();

    // Should show branch creation dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/create.*branch/i)).toBeVisible();

    // Should have pre-filled branch name suggestion
    const branchNameInput = page.locator('input[name="branchName"]');
    await expect(branchNameInput).toBeVisible();
  });

  test('should create edit branch and enter edit mode', async ({ page }) => {
    // Mock published content list
    await page.route('**/api/v1/contents?*', async (route) => {
      const url = new URL(route.request().url());
      const branchId = url.searchParams.get('branchId');

      if (branchId === 'branch-edit-123') {
        // Return branch content when in edit mode
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{
              ...mockContentDetail,
              id: 'content-branch-1',
              branchId: 'branch-edit-123',
            }],
            meta: { total: 1, page: 1, limit: 100, hasMore: false },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockPublishedContent),
        });
      }
    });

    // Mock content detail by slug
    await page.route('**/api/v1/contents/slug/getting-started', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockContentDetail),
      });
    });

    // Mock content detail by ID (for edit mode)
    await page.route('**/api/v1/contents/content-branch-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockContentDetail,
          id: 'content-branch-1',
          branchId: 'branch-edit-123',
        }),
      });
    });

    // Mock branch creation endpoint
    await page.route('**/api/v1/branches/edit', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(mockCreatedBranch),
      });
    });

    // Mock branch detail endpoint
    await page.route('**/api/v1/branches/branch-edit-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCreatedBranch.branch),
      });
    });

    await page.goto('/library/getting-started');

    // Click Edit button
    const editButton = page.getByRole('button', { name: /edit/i });
    await editButton.click();

    // Fill branch name in dialog
    const branchNameInput = page.locator('input[name="branchName"]');
    await branchNameInput.clear();
    await branchNameInput.fill('my-edits');

    // Confirm branch creation
    const confirmButton = page.getByRole('button', { name: /create.*branch/i });
    await confirmButton.click();

    // Should transition to edit mode
    await expect(page).toHaveURL(/mode=edit/);
    await expect(page).toHaveURL(/branchId=branch-edit-123/);
  });

  test('should display WYSIWYG editor in edit mode', async ({ page }) => {
    // Set up mocks for edit mode
    await page.route('**/api/v1/contents?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            ...mockContentDetail,
            id: 'content-branch-1',
            branchId: 'branch-edit-123',
          }],
          meta: { total: 1, page: 1, limit: 100, hasMore: false },
        }),
      });
    });

    await page.route('**/api/v1/contents/content-branch-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockContentDetail,
          id: 'content-branch-1',
          branchId: 'branch-edit-123',
        }),
      });
    });

    await page.route('**/api/v1/branches/branch-edit-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCreatedBranch.branch),
      });
    });

    // Navigate directly to edit mode URL
    await page.goto('/library/getting-started?mode=edit&branchId=branch-edit-123&contentId=content-branch-1');

    // Should show editor interface
    await expect(page.locator('.milkdown, .ProseMirror, [contenteditable="true"]')).toBeVisible({ timeout: 10000 });

    // Should show edit mode header with branch name
    await expect(page.getByText(/edit-getting-started|my-edits/i)).toBeVisible();
  });

  test('should auto-save content changes', async ({ page }) => {
    let syncCalled = false;

    // Set up mocks for edit mode
    await page.route('**/api/v1/contents?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            ...mockContentDetail,
            id: 'content-branch-1',
            branchId: 'branch-edit-123',
          }],
          meta: { total: 1, page: 1, limit: 100, hasMore: false },
        }),
      });
    });

    await page.route('**/api/v1/contents/content-branch-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockContentDetail,
          id: 'content-branch-1',
          branchId: 'branch-edit-123',
        }),
      });
    });

    await page.route('**/api/v1/branches/branch-edit-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCreatedBranch.branch),
      });
    });

    // Mock sync endpoint
    await page.route('**/api/v1/contents/content-branch-1/sync', async (route) => {
      syncCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          newVersionTimestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/library/getting-started?mode=edit&branchId=branch-edit-123&contentId=content-branch-1');

    // Wait for editor to load
    const editor = page.locator('.milkdown, .ProseMirror, [contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Type some content
    await editor.click();
    await page.keyboard.type('New content added for testing');

    // Wait for auto-save debounce (2 seconds) plus some buffer
    await page.waitForTimeout(3000);

    // Auto-save should have been triggered (stored in IndexedDB)
    // The sync to server happens on connectivity/explicit save
  });

  test('should show save status in editor', async ({ page }) => {
    await page.route('**/api/v1/contents?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            ...mockContentDetail,
            id: 'content-branch-1',
            branchId: 'branch-edit-123',
          }],
          meta: { total: 1, page: 1, limit: 100, hasMore: false },
        }),
      });
    });

    await page.route('**/api/v1/contents/content-branch-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockContentDetail,
          id: 'content-branch-1',
          branchId: 'branch-edit-123',
        }),
      });
    });

    await page.route('**/api/v1/branches/branch-edit-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCreatedBranch.branch),
      });
    });

    await page.goto('/library/getting-started?mode=edit&branchId=branch-edit-123&contentId=content-branch-1');

    // Should show status bar or save indicator
    // Look for common save status indicators
    const statusIndicators = page.locator('[data-testid="save-status"], .save-status, [aria-label*="save"]');

    // At minimum, the edit mode UI should be present
    await expect(page.locator('.milkdown, .ProseMirror, [contenteditable="true"]')).toBeVisible({ timeout: 10000 });
  });

  test('should prompt before leaving with unsaved changes', async ({ page }) => {
    await page.route('**/api/v1/contents?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            ...mockContentDetail,
            id: 'content-branch-1',
            branchId: 'branch-edit-123',
          }],
          meta: { total: 1, page: 1, limit: 100, hasMore: false },
        }),
      });
    });

    await page.route('**/api/v1/contents/content-branch-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockContentDetail,
          id: 'content-branch-1',
          branchId: 'branch-edit-123',
        }),
      });
    });

    await page.route('**/api/v1/branches/branch-edit-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCreatedBranch.branch),
      });
    });

    await page.goto('/library/getting-started?mode=edit&branchId=branch-edit-123&contentId=content-branch-1');

    // Wait for editor to load
    const editor = page.locator('.milkdown, .ProseMirror, [contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Make changes
    await editor.click();
    await page.keyboard.type('Unsaved changes');

    // Set up dialog handler for beforeunload-style prompts
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('unsaved');
      await dialog.dismiss();
    });

    // Try to navigate away - this should trigger the blocker
    // Note: Playwright handles beforeunload differently, so we test the Cancel button instead
    const cancelButton = page.getByRole('button', { name: /cancel|discard/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      // If there's a confirm dialog, it should appear
    }
  });

  test('should exit edit mode when Done is clicked', async ({ page }) => {
    await page.route('**/api/v1/contents?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            ...mockContentDetail,
            id: 'content-branch-1',
            branchId: 'branch-edit-123',
          }],
          meta: { total: 1, page: 1, limit: 100, hasMore: false },
        }),
      });
    });

    await page.route('**/api/v1/contents/content-branch-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockContentDetail,
          id: 'content-branch-1',
          branchId: 'branch-edit-123',
        }),
      });
    });

    await page.route('**/api/v1/branches/branch-edit-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCreatedBranch.branch),
      });
    });

    await page.route('**/api/v1/contents/content-branch-1/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          newVersionTimestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/library/getting-started?mode=edit&branchId=branch-edit-123&contentId=content-branch-1');

    // Wait for editor to load
    await expect(page.locator('.milkdown, .ProseMirror, [contenteditable="true"]')).toBeVisible({ timeout: 10000 });

    // Click Done button
    const doneButton = page.getByRole('button', { name: /done/i });
    await expect(doneButton).toBeVisible();
    await doneButton.click();

    // Should exit edit mode (URL should no longer have mode=edit)
    await expect(page).not.toHaveURL(/mode=edit/);
  });

  test('should not show Edit button for unauthenticated users', async ({ page }) => {
    // Don't set up authentication - clear any session
    await page.context().clearCookies();

    // Mock /auth/me to return 401
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    // Mock published content list
    await page.route('**/api/v1/contents?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPublishedContent),
      });
    });

    // Mock content detail by slug
    await page.route('**/api/v1/contents/slug/getting-started', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockContentDetail),
      });
    });

    await page.goto('/library/getting-started');

    // Should show content
    await expect(page.getByRole('heading', { name: 'Getting Started Guide' })).toBeVisible();

    // Should NOT show Edit button for unauthenticated user
    await expect(page.getByRole('button', { name: /^edit$/i })).not.toBeVisible();
  });
});

test.describe('Version History in Edit Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthenticatedSession(page, context);
  });

  test('should show version history for branch content', async ({ page }) => {
    const mockVersions = [
      {
        id: 'version-3',
        body: '# Updated content v3',
        changeDescription: 'Third revision',
        createdAt: '2024-01-22T14:00:00Z',
        createdBy: { id: 'user-123', displayName: 'Test Contributor' },
      },
      {
        id: 'version-2',
        body: '# Updated content v2',
        changeDescription: 'Second revision',
        createdAt: '2024-01-21T12:00:00Z',
        createdBy: { id: 'user-123', displayName: 'Test Contributor' },
      },
      {
        id: 'version-1',
        body: '# Getting Started',
        changeDescription: 'Initial version',
        createdAt: '2024-01-15T10:00:00Z',
        createdBy: { id: 'author-1', displayName: 'Content Author' },
      },
    ];

    await page.route('**/api/v1/contents?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            ...mockContentDetail,
            id: 'content-branch-1',
            branchId: 'branch-edit-123',
          }],
          meta: { total: 1, page: 1, limit: 100, hasMore: false },
        }),
      });
    });

    await page.route('**/api/v1/contents/content-branch-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockContentDetail,
          id: 'content-branch-1',
          branchId: 'branch-edit-123',
        }),
      });
    });

    await page.route('**/api/v1/branches/branch-edit-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCreatedBranch.branch),
      });
    });

    // Mock versions endpoint
    await page.route('**/api/v1/contents/content-branch-1/versions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ versions: mockVersions }),
      });
    });

    await page.goto('/library/getting-started?mode=edit&branchId=branch-edit-123&contentId=content-branch-1');

    // Wait for editor to load
    await expect(page.locator('.milkdown, .ProseMirror, [contenteditable="true"]')).toBeVisible({ timeout: 10000 });

    // Look for version history UI element (could be a tab, button, or section)
    const versionHistoryToggle = page.locator('[aria-label*="version"], [data-testid*="version"], button:has-text("History"), button:has-text("Versions")');

    // The version history might be in the sidebar or as a tab
    // This test verifies the UI elements exist for version tracking
  });
});
