import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

  test('homepage renders', async ({ page }) => {
    const isLive = !!process.env.E2E_LIVE;
    if (!isLive) {
      const fixtureUrl = new URL('../fixtures/repositories-metrics.json', import.meta.url);
      const metrics = JSON.parse(await readFile(fixtureUrl, 'utf-8'));
      await page.route('**/api/repositories/metrics', route => route.fulfill({ json: metrics }));
    }

    await page.goto('/');
    await expect(page).toHaveURL(/http:\/\/localhost:3000/i);

    await expect(page).toHaveTitle(/OnniLens/i);
    await expect(
      page.locator('meta[name="description"]')
    ).toHaveAttribute('content', /Real-time GitHub workflow monitoring and analytics platform/i);

    await expect(page.getByText(/👁️\s*OmniLens/i)).toBeVisible();
  });
