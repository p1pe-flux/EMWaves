import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectExpandedLesson } from '../e2e/lesson-layout';

const designs = ['editorial', 'precision'] as const;
const screens = ['home', 'lab', 'guide'] as const;
const widths = [1440, 850, 390] as const;
const designLabels = ['Warm Paper', 'Precision Studio'];
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

async function openPreview(page: Page, design = 'precision', screen = 'lab', locale = 'es') {
  await page.goto(`/design-preview.html?design=${design}&screen=${screen}&device=desktop&locale=${locale}`);
  await expect(page.locator('.design-preview')).toHaveAttribute('data-design', design);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.design-preview h1')).toBeVisible();
}

async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const product = document.querySelector<HTMLElement>('.design-preview')!;
    return {
      document: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      product: product.scrollWidth > product.clientWidth + 1,
    };
  })).toEqual({ document: false, product: false });
  await expect(page.locator('.formula--error, .katex-error')).toHaveCount(0);
}

async function expectReadableBodyText(page: Page, screen: typeof screens[number]) {
  const selector = screen === 'home' ? '.pv-topic-copy h2' : screen === 'guide' ? '.study-section p' : '.ss-construction__lesson p';
  const contrast = await page.locator(selector).first().evaluate((element) => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const foreground = rgb(getComputedStyle(element).color);
    const background = rgb(getComputedStyle(element.closest('.design-preview')!).backgroundColor);
    const luminance = (color: number[]) => color.map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
}

async function freezeLab(page: Page) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await openPreview(page);
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
  return page.locator('section.ss-construction');
}

async function finishNext(page: Page, construction: Locator, stage: number) {
  await construction.getByRole('button', { name: 'Siguiente', exact: true }).press('Enter');
  await expect(construction).toHaveAttribute('data-stage', String(stage));
  await page.clock.fastForward(6_000);
  await expect(construction).toHaveAttribute('data-playing', 'false');
  await expect(construction).toHaveAttribute('data-stage-progress', '1.000');
  await expectExpandedLesson(construction);
}

for (const design of designs) {
  for (const locale of ['es', 'en'] as const) {
    test(`${design}, ${locale}: responsive catalog, laboratory and guide @matrix`, async ({ page }, testInfo) => {
      for (const width of widths) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        for (const screen of screens) {
          await openPreview(page, design, screen, locale);
          await expect(page.locator('.design-preview')).toHaveAttribute('lang', locale);
          await expectNoOverflow(page);
          await expectReadableBodyText(page, screen);
          if (screen === 'lab') {
            const construction = page.locator('section.ss-construction');
            await expect(construction).toHaveAttribute('data-stage', '0');
            await expect(construction).toHaveAttribute('data-playing', 'false');
            await expect(construction.locator('[data-found="true"]')).toHaveCount(0);
            await expectExpandedLesson(construction);
          }
          if (locale === 'es' && width !== 850) {
            const device = width === 390 ? 'mobile' : 'desktop';
            const path = `test-results/design-preview/${design}-${screen}-${device}.png`;
            await page.locator('.prototype-viewport').screenshot({ path, animations: 'disabled' });
            await testInfo.attach(`${design}-${screen}-${device}`, { path, contentType: 'image/png' });
          }
        }
      }
    });
  }

  test(`${design}: real lab and guide interactions @smoke`, async ({ page }) => {
    await openPreview(page, design);
    const construction = page.locator('section.ss-construction');
    await expect(construction).toHaveAttribute('data-stage', '0');
    await construction.getByRole('slider', { name: 'Velocidad', exact: true }).press('End');
    await construction.getByRole('button', { name: 'Siguiente', exact: true }).press('Enter');
    await expect(construction).toHaveAttribute('data-stage', '1');
    await expect(construction).toHaveAttribute('data-playing', 'false');
    await expectExpandedLesson(construction);
    await page.getByRole('group', { name: 'Pantalla de vista previa' }).getByRole('button', { name: 'Guía', exact: true }).click();
    await expect(page.locator('.prototype-guide')).toBeVisible();
    await page.getByRole('button', { name: 'Stub abierto', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stub abierto', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.study-prose annotation').filter({ hasText: /ell_s=0\.375/ })).toHaveCount(1);
    await expectNoOverflow(page);
  });
}

test('single-stub playback reveals results at completion, reverses, restarts and clears invalid data', async ({ page }) => {
  const construction = await freezeLab(page);
  const first = construction.locator('[data-summary-branch="0"]');
  const second = construction.locator('[data-summary-branch="1"]');
  await construction.getByRole('slider', { name: 'Velocidad', exact: true }).press('End');
  for (let stage = 1; stage <= 10; stage += 1) {
    await construction.getByRole('button', { name: 'Siguiente', exact: true }).press('Enter');
    await expect(construction).toHaveAttribute('data-playing', 'true');
    if (stage === 3) await expect(first.locator('[data-summary-field="distance"]')).toHaveAttribute('data-found', 'false');
    if (stage === 5) await expect(first.locator('[data-summary-field="stub-length"]')).toHaveAttribute('data-found', 'false');
    if (stage >= 7) await expect(first.locator('[data-found="true"]')).toHaveCount(2);
    await page.clock.fastForward(6_000);
    await expect(construction).toHaveAttribute('data-stage', String(stage));
    await expect(construction).toHaveAttribute('data-playing', 'false');
    await expectExpandedLesson(construction);
    if (stage === 3) await expect(first.locator('[data-found="true"]')).toHaveCount(1);
    if (stage === 5) await expect(first.locator('[data-found="true"]')).toHaveCount(2);
    if (stage < 7) await expect(second.locator('[data-found="true"]')).toHaveCount(0);
  }
  await expect(construction.locator('[data-found="true"]')).toHaveCount(4);
  const marker = construction.locator('[data-chart-marker="tracked-load"]');
  expect(Math.hypot(Number(await marker.getAttribute('data-re')), Number(await marker.getAttribute('data-im')))).toBeLessThan(1e-6);
  await expect(construction.getByRole('button', { name: 'Siguiente', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await construction.getByRole('button', { name: 'Anterior', exact: true }).press('Enter');
  await page.clock.fastForward(6_000);
  await expect(construction).toHaveAttribute('data-stage', '9');
  await construction.getByRole('button', { name: 'Anterior', exact: true }).press('Enter');
  await expect(second.locator('[data-summary-field="stub-length"]')).toHaveAttribute('data-found', 'false');
  await page.clock.fastForward(6_000);
  await expect(construction).toHaveAttribute('data-stage', '8');
  await expect(construction.locator('[data-found="true"]')).toHaveCount(3);

  const reference = page.getByRole('spinbutton', { name: 'Impedancia de la línea principal', exact: true });
  await reference.fill('0');
  await expect(page.locator('.parameters-panel [role="alert"]')).toBeVisible();
  await expect(page.locator('.prototype-lab .ssl-workspace svg')).toHaveCount(0);
  await expect(page.locator('.prototype-lab [data-found="true"]')).toHaveCount(0);
  await reference.fill('75');
  await expect(construction).toHaveAttribute('data-stage', '0');
  await finishNext(page, construction, 1);
  await construction.getByRole('button', { name: 'Reiniciar', exact: true }).press('Enter');
  await expect(reference).toHaveValue('75');
  await expect(construction).toHaveAttribute('data-stage', '0');
  await page.getByRole('button', { name: 'Restablecer', exact: true }).press('Enter');
  await expect(reference).toHaveValue('50');
  await expect(page.getByRole('spinbutton', { name: 'Resistencia de la carga', exact: true })).toHaveValue('100');
  await expect(page.getByRole('spinbutton', { name: 'Reactancia de la carga', exact: true })).toHaveValue('50');
  await expect(construction).toHaveAttribute('data-stage', '0');
  await expect(construction).toHaveAttribute('data-playing', 'false');
});

test('direction, language, motion replay and phone preview preserve the active construction', async ({ page }) => {
  const construction = await freezeLab(page);
  const reference = page.getByRole('spinbutton', { name: 'Impedancia de la línea principal', exact: true });
  await reference.fill('75');
  await construction.getByRole('button', { name: 'Siguiente', exact: true }).press('Enter');
  await page.clock.runFor(250);
  const progress = await construction.getAttribute('data-stage-progress');
  expect(Number(progress)).toBeGreaterThan(0);
  expect(Number(progress)).toBeLessThan(1);
  const original = await construction.elementHandle();
  for (let index = 0; index < designs.length; index += 1) {
    await page.getByRole('button', { name: designLabels[index], exact: true }).press('Enter');
    await expect(page.locator('.design-preview')).toHaveAttribute('data-design', designs[index]);
    await expect(construction).toHaveAttribute('data-stage', '1');
    await expect(construction).toHaveAttribute('data-stage-progress', progress!);
    await expect(reference).toHaveValue('75');
    expect(await construction.evaluate((element, previous) => element === previous, original)).toBe(true);
  }
  await page.getByRole('button', { name: 'Repetir movimiento', exact: true }).press('Enter');
  await expect(construction).toHaveAttribute('data-stage-progress', progress!);
  await page.getByRole('combobox', { name: 'Idioma', exact: true }).selectOption('en');
  await expect(page.locator('.design-preview')).toHaveAttribute('lang', 'en');
  await expect(construction).toHaveAttribute('data-stage-progress', progress!);
  await expect(construction.getByRole('button', { name: 'Next', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await page.clock.fastForward(6_000);
  await expect(construction).toHaveAttribute('data-playing', 'false');
  await page.getByRole('button', { name: 'Mobile view', exact: true }).press('Enter');
  await expect(page.locator('.prototype-viewport')).toHaveAttribute('data-device', 'mobile');
  expect((await page.locator('.prototype-viewport').boundingBox())!.width).toBeLessThanOrEqual(390);
  await expect(construction).toHaveAttribute('data-stage', '1');
  await expectExpandedLesson(construction);
  await expectNoOverflow(page);
});

test('keyboard focus remains visible and reduced motion keeps the mathematical result', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const construction = await freezeLab(page);
  const firstDirection = page.getByRole('button', { name: designLabels[0], exact: true });
  await firstDirection.focus();
  await page.keyboard.press('Tab');
  const secondDirection = page.getByRole('button', { name: designLabels[1], exact: true });
  await expect(secondDirection).toBeFocused();
  const outline = await secondDirection.evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth) }));
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Repetir movimiento', exact: true }).press('Enter');
  expect(await page.locator('.design-preview').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  for (let stage = 1; stage <= 10; stage += 1) await finishNext(page, construction, stage);
  const marker = construction.locator('[data-chart-marker="tracked-load"]');
  expect(Math.hypot(Number(await marker.getAttribute('data-re')), Number(await marker.getAttribute('data-im')))).toBeLessThan(1e-6);
  await expect(construction.locator('[data-found="true"]')).toHaveCount(4);
});

test('review navigation restores context and leaves the main app language preference intact', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'en'));
  await openPreview(page, 'precision', 'guide', 'es');
  expect(await page.evaluate(() => localStorage.getItem('emwaves.locale'))).toBe('en');
  await page.getByRole('combobox', { name: 'Idioma', exact: true }).selectOption('en');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('es');
  expect(await page.evaluate(() => localStorage.getItem('emwaves.locale'))).toBe('en');
  await page.locator('.study-open-lab').click();
  await expect(page.locator('.prototype-lab')).toBeVisible();
  await expect.poll(() => page.locator('.review-toolbar').evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThanOrEqual(1);
  await expect(page.locator('.preview-page')).toBeFocused();
});
