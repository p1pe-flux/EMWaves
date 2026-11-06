import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import asar from '@electron/asar';
import { desktopIconFiles, desktopRuntimeFiles, stageDesktopApp } from './stage-desktop.mjs';
import { verifyDesktopArchive } from './verify-desktop-archive.mjs';
import { getSevenZipExecutable, retryToolDownload } from './desktop-tooling.mjs';

const require = createRequire(import.meta.url);
const beforeDesktopBuild = require('./desktop-before-build.cjs');
const execFileAsync = promisify(execFile);

async function fixture(run) {
  // Check staging and ASAR access in locations with spaces and Unicode, such as
  // ordinary user profile directories on Windows, macOS and Linux.
  const root = await mkdtemp(path.join(tmpdir(), 'emwaves desktop tést-'));
  try {
    for (const relative of ['dist/index.html', 'dist/assets/main.js', 'dist/THIRD-PARTY-NOTICES.md', 'LICENSE', ...desktopIconFiles, ...desktopRuntimeFiles]) {
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await writeFile(path.join(root, relative), `Fixture contents: ${relative}\n`);
    }
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'emwaves', version: '0.1.1', license: 'GPL-3.0-only', dependencies: { react: '19.3.0' }, devDependencies: { electron: '44.7.1' }, scripts: { build: 'vite' }, build: { asar: true, productName: 'EMWaves' } }));
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('staged desktop archives contain the compiled frontend, runtime and notices, without frontend installations', async () => {
  await fixture(async (root) => {
    const staged = await stageDesktopApp(root);
    const manifest = JSON.parse(await readFile(path.join(staged, 'package.json'), 'utf8'));
    assert.equal(manifest.version, '0.1.1');
    assert.equal(manifest.name, 'emwaves');
    assert.equal(manifest.productName, 'EMWaves');
    assert.equal(manifest.main, 'electron/main.cjs');
    assert.equal(manifest.dependencies, undefined);
    assert.equal(manifest.devDependencies, undefined);
    assert.equal(manifest.scripts, undefined);
    assert.equal(manifest.build, undefined);
    const archive = path.join(root, 'app.asar');
    await asar.createPackage(staged, archive);
    const result = await verifyDesktopArchive(archive, root);
    assert.equal(result.frontendFiles, 3);
    assert.equal(result.bundledNodeModules, 0);
    assert.equal(result.compiledFrontendVerified, true);
  });
});

test('archive verification rejects an incorrect application display name', async () => {
  await fixture(async (root) => {
    const staged = await stageDesktopApp(root);
    const manifestPath = path.join(staged, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await writeFile(manifestPath, JSON.stringify({ ...manifest, productName: 'Another application' }));
    const archive = path.join(root, 'incorrect-name.asar');
    await asar.createPackage(staged, archive);
    await assert.rejects(verifyDesktopArchive(archive, root), /metadata/);
  });
});

test('archive verification accepts Windows entry separators and still rejects bundled dependencies', async (context) => {
  await fixture(async (root) => {
    const staged = await stageDesktopApp(root);
    const archive = path.join(root, 'windows-paths.asar');
    await asar.createPackage(staged, archive);
    const listPackage = asar.listPackage;
    context.mock.method(asar, 'listPackage', (...args) => listPackage(...args).map((entry) => entry.replaceAll('/', '\\')));
    assert.equal((await verifyDesktopArchive(archive, root)).compiledFrontendVerified, true);
    await mkdir(path.join(staged, 'node_modules/react'), { recursive: true });
    await writeFile(path.join(staged, 'node_modules/react/index.js'), 'redundant frontend copy');
    const duplicateArchive = path.join(root, 'windows-dependencies.asar');
    await asar.createPackage(staged, duplicateArchive);
    await assert.rejects(verifyDesktopArchive(duplicateArchive, root), /Redundant node_modules/);
  });
});

test('staging requires license notices before removing an earlier staged build', async () => {
  await fixture(async (root) => {
    const staged = await stageDesktopApp(root);
    await writeFile(path.join(staged, 'previous-marker'), 'preserve');
    await rm(path.join(root, 'dist/THIRD-PARTY-NOTICES.md'));
    await assert.rejects(stageDesktopApp(root), /ENOENT/);
    assert.equal(await readFile(path.join(staged, 'previous-marker'), 'utf8'), 'preserve');
  });
});

test('archive verification rejects a stale compiled frontend and runtime', async () => {
  await fixture(async (root) => {
    const staged = await stageDesktopApp(root);
    const archive = path.join(root, 'app.asar');
    await asar.createPackage(staged, archive);
    await writeFile(path.join(root, 'dist/assets/main.js'), 'changed frontend');
    await assert.rejects(verifyDesktopArchive(archive, root), /differs.*dist\/assets\/main.js/);
    await writeFile(path.join(root, 'dist/assets/main.js'), 'Fixture contents: dist/assets/main.js\n');
    await writeFile(path.join(root, 'electron/main.cjs'), 'changed runtime');
    await assert.rejects(verifyDesktopArchive(archive, root), /differs.*electron\/main.cjs/);
  });
});

test('archive verification rejects a runtime dependency manifest and bundled node_modules', async () => {
  await fixture(async (root) => {
    const staged = await stageDesktopApp(root);
    const archive = path.join(root, 'app.asar');
    const manifest = JSON.parse(await readFile(path.join(staged, 'package.json'), 'utf8'));
    await writeFile(path.join(staged, 'package.json'), JSON.stringify({ ...manifest, dependencies: { react: '19.3.0' } }));
    await asar.createPackage(staged, archive);
    await assert.rejects(verifyDesktopArchive(archive, root), /must not install/);
    await writeFile(path.join(staged, 'package.json'), JSON.stringify(manifest));
    await mkdir(path.join(staged, 'node_modules/react'), { recursive: true });
    await writeFile(path.join(staged, 'node_modules/react/index.js'), 'redundant frontend copy');
    const duplicateArchive = path.join(root, 'duplicate.asar');
    await asar.createPackage(staged, duplicateArchive);
    await assert.rejects(verifyDesktopArchive(duplicateArchive, root), /Redundant node_modules/);
  });
});

test('archive verification rejects missing dependency notices', async () => {
  await fixture(async (root) => {
    const staged = await stageDesktopApp(root);
    await rm(path.join(staged, 'THIRD-PARTY-NOTICES.md'));
    const archive = path.join(root, 'app.asar');
    await asar.createPackage(staged, archive);
    await assert.rejects(verifyDesktopArchive(archive, root), /not found|does not exist/i);
  });
});

test('the isolated electron-builder adapter resolves an executable 7-Zip tool', async () => {
  await access(await getSevenZipExecutable(), constants.X_OK);
});

test('real pinned 7-Zip download recovers after HTTP 504s and verifies the downloaded executable', { timeout: 45000 }, async () => {
  const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win' : 'linux';
  const architecture = platform === 'darwin' && process.arch === 'x64' ? 'x86_64' : process.arch;
  const filename = `7zip-${platform}-${architecture}.tar.gz`;
  const cacheDirectory = require('app-builder-lib/out/util/electronGet.js').getCacheDirectory({ allowEnvVarOverride: true });
  // Use the actual upstream archive already acquired above or by CI's warmup.
  // The child has an empty cache and validates these real bytes against the
  // pinned builder's SHA-256 table before extracting and running the tool.
  await getSevenZipExecutable();
  const archive = await readFile(path.join(cacheDirectory, '7zip@1.0.0', filename));
  const temporary = await mkdtemp(path.join(tmpdir(), 'emwaves-7zip-download-'));
  let ready = false, failures = 0, successes = 0;
  const server = createServer((request, response) => {
    if (request.url === '/retry-ready') {
      ready = true;
      response.end('ready');
    } else if (request.url === `/7zip@1.0.0/${filename}`) {
      if (!ready) {
        failures++;
        response.writeHead(504, { 'retry-after': '0' });
        response.end('Transient gateway timeout');
      } else {
        successes++;
        response.end(archive);
      }
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const mirror = `http://127.0.0.1:${server.address().port}/`;
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:electron_|npm_config_electron_|npm_package_config_electron_|global_agent_|roarr_|https?_proxy$|all_proxy$|no_proxy$|node_options$)/i.test(key)));
  try {
    const script = String.raw`
      import assert from 'node:assert/strict';
      const { getSevenZipExecutable, retryToolDownload } = await import(process.argv[1]);
      let resolutions = 0;
      const executable = await retryToolDownload(() => {
        resolutions++;
        return getSevenZipExecutable();
      }, {
        wait: async () => {
          const response = await fetch(process.argv[2] + 'retry-ready');
          assert.equal(response.status, 200);
        },
        onRetry: () => {},
      });
      assert.equal(resolutions, 2);
      assert.ok(executable.startsWith(process.env.ELECTRON_BUILDER_CACHE));
      console.log('real-download-verified');
      // The pinned downloader leaves progress timers alive after failed
      // requests. All assertions and native verification have completed.
      process.exit(0);
    `;
    const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '-e', script, new URL('./desktop-tooling.mjs', import.meta.url).href, mirror], {
      timeout: 40000,
      env: { ...environment, ELECTRON_BUILDER_CACHE: temporary, ELECTRON_BUILDER_BINARIES_MIRROR: mirror,
        ELECTRON_BUILDER_BINARIES_ALLOW_HTTP: 'true', ELECTRON_GET_NO_PROGRESS: '1' },
    });
    assert.match(stdout, /real-download-verified/);
    assert.ok(failures >= 4, 'Exercise exhaustion of the pinned downloader retries before a new acquisition');
    assert.equal(successes, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(temporary, { recursive: true, force: true });
  }
});

test('tool acquisition recovers transient HTTP and nested socket failures with bounded backoff', async () => {
  const failures = [
    Object.assign(new Error('Gateway timeout'), { response: { statusCode: 504 } }),
    new Error('Download failed', { cause: Object.assign(new Error('Socket reset'), { code: 'ECONNRESET' }) }),
  ];
  let calls = 0;
  const delays = [], retries = [];
  const result = await retryToolDownload(async () => {
    if (calls++ < failures.length) throw failures[calls - 1];
    return 'verified-tool-path';
  }, { attempts: 3, wait: async (delay) => { delays.push(delay); }, onRetry: (...retry) => retries.push(retry) });
  assert.equal(result, 'verified-tool-path');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [2000, 4000]);
  assert.deepEqual(retries, [[2, 3], [3, 3]]);
});

test('tool acquisition preserves a persistent network failure after its final allowed attempt', async () => {
  const failure = Object.assign(new Error('Service unavailable'), { statusCode: 503 });
  let calls = 0;
  const delays = [];
  await assert.rejects(retryToolDownload(async () => { calls++; throw failure; }, {
    wait: async (delay) => { delays.push(delay); }, onRetry: () => {},
  }), error => error === failure);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [2000]);
});

test('tool acquisition does not retry integrity, authorization, missing-artifact or local filesystem errors', async () => {
  for (const failure of [
    new Error('SHA-256 checksum mismatch'),
    Object.assign(new Error('Unauthorized'), { response: { statusCode: 401 } }),
    Object.assign(new Error('Artifact not found'), { response: { statusCode: 404 } }),
    Object.assign(new Error('Missing file'), { code: 'ENOENT' }),
    Object.assign(new Error('Permission denied'), { code: 'EACCES' }),
    new Error('Unsupported platform'),
  ]) {
    let calls = 0;
    await assert.rejects(retryToolDownload(async () => { calls++; throw failure; }, {
      wait: async () => assert.fail('Permanent failures must not wait or retry'),
      onRetry: () => assert.fail('Permanent failures must not be retried'),
    }), error => error === failure);
    assert.equal(calls, 1);
  }
});

test('a resolved tool that cannot run fails immediately instead of retrying acquisition', async (context) => {
  let calls = 0;
  context.mock.method(require('app-builder-lib/out/toolsets/7zip.js'), 'getPath7za', async () => { calls++; return process.execPath; });
  // A readable native executable is insufficient: Node cannot answer 7-Zip's
  // information command, so the adapter must reject it after actual execution.
  await assert.rejects(getSevenZipExecutable());
  assert.equal(calls, 1);
});

test('the build hook skips collection only for a dependency-free staging tree', async () => {
  await fixture(async (root) => {
    await assert.rejects(beforeDesktopBuild({ appDir: root }), /dependency-free/);
    const staged = await stageDesktopApp(root);
    assert.equal(await beforeDesktopBuild({ appDir: staged }), false);
    await mkdir(path.join(staged, 'node_modules'));
    await assert.rejects(beforeDesktopBuild({ appDir: staged }), /must not contain node_modules/);
  });
});
