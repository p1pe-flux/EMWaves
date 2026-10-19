import { expect, test } from '@playwright/test';

test('a second touch cannot move or interrupt the active transmission-line pointer', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'es'));
  await page.goto('/#/labs/introduction-to-smith-chart');
  const line = page.locator('.transmission-line-diagram');
  const position = line.getByRole('slider');
  await expect(position).toHaveAttribute('aria-valuenow', '0');
  const points = await line.evaluate(element => {
    const matrix = (element as SVGSVGElement).getScreenCTM()!;
    return [0.25, 0.75, 0.5].map(distance => {
      const point = new DOMPoint(480 - 370 * distance, 80).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
  });
  // Send real simultaneous touch contacts, so browser pointer capture and each
  // contact's primary status behave exactly as on a touch screen.
  const touch = await page.context().newCDPSession(page);
  const first = { ...points[0], id: 1 };
  const second = { ...points[1], id: 2 };
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await expect.poll(async () => Number(await position.getAttribute('aria-valuenow'))).toBeCloseTo(0.25, 5);
  const initial = (await position.getAttribute('aria-valuenow'))!;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
  await expect(position).toHaveAttribute('aria-valuenow', initial);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [second] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...points[2], id: 1 }] });
  await expect.poll(async () => Number(await position.getAttribute('aria-valuenow'))).toBeCloseTo(0.5, 5);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(errors).toEqual([]);
});
