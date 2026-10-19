'use strict';

const { createRequire } = require('node:module');

const REDACTED = '[REDACTED]';
const INSTALLED = Symbol.for('emwaves.proxy-log-redaction');
const sensitiveKeys = new Set([
  'auth', 'authorization', 'proxyauthorization', 'cookie', 'cookies', 'setcookie',
  'username', 'password', 'passwd', 'passphrase', 'privatekey', 'pfx',
  'secret', 'clientsecret', 'token', 'accesstoken', 'refreshtoken', 'apikey', 'xapikey', 'xauthtoken',
]);
const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
const proxyKeys = new Set(['httpproxy', 'httpsproxy', 'allproxy', 'proxy', 'proxyurl']);

function redactText(value) {
  // Do not decode or rebuild the URL: malformed/percent-encoded userinfo must
  // also be hidden, while the original scheme, host, port and path stay useful.
  // The pinned proxy's legacy URL parser accepts backslash separators and
  // strips raw CR/LF inside userinfo. Match those forms before they reach logs.
  return value.replace(/\b([a-z][a-z\d+.-]*:[\\/]{2})[^\\/]*@/gi, '$1' + REDACTED + '@')
    .replace(/\b((?:proxy-)?authorization\s*[:=]\s*)(?:Basic|Bearer)\s+[^\s,;'"<>]+/gi, '$1' + REDACTED);
}

/** Sanitize copies of JSON log data, never live proxy/request/TLS objects. */
function redactLogRecord(record) {
  const ancestors = new WeakSet();
  function visit(value, path = []) {
    if (typeof value === 'string') return redactText(value);
    if (value === null || typeof value !== 'object') return value;
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    let output;
    if (Array.isArray(value)) {
      output = value.map((item) => visit(item, path));
    } else {
      output = {};
      for (const [key, child] of Object.entries(value)) {
        const name = normalizeKey(key);
        const sensitive = sensitiveKeys.has(name)
          || (name === 'key' && path.some((parent) => parent === 'tls' || parent === 'https'));
        const proxySetting = proxyKeys.has(name)
          || (name === 'value' && typeof value.name === 'string' && proxyKeys.has(normalizeKey(value.name)));
        let sanitized = sensitive && child !== null && child !== undefined ? REDACTED : visit(child, [...path, name]);
        if (proxySetting && typeof child === 'string' && child.includes('@')) {
          // Configuration is logged before validation: even a mistyped proxy
          // URL without a scheme can contain credentials. Keep its endpoint.
          const scheme = child.match(/^[a-z][a-z\d+.-]*:[\\/]{2}/i)?.[0] ?? '';
          sanitized = scheme + REDACTED + child.slice(child.lastIndexOf('@'));
        }
        // Define an own data property even for a literal JSON '__proto__' key.
        Object.defineProperty(output, key, {
          value: sanitized,
          enumerable: true, configurable: true, writable: true,
        });
      }
    }
    ancestors.delete(value);
    return output;
  }
  return visit(record);
}

/** Initialize the exact pinned logger before wrapping its serialized sink. */
function installProxyLogRedaction() {
  const fromBuilder = createRequire(require.resolve('app-builder-lib/package.json'));
  const fromDownloader = createRequire(fromBuilder.resolve('@electron/get'));
  const fromProxy = createRequire(fromDownloader.resolve('global-agent'));
  // Roarr initializes/replaces its global state on first import. Installing a
  // writer before that import would silently lose the guard.
  const priorWriter = globalThis.ROARR?.write;
  const { ROARR } = fromProxy('roarr');
  const writer = priorWriter ?? ROARR.write;
  if (writer?.[INSTALLED]) {
    ROARR.write = writer;
    return;
  }
  if (typeof writer !== 'function') throw new Error('The pinned proxy logger has no writable sink; update proxy-log-redaction.cjs.');
  function writeRedacted(body) {
    let sanitized;
    try {
      const record = JSON.parse(body);
      if (record === null || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('Expected a log record.');
      sanitized = JSON.stringify(redactLogRecord(record));
    } catch {
      // Keep a visible diagnostic on invalid records, never pass potentially
      // credential-bearing original text to the underlying writer.
      sanitized = JSON.stringify({ message: 'Proxy log record could not be decoded; sensitive content omitted.', context: { logLevel: 40 } });
    }
    return writer.call(this, sanitized);
  }
  Object.defineProperty(writeRedacted, INSTALLED, { value: true });
  ROARR.write = writeRedacted;
}

module.exports = { redactLogRecord, installProxyLogRedaction };
installProxyLogRedaction();
