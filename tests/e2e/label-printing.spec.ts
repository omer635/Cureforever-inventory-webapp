import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Barcode & QR Label Printing Enhancements Suite', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.launchDemoMode();
  });

  test('should open Label Studio, customize templates, select batch items, and switch to Print Preview mode', async ({ page }) => {
    // 1. Open Label Studio modal via quick header trigger
    const labelsBtn = page.locator('button', { hasText: 'Labels' }).first();
    await labelsBtn.click();

    // 2. Verify modal title and initial state
    await expect(page.locator('h2', { hasText: /Label Studio/i })).toBeVisible();

    // 3. Test Select All Products batch toggle
    const selectAllBtn = page.locator('[data-testid="select-all-btn"]');
    await expect(selectAllBtn).toBeVisible();
    await selectAllBtn.click();

    // 4. Change template format to Shelf Edge Price Tag
    const templateSelect = page.locator('[data-testid="template-select"]');
    await templateSelect.selectOption('tag');

    // 5. Update Company Header custom input
    const headerInput = page.locator('[data-testid="company-header-input"]');
    await headerInput.fill('WTF VENDOR PARTNER LABELS');

    // 6. Switch to High-Fidelity Print Preview Mode
    const previewModeBtn = page.locator('[data-testid="mode-preview-btn"]');
    await previewModeBtn.click();

    // 7. Verify Print Preview summary and confirm print button state
    await expect(page.locator('text=Print Summary:')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-print-btn"]')).toBeVisible();
  });
});
