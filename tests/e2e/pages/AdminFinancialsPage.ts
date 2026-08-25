import { Page, Locator, expect } from '@playwright/test';

export class AdminFinancialsPage {
  readonly page: Page;
  readonly financialsTab: Locator;
  readonly valuationSelect: Locator;
  readonly currencySelect: Locator;
  readonly valuationDisplay: Locator;
  readonly exportCsvBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.financialsTab = page.locator('[data-testid="nav-financials"]');
    this.valuationSelect = page.locator('[data-testid="valuation-model-select"]');
    this.currencySelect = page.locator('[data-testid="currency-select"]');
    this.valuationDisplay = page.locator('[data-testid="cost-valuation-display"]');
    this.exportCsvBtn = page.locator('[data-testid="export-csv-btn"]');
  }

  async navigateToFinancials() {
    await this.financialsTab.waitFor({ state: 'visible' });
    await this.financialsTab.click();
    await this.valuationSelect.waitFor({ state: 'visible' });
  }

  async setValuationModel(model: 'weighted_avg' | 'fifo' | 'lifo') {
    await this.valuationSelect.selectOption(model);
    await this.page.waitForTimeout(300);
  }

  async getValuationText() {
    return await this.valuationDisplay.innerText();
  }

  async triggerCsvExport() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.exportCsvBtn.click();
    return await downloadPromise;
  }
}
