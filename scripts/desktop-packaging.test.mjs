import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import asar from '@electron/asar';
import { desktopIconFiles, desktopRuntimeFiles, stageDesktopApp } from './stage-desktop.mjs';
import { verifyDesktopArchive } from './verify-desktop-archive.mjs';
import { getSevenZipExecutable } from './desktop-tooling.mjs';

const beforeDesktopBuild = createRequire(import.meta.url)('./desktop-before-build.cjs');

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'emwaves-desktop-test-'));
  try {
    for (const relative of ['dist/index.html', 'dist/assets/main.js', 'dist/THIRD-PARTY-NOTICES.md', 'LICENSE', ...desktopIconFiles, ...desktopRuntimeFiles]) {
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await writeFile(path.join(root, relative), `Fixture contents: ${relative}\n`);
    }
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'emwaves', version: '0.1.1', license: 'GPL-3.0-only', dependencies: { react: '19.3.0' }, devDependencies: { electron: '44.7.1' }, scripts: { build: 'vite' }, build: { asar: true } }));
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

test('the build hook skips collection only for a dependency-free staging tree', async () => {
  await fixture(async (root) => {
    await assert.rejects(beforeDesktopBuild({ appDir: root }), /dependency-free/);
    const staged = await stageDesktopApp(root);
    assert.equal(await beforeDesktopBuild({ appDir: staged }), false);
    await mkdir(path.join(staged, 'node_modules'));
    await assert.rejects(beforeDesktopBuild({ appDir: staged }), /must not contain node_modules/);
  });
});
