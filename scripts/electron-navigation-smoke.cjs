// Run with Electron, not Node. Exercise the real production entry and native
// navigation events without opening the user's browser or contacting a source.
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { mkdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, shell } = require('electron');
const { captureSmokePage } = require('./electron-smoke-capture.cjs');

// Keep locale/cache tests independent of the user's installed application data.
const profile = mkdtempSync(path.join(tmpdir(), 'emwaves-electron-smoke-'));
const outputDirectory = path.resolve(__dirname, '..', process.env.EMWAVES_SMOKE_OUTPUT_DIR ?? 'test-results/desktop-smoke');
app.setPath('userData', profile);
process.once('exit', () => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* The OS may still hold a cache file briefly. */ } });

const opened = [];
const originalOpenExternal = shell.openExternal;
shell.openExternal = async (url) => { opened.push(url); };
app.on('browser-window-created', (_event, window) => {
  // Xvfb needs a visible surface for Chromium's final frame capture. Keeping
  // the window hidden on Linux can reject capturePage with UnknownVizError.
  if (process.platform !== 'linux') window.hide();
});
require('../electron/main.cjs');

async function waitFor(condition, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${description}`);
}

app.whenReady().then(async () => {
  let stage = 'production frontend';
  try {
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all(['native-guide.png', 'failure.json'].map((name) => rm(path.join(outputDirectory, name), { force: true })));
    const window = BrowserWindow.getAllWindows()[0];
    assert.ok(window, 'Production main must create its window');
    const contents = window.webContents;
    await waitFor(() => contents.executeJavaScript('Boolean(document.querySelector(".main-nav"))'), 'production frontend');
    stage = 'renderer security and permissions';
    const preferences = contents.getLastWebPreferences();
    assert.equal(app.commandLine.hasSwitch('no-sandbox'), false, 'The native smoke must keep Chromium sandboxing enabled');
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.nodeIntegration, false);
    assert.equal(preferences.sandbox, true);
    const permissionStates = await contents.executeJavaScript(`Promise.all(
      ['geolocation', 'notifications', 'midi', 'camera', 'microphone', 'clipboard-read', 'clipboard-write']
        .map(async (name) => [name, (await navigator.permissions.query({ name })).state])
    )`);
    for (const [permission, state] of permissionStates) {
      assert.equal(state, 'denied', `${permission} must be denied by the production session`);
    }
    assert.equal(await contents.executeJavaScript('Notification.requestPermission()'), 'denied', 'Permission requests must also stay denied');
    stage = 'guide and language navigation';
    await contents.executeJavaScript('document.querySelector(".main-nav a[href*=guides]").click()');
    await waitFor(() => contents.executeJavaScript('Boolean(document.querySelector(\'.guide-index a[href="#/guides/introduction-to-smith-chart"]\'))'), 'guide index');
    assert.equal(await contents.executeJavaScript('document.querySelectorAll(".guide-index .guide-entry").length'), 6, 'All six guides must remain available');
    assert.equal(await contents.executeJavaScript('Boolean(document.querySelector("#app-language option[value=en]")) && Boolean(document.querySelector("#app-language option[value=es]"))'), true, 'Both interface languages must remain available');
    assert.equal(await contents.executeJavaScript('document.querySelector("#app-language").value'), 'en', 'A fresh profile defaults to English');
    await contents.executeJavaScript('(() => { const select = document.querySelector("#app-language"); select.value = "es"; select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(() => contents.executeJavaScript('document.documentElement.lang === "es"'), 'Spanish interface');
    assert.equal(await contents.executeJavaScript('document.querySelectorAll(".guide-index .guide-entry").length'), 6);
    await contents.executeJavaScript('(() => { const select = document.querySelector("#app-language"); select.value = "en"; select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(() => contents.executeJavaScript('document.documentElement.lang === "en"'), 'English interface');
    await contents.executeJavaScript('document.querySelector(\'.guide-index a[href="#/guides/introduction-to-smith-chart"]\').click()');
    await waitFor(() => contents.executeJavaScript('Boolean(document.querySelector("a[href^=\\"https://ethw.org/\\"]"))'), 'guide citation');
    stage = 'citation navigation';
    const guideUrl = contents.getURL();
    const firstCitation = await contents.executeJavaScript('document.querySelector("a[href^=\\"https://ethw.org/\\"]").href');
    await contents.executeJavaScript('document.querySelector("a[href^=\\"https://ethw.org/\\"]").click()');
    await waitFor(() => opened.length === 1, 'guide citation delegation');
    assert.equal(opened[0], firstCitation);
    assert.equal(contents.getURL(), guideUrl);

    // Cover target=_self and window.open independently of the Markdown renderer.
    await contents.executeJavaScript(`(() => { const a = document.createElement('a'); a.href = 'https://arxiv.org/pdf/1201.4068'; a.target = '_self'; document.body.append(a); a.click(); a.remove(); })()`);
    await waitFor(() => opened.length === 2, 'same-window citation delegation');
    await contents.executeJavaScript(`window.open('https://ximera.osu.edu/em/electromagnetics/waves/digInReflectionCoeff', '_blank')`);
    await waitFor(() => opened.length === 3, 'new-window citation delegation');
    await contents.executeJavaScript(`(() => { const a = document.createElement('a'); a.href = 'https://example.com/'; document.body.append(a); a.click(); a.remove(); window.open('file:///tmp/emwaves-blocked.html', '_blank'); })()`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(opened.length, 3, 'Unknown HTTPS hosts and file URLs stay blocked');
    assert.equal(contents.getURL(), guideUrl);
    assert.equal(BrowserWindow.getAllWindows().length, 1, 'No popup window is created');
    stage = 'native screenshot';
    console.log('[desktop smoke] Security, language and navigation assertions passed; capturing the visible frame.');
    await mkdir(outputDirectory, { recursive: true });
    const screenshot = path.join(outputDirectory, 'native-guide.png');
    const { image, viewport } = await captureSmokePage(window);
    await writeFile(screenshot, image.toPNG());
    console.log(JSON.stringify({ productionEntryLoaded: true, electron: process.versions.electron, platform: process.platform, architecture: process.arch, sandboxVerified: true, permissionChecksDenied: permissionStates.map(([permission]) => permission), permissionRequestDenied: true, guideCount: 6, defaultLocale: 'en', interfaceLanguages: ['en', 'es'], languageSwitchVerified: true, citationDelegations: opened.length, unknownNavigationBlocked: true, screenshot: path.relative(path.join(__dirname, '..'), screenshot), screenshotViewport: viewport, externalBrowserActuallyLaunched: false }, null, 2));
    app.exit(0);
  } catch (error) {
    console.error(`[desktop smoke] Failed during ${stage}:`, error);
    try {
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(path.join(outputDirectory, 'failure.json'), JSON.stringify({ stage, electron: process.versions.electron, platform: process.platform, architecture: process.arch, gpu: app.getGPUFeatureStatus(), error: { name: error?.name, message: error?.message, stack: error?.stack } }, null, 2) + '\n');
    } catch (diagnosticError) {
      console.error('[desktop smoke] Could not save failure diagnostics:', diagnosticError);
    }
    app.exit(1);
  } finally {
    shell.openExternal = originalOpenExternal;
  }
});
