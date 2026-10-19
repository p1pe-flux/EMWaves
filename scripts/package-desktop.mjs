import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot, stageDesktopApp } from './stage-desktop.mjs';
import { readFile } from 'node:fs/promises';
import { verifyDesktopArchive } from './verify-desktop-archive.mjs';

const require = createRequire(import.meta.url);

export async function packageDesktop(platform, architecture, outputDirectory, unpacked = false) {
  const supported = { win: ['arm64', 'x64'], mac: ['arm64', 'x64', 'universal'], linux: ['arm64', 'x64'] };
  if (!supported[platform]?.includes(architecture)) throw new Error('Expected win|mac|linux and a supported architecture (arm64, x64, or mac universal).');
  const stagedApp = await stageDesktopApp();
  const target = unpacked ? 'dir' : { win: 'nsis', mac: 'dmg', linux: 'AppImage' }[platform];
  const args = ['--require', path.join(projectRoot, 'scripts/proxy-log-redaction.cjs'), require.resolve('electron-builder/cli.js'), `--${platform}`, target, `--${architecture}`, '--publish', 'never', `--config.directories.app=${stagedApp}`, '--config.npmRebuild=true', `--config.beforeBuild=${path.join(projectRoot, 'scripts/desktop-before-build.cjs')}`];
  if (outputDirectory) args.push(`--config.directories.output=${path.resolve(projectRoot, outputDirectory)}`);
  // Preserve the single-stream BCJ workaround for ARM64 NSIS payloads.
  // Nsis7z cannot decode 7-Zip's automatically selected ARM64 filter.
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: platform === 'win' ? { ...process.env, ELECTRON_BUILDER_7Z_FILTER: 'BCJ' } : process.env,
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Desktop packaging terminated by ${result.signal}`);
  if (result.status !== 0) throw new Error(`Desktop packaging failed with exit code ${result.status ?? 1}`);
  const config = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const output = path.resolve(projectRoot, outputDirectory ?? config.build.directories.output);
  const folder = platform === 'mac' ? `mac${architecture === 'x64' ? '' : `-${architecture}`}` : `${platform === 'win' ? 'win' : 'linux'}${architecture === 'x64' ? '' : `-${architecture}`}-unpacked`;
  const archive = platform === 'mac'
    ? path.join(output, folder, `${config.build.productName}.app/Contents/Resources/app.asar`)
    : path.join(output, folder, 'resources/app.asar');
  console.log(JSON.stringify({ archive: path.relative(projectRoot, archive), ...await verifyDesktopArchive(archive) }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const unpacked = args.includes('--dir');
  const [platform, architecture = platform === 'mac' ? 'universal' : 'x64', outputDirectory] = args.filter((arg) => arg !== '--dir');
  await packageDesktop(platform, architecture, outputDirectory, unpacked);
}
