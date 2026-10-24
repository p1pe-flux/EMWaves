import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
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
  /(^|\/)(\.DS_Store|\._[^/]+|Thumbs\.db|ehthumbs\.db|Desktop\.ini|\.Spotlight-V100|\.Trashes|\.fseventsd)(\/|$)/i,
  /\.(exe|msi|msix|msixbundle|appx|appxbundle|dmg|pkg|deb|rpm|appimage|zip|7z|tar|tgz|tar\.(gz|xz|bz2)|asar|blockmap)$/i,
  /\.app(\/|$)/i,
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

function containsLocalPath(text) {
  // Academic citations can contain /users/ in their public URL. File URLs and
  // ordinary local paths still undergo the check; documented Windows examples
  // use the synthetic account "me".
  const localText = text.replace(/https?:\/\/[^\s'"<>`]+/gi, '');
  return /(?:^|[^A-Za-z0-9_./-])\/(?:users|home|volumes|media|mnt)\/[^/\s'"<>`]+(?:\/|(?=[\s'"<>`]|$))/im.test(localText)
    || /(?:^|[^A-Za-z0-9_./-])\/root\//im.test(localText)
    || /[A-Za-z]:[\\/]+users[\\/]+(?!me(?:[\\/]|[\s'"<>`]|$))[^\\/\s'"<>`]+/i.test(localText)
    || /file:\/\/\/(?:users|home|root|volumes|media|mnt)\//i.test(localText);
}

function escapesRoot(file, target) {
  const portableTarget = target.replaceAll('\\', '/');
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), portableTarget));
  return path.posix.isAbsolute(portableTarget) || path.win32.isAbsolute(target)
    || relative === '..' || relative.startsWith('../');
}

function outsideRoot(root, absolute) {
  const relative = path.relative(root, absolute);
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

function grepIndex(root, args) {
  try {
    return git(root, ['grep', '--cached', '-I', '-l', '-z', ...args, '--']).split('\0').filter(Boolean);
  } catch (error) {
    if (error.status !== 1) throw error; // grep's 1 means no matches.
    return [];
  }
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

export function inspectPublicFiles(root) {
  root = realpathSync(root);
  const files = [...new Set(git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean))];
  const issues = [];
  const portableNames = new Map();
  for (const file of files) {
    // Check directory names too: A/one.ts and a/two.ts collide even though the
    // complete file names differ. NFC also covers macOS Unicode normalization.
    const segments = file.split('/');
    for (let length = 1; length <= segments.length; length++) {
      const name = segments.slice(0, length).join('/');
      const key = name.normalize('NFC').toLowerCase();
      const previous = portableNames.get(key);
      if (previous && previous !== name) {
        issues.push({ file, reason: `case-insensitive path collision with ${previous}` });
        break;
      }
      portableNames.set(key, name);
    }
    if (privatePaths.some(rule => rule.test(file))
      || (/(^|\/)\.env(?:\.[^/]+)?$/i.test(file) && !environmentExample.test(file))) {
      issues.push({ file, reason: 'private or generated path' });
    }
    const absolute = path.join(root, file);
    try {
      // Inspect links before reading content, including a directory replaced by
      // a link in a dirty working tree. Never read a linked external file.
      let linked = false;
      for (let length = 1; length <= segments.length; length++) {
        const relative = segments.slice(0, length).join('/');
        const current = path.join(root, relative);
        if (!lstatSync(current).isSymbolicLink()) continue;
        linked = true;
        const target = readlinkSync(current);
        let escapes = escapesRoot(relative, target);
        if (!escapes) {
          try {
            escapes = outsideRoot(root, realpathSync(current));
          } catch (error) {
            if (error.code !== 'ENOENT' && error.code !== 'ELOOP') throw error;
            // A dangling internal link has no external file to inspect. A
            // cycle cannot be resolved safely and must be corrected.
            escapes = error.code === 'ELOOP';
          }
        }
        if (escapes) {
          issues.push({ file, reason: 'absolute or escaping symlink in working tree' });
        }
        break;
      }
      if (linked) continue;
      const content = readFileSync(absolute);
      if (!content.includes(0)) {
        const text = content.toString('utf8');
        if (credentialRegex.test(text)) issues.push({ file, reason: 'credential signature in working tree' });
        if (containsLocalPath(text)) issues.push({ file, reason: 'absolute local path in working tree' });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  // A staged credential must fail even if the working copy was cleaned later.
  for (const file of grepIndex(root, ['-E', '-e', credentialExpression])) {
    issues.push({ file, reason: 'credential signature in Git index' });
  }
  const candidates = ['users', 'home', 'root', 'volumes', 'media', 'mnt'].map(folder => '/' + folder + '/');
  candidates.push('users\\');
  for (const file of grepIndex(root, ['-i', '-F', ...candidates.flatMap(value => ['-e', value])])) {
    if (containsLocalPath(git(root, ['cat-file', 'blob', `:${file}`]))) {
      issues.push({ file, reason: 'absolute local path in Git index' });
    }
  }
  for (const record of git(root, ['ls-files', '--stage', '-z']).split('\0').filter(Boolean)) {
    const separator = record.indexOf('\t');
    const metadata = record.slice(0, separator);
    const file = record.slice(separator + 1);
    const [mode, object] = metadata.split(' ');
    if (mode === '120000' && escapesRoot(file, git(root, ['cat-file', 'blob', object]))) {
      issues.push({ file, reason: 'absolute or escaping symlink in Git index' });
    }
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
