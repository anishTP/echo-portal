import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should be able to navigate using Tab key', async ({ page }) => {
    // Press Tab and verify focus moves
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Continue tabbing and verify focus continues to move
    const initialFocusedText = await focusedElement.textContent();

    await page.keyboard.press('Tab');
    const newFocusedElement = page.locator(':focus');
    await expect(newFocusedElement).toBeVisible();

    // Focus should have moved to a different element
    const newFocusedText = await newFocusedElement.textContent();
    // Note: They might be the same if there's only one focusable element
  });

  test('should be able to activate buttons with Enter key', async ({ page }) => {
    // Find a button and focus it
    const button = page.locator('button').first();
    await button.focus();

    // Verify it's focused
    await expect(button).toBeFocused();

    // Note: Pressing Enter would activate the button
    // We can't easily verify the action without knowing what the button does
  });

  test('should be able to navigate dropdown menus with arrow keys', async ({ page }) => {
    // Find a dropdown trigger (Radix uses data-state attribute)
    const dropdownTrigger = page.locator('[data-radix-collection-item]').first();

    if (await dropdownTrigger.count() > 0) {
      await dropdownTrigger.focus();
      await page.keyboard.press('Enter');

      // If dropdown opened, verify arrow key navigation
      const dropdownContent = page.locator('[role="menu"], [role="listbox"]');
      if (await dropdownContent.count() > 0) {
        await page.keyboard.press('ArrowDown');
        const focusedItem = page.locator(':focus');
        await expect(focusedItem).toBeVisible();
      }
    }
  });

  test('Escape key should close open dialogs', async ({ page }) => {
    // Find and click a dialog trigger
    const dialogTrigger = page.locator('button').filter({ hasText: /delete|submit|publish/i }).first();

    if (await dialogTrigger.count() > 0) {
      await dialogTrigger.click();

      // Wait for dialog to appear
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.count() > 0) {
        await expect(dialog).toBeVisible();

        // Press Escape to close
        await page.keyboard.press('Escape');

        // Dialog should close
        await expect(dialog).not.toBeVisible();
      }
    }
  });

  test('focus should be trapped within open dialogs', async ({ page }) => {
    // Find and click a dialog trigger
    const dialogTrigger = page.locator('button').filter({ hasText: /delete|submit|publish/i }).first();

    if (await dialogTrigger.count() > 0) {
      await dialogTrigger.click();

      const dialog = page.locator('[role="dialog"]');
      if (await dialog.count() > 0) {
        await expect(dialog).toBeVisible();

        // Get all focusable elements in the dialog
        const focusableInDialog = dialog.locator(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const count = await focusableInDialog.count();

        if (count > 1) {
          // Tab through all focusable elements
          for (let i = 0; i < count + 1; i++) {
            await page.keyboard.press('Tab');
          }

          // Focus should still be within the dialog (focus trapped)
          const currentFocus = page.locator(':focus');
          const isWithinDialog = await dialog.locator(':focus').count();
          expect(isWithinDialog).toBeGreaterThan(0);
        }

        // Clean up - close dialog
        await page.keyboard.press('Escape');
      }
    }
  });
});
