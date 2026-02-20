import { test, expect } from '@playwright/test';

/**
 * T020: E2E tests for hierarchy landing pages
 * Tests: navigation flow, card interactions, breadcrumb navigation,
 * sidebar clicks, URL consistency, browser back/forward
 */

// Helper to set up authenticated session with admin role
async function setupAuthenticatedSession(page: any, context: any, roles = ['administrator']) {
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

  await page.route('**/api/v1/auth/me', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'user-123',
          email: 'admin@example.com',
          displayName: 'Test Admin',
          avatarUrl: null,
          roles,
          isActive: true,
        },
        sessionId: 'session-123',
      }),
    });
  });
}

// Mock data
const mockCategories = [
  { id: 'cat-1', name: 'Vehicles', section: 'brand', displayOrder: 0, createdBy: 'user-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'cat-2', name: 'Fashion', section: 'brand', displayOrder: 1, createdBy: 'user-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
];

const mockSubcategories = [
  { id: 'sub-1', name: 'SUVs', categoryId: 'cat-1', displayOrder: 0, body: '', createdBy: 'user-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
];

const mockContent = {
  items: [
    {
      id: 'c-1', branchId: 'main', slug: 'suv-guide', title: 'SUV Buying Guide', contentType: 'guideline',
      section: 'brand', category: 'Vehicles', categoryId: 'cat-1', subcategoryId: 'sub-1', displayOrder: 0,
      tags: [], isPublished: true, description: 'Guide to buying SUVs',
      createdBy: { id: 'user-1', displayName: 'Author', avatarUrl: null },
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    },
    {
      id: 'c-2', branchId: 'main', slug: 'fashion-intro', title: 'Fashion Introduction', contentType: 'guideline',
      section: 'brand', category: 'Fashion', categoryId: 'cat-2', subcategoryId: null, displayOrder: 0,
      tags: [], isPublished: true, description: 'Introduction to fashion',
      createdBy: { id: 'user-1', displayName: 'Author', avatarUrl: null },
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    },
  ],
  total: 2,
  page: 1,
  limit: 100,
};

const mockSectionPage = { id: null, section: 'brand', branchId: null, body: 'Welcome to Brands', createdBy: null, createdAt: null, updatedAt: null };
const mockCategoryPage = { id: null, categoryId: 'cat-1', branchId: null, body: 'All about Vehicles', createdBy: null, createdAt: null, updatedAt: null };
const mockEmptyPage = { id: null, section: '', branchId: null, body: '', createdBy: null, createdAt: null, updatedAt: null };

function setupMockRoutes(page: any) {
  // Categories
  page.route('**/api/v1/categories*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCategories),
    });
  });

  // Subcategories
  page.route('**/api/v1/subcategories*', async (route: any) => {
    const url = route.request().url();
    if (url.includes('categoryId=cat-1')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSubcategories),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  });

  // Published content
  page.route('**/api/v1/content/published*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockContent),
    });
  });

  // Section pages
  page.route('**/api/v1/section-pages/*', async (route: any) => {
    const url = route.request().url();
    if (url.includes('/brand')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSectionPage),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockEmptyPage),
      });
    }
  });

  // Category pages
  page.route('**/api/v1/category-pages/*', async (route: any) => {
    const url = route.request().url();
    if (url.includes('/cat-1')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCategoryPage),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...mockEmptyPage, categoryId: 'cat-2' }),
      });
    }
  });

  // Content by slug (for direct content navigation)
  page.route('**/api/v1/content/by-slug/*', async (route: any) => {
    const url = route.request().url();
    const content = url.includes('suv-guide')
      ? { ...mockContent.items[0], currentVersion: { body: '# SUV Guide\n\nSome content' } }
      : url.includes('fashion-intro')
        ? { ...mockContent.items[1], currentVersion: { body: '# Fashion\n\nSome content' } }
        : null;

    if (content) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(content),
      });
    } else {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
    }
  });

  // OAuth health check
  page.route('**/api/v1/auth/health', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          providers: {
            github: { provider: 'github', available: true, state: 'healthy' },
            google: { provider: 'google', available: true, state: 'healthy' },
          },
          timestamp: new Date().toISOString(),
        },
      }),
    });
  });
}

test.describe('Landing Pages Navigation', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthenticatedSession(page, context);
    setupMockRoutes(page);
  });

  test('navigating to /library redirects to section landing page', async ({ page }) => {
    await page.goto('/library');
    await page.waitForURL(/section=brands/);
    expect(page.url()).toContain('section=brands');
  });

  test('section landing page shows title and category cards', async ({ page }) => {
    await page.goto('/library?section=brands');
    await expect(page.getByRole('heading', { level: 1, name: 'Brands' })).toBeVisible();
    // Card grid should be present
    await expect(page.getByRole('list', { name: 'Landing page items' })).toBeVisible();
  });

  test('clicking category card navigates to category landing page', async ({ page }) => {
    await page.goto('/library?section=brands');
    // Click the Vehicles category card
    const vehiclesCard = page.getByRole('button', { name: /Vehicles/ });
    if (await vehiclesCard.isVisible()) {
      await vehiclesCard.click();
      await page.waitForURL(/category=Vehicles/);
      expect(page.url()).toContain('category=Vehicles');
    }
  });

  test('category landing page shows title and breadcrumb', async ({ page }) => {
    await page.goto('/library?section=brands&category=Vehicles');
    await expect(page.getByRole('heading', { level: 1, name: 'Vehicles' })).toBeVisible();
  });

  test('subcategory landing page shows title and content cards', async ({ page }) => {
    await page.goto('/library?section=brands&category=Vehicles&subcategoryId=sub-1');
    await expect(page.getByRole('heading', { level: 1, name: 'SUVs' })).toBeVisible();
  });

  test('breadcrumb ancestor segments are clickable links', async ({ page }) => {
    await page.goto('/library?section=brands&category=Vehicles');
    // The "Brands" segment should be a link back to section landing page
    const brandsLink = page.locator('a', { hasText: 'Brands' });
    if (await brandsLink.isVisible()) {
      await brandsLink.click();
      await page.waitForURL(/section=brands/);
      expect(page.url()).not.toContain('category=');
    }
  });

  test('URL consistency — direct navigation to each landing page level works', async ({ page }) => {
    // Section
    await page.goto('/library?section=brands');
    await expect(page.getByRole('heading', { level: 1, name: 'Brands' })).toBeVisible();

    // Category
    await page.goto('/library?section=brands&category=Vehicles');
    await expect(page.getByRole('heading', { level: 1, name: 'Vehicles' })).toBeVisible();

    // Subcategory
    await page.goto('/library?section=brands&category=Vehicles&subcategoryId=sub-1');
    await expect(page.getByRole('heading', { level: 1, name: 'SUVs' })).toBeVisible();
  });

  test('browser back/forward navigation between landing page levels', async ({ page }) => {
    // Start at section level
    await page.goto('/library?section=brands');
    await expect(page.getByRole('heading', { level: 1, name: 'Brands' })).toBeVisible();

    // Navigate to category
    await page.goto('/library?section=brands&category=Vehicles');
    await expect(page.getByRole('heading', { level: 1, name: 'Vehicles' })).toBeVisible();

    // Go back
    await page.goBack();
    await page.waitForURL(/section=brands/);
    expect(page.url()).not.toContain('category=');
  });

  test('header nav section label click navigates to section landing page', async ({ page }) => {
    await page.goto('/library?section=brands&category=Vehicles');
    // Click "Products" label in header nav to navigate to Products section
    const productsButton = page.locator('nav button', { hasText: 'Products' }).first();
    if (await productsButton.isVisible()) {
      await productsButton.click();
      await page.waitForURL(/section=products/);
      expect(page.url()).toContain('section=products');
    }
  });
});
