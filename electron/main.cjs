const { app, BrowserWindow, session, shell } = require('electron');
const path = require('node:path');
const { installExternalNavigation } = require('./external-navigation.cjs');

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 860,
    minHeight: 650,
    backgroundColor: '#f5f4ef',
    title: `EMWaves ${app.getVersion()}`,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  installExternalNavigation(window.webContents, (url) => shell.openExternal(url));
  window.loadFile(path.join(__dirname, '../dist/index.html')).catch((error) => {
    console.error('Could not load EMWaves:', error);
    app.exit(1);
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('org.emwaves.lab');
  // Electron checks some permissions before requesting them; deny both paths.
  // The bundled laboratories need no device, location or clipboard API access.
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
