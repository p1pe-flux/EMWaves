const assert = require('node:assert/strict');

// A loaded DOM is not proof that a hidden native window has a composited frame.
// Show the real production window without taking focus, then wait for its fonts
// and two animation frames before requesting the mandatory screenshot.
const paintReadySource = `
  (async () => {
    if (document.visibilityState !== 'visible') {
      await new Promise((resolve) => {
        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            resolve();
          }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        onVisibilityChange();
      });
    }
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      deviceScaleFactor: window.devicePixelRatio,
      visibilityState: document.visibilityState,
    };
  })()
`;

async function withinDeadline(operation, timeoutMs, description) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${description}`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function captureSmokePage(window, { timeoutMs = 15000 } = {}) {
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0, 'Screenshot timeout must be positive');
  const deadline = Date.now() + timeoutMs;
  window.showInactive();
  const viewport = await withinDeadline(window.webContents.executeJavaScript(paintReadySource), timeoutMs, 'visible desktop page, fonts and paint frames');
  assert.equal(viewport.visibilityState, 'visible', 'Desktop page must remain visible for capture');
  assert.ok(viewport.width > 0 && viewport.height > 0, 'Desktop viewport must have positive dimensions');
  assert.ok(Number.isFinite(viewport.deviceScaleFactor) && viewport.deviceScaleFactor > 0, 'Desktop display scale must be positive');
  const image = await withinDeadline(window.webContents.capturePage(), Math.max(1, deadline - Date.now()), 'desktop screenshot capture');
  assert.equal(image.isEmpty(), false, 'Desktop screenshot must not be empty');
  // capturePage captures at the renderer's native density. Request that image
  // representation explicitly and compare physical pixels, including Retina
  // scaling and fractional-scale rounding, rather than assuming a 1x image.
  const size = image.getSize(viewport.deviceScaleFactor);
  const width = Math.ceil(viewport.width * viewport.deviceScaleFactor);
  const height = Math.ceil(viewport.height * viewport.deviceScaleFactor);
  assert.ok(size.width > 0 && size.height > 0, 'Desktop screenshot must have positive dimensions');
  assert.ok(Math.abs(size.width - width) <= 1 && Math.abs(size.height - height) <= 1,
    `Desktop screenshot ${size.width}x${size.height} must cover content viewport ${width}x${height} physical pixels`);
  return { image, viewport };
}

module.exports = { captureSmokePage };
