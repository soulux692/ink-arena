const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;
let splashWindow;
let normalBounds = null;
let desktopTearActive = false;

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


ipcMain.handle('updates:import-archive', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, message: 'Окно игры недоступно.' };
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите ZIP-архив обновления',
    properties: ['openFile'],
    filters: [{ name: 'ZIP-архив', extensions: ['zip'] }]
  });
  if (picked.canceled || !picked.filePaths[0]) return { ok: false, canceled: true };
  const archive = picked.filePaths[0];
  const tempRoot = path.join(os.tmpdir(), 'InkArenaUpdate-' + Date.now());
  const quotePS = (v) => "'" + String(v).replace(/'/g, "''") + "'";
  try {
    mainWindow.webContents.send('updates:progress', { stage: 'extract', message: 'Читаю и проверяю ZIP-архив…' });
    fs.mkdirSync(tempRoot, { recursive: true });
    const ps = `Expand-Archive -LiteralPath ${quotePS(archive)} -DestinationPath ${quotePS(tempRoot)} -Force`;
    await new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true });
      let err = '';
      child.stderr.on('data', d => err += d.toString());
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(err || 'Не удалось распаковать архив.')));
    });
    const findFile = (dir, filename, depth = 0) => {
      if (depth > 5) return null;
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isFile() && item.name.toLowerCase() === filename.toLowerCase()) return full;
        if (item.isDirectory() && !['node_modules', '.git'].includes(item.name.toLowerCase())) {
          const found = findFile(full, filename, depth + 1);
          if (found) return found;
        }
      }
      return null;
    };
    const setup = (() => {
      const search = (dir, depth = 0) => {
        if (depth > 6 || !fs.existsSync(dir)) return null;
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, item.name);
          if (item.isFile() && /^InkArenaRemastered-Setup.*\.exe$/i.test(item.name)) return full;
          if (item.isDirectory() && !['node_modules', '.git'].includes(item.name.toLowerCase())) {
            const found = search(full, depth + 1); if (found) return found;
          }
        }
        return null;
      };
      return search(tempRoot);
    })();
    if (setup) {
      const answer = await dialog.showMessageBox(mainWindow, {
        type: 'info', buttons: ['Установить обновление', 'Отмена'], defaultId: 0, cancelId: 1,
        title: 'Архив проверен', message: 'В архиве найден установщик игры.',
        detail: 'Установщик обновит приложение поверх текущей установки. Игровые сохранения не должны удаляться.'
      });
      if (answer.response !== 0) return { ok: false, canceled: true };
      spawn(setup, [], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => app.quit(), 500);
      return { ok: true, message: 'Установщик запущен.' };
    }
    const bat = findFile(tempRoot, 'BUILD_FOR_SHARING.bat') || findFile(tempRoot, 'INSTALL_AND_BUILD.bat');
    const packageFile = findFile(tempRoot, 'package.json');
    if (!bat || !packageFile) {
      return { ok: false, message: 'В архиве не найден Setup.exe и не найдены файлы проекта (BAT + package.json).' };
    }
    let version = 'неизвестна';
    try { version = JSON.parse(fs.readFileSync(packageFile, 'utf8')).version || version; } catch {}
    const answer = await dialog.showMessageBox(mainWindow, {
      type: 'info', buttons: ['Собрать установщик', 'Отмена'], defaultId: 0, cancelId: 1,
      title: 'Архив проекта найден', message: `Версия проекта в архиве: ${version}`,
      detail: 'Для сборки нужны Node.js LTS и интернет для загрузки npm-зависимостей. После сборки будет запущен Setup.exe, который обновит игру.'
    });
    if (answer.response !== 0) return { ok: false, canceled: true };
    mainWindow.webContents.send('updates:progress', { stage: 'build', message: 'Собираю установщик из архива…' });
    const result = await new Promise((resolve) => {
      const child = spawn('cmd.exe', ['/d', '/s', '/c', `"${bat}" < nul`], {
        cwd: path.dirname(bat), windowsHide: true
      });
      let output = '';
      child.stdout.on('data', d => output += d.toString());
      child.stderr.on('data', d => output += d.toString());
      child.on('error', e => resolve({ code: -1, output: String(e) }));
      child.on('close', code => resolve({ code, output }));
    });
    if (result.code !== 0) {
      return { ok: false, message: 'Не удалось собрать установщик. Проверьте, установлен ли Node.js LTS и доступен ли интернет. ' + result.output.slice(-900) };
    }
    const builtSetup = (() => {
      const search = (dir, depth = 0) => {
        if (depth > 5 || !fs.existsSync(dir)) return null;
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, item.name);
          if (item.isFile() && /^InkArenaRemastered-Setup.*\.exe$/i.test(item.name)) return full;
          if (item.isDirectory() && !['node_modules', '.git'].includes(item.name.toLowerCase())) {
            const found = search(full, depth + 1); if (found) return found;
          }
        }
        return null;
      };
      return search(path.join(path.dirname(bat), 'release')) || search(tempRoot);
    })();
    if (!builtSetup) return { ok: false, message: 'Сборка завершилась, но Setup.exe не найден в папке release.' };
    const install = await dialog.showMessageBox(mainWindow, {
      type: 'info', buttons: ['Установить и перезапустить', 'Позже'], defaultId: 0, cancelId: 1,
      title: 'Обновление готово', message: `Установщик версии ${version} готов.`,
      detail: 'После запуска установщика игра закроется. Завершите установку, чтобы обновить её.'
    });
    if (install.response === 0) {
      spawn(builtSetup, [], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => app.quit(), 500);
      return { ok: true, message: 'Установщик запущен.' };
    }
    return { ok: true, message: 'Установщик создан в папке release.' };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  } finally {
    // Leave extracted files if a build script was involved, because release/Setup may be needed.
  }
});

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
    autoUpdater.autoDownload = false;
    autoUpdater.on('update-available', async (info) => {
      const answer = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Скачать обновление', 'Позже'],
        defaultId: 0,
        cancelId: 1,
        title: 'Доступно обновление',
        message: `Доступна новая версия Ink Arena Remastered: ${info.version}`,
        detail: 'Игра загрузит обновление и предложит перезапуститься для установки.'
      });
      if (answer.response === 0) autoUpdater.downloadUpdate().catch(() => {});
    });
    autoUpdater.on('update-downloaded', async () => {
      const answer = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Перезапустить и установить', 'Позже'],
        defaultId: 0,
        cancelId: 1,
        title: 'Обновление готово',
        message: 'Обновление скачано.',
        detail: 'Сохраните прогресс, если нужно, и перезапустите игру для установки.'
      });
      if (answer.response === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.checkForUpdates().catch(() => {});
  }
  createSplash();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createSplash();
  });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
