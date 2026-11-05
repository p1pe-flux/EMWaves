import { expect, test, type Locator, type Page } from '@playwright/test';

const matchingLabs = [
  ['single-stub-matching', 2],
  ['series-stub-matching', 2],
  ['lc-matching', 1],
  ['quarter-wave-transformer', 2],
  ['double-stub-matching', 2],
] as const;

const panel = (page: Page) => page.locator('.frequency-response');
const curves = (page: Page) => panel(page).locator('path[data-response-branch]');
const readout = (page: Page) => panel(page).getByRole('spinbutton', { name: 'Readout frequency', exact: true });
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'en'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const collected: string[] = [];
  errors.set(page, collected);
  page.on('pageerror', error => collected.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  await expect(page.locator('.formula--error, .katex-error')).toHaveCount(0);
});

async function openLab(page: Page, slug: string) {
  await page.goto('/#/labs/' + slug);
  await expect(panel(page).getByRole('heading', { name: 'Frequency response', exact: true })).toBeVisible();
}

async function showPlot(page: Page) {
  await expect(panel(page).getByRole('img', { name: 'Reflection magnitude as a function of frequency', exact: true })).toBeVisible();
}

async function expectPureFrequencyResponse(page: Page) {
  await expect(panel(page).getByRole('spinbutton', { name: /Maximum reflection magnitude|Módulo de reflexión máximo/ })).toHaveCount(0);
  await expect(panel(page).locator('.frequency-response__threshold, .frequency-response__swatch--threshold')).toHaveCount(0);
  await expect(panel(page).locator('.frequency-response__bandwidths, [data-bandwidth-status]')).toHaveCount(0);
  await expect(panel(page)).not.toContainText(/Bandwidth|Ancho de banda/);
  await expect(panel(page).getByRole('button')).toHaveCount(0);
  await expect(panel(page)).not.toContainText(/Ideal lossless, nondispersive lines|Líneas ideales sin pérdidas ni dispersión/);
}

async function readMagnitudes(page: Page): Promise<number[]> {
  return panel(page).locator('.frequency-response__readout-values annotation').evaluateAll(nodes => nodes.map(node => {
    const match = node.textContent?.match(/=\s*([\d.]+)/);
    return match ? Number(match[1]) : Number.NaN;
  }));
}

async function expectMatchedReadout(page: Page, count: number) {
  await expect.poll(() => readMagnitudes(page)).toHaveLength(count);
  const values = await readMagnitudes(page);
  for (const value of values) expect(value).toBeLessThan(1e-5);
}

async function completeLC(page: Page) {
  const construction = page.locator('section.ss-construction');
  for (let stage = 1; stage <= 6; stage += 1) {
    await construction.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(construction).toHaveAttribute('data-stage', String(stage));
    await expect(construction).toHaveAttribute('data-playing', 'false');
  }
  return construction;
}

async function componentValues(construction: Locator) {
  return construction.locator('[data-summary-field^="element-"] annotation').evaluateAll(nodes => nodes.map(node => {
    const match = node.textContent?.match(/\\mathbf\{([\d.]+)\}/);
    return match ? Number(match[1]) : Number.NaN;
  }));
}

test('all five matching laboratories evaluate the fixed network at and away from its design frequency', async ({ page }) => {
  test.setTimeout(70_000);
  for (const [slug, count] of matchingLabs) {
    await test.step(slug, async () => {
      await openLab(page, slug);
      await showPlot(page);
      const chart = panel(page).getByRole('img', { name: 'Reflection magnitude as a function of frequency', exact: true });
      await expect(chart).toHaveAttribute('aria-label', 'Reflection magnitude as a function of frequency');
      await expect(chart.locator('title, [title]')).toHaveCount(0);
      await expect(chart).not.toHaveAttribute('title', /.+/);
      await expect(curves(page)).toHaveCount(count);
      await expect(readout(page)).toHaveValue('1000');
      await expectMatchedReadout(page, count);
      await readout(page).fill('750');
      const magnitudes = await readMagnitudes(page);
      expect(magnitudes).toHaveLength(count);
      for (const magnitude of magnitudes) {
        expect(magnitude).toBeGreaterThan(.005);
        expect(magnitude).toBeLessThanOrEqual(1);
      }
      const paths = await curves(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('d')));
      if (count === 2) expect(paths[0]).not.toEqual(paths[1]);
      await expectPureFrequencyResponse(page);
      await expect(panel(page).getByRole('spinbutton')).toHaveCount(3);
      await page.locator('#app-language').selectOption('es');
      await expect(panel(page).getByRole('img', { name: 'Módulo de reflexión en función de la frecuencia', exact: true })).toBeVisible();
      await expectPureFrequencyResponse(page);
      expect(await curves(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))).toEqual(paths);
      await page.locator('#app-language').selectOption('en');
      await expect(page.locator('section.ss-construction')).toHaveAttribute('data-stage', '0');
    });
  }
});

test('broad sweeps increase plot resolution and reject ranges that would alias the fixed network', async ({ page }) => {
  await openLab(page, 'single-stub-matching');
  const stop = panel(page).getByRole('spinbutton', { name: 'Sweep stop frequency', exact: true });
  await stop.fill('100000');
  await showPlot(page);
  await expect(curves(page)).toHaveCount(2);
  const vertices = await curves(page).evaluateAll(paths => paths.map(path => (path.getAttribute('d')?.match(/[ML]/g) ?? []).length));
  for (const count of vertices) expect(count).toBeGreaterThan(801);
  await readout(page).fill('13000');
  // Branch 2 repeats its short-stub match at ratio 13; it must not be
  // replaced by the response of a newly synthesized network at this frequency.
  const magnitudes = await readMagnitudes(page);
  expect(magnitudes).toHaveLength(2);
  expect(magnitudes[1]).toBeLessThan(1e-5);
  expect(magnitudes[0]).toBeGreaterThan(.005);
  const exactMagnitude = Number(await panel(page).locator('[data-response-readout="branch-2"]').getAttribute('data-magnitude'));
  expect(exactMagnitude).toBeLessThan(1e-12);

  await stop.fill('1000000');
  await expect(panel(page).getByRole('alert')).toContainText('too wide');
  await expect(panel(page).getByRole('img')).toHaveCount(0);
  await expectPureFrequencyResponse(page);
  await stop.fill('1500');
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
  await expect(curves(page)).toHaveCount(2);
  await readout(page).fill('1000');
  await expectMatchedReadout(page, 2);
});

test('the introductory Smith laboratory keeps its free explorer without frequency-response controls', async ({ page }) => {
  await page.goto('/#/labs/introduction-to-smith-chart');
  const chart = page.locator('svg.smith-chart__svg');
  await expect(chart).toHaveAttribute('data-interactive', 'true');
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Design frequency', exact: true })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Sweep start frequency', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show gamma', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show SWR circle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show curves', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hide curves', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const distance = page.locator('#line-length');
  await distance.press('End');
  await expect(distance).toHaveValue('1');
  await page.getByRole('button', { name: 'Restart from the load', exact: true }).click();
  await expect(distance).toHaveValue('0');
  await page.getByRole('button', { name: 'Animate line traversal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause animation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Animate line traversal', exact: true })).toBeVisible();
});

test('LC synthesis and response share one design frequency and keep physical component values fixed during the sweep', async ({ page }) => {
  await openLab(page, 'lc-matching');
  const frequency = page.locator('.parameters-panel').getByRole('spinbutton', { name: 'Frequency', exact: true });
  await expect(frequency).toHaveCount(1);
  let construction = await completeLC(page);
  const original = await componentValues(construction);
  expect(original).toHaveLength(2);
  await showPlot(page);
  await readout(page).fill('750');
  expect(await componentValues(construction)).toEqual(original);

  await frequency.fill('500');
  await expect(construction).toHaveAttribute('data-stage', '0');
  await showPlot(page);
  await expect(panel(page).getByRole('spinbutton', { name: 'Sweep start frequency', exact: true })).toHaveValue('250');
  await expect(panel(page).getByRole('spinbutton', { name: 'Sweep stop frequency', exact: true })).toHaveValue('750');
  construction = await completeLC(page);
  const redesigned = await componentValues(construction);
  redesigned.forEach((value, index) => expect(value / original[index]).toBeCloseTo(2, 4));
  await showPlot(page);
  await expect(readout(page)).toHaveValue('500');
  await expectMatchedReadout(page, 1);
  await readout(page).fill('375');
  expect((await readMagnitudes(page))[0]).toBeGreaterThan(.005);
  expect(await componentValues(construction)).toEqual(redesigned);
});

test('sweep and language changes preserve the construction and network, while Reset restores all frequency controls', async ({ page }) => {
  await openLab(page, 'single-stub-matching');
  const construction = page.locator('section.ss-construction');
  await construction.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(construction).toHaveAttribute('data-stage', '1');
  await showPlot(page);
  const originalPaths = await curves(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('d')));
  await page.locator('#app-language').selectOption('es');
  await expect(panel(page).getByRole('heading', { name: 'Respuesta en frecuencia' })).toBeVisible();
  await expectPureFrequencyResponse(page);
  if (test.info().project.name === 'chromium') {
    await panel(page).screenshot({ path: 'test-results/frequency-response/single-stub-panel-es.png', animations: 'disabled' });
    await panel(page).screenshot({ path: 'test-results/navigation/frequency-es.png', animations: 'disabled' });
  }
  expect(await curves(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))).toEqual(originalPaths);
  await expect(construction).toHaveAttribute('data-stage', '1');
  await panel(page).getByRole('spinbutton', { name: 'Frecuencia inicial del barrido', exact: true }).fill('600');
  await panel(page).getByRole('spinbutton', { name: 'Frecuencia final del barrido', exact: true }).fill('1400');
  await expect(curves(page)).toHaveCount(2);
  await expect(construction).toHaveAttribute('data-stage', '1');
  await expect(panel(page).getByRole('spinbutton', { name: 'Frecuencia de lectura', exact: true })).toHaveValue('1000');
  await page.locator('.parameters-panel').getByRole('spinbutton', { name: 'Frecuencia de diseño', exact: true }).fill('1200');
  await expect(construction).toHaveAttribute('data-stage', '0');
  await page.getByRole('button', { name: 'Restablecer', exact: true }).click();
  await expect(page.locator('.parameters-panel').getByRole('spinbutton', { name: 'Frecuencia de diseño', exact: true })).toHaveValue('1000');
  await expect(panel(page).getByRole('spinbutton', { name: 'Frecuencia inicial del barrido', exact: true })).toHaveValue('500');
  await expect(panel(page).getByRole('spinbutton', { name: 'Frecuencia final del barrido', exact: true })).toHaveValue('1500');
  await expectPureFrequencyResponse(page);
  await expect(panel(page).getByRole('spinbutton')).toHaveCount(3);
  await expect(panel(page).getByRole('img')).toBeVisible();
});

test('invalid electrical data and sweep settings remove the plot and cannot expose stale responses', async ({ page }) => {
  await openLab(page, 'quarter-wave-transformer');
  await showPlot(page);
  const oldPaths = await curves(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('d')));
  const start = panel(page).getByRole('spinbutton', { name: 'Sweep start frequency', exact: true });
  const stop = panel(page).getByRole('spinbutton', { name: 'Sweep stop frequency', exact: true });
  for (const [field, bad, good] of [[start, '', '500'], [stop, '400', '1500'], [start, '0', '500']] as const) {
    await field.fill(bad);
    await expect(panel(page).getByRole('alert')).toBeVisible();
    await expect(panel(page).getByRole('img')).toHaveCount(0);
    await expect(panel(page).getByRole('button')).toHaveCount(0);
    await field.fill(good);
    await showPlot(page);
  }
  const resistance = page.locator('.parameters-panel').getByRole('spinbutton', { name: 'Load resistance', exact: true });
  await resistance.fill('-1');
  await expect(page.locator('.parameters-panel').getByRole('alert')).toBeVisible();
  await expect(page.locator('.ssl-workspace svg')).toHaveCount(0);
  await resistance.fill('25');
  await showPlot(page);
  expect(await curves(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))).not.toEqual(oldPaths);
  await expectMatchedReadout(page, 2);
});

test('continuous families and unavailable matching networks do not fabricate frequency response branches', async ({ page }) => {
  await openLab(page, 'double-stub-matching');
  await showPlot(page);
  await page.getByRole('spinbutton', { name: 'Stub separation d₂', exact: true }).fill('0');
  await expect(curves(page)).toHaveCount(0);
  await expect(panel(page).getByRole('button')).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Load to stub 2 distance d₁', exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: 'Load resistance', exact: true }).fill('50');
  await page.getByRole('spinbutton', { name: 'Load reactance', exact: true }).fill('0');
  await expect(panel(page)).toContainText(/continuous/i);
  await expect(panel(page).getByRole('img')).toHaveCount(0);

  await openLab(page, 'lc-matching');
  await showPlot(page);
  await page.getByRole('radio', { name: 'Component 2 in series', exact: true }).check();
  await expect(panel(page).getByRole('img')).toHaveCount(0);
  await expect(panel(page).getByRole('button')).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Load resistance', exact: true }).fill('50');
  await page.getByRole('spinbutton', { name: 'Load reactance', exact: true }).fill('0');
  await expect(panel(page)).toContainText(/continuous/i);
  await expect(panel(page).getByRole('button')).toHaveCount(0);
});

test('automatic frequency responses fit mobile and provide keyboard access to sweep settings and numerical readout', async ({ page }) => {
  test.setTimeout(70_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [slug] of matchingLabs) {
    await test.step(slug, async () => {
      await openLab(page, slug);
      await showPlot(page);
      await expectPureFrequencyResponse(page);
      const start = panel(page).getByRole('spinbutton', { name: 'Sweep start frequency', exact: true });
      await start.focus();
      await start.press('ControlOrMeta+A');
      await start.pressSequentially('600');
      await expect(start).toHaveValue('600');
      await showPlot(page);
      const input = readout(page);
      await input.focus();
      await input.press('ControlOrMeta+A');
      await input.pressSequentially('750');
      await expect(input).toHaveValue('750');
      await expect(panel(page).locator('.frequency-response__readout-values')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      const bounds = await panel(page).getByRole('img').boundingBox();
      expect(bounds!.width).toBeGreaterThan(250);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
      if (slug === 'single-stub-matching' && test.info().project.name === 'chromium') {
        await page.locator('#app-language').selectOption('es');
        await panel(page).screenshot({ path: 'test-results/frequency-response/single-stub-panel-mobile-es.png', animations: 'disabled' });
        await page.locator('#app-language').selectOption('en');
      }
    });
  }
});
