import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
