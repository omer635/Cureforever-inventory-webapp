import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Integration Webhooks & ERP Accounting Sync Suite', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.launchDemoMode();
  });

  test('should navigate to Integrations, register webhooks, test payload delivery, trigger accounting sync, and inspect event logs', async ({ page }) => {
    // 1. Navigate to Integrations & Webhooks tab
    const integrationsNav = page.locator('[data-testid="nav-integrations"]');
    await integrationsNav.click();

    // 2. Verify Integrations Header is visible
    await expect(page.locator('text=Integrations, Webhooks & ERP Accounting Sync')).toBeVisible();

    // 3. Register New Webhook Endpoint
    const nameInput = page.locator('[data-testid="webhook-name-input"]');
    const urlInput = page.locator('[data-testid="webhook-url-input"]');
    const addBtn = page.locator('[data-testid="add-webhook-btn"]');

    await nameInput.fill('WooCommerce OMS Listener');
    await urlInput.fill('https://store.example.com/wp-json/inventory/webhook');
    await addBtn.click();

    await expect(page.locator('text=WooCommerce OMS Listener')).toBeVisible();

    // 4. Test Webhook Delivery Trigger
    const testBtn = page.locator('[data-testid="test-webhook-btn"]').first();
    await testBtn.click();

    // 5. Switch to Accounting & ERP Sync Sub-tab
    const accountingSubTab = page.locator('[data-testid="subtab-accounting"]');
    await accountingSubTab.click();

    await expect(page.locator('text=QuickBooks Online')).toBeVisible();
    await expect(page.locator('text=Xero Accounting')).toBeVisible();
    await expect(page.locator('h4:has-text("myBillBook")')).toBeVisible();

    // 6. Trigger Accounting Sync
    const syncBtn = page.locator('[data-testid="sync-accounting-btn"]');
    await syncBtn.click();

    // 7. Switch to Event Logs Sub-tab
    const logsSubTab = page.locator('[data-testid="subtab-logs"]');
    await logsSubTab.click();

    await expect(page.locator('text=Real-Time Webhook & API Delivery Event Logs')).toBeVisible();
  });
});
