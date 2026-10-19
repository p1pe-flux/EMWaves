import { expect, type Locator, type Page } from '@playwright/test';

/** The page, rather than a nested lesson panel, must accommodate the full text. */
export async function expectExpandedLesson(construction: Locator) {
  const lesson = construction.locator('.ss-construction__lesson');
  await expect(lesson).toBeVisible();
  await expect(lesson.locator('.step-explanation')).toHaveAttribute('data-step-explanation-ready', 'true');
  await expect(lesson.locator('.step-explanation__measurements')).toHaveCount(0);
  await expect.poll(() => lesson.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const containers = ['.ss-construction__details', '.ss-construction__body'];
    return {
      overflowY: getComputedStyle(element).overflowY,
      hasVerticalOverflow: element.scrollHeight > element.clientHeight + 1,
      extendsBeyondContainer: containers.some((selector) => {
        const container = element.closest(selector);
        return container === null || bounds.bottom > container.getBoundingClientRect().bottom + 1;
      }),
    };
  }), { message: 'The complete lesson must fit its height and its surrounding layout without internal scrolling.' }).toEqual({
    overflowY: 'visible', hasVerticalOverflow: false, extendsBeyondContainer: false,
  });
}

export async function constructionHeight(construction: Locator): Promise<number> {
  return construction.evaluate(element => element.getBoundingClientRect().height);
}

export async function expectConstructionHeight(construction: Locator, expected: number) {
  await expect.poll(async () => Math.abs(await constructionHeight(construction) - expected), {
    message: 'Changing the step must preserve the space reserved for the complete construction.',
  }).toBeLessThanOrEqual(1);
}

/** Reuse one completed state across breakpoints, without replaying every animation. */
export async function expectGuideLessonsExpanded(page: Page, construction: Locator, locale: 'en' | 'es') {
  await page.clock.pauseAt(new Date('2026-01-01T00:10:00Z'));
  await page.evaluate(() => document.fonts.ready);
  const count = await construction.locator('.ss-step-count').innerText();
  const stepCount = Number(count.split('/')[1]);
  expect(stepCount).toBeGreaterThan(1);
  expect(stepCount).toBeLessThan(20);
  const next = construction.getByRole('button', { name: locale === 'es' ? 'Siguiente' : 'Next', exact: true });
  const heights = new Map<number, number>();
  for (let stage = 0; stage < stepCount; stage += 1) {
    if (stage > 0) {
      await next.press('Enter');
      await page.clock.fastForward(1_000);
      await expect(construction).toHaveAttribute('data-stage', String(stage));
      await expect(construction).toHaveAttribute('data-playing', 'false');
    }
    for (const viewport of [{ width: 1440, height: 900 }, { width: 850, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expectExpandedLesson(construction);
      if (stage === 0) heights.set(viewport.width, await constructionHeight(construction));
      else await expectConstructionHeight(construction, heights.get(viewport.width)!);
    }
  }
  await page.clock.resume();
}
