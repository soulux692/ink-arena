const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const os = require('os');
const registerLan = require('./lan.cjs');

let mainWindow;
let splashWindow;
let normalBounds = null;
let desktopTearActive = false;

registerLan(ipcMain, () => mainWindow, app);

function getPcProfile() {
  const totalRamGB = Math.round(os.totalmem() / (1024 ** 3));
  const cpuThreads = os.cpus()?.length || 2;
  // These are a lightweight capability estimate, not a benchmark.
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

ipcMain.handle('window:desktop-tear', (_event, active) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const { screen } = require('electron');
  if (active && !desktopTearActive) {
    normalBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(normalBounds);
    const area = display.workArea;
    // Keep the game rendering at its normal 16:10 size while the native window
    // exposes the right half of the desktop beside it.
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
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: result ? 'checked' : 'no-update' };
  } catch (error) {
    return { status: 'unavailable', message: String(error?.message || error) };
  }
});


// Importing ZIP archives and executing bundled BAT/PowerShell scripts is intentionally
// disabled. Updates must come from the signed/reviewed GitHub release channel.
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
  // Update checks are enabled for packaged builds once a publish provider is
  // configured in package.json (GitHub Releases or another electron-builder provider).
  if (app.isPackaged) {
    // Download updates from GitHub Releases automatically and install on restart.
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on('update-available', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updates:status', { stage: 'available', version: info.version });
      }
    });
    autoUpdater.on('download-progress', (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updates:status', {
          stage: 'downloading', percent: Math.round(progress.percent || 0)
        });
      }
    });
    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updates:status', { stage: 'installing', version: info.version });
      }
      // NSIS updater waits for the app to exit, then silently installs and relaunches it.
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 1200);
    });
    autoUpdater.on('error', (error) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updates:status', { stage: 'error', message: String(error?.message || error) });
      }
    });
    autoUpdater.checkForUpdates().catch(() => {});
  }
  createSplash();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createSplash();
  });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
