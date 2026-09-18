const { test, expect } = require('@playwright/test');

test('arboretum search and specimen inspection work in the public build', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.specimen')).toHaveCount(97);
  await expect(page.locator('#freshness')).toContainText('Prices through');

  await page.getByLabel('Find a tree by ticker or name').fill('BTC');
  await expect(page.locator('.specimen')).toHaveCount(1);
  await expect(page.locator('.specimen .name')).toHaveText('Bitcoin');

  await page.locator('.specimen').press('Enter');
  await expect(page).toHaveURL(/\/specimen\/.*id=btc/);
  await expect(page.locator('#year-labels button.active')).toHaveAttribute('data-labels', 'hide');

  const canvas = page.locator('#canvas');
  await canvas.focus();
  await canvas.press('ArrowLeft');
  await expect(page.locator('#ring-readout')).toContainText('BTC ·');
  await expect(page.locator('.year-table tr.active')).toHaveCount(1);
});

test('methodology and public metadata ship', async ({ page }) => {
  await page.goto('/methodology/');
  await expect(page.getByRole('heading', { name: 'How financial history becomes wood' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Important limitations' })).toBeVisible();
});
