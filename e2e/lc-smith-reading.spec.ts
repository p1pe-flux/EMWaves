import { expect, test, type Locator, type Page } from '@playwright/test';

const viewports = [
  { width: 1440, height: 1000, name: 'desktop' },
  { width: 850, height: 1000, name: 'tablet' },
  { width: 390, height: 844, name: 'mobile' },
] as const;
const section = (page: Page) => page.locator('.lc-smith-reading[data-lc-smith-reading]');
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
  await expect(page.locator('.formula--error, .katex-error')).toHaveCount(0);
});

async function numberAttribute(locator: Locator, name: string) {
  const value = await locator.getAttribute(name);
  expect(value, name + ' must be present').not.toBeNull();
  const number = Number(value);
  expect(Number.isFinite(number), name + ' must be finite').toBe(true);
  return number;
}

async function expectTwoPhysicalReadings(page: Page) {
  const reading = section(page);
  const chart = reading.locator('svg[data-grid="both"]');
  await expect(chart).toHaveCount(1);
  await expect(chart).toHaveAttribute('data-interactive', 'false');
  await expect(chart.locator('[data-grid-layer]')).toHaveCount(2);
  await expect(chart.locator('[data-grid-layer="impedance"]')).toBeVisible();
  await expect(chart.locator('[data-grid-layer="admittance"]')).toBeVisible();
  // Only the two named points belong on this introductory chart; the reading
  // values are explained in the prose, rather than a dense numerical grid.
  await expect(chart.locator('[data-chart-marker]')).toHaveCount(2);
  await expect(chart.locator('text')).toHaveCount(0);
  for (const [point, sign] of [['A', 1], ['B', -1]] as const) {
    const example = reading.locator('[data-lc-reading-example="' + point + '"]');
    await expect(example).toHaveCount(1);
    const r = await numberAttribute(example, 'data-z-real');
    const x = await numberAttribute(example, 'data-z-imaginary');
    const g = await numberAttribute(example, 'data-y-real');
    const b = await numberAttribute(example, 'data-y-imaginary');
    const gammaReal = await numberAttribute(example, 'data-gamma-real');
    const gammaImaginary = await numberAttribute(example, 'data-gamma-imaginary');
    expect(r).toBe(1);
    expect(x).toBe(sign);
    expect(g).toBeCloseTo(.5, 12);
    expect(b).toBeCloseTo(-sign * .5, 12);
    expect(x * sign).toBeGreaterThan(0);
    expect(b * sign).toBeLessThan(0);
    expect(g).toBeCloseTo(r / (r * r + x * x), 12);
    expect(b).toBeCloseTo(-x / (r * r + x * x), 12);
    expect(gammaReal).toBeCloseTo(.2, 12);
    expect(gammaImaginary).toBeCloseTo(sign * .4, 12);
    const marker = chart.locator('[data-chart-marker="lc-reading-' + point + '"]');
    await expect(marker).toHaveCount(1);
    expect(await numberAttribute(marker, 'data-re')).toBeCloseTo(gammaReal, 12);
    expect(await numberAttribute(marker, 'data-im')).toBeCloseTo(gammaImaginary, 12);
    const screenY = await numberAttribute(marker.locator('circle').last(), 'cy');
    expect((340 - screenY) * sign).toBeGreaterThan(0);
  }
  await expect(reading.getByRole('table')).toHaveCount(1);
  for (const [row, signs] of [['x>0', 'b<0'], ['x<0', 'b>0'], ['x=0', 'b=0']].entries()) {
    await expect(reading.locator('tbody tr').nth(row).locator('annotation')).toHaveText(signs);
  }
  await expect(reading.locator('input, button')).toHaveCount(0);
}

async function expectReadingFits(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const overflow = await section(page).evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return {
      section: element.scrollWidth > element.clientWidth + 1,
      formulas: [...element.querySelectorAll('.formula')].filter(formula => {
        const box = formula.getBoundingClientRect();
        return box.width > 0 && (box.left < bounds.left - 1 || box.right > bounds.right + 1 || formula.scrollWidth > formula.clientWidth + 1);
      }).map(formula => formula.querySelector('annotation')?.textContent ?? 'unnamed formula'),
      table: [...element.querySelectorAll('table')].some(table => table.getBoundingClientRect().width > element.clientWidth + 1),
    };
  });
  expect(overflow, 'The guide reading, formulas, and table must fit without clipping or internal scrolling.').toEqual({ section: false, formulas: [], table: false });
}

for (const locale of ['es', 'en'] as const) {
  test(`the ${locale} LC guide explains both Smith readings at desktop, tablet, and mobile widths`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('emwaves.locale', value), locale);
    await page.goto('/#/guides/lc-matching');
    await expect(section(page)).toHaveCount(1);
    await expect(section(page).getByRole('heading', {
      name: locale === 'es' ? 'Cómo leer el diagrama doble de Smith' : 'How to read the combined Smith chart', exact: true,
    })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expectTwoPhysicalReadings(page);
    const construction = page.locator('section.lc-matching-construction');
    await expect(construction).toHaveAttribute('data-chart-convention', 'physical-yz');
    await expect(construction.locator('.ss-step-count')).toHaveText('1 / 7');

    for (const viewport of viewports) {
      await test.step(viewport.name, async () => {
        await page.setViewportSize(viewport);
        await expectReadingFits(page);
        await expect(section(page).locator('svg[data-grid="both"]')).toBeVisible();
        await expect(section(page).locator('[data-grid-layer]')).toHaveCount(2);
        if (locale === 'es' && test.info().project.name === 'chromium' && viewport.name !== 'tablet') {
          await section(page).screenshot({ path: `test-results/lc-smith-reading/guide-es-${viewport.name}.png`, animations: 'disabled' });
        }
      });
    }
  });
}

test('the explanatory reading stays in the guide while the LC laboratory retains its seven-step physical YZ construction', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'en'));
  await page.goto('/#/labs/lc-matching');
  await expect(section(page)).toHaveCount(0);
  const construction = page.locator('section.lc-matching-construction');
  await expect(construction).toHaveAttribute('data-stage', '0');
  await expect(construction).toHaveAttribute('data-chart-convention', 'physical-yz');
  await expect(construction.locator('.ss-step-count')).toHaveText('1 / 7');
  await expect(construction.locator('svg[data-grid="both"]')).toHaveCount(1);
  await expect(construction.locator('[data-grid-layer]')).toHaveCount(2);
  for (let stage = 1; stage <= 6; stage += 1) {
    await construction.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(construction).toHaveAttribute('data-stage', String(stage));
    await expect(construction).toHaveAttribute('data-playing', 'false');
    await expect(construction).toHaveAttribute('data-chart-convention', 'physical-yz');
  }
  await expect(construction.locator('.ss-step-count')).toHaveText('7 / 7');
  const finalPoint = construction.locator('[data-chart-marker="tracked-load"]');
  expect(Math.hypot(await numberAttribute(finalPoint, 'data-re'), await numberAttribute(finalPoint, 'data-im'))).toBeLessThan(1e-6);
  await expect(section(page)).toHaveCount(0);
});
