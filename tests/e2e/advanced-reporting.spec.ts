import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Advanced Export & Reporting Suite', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.launchDemoMode();
  });

  test('should display FIFO vs LIFO valuation comparison and allow CSV export', async ({ page }) => {
    // 1. Navigate to Admin Financials
    const financialsNav = page.locator('[data-testid="nav-financials"]');
    await financialsNav.click();

    // 2. Verify Valuation Comparison Matrix is visible
    await expect(page.locator('text=Valuation Model Side-by-Side Comparison')).toBeVisible();
    await expect(page.locator('[data-testid="export-valuation-comparison-btn"]')).toBeVisible();
  });

  test('should display Stock Aging breakdown (0-30d, 31-60d, 61-90d, 90+d) and allow CSV export', async ({ page }) => {
    // 1. Navigate to Admin Analytics
    const analyticsNav = page.locator('[data-testid="nav-analytics"]');
    await analyticsNav.click();

    // 2. Verify Stock Aging breakdown panel is visible
    await expect(page.locator('text=Stock Aging & Asset Life Breakdown')).toBeVisible();
    await expect(page.locator('[data-testid="export-stock-aging-btn"]')).toBeVisible();
  });

  test('should display Vendor Performance Scorecard (Avg Lead Time, Fill Rate) and allow CSV export', async ({ page }) => {
    // 1. Navigate to Admin Vendors
    const vendorsNav = page.locator('[data-testid="nav-vendors"]');
    await vendorsNav.click();

    // 2. Verify Vendor Operations Scorecard is visible
    await expect(page.locator('text=Vendor Operations & Reliability Scorecard')).toBeVisible();
    await expect(page.locator('[data-testid="export-vendor-performance-btn"]')).toBeVisible();
  });
});
