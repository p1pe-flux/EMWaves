import { expect, test } from '@playwright/test';
import type { Response } from '@playwright/test';
import { gzipSync } from 'node:zlib';

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
  await page.getByRole('link', { name: 'Guías', exact: true }).click();
  await expect(page.locator('.guide-entry')).toHaveCount(6);
  await page.locator('.guide-entry').filter({ hasText: 'Introducción al diagrama de Smith' }).getByRole('link', { name: 'Leer guía', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Introducción al diagrama de Smith' })).toBeVisible();
  await expect(page.locator('.guide-document math').first()).toBeAttached();
  await expect(page.locator('.katex-error')).toHaveCount(0);
});

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
