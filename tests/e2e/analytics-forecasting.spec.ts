import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Analytics & Demand Forecasting Suite', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.launchDemoMode();
  });

  test('should navigate to Demand Forecast, verify Moving Averages, Seasonal Trends, EOQ recommendations, and toggle Stock Velocity chart', async ({ page }) => {
    // 1. Navigate to Demand Forecast tab
    const analyticsNav = page.locator('[data-testid="nav-analytics"]');
    await analyticsNav.click();

    // 2. Verify Seasonal Demand Trend panel is visible
    await expect(page.locator('text=Seasonal Demand & Quarterly Multiplier Model')).toBeVisible();

    // 3. Toggle Chart Mode to Line Chart (Stock Velocity Over Time)
    const chartModeSelect = page.locator('[data-testid="chart-mode-select"]');
    await expect(chartModeSelect).toBeVisible();
    await chartModeSelect.selectOption('line');

    // 4. Verify Moving Averages and EOQ table headers
    await expect(page.locator('text=Moving Averages (7D / 14D)')).toBeVisible();
    await expect(page.locator('text=Rec. EOQ Qty')).toBeVisible();

    // 5. Verify Export EOQ CSV Button
    await expect(page.locator('[data-testid="export-eoq-csv-btn"]')).toBeVisible();
  });
});
