import { expect, test } from '@playwright/test';

test('a competing primary pointer cannot take over the active Smith load drag', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('emwaves.locale', 'es'));
  await page.goto('/#/labs/introduction-to-smith-chart');
  const chart = page.locator('.smith-chart__svg');
  const resistance = page.getByRole('spinbutton', { name: 'Resistencia de la carga', exact: true });
  const reactance = page.getByRole('spinbutton', { name: 'Reactancia de la carga', exact: true });
  await expect(chart).toBeVisible();
  const points = await chart.evaluate(element => {
    const matrix = (element as SVGSVGElement).getScreenCTM()!;
    return [0.25, -0.25, 0, 0.5, -0.5].map(real => {
      const point = new DOMPoint(340 + 252 * real, 340).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
  });
  // A mouse and a touch contact can both be primary for their own pointer type.
  // Real input keeps browser pointer capture active throughout the overlap.
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await expect.poll(async () => Number(await resistance.inputValue())).toBeCloseTo(250 / 3, 3);
  const initial = [await resistance.inputValue(), await reactance.inputValue()];
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[1], id: 1 }] });
  await expect(resistance).toHaveValue(initial[0]);
  await expect(reactance).toHaveValue(initial[1]);
  await page.mouse.move(points[2].x, points[2].y);
  await expect.poll(async () => Number(await resistance.inputValue())).toBeCloseTo(50, 3);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.mouse.move(points[3].x, points[3].y);
  await expect.poll(async () => Number(await resistance.inputValue())).toBeCloseTo(150, 3);
  await page.mouse.up();

  // Once the owner releases, a new touch drag is accepted normally.
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[1], id: 2 }] });
  await expect.poll(async () => Number(await resistance.inputValue())).toBeCloseTo(30, 3);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...points[4], id: 2 }] });
  await expect.poll(async () => Number(await resistance.inputValue())).toBeCloseTo(50 / 3, 3);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(errors).toEqual([]);
});

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
