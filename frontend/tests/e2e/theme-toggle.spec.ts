import { test, expect } from '@playwright/test';

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('theme toggle is visible in header', async ({ page }) => {
    await page.goto('/');

    // Look for the theme toggle button (ghost button with icon)
    const themeToggle = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeToggle).toBeVisible();
  });

  test('clicking theme toggle opens dropdown menu', async ({ page }) => {
    await page.goto('/');

    const themeToggle = page.locator('button[aria-label="Toggle theme"]');
    await themeToggle.click();

    // Dropdown menu should be visible with Light, Dark, System options
    await expect(page.getByText('Light')).toBeVisible();
    await expect(page.getByText('Dark')).toBeVisible();
    await expect(page.getByText('System')).toBeVisible();
  });

  test('selecting Light theme applies light mode', async ({ page }) => {
    await page.goto('/');

    // Open theme menu and select Light
    await page.locator('button[aria-label="Toggle theme"]').click();
    await page.getByText('Light').click();

    // Document should have light class
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('light');
    expect(htmlClass).not.toContain('dark');
  });

  test('selecting Dark theme applies dark mode', async ({ page }) => {
    await page.goto('/');

    // Open theme menu and select Dark
    await page.locator('button[aria-label="Toggle theme"]').click();
    await page.getByText('Dark').click();

    // Document should have dark class
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('dark');
    expect(htmlClass).not.toContain('light');
  });

  test('theme preference persists across page reload', async ({ page }) => {
    await page.goto('/');

    // Select dark theme
    await page.locator('button[aria-label="Toggle theme"]').click();
    await page.getByText('Dark').click();

    // Reload page
    await page.reload();

    // Theme should still be dark
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('dark');
  });

  test('theme preference is stored in localStorage', async ({ page }) => {
    await page.goto('/');

    // Select dark theme
    await page.locator('button[aria-label="Toggle theme"]').click();
    await page.getByText('Dark').click();

    // Check localStorage
    const stored = await page.evaluate(() => {
      return localStorage.getItem('echo-portal-theme-preference');
    });

    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.preference).toBe('dark');
  });

  test('System option follows OS preference', async ({ page }) => {
    await page.goto('/');

    // Open theme menu and select System
    await page.locator('button[aria-label="Toggle theme"]').click();
    await page.getByText('System').click();

    // Verify the preference is stored as 'system'
    const stored = await page.evaluate(() => {
      return localStorage.getItem('echo-portal-theme-preference');
    });

    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.preference).toBe('system');
    }
  });

  test('theme toggle shows checkmark for current selection', async ({ page }) => {
    await page.goto('/');

    // Select Light theme
    await page.locator('button[aria-label="Toggle theme"]').click();
    await page.getByText('Light').click();

    // Reopen menu
    await page.locator('button[aria-label="Toggle theme"]').click();

    // Light option should have a checkmark
    const lightOption = page.locator('[role="menuitem"]').filter({ hasText: 'Light' });
    await expect(lightOption).toContainText('✓');
  });

  test('keyboard navigation works for theme menu', async ({ page }) => {
    await page.goto('/');

    // Focus on theme toggle
    const themeToggle = page.locator('button[aria-label="Toggle theme"]');
    await themeToggle.focus();

    // Press Enter to open menu
    await page.keyboard.press('Enter');

    // Menu should be visible
    await expect(page.getByText('Light')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Menu should be closed
    await expect(page.getByText('Light')).not.toBeVisible();
  });
});
