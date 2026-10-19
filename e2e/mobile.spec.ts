import { expect, test } from '@playwright/test';
import { allRoutes } from './laboratories';
import { expectExpandedLesson } from './lesson-layout';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'es'));
});

for (const [route, title] of allRoutes) {
  test(`${route} fits mobile without invalid mathematics`, async ({ page }) => {
    await page.goto('/' + route);
    await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
    if (route.startsWith('#/labs/')) {
      await expect(page.locator('.parameters-panel')).toBeVisible();
      await expect(page.locator('.smith-chart__svg')).toBeVisible();
    } else {
      await expect(page.locator('math').first()).toBeAttached();
    }
    await expect(page.locator('.formula--error, .katex-error')).toHaveCount(0);
    const construction = page.locator('section.ss-construction');
    if (await construction.count()) await expectExpandedLesson(construction);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const parameters = page.locator('.parameters-panel');
    if (await parameters.count()) {
      await expect(parameters).toBeVisible();
      expect(await parameters.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    }
  });
}
