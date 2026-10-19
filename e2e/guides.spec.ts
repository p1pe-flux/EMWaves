import { expect, test } from '@playwright/test';
import { expectGuideLessonsExpanded } from './lesson-layout';

const guides = [
  ['introduction-to-smith-chart', 'Introduction to Smith Chart', 'Introducción al diagrama de Smith'],
  ['single-stub-matching', 'Single-Stub Matching', 'Adaptación con un stub'],
  ['series-stub-matching', 'Series-Stub Matching', 'Adaptación con un stub en serie'],
  ['lc-matching', 'LC Matching', 'Adaptación con L y C'],
  ['quarter-wave-transformer', 'Quarter-Wave Transformer', 'Transformador de cuarto de onda'],
  ['double-stub-matching', 'Double-Stub Matching', 'Adaptación con dos stubs'],
] as const;

for (const locale of ['en', 'es'] as const) {
  for (const [slug, english, spanish] of guides) {
    test(`${slug} retains its full ${locale} guide and direct laboratory link`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      if (slug !== 'introduction-to-smith-chart') {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      }
      await page.addInitScript((value) => localStorage.setItem('emwaves.locale', value), locale);
      await page.goto('/#/guides/' + slug);
      await expect(page.getByRole('heading', { level: 1, name: locale === 'es' ? spanish : english, exact: true })).toBeVisible();
      await expect(page.locator('math').first()).toBeAttached();
      await expect(page.locator('.formula--error, .katex-error')).toHaveCount(0);
      if (slug === 'introduction-to-smith-chart') {
        const diagram = page.locator('[data-transmission-line-concept]');
        await expect(diagram).toHaveCount(1);
        expect(await diagram.evaluate((element) => element.previousElementSibling?.textContent)).toContain(locale === 'es' ? 'Impedancia a lo largo de una línea de transmisión' : 'Impedance along a transmission line');
        expect(await diagram.evaluate((element) => element.nextElementSibling?.textContent)).toContain(locale === 'es' ? 'Considera una línea sin pérdidas' : 'Consider a lossless line');
        await expect(diagram.getByRole('slider')).toHaveCount(0);
        await expect(diagram).not.toContainText('Ω');
      }
      await expect(page.getByRole('link', { name: locale === 'es' ? 'Abrir laboratorio' : 'Open lab', exact: true })).toHaveAttribute('href', '#/labs/' + slug);
      await expect(page.getByRole('combobox')).toHaveValue(locale);
      const article = page.locator('.guide-content');
      expect((await article.innerText()).length).toBeGreaterThan(500);
      if (slug !== 'introduction-to-smith-chart') {
        await expectGuideLessonsExpanded(page, page.locator('section.ss-construction'), locale);
      }
      await page.getByRole('link', { name: locale === 'es' ? 'Todas las guías' : 'All guides', exact: true }).click();
      await expect(page.locator('.guide-entry')).toHaveCount(6);
      expect(errors).toEqual([]);
    });
  }
}

test('switching language preserves a guide construction while it is moving', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'es'));
  await page.goto('/#/guides/single-stub-matching');
  const construction = page.locator('.ss-construction');
  await expect(construction).toHaveAttribute('data-stage', '0');
  await construction.getByRole('slider', { name: 'Velocidad', exact: true }).press('Home');
  await construction.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(construction).toHaveAttribute('data-playing', 'true');
  await expect.poll(async () => Number(await construction.getAttribute('data-stage-progress'))).toBeGreaterThan(0);
  const before = Number(await construction.getAttribute('data-stage-progress'));
  await page.getByRole('combobox').selectOption('en');
  await expect(page.getByRole('heading', { level: 1, name: 'Single-Stub Matching', exact: true })).toBeVisible();
  await expect(construction).toHaveAttribute('data-stage', '1');
  expect(Number(await construction.getAttribute('data-stage-progress'))).toBeGreaterThanOrEqual(before);
  await expect(construction.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
});
