import { expect, test, type Locator, type Page } from '@playwright/test';
import { matchingLabs } from './laboratories';
import { constructionHeight, expectConstructionHeight, expectExpandedLesson } from './lesson-layout';

const expectedSteps = { ss: 11, series: 10, lc: 7, qw: 12, ds: 15 } as const;
const expectedFields = { ss: 4, series: 4, lc: 2, qw: 6, ds: 4 } as const;
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'es'));
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

const trackedMarker = { ss: 'tracked-load', series: 'tracked-load', lc: 'tracked-load', qw: 'tracked-quarter-wave', ds: 'tracked-double-stub' } as const;
const nextButton = (construction: Locator) => construction.getByRole('button', { name: 'Siguiente', exact: true });
const previousButton = (construction: Locator) => construction.getByRole('button', { name: 'Anterior', exact: true });
const movementSpeed = (construction: Locator) => construction.getByRole('slider', { name: 'Velocidad', exact: true });

async function openLab(page: Page, route: string) {
  await page.goto('/#/labs/' + route);
  const construction = page.locator('section.ss-construction');
  await expect(construction).toHaveAttribute('data-stage', '0');
  await expect(construction).toHaveAttribute('data-playing', 'false');
  await page.evaluate(() => document.fonts.ready);
  return construction;
}

async function completeNext(construction: Locator, stage: number) {
  const next = nextButton(construction);
  const height = await constructionHeight(construction);
  await next.press('Enter');
  await expect(construction).toHaveAttribute('data-stage', String(stage));
  await expect(construction).toHaveAttribute('data-playing', 'true');
  await expectConstructionHeight(construction, height);
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await expect(next).toBeFocused();
  await expect(construction).toHaveAttribute('data-playing', 'false');
  await expect(construction).toHaveAttribute('data-stage-progress', '1.000');
  await expect(next).toBeFocused();
  await expectExpandedLesson(construction);
}

async function freezeClock(page: Page, route: string) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  const construction = await openLab(page, route);
  await page.clock.pauseAt(new Date('2026-01-01T00:10:00Z'));
  return construction;
}

for (const [route, title, kind] of matchingLabs) {
  test(`${title}: all steps stop, rewind, restart, reset, and reject invalid inputs`, async ({ page }) => {
    const construction = await openLab(page, route);
    await expect(construction.locator('.ss-step-count')).toHaveText('1 / ' + expectedSteps[kind]);
    await expectExpandedLesson(construction);
    const height = await constructionHeight(construction);
    await expect(construction.locator('[data-found="true"]')).toHaveCount(0);
    await movementSpeed(construction).press('End');
    await expect(movementSpeed(construction)).toHaveValue('4');

    for (let stage = 1; stage < expectedSteps[kind]; stage += 1) {
      await completeNext(construction, stage);
      await expectConstructionHeight(construction, height);
      // A completed transition stays on this operation until the next key press.
      await expect(construction).toHaveAttribute('data-stage', String(stage));
      await expect(nextButton(construction)).toHaveAttribute('aria-disabled', String(stage === expectedSteps[kind] - 1));
      if (kind === 'ss' && stage === 1) {
        const lesson = construction.locator('.ss-construction__lesson');
        await expect(lesson.locator('annotation').filter({ hasText: 'y_L=1/z_L=' })).toHaveCount(1);
        await expect(lesson.locator('annotation').filter({ hasText: /^y_v=/ })).toHaveCount(0);
        await expect(construction.locator('[data-stub-present]')).toHaveAttribute('data-stub-present', 'false');
        await page.screenshot({ path: 'test-results/review-single-stub-corrected.png', fullPage: true });
      }
    }

    await expect(construction.locator('[data-found="true"]')).toHaveCount(expectedFields[kind]);
    const marker = construction.locator(`[data-chart-marker="${trackedMarker[kind]}"]`);
    expect(Math.hypot(Number(await marker.getAttribute('data-re')), Number(await marker.getAttribute('data-im')))).toBeLessThan(1e-6);
    // The terminal Next remains focused and cannot advance out of the timeline.
    await nextButton(construction).press('Enter');
    await expect(construction).toHaveAttribute('data-stage', String(expectedSteps[kind] - 1));
    await expect(construction).toHaveAttribute('data-playing', 'false');
    await expect(nextButton(construction)).toBeFocused();

    const previous = previousButton(construction);
    await previous.press('Enter');
    await expect(construction).toHaveAttribute('data-playing', 'true');
    await expect(previous).toBeFocused();
    await expect(construction).toHaveAttribute('data-playing', 'false');
    await expect(construction).toHaveAttribute('data-stage', String(expectedSteps[kind] - 2));
    await expectConstructionHeight(construction, height);
    await expect(previous).toBeFocused();

    const reference = page.locator('.parameter-grid input').first();
    await expect(construction.locator('[data-found="true"]')).toHaveCount(expectedFields[kind]);
    // Invalid data must remove the last valid visualization and disclosed values.
    await reference.fill('0');
    await expect(page.locator('.parameters-panel [role="alert"]')).toBeVisible();
    await expect(page.locator('.ssl-workspace svg')).toHaveCount(0);
    await expect(page.locator('.ssl-workspace [data-found="true"]')).toHaveCount(0);
    await reference.fill('50');
    await expect(construction).toHaveAttribute('data-stage', '0');
    await expect(construction).toHaveAttribute('data-playing', 'false');
    await expect(construction.locator('[data-found="true"]')).toHaveCount(0);
    await reference.fill('75');
    await expect(construction).toHaveAttribute('data-stage', '0');
    await expect(construction.locator('[data-found="true"]')).toHaveCount(0);
    await movementSpeed(construction).press('End');
    await completeNext(construction, 1);
    await construction.getByRole('button', { name: 'Reiniciar', exact: true }).click();
    await expect(reference).toHaveValue('75');
    await expect(construction).toHaveAttribute('data-stage', '0');
    await expect(construction).toHaveAttribute('data-playing', 'false');
    await expect(construction.locator('[data-found="true"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Restablecer', exact: true }).click();
    await expect(reference).toHaveValue('50');
    await expect(page.getByRole('spinbutton', { name: /resistencia de (la )?carga/i })).toHaveValue('100');
    await expect(page.getByRole('spinbutton', { name: /reactancia de (la )?carga/i })).toHaveValue('50');
    await expect(construction).toHaveAttribute('data-stage', '0');
    await expect(movementSpeed(construction)).toHaveValue('1');

    await expect(page.locator('.formula--error, .katex-error')).toHaveCount(0);
  });
}

test('single-stub values appear on completion and retract during reverse playback', async ({ page }) => {
  const construction = await freezeClock(page, 'single-stub-matching');
  const first = construction.locator('[data-summary-branch="0"]');
  const second = construction.locator('[data-summary-branch="1"]');
  const distance = first.locator('[data-summary-field="distance"]');
  const length = first.locator('[data-summary-field="stub-length"]');
  await movementSpeed(construction).press('End');
  for (const stage of [1, 2]) {
    await nextButton(construction).press('Enter');
    await page.clock.fastForward(5_000);
    await expect(construction).toHaveAttribute('data-stage', String(stage));
    await expect(construction).toHaveAttribute('data-playing', 'false');
  }

  await nextButton(construction).press('Enter');
  await page.clock.runFor(200);
  await expect(construction).toHaveAttribute('data-playing', 'true');
  await expect(distance).toHaveAttribute('data-found', 'false');
  await expect(length).toHaveAttribute('data-found', 'false');
  // Keyboard activation while aria-disabled is guarded without losing focus.
  await nextButton(construction).press('Enter');
  await expect(construction).toHaveAttribute('data-stage', '3');
  await expect(nextButton(construction)).toBeFocused();
  await page.clock.fastForward(5_000);
  await expect(construction).toHaveAttribute('data-playing', 'false');
  await expect(distance).toHaveAttribute('data-found', 'true');
  await expect(length).toHaveAttribute('data-found', 'false');
  await expect(second.locator('[data-found="true"]')).toHaveCount(0);

  await nextButton(construction).press('Enter');
  await page.clock.fastForward(5_000);
  await nextButton(construction).press('Enter');
  await page.clock.runFor(200);
  await expect(construction).toHaveAttribute('data-stage', '5');
  await expect(length).toHaveAttribute('data-found', 'false');
  await page.clock.fastForward(5_000);
  await expect(length).toHaveAttribute('data-found', 'true');
  await previousButton(construction).press('Enter');
  await expect(length).toHaveAttribute('data-found', 'false');
  await expect(distance).toHaveAttribute('data-found', 'true');
  await page.clock.fastForward(5_000);
  await expect(construction).toHaveAttribute('data-stage', '4');

  for (const stage of [5, 6, 7]) {
    await nextButton(construction).press('Enter');
    if (stage === 7) {
      await page.clock.runFor(200);
      await expect(first.locator('[data-found="true"]')).toHaveCount(2);
      await expect(second.locator('[data-found="true"]')).toHaveCount(0);
    }
    await page.clock.fastForward(5_000);
    await expect(construction).toHaveAttribute('data-stage', String(stage));
    await expect(construction).toHaveAttribute('data-playing', 'false');
  }
  await expect(first.locator('[data-found="true"]')).toHaveCount(2);
  await expect(second.locator('[data-summary-field="distance"]')).toHaveAttribute('data-found', 'true');
  await expect(second.locator('[data-summary-field="stub-length"]')).toHaveAttribute('data-found', 'false');
});

test('speed changes retain the current forward and reverse animation position', async ({ page }) => {
  const construction = await freezeClock(page, 'single-stub-matching');
  const speed = movementSpeed(construction);
  await nextButton(construction).press('Enter');
  await page.clock.runFor(500);
  const beforeForwardChange = await construction.getAttribute('data-stage-progress');
  expect(Number(beforeForwardChange)).toBeGreaterThan(0.1);
  expect(Number(beforeForwardChange)).toBeLessThan(0.5);
  await speed.press('End');
  await expect(speed).toHaveValue('4');
  await expect(construction).toHaveAttribute('data-stage-progress', beforeForwardChange!);
  await expect(construction).toHaveAttribute('data-stage', '1');
  await page.clock.runFor(200);
  expect(Number(await construction.getAttribute('data-stage-progress'))).toBeGreaterThan(Number(beforeForwardChange));
  await page.clock.fastForward(5_000);
  await expect(construction).toHaveAttribute('data-playing', 'false');
  // Simulate an idle period: playback must not chain into the following step.
  await page.clock.fastForward(30_000);
  await expect(construction).toHaveAttribute('data-stage', '1');

  await previousButton(construction).press('Enter');
  await page.clock.runFor(200);
  const beforeReverseChange = await construction.getAttribute('data-stage-progress');
  expect(Number(beforeReverseChange)).toBeLessThan(1);
  expect(Number(beforeReverseChange)).toBeGreaterThan(0.5);
  await speed.press('Home');
  await expect(speed).toHaveValue('0.25');
  await expect(construction).toHaveAttribute('data-stage-progress', beforeReverseChange!);
  await page.clock.runFor(500);
  expect(Number(await construction.getAttribute('data-stage-progress'))).toBeLessThan(Number(beforeReverseChange));
  await expect(construction).toHaveAttribute('data-stage', '1');
  await expect(construction).toHaveAttribute('data-playing', 'true');
  await page.clock.fastForward(30_000);
  await expect(construction).toHaveAttribute('data-stage', '0');
  await expect(construction).toHaveAttribute('data-playing', 'false');
});

for (const [route, title] of matchingLabs) {
  test(`${title}: reduced motion completes a single step and preserves keyboard focus`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const construction = await freezeClock(page, route);
    await expect(construction.locator('.ss-motion-note')).toBeVisible();
    const next = nextButton(construction);
    await next.press('Enter');
    await expect(construction).toHaveAttribute('data-stage', '1');
    await expect(construction).toHaveAttribute('data-stage-progress', '1.000');
    await expect(construction).toHaveAttribute('data-playing', 'true');
    await expect(next).toBeFocused();
    await page.clock.fastForward(1_000);
    await expect(construction).toHaveAttribute('data-playing', 'false');
    await expect(next).toBeFocused();
    await page.clock.fastForward(30_000);
    await expect(construction).toHaveAttribute('data-stage', '1');
    const previous = previousButton(construction);
    await previous.press('Enter');
    await expect(construction).toHaveAttribute('data-stage-progress', '0.000');
    await page.clock.fastForward(1_000);
    await expect(construction).toHaveAttribute('data-stage', '0');
    await expect(construction).toHaveAttribute('data-playing', 'false');
    await expect(previous).toBeFocused();
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
  });
}
