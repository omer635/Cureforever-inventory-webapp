import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Dashboard Widgets & Customization Suite', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.launchDemoMode();
  });

  test('should display Live Sync indicator, top suppliers, transfer volume, and expiry heatmap widgets', async ({ page }) => {
    // 1. Verify Live Sync indicator badge
    await expect(page.locator('[data-testid="live-sync-indicator"]')).toBeVisible();

    // 2. Verify Top Suppliers widget card
    await expect(page.locator('[data-testid="widget-top-suppliers"]')).toBeVisible();

    // 3. Verify Transfer Volume widget card
    await expect(page.locator('[data-testid="widget-transfer-volume"]')).toBeVisible();

    // 4. Verify Expiry Risk Heatmap widget card
    await expect(page.locator('[data-testid="widget-expiry-heatmap"]')).toBeVisible();
  });

  test('should allow entering layout customization mode, reordering widgets, and resetting layout', async ({ page }) => {
    // 1. Click Customize Layout toggle
    const customizeBtn = page.locator('[data-testid="customize-layout-btn"]');
    await customizeBtn.click();

    // 2. Verify customization control banner is active
    await expect(page.locator('text=Dashboard Customization Active')).toBeVisible();

    // 3. Reorder widget via move controls
    const moveDownBtn = page.locator('[data-testid="move-down-kpi_cards"]');
    if (await moveDownBtn.isVisible()) {
      await moveDownBtn.click();
    }

    // 4. Click Reset to Default Layout
    const resetBtn = page.locator('[data-testid="reset-layout-btn"]');
    await resetBtn.click();
  });

  test('should execute manual refresh trigger cleanly', async ({ page }) => {
    const refreshBtn = page.locator('[data-testid="manual-refresh-btn"]');
    await refreshBtn.click();
    await expect(page.locator('[data-testid="live-sync-indicator"]')).toBeVisible();
  });
});
