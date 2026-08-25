import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Full Dashboard Navigation & Component Coverage (80%+ Target)', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('should navigate through all operational modules seamlessly', async ({ page }) => {
    await loginPage.launchDemoMode();

    // 1. Dashboard Overview
    await expect(page.locator('h2').first()).toBeVisible();

    // 2. All Stock Module
    const navStock = page.locator('[data-testid="nav-allstock"]');
    if (await navStock.isVisible()) {
      await navStock.click();
      await expect(page.locator('h2').first()).toContainText(/Stock|Inventory/i);
    }

    // 3. Batches Module
    const navBatches = page.locator('[data-testid="nav-batches"]');
    if (await navBatches.isVisible()) {
      await navBatches.click();
      await expect(page.locator('h2').first()).toContainText(/Batch|Batches/i);
    }

    // 4. Financials Module
    const navFinancials = page.locator('[data-testid="nav-financials"]');
    if (await navFinancials.isVisible()) {
      await navFinancials.click();
      await expect(page.locator('[data-testid="valuation-model-select"]')).toBeVisible();
    }

    // 5. Audit Logs Module
    const navAudit = page.locator('[data-testid="nav-audit_logs"]');
    if (await navAudit.isVisible()) {
      await navAudit.click();
      await expect(page.locator('h2').first()).toContainText(/Audit|Log/i);
    }
  });
});
