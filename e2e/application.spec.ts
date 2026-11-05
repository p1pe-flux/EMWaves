import { expect, test } from '@playwright/test';
import type { Response } from '@playwright/test';
import { gzipSync } from 'node:zlib';

const laboratories = [
  ['introduction-to-smith-chart', 'Introduction to Smith Chart', 'Introducción al diagrama de Smith'],
  ['single-stub-matching', 'Single-Stub Matching', 'Adaptación con un stub'],
  ['series-stub-matching', 'Series-Stub Matching', 'Adaptación con un stub en serie'],
  ['lc-matching', 'LC Matching', 'Adaptación con L y C'],
  ['quarter-wave-transformer', 'Quarter-Wave Transformer', 'Transformador de cuarto de onda'],
  ['double-stub-matching', 'Double-Stub Matching', 'Adaptación con dos stubs'],
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'es'));
});

test('catalogue defers interactive code and stays within its JavaScript budget', async ({ page }) => {
  const scripts: Response[] = [];
  page.on('response', (response) => { if (response.request().resourceType() === 'script') scripts.push(response); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Laboratorios', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(scripts.map((response) => response.url()).join('\n')).not.toMatch(/SmithGuidePage-|SmithChart-|Matching-/);
  const sizes = await Promise.all(scripts.map(async (response) => gzipSync(await response.body()).byteLength));
  expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThan(100_000);
  await expect(page.locator('.landing-lab-card')).toHaveCount(6);
  await expect(page.locator('.landing-read-guide')).toHaveCount(6);
  await expect(page.locator('nav.main-nav a[href="#/guides"]')).toHaveCount(0);
  await page.locator('.landing-read-guide[href="#/guides/introduction-to-smith-chart"]').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Introducción al diagrama de Smith' })).toBeVisible();
  await expect(page.locator('.guide-document math').first()).toBeAttached();
  await expect(page.locator('.katex-error')).toHaveCount(0);
});

for (const locale of ['es', 'en'] as const) {
  test(`the ${locale} catalogue and laboratories provide guide access without a global Guides tab on desktop and mobile`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const catalogName = locale === 'es' ? 'Laboratorios' : 'Laboratories';
    const backName = locale === 'es' ? 'Todos los laboratorios' : 'All laboratories';
    const readName = locale === 'es' ? 'Leer guía' : 'Read guide';

    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.getByRole('combobox').selectOption(locale);
      await expect(page.getByRole('heading', { name: catalogName, level: 1, exact: true })).toBeVisible();
      const navigation = page.locator('nav.main-nav');
      await expect(navigation.getByRole('link')).toHaveCount(1);
      await expect(navigation.getByRole('link', { name: catalogName, exact: true })).toHaveAttribute('href', '#/');
      await expect(page.locator('a[href="#/guides"]')).toHaveCount(0);
      await expect(page.locator('.landing-read-guide')).toHaveCount(6);
      for (const [slug] of laboratories) {
        await expect(page.locator(`.landing-lab-card:has(.landing-lab-link[href="#/labs/${slug}"]) .landing-read-guide`)).toHaveAttribute('href', '#/guides/' + slug);
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      if (locale === 'es' && test.info().project.name === 'chromium') {
        await page.screenshot({ path: viewport.width === 1440 ? 'test-results/navigation/catalog-es.png' : 'test-results/navigation/catalog-es-mobile.png', fullPage: true, animations: 'disabled' });
      }

      // All six guide routes are exercised on desktop; Smith and LC also
      // exercise the same entry points with the mobile navigation layout.
      const targets = viewport.width === 1440 ? laboratories : [laboratories[0], laboratories[3]];
      for (const [slug, english, spanish] of targets) {
        const title = locale === 'es' ? spanish : english;
        const cardGuide = page.locator(`.landing-read-guide[href="#/guides/${slug}"]`);
        await expect(cardGuide).toHaveAccessibleName(readName);
        await cardGuide.click();
        await expect(page).toHaveURL(new RegExp('#/guides/' + slug + '$'));
        await expect(page.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
        await expect(page.locator('a[href="#/guides"]')).toHaveCount(0);
        const guideBack = page.locator('.guide-back');
        await expect(guideBack).toHaveAccessibleName(backName);
        await expect(guideBack).toHaveAttribute('href', '#/');
        await guideBack.click();
        await expect(page.locator('.landing-lab-card')).toHaveCount(6);

        await page.locator(`.landing-lab-link[href="#/labs/${slug}"]`).click();
        await expect(page.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
        const labGuide = page.locator('.read-guide-button');
        await expect(labGuide).toHaveAccessibleName(readName);
        await expect(labGuide).toHaveAttribute('href', '#/guides/' + slug);
        await expect(page.locator('nav.main-nav a[href="#/guides"]')).toHaveCount(0);
        if (slug === 'introduction-to-smith-chart') {
          await expect(page.locator('svg.smith-chart__svg')).toBeVisible();
          await expect(page.locator('.frequency-response')).toHaveCount(0);
          await expect(page.getByRole('spinbutton', { name: /Design frequency|Frecuencia de diseño/ })).toHaveCount(0);
          if (locale === 'es' && test.info().project.name === 'chromium') {
            await page.screenshot({ path: viewport.width === 1440 ? 'test-results/navigation/smith-es.png' : 'test-results/navigation/smith-es-mobile.png', fullPage: true, animations: 'disabled' });
          }
        }
        await labGuide.click();
        await expect(page).toHaveURL(new RegExp('#/guides/' + slug + '$'));
        await expect(page.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
        await expect(page.locator('.guide-back')).toHaveAttribute('href', '#/');
        await page.locator('.guide-back').click();
        await expect(page.getByRole('heading', { name: catalogName, level: 1, exact: true })).toBeVisible();
      }
    }

    await page.goto('/#/guides');
    await page.getByRole('combobox').selectOption(locale);
    await expect(page.locator('.guide-entry')).toHaveCount(6);
    await expect(page.locator('nav.main-nav a[href="#/guides"]')).toHaveCount(0);
    expect(errors).toEqual([]);
    await expect(page.locator('.formula--error, .katex-error')).toHaveCount(0);
  });
}

test('a failed laboratory chunk offers recovery and the catalogue remains usable', async ({ page }) => {
  await page.route('**/assets/SingleStubMatching-*.js', (route) => route.abort('failed'));
  await page.goto('/');
  await page.getByRole('link', { name: 'Adaptación con un stub', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo abrir este contenido');
  await expect(page.getByRole('button', { name: 'Recargar', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al catálogo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Laboratorios', exact: true })).toBeVisible();
});

test('secondary clicks and secondary pointers leave the Smith load unchanged', async ({ page }) => {
  await page.goto('/#/labs/introduction-to-smith-chart');
  const resistance = page.getByRole('spinbutton', { name: 'Resistencia de la carga', exact: true });
  const reactance = page.getByRole('spinbutton', { name: 'Reactancia de la carga', exact: true });
  const chart = page.locator('.smith-chart__svg');
  await expect(resistance).toHaveValue('100');
  await chart.click({ button: 'right', position: { x: 250, y: 250 } });
  await expect(resistance).toHaveValue('100');
  await expect(reactance).toHaveValue('50');
  await chart.dispatchEvent('pointerdown', { button: 0, isPrimary: false, pointerId: 2, clientX: 500, clientY: 500 });
  await expect(resistance).toHaveValue('100');
  await chart.click({ position: { x: 250, y: 250 } });
  await expect(resistance).not.toHaveValue('100');
  await chart.focus();
  await page.keyboard.press('ArrowRight');
  await expect(chart).toBeFocused();
});

test('the guide projection stops offscreen and resumes without losing playback intent', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/guides/introduction-to-smith-chart');
  const projection = page.locator('.smith-projection');
  await projection.scrollIntoViewIfNeeded();
  await expect(projection).toHaveAttribute('data-running', 'true');
  await page.clock.runFor(1800);
  const before = Number(await projection.getAttribute('data-progress'));
  expect(before).toBeGreaterThan(0);
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect(projection).toHaveAttribute('data-running', 'false');
  const stopped = await projection.getAttribute('data-progress');
  await page.clock.runFor(1800);
  await expect(projection).toHaveAttribute('data-progress', stopped!);
  await projection.scrollIntoViewIfNeeded();
  await expect(projection).toHaveAttribute('data-running', 'true');
  await page.clock.runFor(500);
  expect(Number(await projection.getAttribute('data-progress'))).toBeGreaterThan(Number(stopped));
});

test('reduced motion starts the guide projection paused and allows explicit inspection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/guides/introduction-to-smith-chart');
  const projection = page.locator('.smith-projection');
  await projection.scrollIntoViewIfNeeded();
  await expect(projection).toHaveAttribute('data-running', 'false');
  await projection.getByRole('button', { name: 'Diagrama de Smith', exact: true }).click();
  await expect(projection).toHaveAttribute('data-progress', '1.0000');
});
