import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import asar from '@electron/asar';
import { desktopIconFiles, desktopManifest, desktopRuntimeFiles, projectRoot } from './stage-desktop.mjs';

// asar's filesystem lookup also splits directory names using the host's path
// separator. Canonical slash names are for comparisons; lookups use native paths.
export function readDesktopArchiveFile(archive, relative) {
  return asar.extractFile(archive, path.normalize(relative));
}

async function sourceFiles(folder, relative = '') {
  const files = [];
  for (const entry of await readdir(path.join(folder, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(folder, name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Unexpected symlink in compiled frontend: ${name}`);
  }
  return files.sort();
}

/** Verify what the installer actually contains, against this completed build. */
export async function verifyDesktopArchive(archive, root = projectRoot) {
  const config = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const packaged = JSON.parse(readDesktopArchiveFile(archive, 'package.json').toString());
  const manifest = desktopManifest(config);
  if (['name', 'productName', 'version', 'main'].some((field) => packaged[field] !== manifest[field])) {
    throw new Error('Unexpected packaged application metadata.');
  }
  if (Object.keys(packaged.dependencies ?? {}).length || Object.keys(packaged.devDependencies ?? {}).length) {
    throw new Error('The desktop runtime manifest must not install frontend or development dependencies.');
  }
  // asar uses the host's path separator when listing entries. Compare a stable
  // archive-relative form on Windows as well as Unix hosts.
  const entries = asar.listPackage(archive).map((name) => name.replaceAll('\\', '/').replace(/^\/+/, ''));
  if (entries.some((name) => name.split('/').includes('node_modules'))) {
    throw new Error('Redundant node_modules were included in the desktop archive.');
  }
  const frontend = await sourceFiles(path.join(root, 'dist'));
  const expected = new Set(['package.json', 'LICENSE', 'THIRD-PARTY-NOTICES.md', ...desktopRuntimeFiles, ...desktopIconFiles, ...frontend.map((name) => `dist/${name}`)]);
  const files = entries.filter((name) => !asar.statFile(archive, path.normalize(name)).files);
  for (const relative of files) {
    if (!expected.has(relative)) throw new Error(`Unexpected packaged application file: ${relative}`);
  }
  for (const relative of expected) {
    if (relative === 'package.json') continue;
    const source = relative === 'THIRD-PARTY-NOTICES.md' ? path.join(root, 'dist', relative) : path.join(root, relative);
    const original = await readFile(source);
    if (!readDesktopArchiveFile(archive, relative).equals(original)) throw new Error(`Packaged application differs from the current build: ${relative}`);
  }
  if (!readDesktopArchiveFile(archive, 'THIRD-PARTY-NOTICES.md').length) throw new Error('Missing frontend dependency notices.');
  return { version: packaged.version, frontendFiles: frontend.length, runtimeFiles: desktopRuntimeFiles.length, archiveFiles: files.length, archiveBytes: (await stat(archive)).size, bundledNodeModules: 0, compiledFrontendVerified: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/verify-desktop-archive.mjs path/to/app.asar');
  console.log(JSON.stringify(await verifyDesktopArchive(path.resolve(process.argv[2])), null, 2));
}
