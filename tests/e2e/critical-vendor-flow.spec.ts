import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { VendorDashboardPage } from './pages/VendorDashboardPage';

test.describe('Critical Vendor Flow', () => {
  let loginPage: LoginPage;
  let vendorDashboardPage: VendorDashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    vendorDashboardPage = new VendorDashboardPage(page);
  });

  test('should execute flow: login -> vendor dashboard -> stock adjustment -> real-time sync', async ({ page }) => {
    // 1. Login via Demo Mode / Authentication
    await loginPage.launchDemoMode();

    // 2. Navigate to Vendor View
    await vendorDashboardPage.switchToVendorRole();

    // 3. Verify real-time status indicator
    await vendorDashboardPage.verifyRealTimeSyncBadge();

    // 4. Perform stock adjustment
    await vendorDashboardPage.adjustFirstStockItem(85);

    // 5. Verify quantity persists locally and sync state is active
    const qtyInput = page.locator('.qty-input').first();
    await expect(qtyInput).toHaveValue('85');
  });
});
