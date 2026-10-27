const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

let mainWindow;
let splashWindow;
let normalBounds = null;
let desktopTearActive = false;

/* ------------------------------------------------------------------ updates */
// Everything the update flow reports goes through this single channel, so the
// in-game UI can show progress bars and download percentages instead of only
// native dialogs. Events are buffered until the game window is ready.
let pendingUpdateEvents = [];
function sendUpdate(payload) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('updates:progress', payload);
  } else {
    pendingUpdateEvents.push(payload);
    if (pendingUpdateEvents.length > 40) pendingUpdateEvents.shift();
  }
}
function flushPendingUpdateEvents() {
  const list = pendingUpdateEvents;
  pendingUpdateEvents = [];
  for (const p of list) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:progress', p);
  }
}

const RELEASES_API = 'https://api.github.com/repos/soulux692/ink-arena/releases';
function githubGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ink-arena-updater', Accept: 'application/vnd.github+json' } }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    }).on('error', reject);
  });
}
function parseVersion(v) {
  const m = String(v || '').match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}
function cmpVersion(a, b) {
  const pa = parseVersion(a), pb = parseVersion(b);
  for (let i = 0; i < 3; i++) { if (pa[i] !== pb[i]) return pa[i] - pb[i]; }
  return 0;
}
async function fetchLatestRelease(preferSetup) {
  const res = await githubGet(RELEASES_API + '?per_page=10');
  if (res.status !== 200) throw new Error('GitHub API ответил ' + res.status);
  const releases = JSON.parse(res.body);
  if (!Array.isArray(releases) || !releases.length) throw new Error('На GitHub пока нет ни одного релиза.');
  const usable = releases.filter((rel) => !rel.draft && Array.isArray(rel.assets) && rel.assets.length);
  if (!usable.length) throw new Error('В последнем релизе нет файлов для скачивания.');
  // newest release first — do not rely on GitHub's ordering
  usable.sort((a, b) => cmpVersion(b.tag_name, a.tag_name));
  for (const rel of usable) {
    const setupAsset = rel.assets.find((as) => /^InkArenaRemastered-Setup.*\.exe$/i.test(as.name))
      || rel.assets.find((as) => /\.exe$/i.test(as.name));
    const zipAsset = rel.assets.find((as) => /\.zip$/i.test(as.name));
    const asset = preferSetup ? (setupAsset || zipAsset) : (zipAsset || setupAsset);
    if (asset) {
      return {
        version: String(rel.tag_name).replace(/^v/i, ''),
        name: rel.name || rel.tag_name,
        body: String(rel.body || '').slice(0, 2000),
        url: asset.browser_download_url,
        fileName: asset.name,
        size: asset.size || 0,
        kind: /\.exe$/i.test(asset.name) ? 'setup' : 'zip',
      };
    }
  }
  throw new Error('В релизах не найдено установщика (.exe) или ZIP-архива.');
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const finishDownload = (u) => {
      https.get(u, { headers: { 'User-Agent': 'ink-arena-updater' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          finishDownload(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error('Сервер ответил ' + res.statusCode));
          return;
        }
        const total = Number(res.headers['content-length'] || 0);
        let done = 0;
        const out = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          done += chunk.length;
          if (onProgress && done % 65536 < chunk.length) onProgress(done, total);
        });
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve(done)));
        out.on('error', (e) => { try { fs.unlinkSync(dest); } catch {} reject(e); });
      }).on('error', (e) => { try { fs.unlinkSync(dest); } catch {} reject(e); });
    };
    finishDownload(url);
  });
}

async function runPowershell(script) {
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let err = '';
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err || 'Команда PowerShell завершилась с ошибкой.'))));
  });
}
const quotePS = (v) => "'" + String(v).replace(/'/g, "''") + "'";

function findSetupExe(dir, depth = 0) {
  if (depth > 6 || !fs.existsSync(dir)) return null;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isFile() && /^InkArenaRemastered-Setup.*\.exe$/i.test(item.name)) return full;
    if (item.isDirectory() && !['node_modules', '.git'].includes(item.name.toLowerCase())) {
      const found = findSetupExe(full, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
function findFileNamed(dir, filename, depth = 0) {
  if (depth > 5 || !fs.existsSync(dir)) return null;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isFile() && item.name.toLowerCase() === filename.toLowerCase()) return full;
    if (item.isDirectory() && !['node_modules', '.git'].includes(item.name.toLowerCase())) {
      const found = findFileNamed(full, filename, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function launchInstaller(setupPath) {
  try {
    spawn(setupPath, [], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    shell.openPath(setupPath);
  }
  setTimeout(() => app.quit(), 600);
}

// Shared logic for both update buttons: electron-updater first (fast, signed),
// direct download from GitHub Releases as a guaranteed fallback.
let updatingNow = false;
async function performOnlineUpdate() {
  if (updatingNow) return { ok: false, message: 'Обновление уже скачивается, подожди…' };
  updatingNow = true;
  try {
    if (app.isPackaged) {
      try {
        const info = await autoUpdater.checkForUpdates();
        if (info && info.updateInfo && typeof info.updateInfo.version === 'string'
          && cmpVersion(info.updateInfo.version, app.getVersion()) > 0) {
          sendUpdate({ stage: 'download', percent: 0, message: `autoUpdater: скачаю версию ${info.updateInfo.version}…` });
          autoUpdater.downloadUpdate().catch(() => {});
          return { ok: true, via: 'autoUpdater', message: `Скачиваю версию ${info.updateInfo.version}…` };
        }
      } catch { /* fall through to the GitHub Releases fallback */ }
    }
    sendUpdate({ stage: 'check', message: 'Ищу последний релиз на GitHub…' });
    const latest = await fetchLatestRelease(true);
    if (app.isPackaged && cmpVersion(latest.version, app.getVersion()) <= 0) {
      sendUpdate({ stage: 'idle', message: '' });
      return { ok: false, upToDate: true, message: `Уже установлена последняя версия ${app.getVersion()}.` };
    }
    const dir = path.join(app.getPath('downloads'), 'InkArenaUpdate');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, latest.fileName.replace(/[^\w.\-]/g, '_'));
    if (fs.existsSync(dest)) { try { fs.unlinkSync(dest); } catch {} }
    sendUpdate({ stage: 'download', percent: 0, message: `Скачаю ${latest.fileName} (${Math.round(latest.size / 1048576)} МБ)…` });
    await downloadFile(latest.url, dest, (done, total) => {
      const percent = total ? Math.min(100, Math.round((done / total) * 100)) : -1;
      sendUpdate({ stage: 'download', percent, message: `Скачано ${Math.round(done / 1048576)}${total ? ' из ' + Math.round(total / 1048576) : ''} МБ` });
    });
    if (latest.kind === 'setup') {
      sendUpdate({ stage: 'install', message: 'Запускаю установщик…' });
      launchInstaller(dest);
      return { ok: true, via: 'github', message: 'Установщик запущен — игра перезапустится обновлённой.' };
    }
    // ZIP archive: extract it and look for the installer inside
    const tempRoot = path.join(os.tmpdir(), 'InkArenaUpdate-' + Date.now());
    fs.mkdirSync(tempRoot, { recursive: true });
    sendUpdate({ stage: 'extract', message: 'Распаковываю архив обновления…' });
    await runPowershell(`Expand-Archive -LiteralPath ${quotePS(dest)} -DestinationPath ${quotePS(tempRoot)} -Force`);
    const setup = findSetupExe(tempRoot);
    if (setup) {
      sendUpdate({ stage: 'install', message: 'Установщик найден, запускаю…' });
      launchInstaller(setup);
      return { ok: true, via: 'github-zip', message: 'Установщик запущен — игра перезапустится обновлённой.' };
    }
    sendUpdate({ stage: 'ready', message: '' });
    return { ok: true, manual: true, message: `Архив версии ${latest.version} скачан в папку «Загрузки/InkArenaUpdate`. Открой его через «Обновить из файла…».` };
  } catch (error) {
    const msg = String(error?.message || error);
    sendUpdate({ stage: 'error', message: '' });
    return { ok: false, message: 'Не удалось получить обновление: ' + msg };
  } finally {
    updatingNow = false;
  }
}

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
    flushPendingUpdateEvents();
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
  // Manual "check for updates" from the settings screen. In packaged builds we
  // try electron-updater first, then fall back to a plain GitHub Releases probe
  // so the button always gives a real answer instead of silently doing nothing.
  if (!app.isPackaged) return { status: 'dev' };
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.updateInfo && cmpVersion(result.updateInfo.version, app.getVersion()) > 0) {
      return { status: 'available', version: result.updateInfo.version };
    }
  } catch { /* fall through to the GitHub fallback */ }
  try {
    const latest = await fetchLatestRelease(true);
    if (cmpVersion(latest.version, app.getVersion()) > 0) {
      return { status: 'available', version: latest.version, fileName: latest.fileName, url: latest.url, size: latest.size, kind: latest.kind };
    }
    return { status: 'up-to-date', version: app.getVersion() };
  } catch (error) {
    return { status: 'unavailable', message: String(error?.message || error) };
  }
});

ipcMain.handle('updates:start', async () => performOnlineUpdate());

// The in-game dialog also offers "download anyway", e.g. when the user trusts
// a release that reports the same version as the installed one.
ipcMain.handle('updates:force-download', async () => {
  if (updatingNow) return { ok: false, message: 'Обновление уже скачивается, подожди…' };
  updatingNow = true;
  try {
    sendUpdate({ stage: 'check', message: 'Ищу последний релиз на GitHub…' });
    const latest = await fetchLatestRelease(true);
    const dir = path.join(app.getPath('downloads'), 'InkArenaUpdate');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, latest.fileName.replace(/[^\w.\-]/g, '_'));
    if (fs.existsSync(dest)) { try { fs.unlinkSync(dest); } catch {} }
    sendUpdate({ stage: 'download', percent: 0, message: `Скачаю ${latest.fileName} (${Math.round(latest.size / 1048576)} МБ)…` });
    await downloadFile(latest.url, dest, (done, total) => {
      const percent = total ? Math.min(100, Math.round((done / total) * 100)) : -1;
      sendUpdate({ stage: 'download', percent, message: `Скачано ${Math.round(done / 1048576)}${total ? ' из ' + Math.round(total / 1048576) : ''} МБ` });
    });
    if (latest.kind === 'setup') {
      sendUpdate({ stage: 'install', message: 'Запускаю установщик…' });
      launchInstaller(dest);
      return { ok: true, via: 'github', message: 'Установщик запущен — игра перезапустится обновлённой.' };
    }
    const tempRoot = path.join(os.tmpdir(), 'InkArenaUpdate-' + Date.now());
    fs.mkdirSync(tempRoot, { recursive: true });
    sendUpdate({ stage: 'extract', message: 'Распаковываю архив обновления…' });
    await runPowershell(`Expand-Archive -LiteralPath ${quotePS(dest)} -DestinationPath ${quotePS(tempRoot)} -Force`);
    const setup = findSetupExe(tempRoot);
    if (setup) {
      sendUpdate({ stage: 'install', message: 'Установщик найден, запускаю…' });
      launchInstaller(setup);
      return { ok: true, via: 'github-zip', message: 'Установщик запущен — игра перезапустится обновлённой.' };
    }
    sendUpdate({ stage: 'ready', message: '' });
    return { ok: true, manual: true, message: `Архив версии ${latest.version} скачан в папку «Загрузки/InkArenaUpdate». Открой его через «Обновить из файла…».`, version: latest.version };
  } catch (error) {
    sendUpdate({ stage: 'error', message: '' });
    return { ok: false, message: 'Не удалось скачать обновление: ' + String(error?.message || error) };
  } finally {
    updatingNow = false;
  }
});

ipcMain.handle('updates:open-downloads', async () => {
  const dir = path.join(app.getPath('downloads'), 'InkArenaUpdate');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  shell.openPath(dir);
  return { ok: true };
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
  try {
    sendUpdate({ stage: 'extract', message: 'Читаю и проверяю ZIP-архив…' });
    fs.mkdirSync(tempRoot, { recursive: true });
    await runPowershell(`Expand-Archive -LiteralPath ${quotePS(archive)} -DestinationPath ${quotePS(tempRoot)} -Force`);
    const setup = findSetupExe(tempRoot);
    if (setup) {
      const answer = await dialog.showMessageBox(mainWindow, {
        type: 'info', buttons: ['Установить обновление', 'Отмена'], defaultId: 0, cancelId: 1,
        title: 'Архив проверен', message: 'В архиве найден установщик игры.',
        detail: 'Установщик обновит приложение поверх текущей установки. Игровые сохранения не должны удаляться.'
      });
      if (answer.response !== 0) return { ok: false, canceled: true };
      launchInstaller(setup);
      return { ok: true, message: 'Установщик запущен.' };
    }
    const bat = findFileNamed(tempRoot, 'BUILD_FOR_SHARING.bat') || findFileNamed(tempRoot, 'INSTALL_AND_BUILD.bat');
    const packageFile = findFileNamed(tempRoot, 'package.json');
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
    sendUpdate({ stage: 'build', message: 'Собираю установщик из архива…' });
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
    const builtSetup = findSetupExe(path.join(path.dirname(bat), 'release')) || findSetupExe(tempRoot);
    if (!builtSetup) return { ok: false, message: 'Сборка завершилась, но Setup.exe не найден в папке release.' };
    const install = await dialog.showMessageBox(mainWindow, {
      type: 'info', buttons: ['Установить и перезапустить', 'Позже'], defaultId: 0, cancelId: 1,
      title: 'Обновление готово', message: `Установщик версии ${version} готов.`,
      detail: 'После запуска установщика игра закроется. Завершите установку, чтобы обновить её.'
    });
    if (install.response === 0) {
      launchInstaller(builtSetup);
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
    autoUpdater.on('checking-for-update', () => sendUpdate({ stage: 'check', message: 'Проверяю обновления…' }));
    autoUpdater.on('update-available', async (info) => {
      sendUpdate({ stage: 'available', version: info.version, message: `Доступна версия ${info.version}` });
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
    autoUpdater.on('update-not-available', () => sendUpdate({ stage: 'idle', message: '' }));
    autoUpdater.on('download-progress', (p) => {
      sendUpdate({ stage: 'download', percent: Math.round(p.percent || 0), message: `Загружаю обновление… ${Math.round(p.percent || 0)}%` });
    });
    autoUpdater.on('error', (err) => {
      sendUpdate({ stage: 'error', message: String(err?.message || err) });
    });
    autoUpdater.on('update-downloaded', async (info) => {
      sendUpdate({ stage: 'ready', version: info?.version, message: '' });
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
