import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Product Image Upload & Thumbnail Display Suite', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.launchDemoMode();
  });

  test('should open Product Modal, allow entering Product Image URL, and display thumbnail avatar in Products Catalog', async ({ page }) => {
    // 1. Navigate to Products Catalog
    const productsNav = page.locator('[data-testid="nav-products"]');
    await productsNav.click();

    // 2. Click + New Product
    const newProductBtn = page.locator('button:has-text("+ New Product")');
    await newProductBtn.click();

    // 3. Verify Product Modal is open and Product Image URL input is visible
    const imageUrlInput = page.locator('[data-testid="product-image-url-input"]');
    await expect(imageUrlInput).toBeVisible();

    // 4. Fill Product Details including Image URL
    await page.locator('[data-testid="product-name-input"]').fill('CureForever Test Supplement');
    await page.locator('[data-testid="product-sku-input"]').fill('SKU-IMG-999');
    await imageUrlInput.fill('https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=100');

    // 5. Save Product
    const saveBtn = page.locator('button.save-btn');
    await saveBtn.click();

    // 6. Verify Product appears in table with Image Thumbnail
    await expect(page.locator('text=CureForever Test Supplement')).toBeVisible();
    await expect(page.locator('img[alt="CureForever Test Supplement"]')).toBeVisible();
  });
});
