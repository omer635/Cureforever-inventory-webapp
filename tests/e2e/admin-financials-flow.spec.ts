import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { AdminFinancialsPage } from './pages/AdminFinancialsPage';

test.describe('Admin Dashboard Financial Interactions', () => {
  let loginPage: LoginPage;
  let adminFinancialsPage: AdminFinancialsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    adminFinancialsPage = new AdminFinancialsPage(page);
  });

  test('should allow switching valuation models (Weighted Avg, FIFO, LIFO) and export CSV', async ({ page }) => {
    // 1. Launch Sandbox Portal
    await loginPage.launchDemoMode();

    // 2. Navigate to Admin Financials tab
    await adminFinancialsPage.navigateToFinancials();

    // 3. Verify initial valuation model display
    const initialValuation = await adminFinancialsPage.getValuationText();
    expect(initialValuation).toBeTruthy();

    // 4. Change Valuation Model to FIFO
    await adminFinancialsPage.setValuationModel('fifo');
    const fifoValuation = await adminFinancialsPage.getValuationText();
    expect(fifoValuation).toBeTruthy();

    // 5. Change Valuation Model to LIFO
    await adminFinancialsPage.setValuationModel('lifo');
    const lifoValuation = await adminFinancialsPage.getValuationText();
    expect(lifoValuation).toBeTruthy();

    // 6. Test CSV Export functionality
    const download = await adminFinancialsPage.triggerCsvExport();
    expect(download.suggestedFilename()).toMatch(/financial-audit-.*\.csv/);
  });
});
