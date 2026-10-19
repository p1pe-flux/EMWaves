// Only the HTTPS sources cited by the bundled guides may leave the app.
// Add a host deliberately when adding a new source in either language.
const CITATION_HOSTS = new Set([
  'ethw.org', 'maths.dur.ac.uk', 'arxiv.org', 'ximera.osu.edu',
  'www.mathworks.com', 'web.ece.ucsb.edu', 'courses.ece.vt.edu', 'www.waves.utoronto.ca',
]);

function externalCitationUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !CITATION_HOSTS.has(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function installExternalNavigation(webContents, openExternal, reportError = console.error) {
  function openCitation(value) {
    const url = externalCitationUrl(value);
    if (url === null) return;
    // A failed browser launch must not become an unhandled rejection in main.
    Promise.resolve().then(() => openExternal(url)).catch((error) => reportError('Could not open citation:', error));
  }

  webContents.setWindowOpenHandler(({ url }) => {
    openCitation(url);
    return { action: 'deny' };
  });
  webContents.on('will-frame-navigate', (event) => {
    event.preventDefault();
    if (event.isMainFrame) openCitation(event.url);
  });
}

module.exports = { externalCitationUrl, installExternalNavigation };
