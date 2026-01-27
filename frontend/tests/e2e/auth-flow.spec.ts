import { test, expect } from '@playwright/test';

/**
 * E2E Auth Flow Tests (T032)
 *
 * These tests verify the complete authentication flow from the user's perspective:
 * - Login button interaction
 * - OAuth redirect handling
 * - Callback processing
 * - Authenticated state display
 * - Logout functionality
 */

// Mock OAuth provider responses for E2E testing
test.describe('Authentication E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the home page
    await page.goto('/');
  });

  test('should display login buttons when not authenticated', async ({ page }) => {
    // Check for GitHub login button
    const githubButton = page.getByRole('button', { name: /sign in with github/i });
    await expect(githubButton).toBeVisible();

    // Check for Google login button
    const googleButton = page.getByRole('button', { name: /sign in with google/i });
    await expect(googleButton).toBeVisible();

    // Should not show user info
    await expect(page.getByText(/sign out/i)).not.toBeVisible();
  });

  test('should show role badge for authenticated user', async ({ page, context }) => {
    // Mock authenticated session
    await context.addCookies([
      {
        name: 'echo_session',
        value: 'mock-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // Mock /auth/me endpoint
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            email: 'test@example.com',
            displayName: 'Test User',
            avatarUrl: 'https://example.com/avatar.jpg',
            roles: ['contributor', 'reviewer'],
            isActive: true,
          },
          sessionId: 'session-123',
        }),
      });
    });

    await page.reload();

    // Should show user info
    await expect(page.getByText('Test User')).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();

    // Should show role badge
    await expect(page.getByText(/contributor|reviewer/i)).toBeVisible();

    // Should show logout button
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('should initiate OAuth login flow when clicking GitHub button', async ({ page }) => {
    // Mock /auth/login/github endpoint
    await page.route('**/api/v1/auth/login/github', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://github.com/login/oauth/authorize?state=mock-state&client_id=mock',
          provider: 'github',
        }),
      });
    });

    // Click GitHub login button
    const githubButton = page.getByRole('button', { name: /sign in with github/i });

    // Listen for navigation
    const navigationPromise = page.waitForURL(/github\.com/);

    await githubButton.click();

    // Should redirect to GitHub OAuth
    await navigationPromise;
    expect(page.url()).toContain('github.com');
  });

  test('should initiate OAuth login flow when clicking Google button', async ({ page }) => {
    // Mock /auth/login/google endpoint
    await page.route('**/api/v1/auth/login/google', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://accounts.google.com/o/oauth2/v2/auth?state=mock-state&client_id=mock',
          provider: 'google',
        }),
      });
    });

    // Click Google login button
    const googleButton = page.getByRole('button', { name: /sign in with google/i });

    // Listen for navigation
    const navigationPromise = page.waitForURL(/google\.com/);

    await googleButton.click();

    // Should redirect to Google OAuth
    await navigationPromise;
    expect(page.url()).toContain('google.com');
  });

  test('should show loading state while authenticating', async ({ page }) => {
    // Mock slow /auth/login response
    await page.route('**/api/v1/auth/login/github', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://github.com/login/oauth/authorize?state=mock-state',
          provider: 'github',
        }),
      });
    });

    const githubButton = page.getByRole('button', { name: /sign in with github/i });
    await githubButton.click();

    // Should show loading state
    await expect(page.getByText(/signing in/i)).toBeVisible();
  });

  test('should handle successful OAuth callback', async ({ page }) => {
    // Navigate to callback URL with success
    await page.goto('/auth/callback?success=true');

    // Mock /auth/me endpoint
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            email: 'newuser@example.com',
            displayName: 'New User',
            roles: ['contributor'],
            isActive: true,
          },
          sessionId: 'session-123',
        }),
      });
    });

    // Should show loading/processing state
    await expect(page.getByText(/completing authentication/i)).toBeVisible();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Should show authenticated state
    await expect(page.getByText('New User')).toBeVisible();
  });

  test('should handle OAuth callback error gracefully', async ({ page }) => {
    // Navigate to callback URL with error
    await page.goto('/auth/callback?error=auth_failed');

    // Should show error message
    await expect(page.getByText(/authentication error/i)).toBeVisible();
    await expect(page.getByText(/failed/i)).toBeVisible();

    // Should show redirect message
    await expect(page.getByText(/redirecting/i)).toBeVisible();

    // Should redirect to home after timeout (would need to wait or mock timer)
  });

  test('should handle provider unavailable error', async ({ page }) => {
    // Navigate to callback with provider unavailable error
    await page.goto('/auth/callback?error=provider_unavailable&message=OAuth%20provider%20is%20temporarily%20unavailable');

    // Should show specific error message
    await expect(page.getByText(/authentication error/i)).toBeVisible();
    await expect(page.getByText(/temporarily unavailable/i)).toBeVisible();
  });

  test('should logout successfully', async ({ page, context }) => {
    // Set up authenticated state
    await context.addCookies([
      {
        name: 'echo_session',
        value: 'mock-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // Mock /auth/me endpoint
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            email: 'test@example.com',
            displayName: 'Test User',
            roles: ['contributor'],
            isActive: true,
          },
          sessionId: 'session-123',
        }),
      });
    });

    await page.reload();

    // Mock /auth/logout endpoint
    await page.route('**/api/v1/auth/logout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Logged out successfully',
        }),
      });
    });

    // Click logout button
    const logoutButton = page.getByRole('button', { name: /sign out/i });
    await logoutButton.click();

    // Should redirect to home
    await expect(page).toHaveURL('/');

    // Should show login buttons again
    await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible();
  });

  test('should display different role badges for different roles', async ({ page, context }) => {
    // Test Contributor role
    await context.addCookies([
      {
        name: 'echo_session',
        value: 'contributor-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-1',
            email: 'contributor@example.com',
            displayName: 'Contributor User',
            roles: ['contributor'],
            isActive: true,
          },
          sessionId: 'session-1',
        }),
      });
    });

    await page.reload();
    await expect(page.getByText('Contributor')).toBeVisible();

    // Clear cookies and test Reviewer role
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'echo_session',
        value: 'reviewer-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-2',
            email: 'reviewer@example.com',
            displayName: 'Reviewer User',
            roles: ['reviewer'],
            isActive: true,
          },
          sessionId: 'session-2',
        }),
      });
    });

    await page.reload();
    await expect(page.getByText('Reviewer')).toBeVisible();

    // Clear cookies and test Administrator role
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'echo_session',
        value: 'admin-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-3',
            email: 'admin@example.com',
            displayName: 'Admin User',
            roles: ['administrator'],
            isActive: true,
          },
          sessionId: 'session-3',
        }),
      });
    });

    await page.reload();
    await expect(page.getByText('Administrator')).toBeVisible();
  });

  test('should maintain authentication state across page navigation', async ({ page, context }) => {
    // Set up authenticated state
    await context.addCookies([
      {
        name: 'echo_session',
        value: 'persistent-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            email: 'persistent@example.com',
            displayName: 'Persistent User',
            roles: ['contributor'],
            isActive: true,
          },
          sessionId: 'session-123',
        }),
      });
    });

    await page.reload();

    // Verify authenticated
    await expect(page.getByText('Persistent User')).toBeVisible();

    // Navigate to another page
    await page.goto('/dashboard');

    // Should still be authenticated
    await expect(page.getByText('Persistent User')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('should handle session expiry gracefully', async ({ page, context }) => {
    // Set up authenticated state
    await context.addCookies([
      {
        name: 'echo_session',
        value: 'expired-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Mock /auth/me to return 401 (expired)
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Session expired',
        }),
      });
    });

    await page.reload();

    // Should return to unauthenticated state
    await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible();
    await expect(page.getByText('Test User')).not.toBeVisible();
  });

  test('should show user avatar when available', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'echo_session',
        value: 'avatar-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            email: 'avatar@example.com',
            displayName: 'Avatar User',
            avatarUrl: 'https://avatars.example.com/user-123.jpg',
            roles: ['contributor'],
            isActive: true,
          },
          sessionId: 'session-123',
        }),
      });
    });

    await page.reload();

    // Should display avatar image
    const avatar = page.locator('img[alt="Avatar User"]');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveAttribute('src', 'https://avatars.example.com/user-123.jpg');
  });

  test('should show initials when avatar is not available', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'echo_session',
        value: 'no-avatar-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-456',
            email: 'noavatar@example.com',
            displayName: 'John Doe',
            avatarUrl: null,
            roles: ['contributor'],
            isActive: true,
          },
          sessionId: 'session-456',
        }),
      });
    });

    await page.reload();

    // Should display initials (first letter of display name)
    await expect(page.getByText('J')).toBeVisible(); // First initial
  });
});
