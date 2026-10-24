import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectPublicFiles } from './check-public-files.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'emwaves-public-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init', '--quiet');
  const write = (file, content = 'local fixture') => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  write('.gitignore', readFileSync(new URL('../.gitignore', import.meta.url)));
  git('add', '.gitignore');
  return { root, git, write };
}

function symlink(t, target, location, type = 'file') {
  try {
    symlinkSync(target, location, type);
    return true;
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'ENOTSUP') throw error;
    t.skip('This host does not permit filesystem symlinks; staged-link coverage still runs.');
    return false;
  }
}

test('keeps public source, tests, developer docs, media and placeholder environment examples', t => {
  const { root, git, write } = fixture(t);
  for (const file of ['src/App.tsx', 'src/domain/transmission.test.ts', 'scripts/audit-matching-models.mjs',
    'docs/architecture.md', 'docs/windows-distribution.md', 'docs/media/README.md',
    '.env.example', 'config/.env.development.example']) write(file, 'PUBLIC_URL=example.invalid');
  git('add', '.');
  assert.deepEqual(inspectPublicFiles(root).issues, []);
});

test('ignores private local material and rejects it even after a forced add', t => {
  const { root, git, write } = fixture(t);
  const files = ['AGENTS.md', 'src/AGENTS.local.md', '.local/reports/findings.md', '.local/.env.example',
    'docs/test-audit-2026-10-22.md', 'docs/performance-and-windows-validation.md',
    'internal/notes.md', '.env.local', 'config/.env', 'signing/release.p12',
    'test-results/browser/trace.zip', '.codex/session.json'];
  for (const file of files) write(file);
  for (const file of files) assert.ok(git('check-ignore', file).trim(), file);
  assert.deepEqual(inspectPublicFiles(root).issues, []);
  git('add', '--force', '--', ...files);
  assert.deepEqual(inspectPublicFiles(root).issues.map(issue => issue.file).sort(), files.sort());
});

test('finds credentials in an unignored file and never returns the secret value', t => {
  const { root, write } = fixture(t);
  const token = ['ghp', '_', 'a'.repeat(36)].join('');
  write('src/config.ts', `export const credential = '${token}';`);
  const result = inspectPublicFiles(root);
  assert.deepEqual(result.issues, [{ file: 'src/config.ts', reason: 'credential signature in working tree' }]);
  assert.equal(JSON.stringify(result).includes(token), false);
});

test('catches a credential staged in Git even after its working copy is cleaned', t => {
  const { root, git, write } = fixture(t);
  const key = ['-----BEGIN ', 'OPENSSH ', 'PRIVATE KEY-----'].join('');
  write('src/config.ts', key);
  git('add', 'src/config.ts');
  write('src/config.ts', 'export const publicSetting = true;');
  assert.deepEqual(inspectPublicFiles(root).issues, [
    { file: 'src/config.ts', reason: 'credential signature in Git index' },
  ]);
});

test('scans large untracked text and dirty working copies even with a clean index', t => {
  const { root, git, write } = fixture(t);
  const token = ['github', '_pat_', 'b'.repeat(60)].join('');
  const content = ' '.repeat(2 * 1024 * 1024) + token;
  write('large-source.ts', content);
  assert.deepEqual(inspectPublicFiles(root).issues, [
    { file: 'large-source.ts', reason: 'credential signature in working tree' },
  ]);
  write('large-source.ts', 'export const publicSetting = true;');
  git('add', 'large-source.ts');
  write('large-source.ts', content);
  assert.deepEqual(inspectPublicFiles(root).issues, [
    { file: 'large-source.ts', reason: 'credential signature in working tree' },
  ]);
});

test('rejects local home and mounted-volume paths without returning their values', t => {
  const { root, write } = fixture(t);
  const windows = ['C:', 'Users', 'fixture-account', 'project', 'file.ts'].join('\\');
  const examples = [
    ...['Users', 'home', 'Volumes', 'media', 'mnt'].map(folder => ['', folder, 'fixture-account', 'project'].join('/')),
    ['', 'root', 'project'].join('/'), windows, windows.replaceAll('\\', '\\\\'),
    ['C:', 'Users', 'fixture-account', 'project'].join('/'),
    'file://' + ['', 'Users', 'fixture-account', 'project'].join('/'),
  ];
  for (const localPath of examples) {
    write('src/config.ts', `const location = '${localPath}';`);
    const result = inspectPublicFiles(root);
    assert.deepEqual(result.issues, [{ file: 'src/config.ts', reason: 'absolute local path in working tree' }], localPath);
    assert.equal(JSON.stringify(result).includes(localPath), false);
  }
});

test('allows public academic URLs and documented synthetic Windows paths in both copies', t => {
  const { root, git, write } = fixture(t);
  const windowsExample = ['C:', 'Users', 'me', 'Downloads', 'EMWaves-Setup.exe'].join('\\');
  write('docs/setup.md', [
    'https://university.example/users/researcher/notes.html',
    'https://university.example/Users/researcher/notes.html',
    windowsExample, windowsExample.replaceAll('\\', '\\\\'),
  ].join('\n'));
  git('add', 'docs/setup.md');
  assert.deepEqual(inspectPublicFiles(root).issues, []);
});

test('checks staged local paths even after the working copy is cleaned or removed', t => {
  const { root, git, write } = fixture(t);
  for (const [name, localPath] of [
    ['unix.ts', ['', 'home', 'fixture-account', 'project'].join('/')],
    ['windows.ts', ['C:', 'Users', 'fixture-account', 'project'].join('\\')],
  ]) {
    write(name, localPath);
    git('add', name);
    write(name, 'export const publicSetting = true;');
  }
  rmSync(path.join(root, 'unix.ts'));
  assert.deepEqual(inspectPublicFiles(root).issues, [
    { file: 'unix.ts', reason: 'absolute local path in Git index' },
    { file: 'windows.ts', reason: 'absolute local path in Git index' },
  ]);
});

test('rejects OS metadata and misplaced release archives even after forced staging', t => {
  const { root, git, write } = fixture(t);
  const files = ['docs/.DS_Store', 'docs/._image.png', 'src/Thumbs.db', 'src/Desktop.ini',
    'docs/EMWaves-Setup.exe', 'downloads/EMWaves.dmg', 'src/desktop.AppImage',
    'docs/source.zip', 'docs/build.tar.gz', 'docs/app.asar', 'downloads/EMWaves.app/Contents/MacOS/EMWaves'];
  for (const file of files) write(file);
  git('add', '--force', '--', ...files);
  assert.deepEqual(inspectPublicFiles(root).issues.map(issue => issue.file).sort(), files.sort());
});

test('detects file, directory and Unicode path collisions independently of the host filesystem', t => {
  const { root, git, write } = fixture(t);
  git('config', 'core.precomposeunicode', 'false');
  write('source.ts', 'export const fixture = true;');
  const object = git('hash-object', '-w', 'source.ts').trim();
  for (const name of ['src/Chart.ts', 'src/chart.ts', 'Guides/one.md', 'guides/two.md', 'caf\u00e9/a.md', 'cafe\u0301/b.md']) {
    git('update-index', '--add', '--cacheinfo', `100644,${object},${name}`);
  }
  const issues = inspectPublicFiles(root).issues;
  assert.equal(issues.length, 3);
  assert.ok(issues.every(issue => issue.reason.startsWith('case-insensitive path collision with ')));
});

test('checks staged symlink targets even on hosts without filesystem symlink support', t => {
  const { root, git, write } = fixture(t);
  for (const [name, target] of [
    ['absolute-unix.txt', ['', 'external', 'fixture.txt'].join('/')],
    ['absolute-win.txt', ['D:', 'external', 'fixture.txt'].join('\\')],
    ['escaping.txt', ['..', '..', 'fixture.txt'].join('/')],
    ['internal.txt', 'docs/setup.md'],
  ]) {
    write('.local/target', target);
    const object = git('hash-object', '-w', '.local/target').trim();
    git('update-index', '--add', '--cacheinfo', `120000,${object},${name}`);
  }
  assert.deepEqual(inspectPublicFiles(root).issues, [
    { file: 'absolute-unix.txt', reason: 'absolute or escaping symlink in Git index' },
    { file: 'absolute-win.txt', reason: 'absolute or escaping symlink in Git index' },
    { file: 'escaping.txt', reason: 'absolute or escaping symlink in Git index' },
  ]);
});

test('rejects external symlinks without reading their contents, including staged links', t => {
  const { root, git, write } = fixture(t);
  const outside = mkdtempSync(path.join(os.tmpdir(), 'emwaves-external-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const token = ['ghp', '_', 'z'.repeat(36)].join('');
  writeFileSync(path.join(outside, 'secret.txt'), token);
  if (!symlink(t, path.join(outside, 'secret.txt'), path.join(root, 'absolute.txt'))) return;
  symlink(t, path.relative(root, path.join(outside, 'secret.txt')), path.join(root, 'escaping.txt'));
  write('public.txt', 'public fixture');
  symlink(t, 'public.txt', path.join(root, 'internal.txt'));
  git('config', 'core.symlinks', 'true');
  git('add', 'absolute.txt', 'escaping.txt', 'internal.txt', 'public.txt');
  const result = inspectPublicFiles(root);
  assert.deepEqual(result.issues, [
    { file: 'absolute.txt', reason: 'absolute or escaping symlink in working tree' },
    { file: 'escaping.txt', reason: 'absolute or escaping symlink in working tree' },
    { file: 'absolute.txt', reason: 'absolute or escaping symlink in Git index' },
    { file: 'escaping.txt', reason: 'absolute or escaping symlink in Git index' },
  ]);
  assert.equal(JSON.stringify(result).includes(token), false);
  assert.equal(JSON.stringify(result).includes(outside), false);
});

test('does not read through a tracked directory replaced by an external symlink', t => {
  const { root, git, write } = fixture(t);
  write('src/config.ts', 'public fixture');
  git('add', 'src/config.ts');
  rmSync(path.join(root, 'src'), { recursive: true });
  const outside = mkdtempSync(path.join(os.tmpdir(), 'emwaves-external-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(path.join(outside, 'config.ts'), ['ghp', '_', 'z'.repeat(36)].join(''));
  if (!symlink(t, outside, path.join(root, 'src'), 'dir')) return;
  const issues = inspectPublicFiles(root).issues;
  assert.ok(issues.some(issue => issue.file === 'src/config.ts' && issue.reason === 'absolute or escaping symlink in working tree'));
  assert.ok(issues.every(issue => !issue.reason.includes('credential')));
});
