import { Page, Locator, expect } from '@playwright/test';

export class VendorDashboardPage {
  readonly page: Page;
  readonly vendorRoleButton: Locator;
  readonly adminRoleButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.vendorRoleButton = page.locator('[data-testid="role-switch-vendor"]');
    this.adminRoleButton = page.locator('[data-testid="role-switch-admin"]');
  }

  async switchToVendorRole() {
    if (await this.vendorRoleButton.isVisible()) {
      await this.vendorRoleButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async adjustFirstStockItem(newQuantity: number) {
    const qtyInput = this.page.locator('.qty-input').first();
    await qtyInput.waitFor({ state: 'visible' });
    await qtyInput.fill(newQuantity.toString());
    await qtyInput.press('Enter');
    await this.page.waitForTimeout(500);
  }

  async verifyRealTimeSyncBadge() {
    const netBadge = this.page.locator('.net-badge');
    await expect(netBadge).toBeVisible();
    await expect(netBadge).toHaveText(/Online|Offline/);
  }
}
