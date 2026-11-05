import { mkdir } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectExpandedLesson } from './lesson-layout';

const laboratories = [
  ['introduction-to-smith-chart', 'Introduction to Smith Chart', 'Introducción al diagrama de Smith'],
  ['single-stub-matching', 'Single-Stub Matching', 'Adaptación con un stub'],
  ['series-stub-matching', 'Series-Stub Matching', 'Adaptación con un stub en serie'],
  ['lc-matching', 'LC Matching', 'Adaptación con L y C'],
  ['quarter-wave-transformer', 'Quarter-Wave Transformer', 'Transformador de cuarto de onda'],
  ['double-stub-matching', 'Double-Stub Matching', 'Adaptación con dos stubs'],
] as const;

const viewports = [
  { width: 1440, height: 1100, label: 'desktop' },
  { width: 850, height: 1000, label: 'tablet' },
  { width: 390, height: 844, label: 'mobile' },
] as const;
const screenshotDirectory = 'test-results/warm-paper';

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), {
    message: 'The page must fit the viewport without horizontal scrolling.',
  }).toBe(true);
}

async function expectControlsUnclipped(container: Locator) {
  const clipped = await container.locator('button, input, select').evaluateAll((controls) => controls.flatMap((control) => {
    const bounds = control.getBoundingClientRect();
    if (!bounds.width || !bounds.height || getComputedStyle(control).visibility === 'hidden') return [];
    const label = control.getAttribute('aria-label') ?? control.getAttribute('id') ?? control.textContent?.trim() ?? control.tagName;
    for (let ancestor = control.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const frame = ancestor.getBoundingClientRect();
      const clipsX = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX);
      const clipsY = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY);
      if ((clipsX && (bounds.left < frame.left - 1 || bounds.right > frame.right + 1))
        || (clipsY && (bounds.top < frame.top - 1 || bounds.bottom > frame.bottom + 1))) return [label];
    }
    return [];
  }));
  expect(clipped, 'Parameter and playback controls must fit their containing surfaces.').toEqual([]);
}

async function savePage(page: Page, name: string) {
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: `${screenshotDirectory}/${name}.png`, fullPage: true, animations: 'disabled' });
}

for (const locale of ['es', 'en'] as const) {
  test(`Warm Paper preserves all six ${locale} laboratories at desktop, tablet, and mobile widths`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((value) => localStorage.setItem('emwaves.locale', value), locale);

    for (const [slug, english, spanish] of laboratories) {
      await page.setViewportSize(viewports[0]);
      await page.goto('/#/labs/' + slug);
      const title = locale === 'es' ? spanish : english;
      await expect(page.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
      expect(await page.title()).toContain(title);
      await expect(page.locator('math').first()).toBeAttached();
      await page.evaluate(() => document.fonts.ready);

      for (const viewport of viewports) {
        await test.step(`${slug} · ${viewport.width}px`, async () => {
          await page.setViewportSize(viewport);
          await expectNoHorizontalOverflow(page);
          await expect(page.locator('.formula--error, .katex-error')).toHaveCount(0);
          const parameters = page.locator('.parameters-panel');
          await expect(parameters).toBeVisible();
          await expect.poll(() => parameters.evaluate((element) => {
            const style = getComputedStyle(element);
            return { overflowY: style.overflowY, internallyScrollable: element.scrollHeight > element.clientHeight + 1, minHeight: style.minHeight, maxHeight: style.maxHeight };
          }), { message: 'Parameters must retain natural height without an internal scroll area.' }).toEqual({
            overflowY: 'visible', internallyScrollable: false, minHeight: '0px', maxHeight: 'none',
          });
          const reset = parameters.getByRole('button', { name: locale === 'es' ? 'Restablecer' : 'Reset', exact: true });
          await expect(reset).toBeVisible();
          await expect(reset).toHaveAttribute('title', locale === 'es' ? 'Restablecer los valores iniciales' : 'Reset to initial values');
          const resetBounds = await reset.boundingBox();
          expect(resetBounds?.width).toBeCloseTo(30, 0);
          expect(resetBounds?.height).toBeCloseTo(30, 0);
          await expectControlsUnclipped(parameters);
          const construction = page.locator('section.ss-construction');
          if (await construction.count()) {
            await expectExpandedLesson(construction);
            await expectControlsUnclipped(construction.locator('.ss-playback'));
          }
          if (locale === 'es' && test.info().project.name === 'chromium' && viewport.label !== 'tablet') {
            await savePage(page, `${slug}-${viewport.label}`);
          }
        });
      }
    }
    expect(errors).toEqual([]);
  });
}

test('Warm Paper keeps the catalog, guide index, and full guide construction open and unclipped', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'es'));

  for (const viewport of viewports.filter((value) => value.label !== 'tablet')) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Laboratorios', level: 1, exact: true })).toBeVisible();
    await expect(page.locator('.landing-lab-card')).toHaveCount(6);
    await expect(page.locator('.landing-read-guide')).toHaveCount(6);
    await expect(page.locator('.landing-page').getByRole('heading', { level: 2 })).toHaveText(laboratories.map(([, , spanish]) => spanish));
    await expect(page.locator('.landing-page p')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(247, 244, 237)');
    await expectNoHorizontalOverflow(page);
    if (test.info().project.name === 'chromium') await savePage(page, `catalog-${viewport.label}`);

    await page.goto('/#/guides');
    await expect(page.getByRole('heading', { name: 'Guías', level: 1, exact: true })).toBeVisible();
    await expect(page.locator('.guide-entry')).toHaveCount(6);
    await expectNoHorizontalOverflow(page);
    if (test.info().project.name === 'chromium') await savePage(page, `guides-${viewport.label}`);

    await page.goto('/#/guides/single-stub-matching');
    await expect(page.getByRole('heading', { name: 'Adaptación con un stub', level: 1, exact: true })).toBeVisible();
    const construction = page.locator('section.ss-construction');
    await expectExpandedLesson(construction);
    await expect(page.locator('.formula--error, .katex-error')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectControlsUnclipped(construction.locator('.ss-playback'));
    if (test.info().project.name === 'chromium') {
      await mkdir(screenshotDirectory, { recursive: true });
      await construction.screenshot({ path: `${screenshotDirectory}/single-stub-guide-construction-${viewport.label}.png`, animations: 'disabled' });
    }
  }
  expect(errors).toEqual([]);
});
