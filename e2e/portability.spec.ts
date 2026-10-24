import { expect, test } from '@playwright/test';
import { resolve, sep } from 'node:path';
import { allRoutes } from './laboratories';

test('a relocated production build loads every laboratory and guide with local assets only', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  const prefix = '/portable/emwaves/';
  const dist = resolve('dist');
  const origin = new URL(baseURL!).origin;
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'es'));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (url.origin !== origin || !url.pathname.startsWith(prefix)) {
      await route.abort('blockedbyclient');
      return;
    }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const file = resolve(dist, relative);
    expect(file.startsWith(dist + sep)).toBe(true);
    await route.fulfill({ path: file });
  });

  await page.goto(prefix);
  await expect(page.getByRole('heading', { level: 1, name: 'Laboratorios', exact: true })).toBeVisible();
  for (const [hash, title] of allRoutes) {
    await page.goto(prefix + hash);
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.locator('.smith-chart__svg').first()).toBeVisible();
    await expect(page.locator('.formula--error, .katex-error, [role="alert"]')).toHaveCount(0);
    await expect(page).toHaveTitle(new RegExp('^EMWaves [\\d.]+ — '));
  }
  await page.evaluate(() => document.fonts.ready);
  expect(requests.some(url => /KaTeX_.*\.woff2?$/.test(url))).toBe(true);
  expect(requests.every(url => url.startsWith(origin + prefix))).toBe(true);
  expect(errors).toEqual([]);
});

test('blocked browser storage preserves navigation and language switching', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage is unavailable', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('combobox')).toHaveValue('en');
  await page.getByRole('combobox').selectOption('es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.getByRole('link', { name: 'Adaptación con un stub', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Adaptación con un stub', exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/EMWaves .* — Adaptación con un stub/);
  await page.getByRole('link', { name: 'Leer guía', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Adaptación con un stub', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveValue('es');
  await page.reload();
  await expect(page.getByRole('combobox')).toHaveValue('en');
  expect(errors).toEqual([]);
});

test('guides remain usable when optional browser observers and preference APIs are unavailable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    for (const property of ['ResizeObserver', 'IntersectionObserver', 'matchMedia']) {
      Object.defineProperty(window, property, { configurable: true, value: undefined });
    }
    Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
  });
  await page.goto('/#/guides/introduction-to-smith-chart');
  const projection = page.locator('.smith-projection');
  await expect(projection).toBeAttached();
  await expect(projection).toHaveAttribute('data-running', 'false');
  await projection.getByRole('button', { name: 'Smith chart', exact: true }).click();
  await expect(projection).toHaveAttribute('data-progress', '1.0000');
  await page.goto('/#/guides/single-stub-matching');
  const lesson = page.locator('.step-explanation');
  await expect(lesson).toHaveAttribute('data-step-explanation-ready', 'true');
  await page.setViewportSize({ width: 840, height: 900 });
  await expect(lesson).toHaveAttribute('data-step-explanation-ready', 'true');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await expect(page.locator('.formula--error, .katex-error, [role="alert"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
