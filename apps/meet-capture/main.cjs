const { app, BrowserWindow, session, shell } = require('electron');
const path = require('path');

const CAPTURE_URL =
  process.env.ETHOLYS_CAPTURE_URL || 'https://app.etholys.com/hub/meet/capture';

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: 'Etholys Meet Capture',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Permissões de media / display-capture para a app Etholys
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allow = [
      'media',
      'display-capture',
      'mediaKeySystem',
      'clipboard-sanitized-write',
    ].includes(permission);
    callback(allow);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  void win.loadURL(CAPTURE_URL);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
