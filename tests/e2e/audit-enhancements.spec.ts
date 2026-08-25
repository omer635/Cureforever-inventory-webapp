import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Audit Trail Enhancements Suite', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.launchDemoMode();
  });

  test('should navigate to Audit Logs, filter by date presets, toggle Timeline View, and export PDF', async ({ page }) => {
    // 1. Navigate to Audit Logs
    const auditNav = page.locator('[data-testid="nav-auditlogs"]');
    await auditNav.click();

    // 2. Verify Audit Summary Header is visible
    await expect(page.locator('text=Audit Period Summary')).toBeVisible();

    // 3. Test Date Preset Filter
    const datePresetSelect = page.locator('[data-testid="date-preset-select"]');
    await expect(datePresetSelect).toBeVisible();
    await datePresetSelect.selectOption('7days');

    // 4. Switch to Activity Timeline View
    const timelineBtn = page.locator('[data-testid="view-mode-timeline"]');
    await timelineBtn.click();
    await expect(page.locator('[data-testid="audit-timeline-container"]')).toBeVisible();

    // 5. Verify PDF Export Button
    await expect(page.locator('[data-testid="export-audit-pdf-btn"]')).toBeVisible();
  });
});
