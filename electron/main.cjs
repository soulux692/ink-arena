const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const os = require('os');
const registerLan = require('./lan.cjs');

let mainWindow;
let splashWindow;
let normalBounds = null;
let desktopTearActive = false;
let updateCheckStarted = false;

registerLan(ipcMain, () => mainWindow, app);

function getPcProfile() {
  const totalRamGB = Math.round(os.totalmem() / (1024 ** 3));
  const cpuThreads = os.cpus()?.length || 2;
  const tier = (totalRamGB >= 16 && cpuThreads >= 8) ? 'high'
    : (totalRamGB >= 8 && cpuThreads >= 4) ? 'medium' : 'low';
  return {
    platform: process.platform,
    arch: process.arch,
    cpuThreads,
    totalRamGB,
    tier,
    recommended: tier === 'high'
      ? { effects: 'high', particles: 'high', resolutionScale: 1 }
      : tier === 'medium'
      ? { effects: 'medium', particles: 'medium', resolutionScale: 0.9 }
      : { effects: 'low', particles: 'low', resolutionScale: 0.75 }
  };
}

function sendUpdateStatus(payload) {
  for (const win of [splashWindow, mainWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send('updates:status', payload);
  }
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 720, height: 440, frame: false, resizable: false,
    show: false, backgroundColor: '#111111',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

function createGame() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    show: false, backgroundColor: '#111111',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.show();
  });
}

function configureUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ stage: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ stage: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus({ stage: 'not-available', version: info.version });
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
      stage: 'downloading',
      percent: Math.max(0, Math.min(100, Math.round(progress.percent || 0))),
      transferred: progress.transferred,
      total: progress.total
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ stage: 'installing', version: info.version, percent: 100 });
    // The downloaded installer is applied only after the updater confirms completion.
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 1100);
  });
  autoUpdater.on('error', (error) => {
    sendUpdateStatus({ stage: 'error', message: String(error?.message || error) });
  });
}

ipcMain.handle('window:desktop-tear', (_event, active) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const { screen } = require('electron');
  if (active && !desktopTearActive) {
    normalBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(normalBounds);
    const area = display.workArea;
    const visibleWidth = Math.max(520, Math.floor(normalBounds.width / 2));
    mainWindow.setBounds({
      x: area.x,
      y: Math.max(area.y, Math.min(normalBounds.y, area.y + area.height - normalBounds.height)),
      width: visibleWidth,
      height: normalBounds.height
    });
    desktopTearActive = true;
  } else if (!active && desktopTearActive) {
    if (normalBounds) mainWindow.setBounds(normalBounds);
    desktopTearActive = false;
    normalBounds = null;
  }
  return true;
});

ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged) return { status: 'dev' };
  if (updateCheckStarted) return { status: 'checking' };
  updateCheckStarted = true;
  try {
    await autoUpdater.checkForUpdates();
    return { status: 'checking' };
  } catch (error) {
    updateCheckStarted = false;
    const message = String(error?.message || error);
    sendUpdateStatus({ stage: 'error', message });
    return { status: 'unavailable', message };
  }
});

// Importing ZIP archives and executing bundled BAT/PowerShell scripts remains disabled.
ipcMain.handle('updates:import-archive', async () => ({
  ok: false,
  message: 'Импорт ZIP-архивов отключён в целях безопасности. Используйте обновление через GitHub Releases.'
}));

ipcMain.handle('startup:profile', () => getPcProfile());
ipcMain.handle('startup:launch', () => {
  createGame();
  return true;
});
ipcMain.handle('app:open-external', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});

app.whenReady().then(() => {
  configureUpdater();
  createSplash();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createSplash();
  });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
