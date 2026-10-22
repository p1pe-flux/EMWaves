import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Inspect Git's index as well as the working tree: ignore rules cannot protect
// an already tracked file or prevent someone using `git add --force`.
const privatePaths = [
  /(^|\/)(AGENTS(?:\.[^/]+)?\.md|CLAUDE\.md|GEMINI\.md)$/i,
  /(^|\/)(\.local|private|internal|audits|audit-[^/]+|\.codex|\.claude|\.cursor|\.idea|\.vscode)\//i,
  /(^|\/)(node_modules|dist|release|\.desktop|test-results|playwright-report|blob-report|coverage|\.venv)(\/|$)/i,
  /^docs\/[^/]*audit[^/]*\.md$/i,
  /^docs\/performance-and-windows-validation\.md$/i,
  /(^|\/)(\.npmrc|credentials\.json|service-account[^/]*\.json|id_rsa[^/]*|id_ed25519[^/]*)$/i,
  /\.(key|pem|p12|pfx|mobileprovision|tsbuildinfo|log|bak)$/i,
  /\.private\./i,
];
const environmentExample = /(^|\/)\.env(?:\.[^/]+)?\.example$/i;

// Deliberately narrow credential signatures avoid flagging ordinary prose,
// parameter names, or the fake passwords used in the proxy regression tests.
const credentialPatterns = [
  '-----BEGIN (RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----',
  'gh[pousr]_[A-Za-z0-9]{36,255}',
  'github_pat_[A-Za-z0-9_]{50,255}',
  '(AKIA|ASIA)[A-Z0-9]{16}',
  'AIza[A-Za-z0-9_-]{35}',
  'xox[baprs]-[A-Za-z0-9-]{20,255}',
];
const credentialExpression = credentialPatterns.join('|');
const credentialRegex = new RegExp(credentialExpression);

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

export function inspectPublicFiles(root) {
  const files = [...new Set(git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean))];
  const issues = [];
  for (const file of files) {
    if (privatePaths.some(rule => rule.test(file))
      || (/(^|\/)\.env(?:\.[^/]+)?$/i.test(file) && !environmentExample.test(file))) {
      issues.push({ file, reason: 'private or generated path' });
    }
    const absolute = path.join(root, file);
    try {
      const content = readFileSync(absolute);
      if (!content.includes(0) && credentialRegex.test(content.toString('utf8'))) {
        issues.push({ file, reason: 'credential signature in working tree' });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  // A staged credential must fail even if the working copy was cleaned later.
  let stagedMatches = '';
  try {
    stagedMatches = git(root, ['grep', '--cached', '-I', '-l', '-z', '-E', '-e', credentialExpression, '--']);
  } catch (error) {
    if (error.status !== 1) throw error; // grep's 1 means no matches.
  }
  for (const file of stagedMatches.split('\0').filter(Boolean)) {
    issues.push({ file, reason: 'credential signature in Git index' });
  }
  return { checked: files.length, issues };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { checked, issues } = inspectPublicFiles(root);
  if (issues.length) {
    console.error('Public repository check failed (file names only; credential values are suppressed):');
    for (const { file, reason } of issues) console.error(`- ${JSON.stringify(file)}: ${reason}`);
    process.exitCode = 1;
  } else {
    console.log(`Public repository check passed: ${checked} tracked or unignored files.`);
  }
}
