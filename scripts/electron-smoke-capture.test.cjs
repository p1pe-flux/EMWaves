const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const { captureSmokePage } = require('./electron-smoke-capture.cjs');

function fixture({ visibleOnShow = true, deviceScaleFactor = 1, empty = false, size = { width: Math.ceil(1440 * deviceScaleFactor), height: Math.ceil(952 * deviceScaleFactor) }, captureError } = {}) {
  const calls = [];
  const visibilityListeners = new Set();
  const frames = [];
  let visible = false;
  let shown = false;
  let fontsLoaded = false;
  let paintedFrames = 0;
  let resolveFonts;
  const document = {
    get visibilityState() { return visible ? 'visible' : 'hidden'; },
    fonts: { ready: new Promise((resolve) => { resolveFonts = resolve; }) },
    addEventListener(name, listener) {
      assert.equal(name, 'visibilitychange');
      visibilityListeners.add(listener);
    },
    removeEventListener(name, listener) {
      assert.equal(name, 'visibilitychange');
      visibilityListeners.delete(listener);
    },
  };
  const image = {
    isEmpty: () => empty,
    getSize(scaleFactor) { assert.equal(scaleFactor, deviceScaleFactor, 'Compare the native-density image representation in physical pixels'); return size; },
  };
  const window = {
    showInactive() {
      calls.push('showInactive');
      shown = true;
      if (visibleOnShow) setVisible();
    },
    webContents: {
      executeJavaScript(source) {
        calls.push('waitForPaint');
        return runInNewContext(source, {
          document,
          window: { innerWidth: 1440, innerHeight: 952, devicePixelRatio: deviceScaleFactor },
          requestAnimationFrame(callback) { frames.push(callback); },
        });
      },
      async capturePage() {
        calls.push('capturePage');
        // This models the original bug: querying a loaded DOM still succeeds,
        // but capturing a hidden/unpainted native surface rejects.
        assert.ok(shown && visible && fontsLoaded && paintedFrames >= 2, 'UnknownVizError: native surface was not painted');
        if (captureError) throw captureError;
        return image;
      },
    },
  };
  function setVisible() {
    visible = true;
    for (const listener of visibilityListeners) listener();
  }
  function loadFonts() {
    fontsLoaded = true;
    resolveFonts();
  }
  async function paintFrame() {
    await new Promise((resolve) => setImmediate(resolve));
    const callbacks = frames.splice(0);
    assert.equal(callbacks.length, 1, 'Exactly one next animation frame should be pending');
    paintedFrames += 1;
    for (const callback of callbacks) callback();
    await new Promise((resolve) => setImmediate(resolve));
  }
  async function paintReady() {
    loadFonts();
    await paintFrame();
    await paintFrame();
  }
  return { window, image, calls, frames, visibilityListeners, setVisible, loadFonts, paintFrame, paintReady };
}

test('capture shows a hidden native surface and waits for font loading and both paint frames', async () => {
  const page = fixture();
  const captured = captureSmokePage(page.window);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(page.calls, ['showInactive', 'waitForPaint']);
  assert.equal(page.frames.length, 0, 'Do not request paint frames before fonts are ready');
  page.loadFonts();
  await page.paintFrame();
  assert.equal(page.calls.includes('capturePage'), false, 'One paint frame is not sufficient');
  await page.paintFrame();
  const result = await captured;
  assert.equal(result.image, page.image);
  assert.deepEqual({ ...result.viewport }, { width: 1440, height: 952, deviceScaleFactor: 1, visibilityState: 'visible' });
  assert.deepEqual(page.calls, ['showInactive', 'waitForPaint', 'capturePage']);
});

test('capture waits for the renderer visibility transition before requesting paint frames', async () => {
  const page = fixture({ visibleOnShow: false });
  const captured = captureSmokePage(page.window);
  page.loadFonts();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.frames.length, 0);
  assert.equal(page.visibilityListeners.size, 1);
  page.setVisible();
  await page.paintFrame();
  await page.paintFrame();
  await captured;
  assert.equal(page.visibilityListeners.size, 0);
});

test('capture compares physical pixels at the native density on a Retina display', async () => {
  const page = fixture({ deviceScaleFactor: 2, size: { width: 2880, height: 1904 } });
  const captured = captureSmokePage(page.window);
  await page.paintReady();
  assert.equal((await captured).viewport.deviceScaleFactor, 2);
});

test('capture accounts for fractional display scaling and pixel rounding', async () => {
  const page = fixture({ deviceScaleFactor: 1.3333333, size: { width: 1920, height: 1270 } });
  const captured = captureSmokePage(page.window);
  await page.paintReady();
  await captured;
});

test('empty captures and incorrect capture dimensions fail the smoke check', async () => {
  for (const options of [
    { empty: true },
    { size: { width: 0, height: 0 } },
    { size: { width: 720, height: 476 } },
    { deviceScaleFactor: 2, size: { width: 1440, height: 952 } },
    { deviceScaleFactor: 1, size: { width: 2880, height: 1904 } },
  ]) {
    const page = fixture(options);
    const failed = assert.rejects(captureSmokePage(page.window), /must not be empty|positive dimensions|must cover content viewport/);
    await page.paintReady();
    await failed;
    assert.equal(page.calls.filter((call) => call === 'capturePage').length, 1);
  }
});

test('a page that stays hidden times out without attempting capture', async () => {
  const page = fixture({ visibleOnShow: false });
  await assert.rejects(captureSmokePage(page.window, { timeoutMs: 25 }), /Timed out: visible desktop page, fonts and paint frames/);
  assert.equal(page.calls.includes('capturePage'), false);
});

test('paint readiness and compositor errors propagate without retries or fallback', async () => {
  const rendererError = new Error('Renderer exited');
  const brokenRenderer = fixture();
  brokenRenderer.window.webContents.executeJavaScript = async () => { throw rendererError; };
  await assert.rejects(captureSmokePage(brokenRenderer.window), (error) => error === rendererError);
  assert.equal(brokenRenderer.calls.includes('capturePage'), false);

  const captureError = new Error('UnknownVizError');
  const page = fixture({ captureError });
  const failed = assert.rejects(captureSmokePage(page.window), (error) => error === captureError);
  await page.paintReady();
  await failed;
  assert.equal(page.calls.filter((call) => call === 'capturePage').length, 1);
});

test('a stalled compositor capture times out and remains a failed smoke check', async () => {
  const page = fixture();
  page.window.webContents.capturePage = () => new Promise(() => {});
  const failed = assert.rejects(captureSmokePage(page.window, { timeoutMs: 100 }), /Timed out: desktop screenshot capture/);
  await page.paintReady();
  await failed;
});
