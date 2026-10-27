const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('inkDesktop', {
  getPcProfile: () => ipcRenderer.invoke('startup:profile'),
  launch: () => ipcRenderer.invoke('startup:launch'),
  setDesktopTear: (active) => ipcRenderer.invoke('window:desktop-tear', Boolean(active)),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  importUpdateArchive: () => ipcRenderer.invoke('updates:import-archive'),
  onUpdateProgress: (callback) => ipcRenderer.on('updates:progress', (_event, data) => callback(data))
});
