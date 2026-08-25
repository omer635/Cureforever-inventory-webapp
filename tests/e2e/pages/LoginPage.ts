import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly demoModeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[data-testid="login-email"]');
    this.passwordInput = page.locator('[data-testid="login-password"]');
    this.submitButton = page.locator('[data-testid="login-submit"]');
    this.demoModeButton = page.locator('[data-testid="demo-mode-btn"]');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async launchDemoMode() {
    await this.goto();
    const isAppContainerVisible = await this.page.isVisible('.app-container');
    if (isAppContainerVisible) return;

    await this.emailInput.fill('demo2026@cureforever.com');
    await this.passwordInput.fill('Cureforever@2026');
    await this.submitButton.click();
    await this.page.waitForSelector('.app-container', { state: 'visible', timeout: 15000 });
  }

  async login(email: string, pass: string) {
    await this.goto();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(pass);
    await this.submitButton.click();
    await this.page.waitForSelector('.app-container', { state: 'visible', timeout: 15000 });
  }
}
