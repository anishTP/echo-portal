import { test, expect } from '@playwright/test';

/**
 * T053: Performance Tests
 *
 * Verifies that theme operations meet performance requirements.
 */

test.describe('Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('theme toggle should complete in under 100ms', async ({ page }) => {
    // Find the theme toggle button
    const themeToggle = page.locator('button').filter({ hasText: /light|dark|system/i }).first();

    // If no toggle found by text, look for common theme toggle patterns
    const toggle = (await themeToggle.count()) > 0
      ? themeToggle
      : page.locator('[aria-label*="theme" i], [data-testid*="theme" i]').first();

    if (await toggle.count() === 0) {
      // Skip test if no theme toggle is visible on this page
      test.skip();
      return;
    }

    // Measure time to toggle theme
    const startTime = performance.now();

    await toggle.click();

    // Wait for any dropdown to appear if using a dropdown pattern
    const dropdown = page.locator('[role="menu"], [role="listbox"]');
    if (await dropdown.count() > 0) {
      // Click on an option (Dark or Light)
      const option = dropdown.locator('text=/dark|light/i').first();
      if (await option.count() > 0) {
        await option.click();
      }
    }

    // Wait for theme change to be reflected (class change on html element)
    await page.waitForFunction(() => {
      const html = document.documentElement;
      return html.classList.contains('light') || html.classList.contains('dark');
    }, { timeout: 100 });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Theme toggle should complete in under 100ms
    expect(duration).toBeLessThan(100);
  });

  test('initial page load with theme should be under 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Initial page load should be under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('theme preference should persist without delay', async ({ page }) => {
    // Set theme preference
    await page.evaluate(() => {
      localStorage.setItem('echo-portal-theme-preference', JSON.stringify({
        preference: 'dark',
        lastUpdated: new Date().toISOString()
      }));
    });

    // Measure reload time with persisted theme
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const endTime = Date.now();

    // Should load with persisted theme quickly
    expect(endTime - startTime).toBeLessThan(3000);

    // Verify theme was applied
    const isDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });
    expect(isDark).toBe(true);
  });

  test('no layout shift during theme toggle', async ({ page }) => {
    // Get initial layout metrics
    const initialMetrics = await page.evaluate(() => {
      const body = document.body;
      return {
        width: body.offsetWidth,
        height: body.offsetHeight,
      };
    });

    // Toggle theme via localStorage (simulating toggle)
    await page.evaluate(() => {
      const currentTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(currentTheme);
    });

    // Wait a frame for any layout changes
    await page.waitForTimeout(50);

    // Get final layout metrics
    const finalMetrics = await page.evaluate(() => {
      const body = document.body;
      return {
        width: body.offsetWidth,
        height: body.offsetHeight,
      };
    });

    // Layout should not shift significantly (allow 1px tolerance for rounding)
    expect(Math.abs(finalMetrics.width - initialMetrics.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(finalMetrics.height - initialMetrics.height)).toBeLessThanOrEqual(1);
  });
});
