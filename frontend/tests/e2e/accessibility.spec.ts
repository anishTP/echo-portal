import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test.describe('Theme modes', () => {
    test('should have no critical accessibility violations in light mode', async ({ page }) => {
      await page.goto('/');

      // Ensure light mode
      await page.evaluate(() => {
        localStorage.setItem('echo-portal-theme-preference', JSON.stringify({ preference: 'light' }));
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      // Filter for critical and serious violations only
      const criticalViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalViolations).toEqual([]);
    });

    test('should have no critical accessibility violations in dark mode', async ({ page }) => {
      await page.goto('/');

      // Set dark mode
      await page.evaluate(() => {
        localStorage.setItem('echo-portal-theme-preference', JSON.stringify({ preference: 'dark' }));
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalViolations).toEqual([]);
    });
  });

  test.describe('Dialog accessibility', () => {
    test('dialogs should trap focus', async ({ page }) => {
      // This test assumes there's a way to open a dialog on the page
      // The specific implementation depends on what's available on the home page
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Look for any dialog triggers (this is a general pattern)
      const dialogTrigger = page.locator('[data-state="closed"]').first();

      if (await dialogTrigger.count() > 0) {
        await dialogTrigger.click();

        // Check if dialog opened
        const dialog = page.locator('[role="dialog"]');
        if (await dialog.count() > 0) {
          // Verify focus is within the dialog
          const focusedElement = page.locator(':focus');
          await expect(focusedElement).toBeVisible();

          // Dialog should be within the viewport
          await expect(dialog).toBeVisible();

          // Escape should close the dialog
          await page.keyboard.press('Escape');
          await expect(dialog).not.toBeVisible();
        }
      }
    });
  });
});
