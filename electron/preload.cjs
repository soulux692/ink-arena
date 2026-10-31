const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inkDesktop', {
  getPcProfile: () => ipcRenderer.invoke('startup:profile'),
  launch: () => ipcRenderer.invoke('startup:launch'),
  setDesktopTear: (active) => ipcRenderer.invoke('window:desktop-tear', Boolean(active)),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  importUpdateArchive: () => ipcRenderer.invoke('updates:import-archive'),
  onUpdateProgress: (callback) => ipcRenderer.on('updates:progress', (_event, data) => callback(data)),
  onUpdateStatus: (callback) => ipcRenderer.on('updates:status', (_event, data) => callback(data)),
  getLanRooms: () => ipcRenderer.invoke('lan:rooms'),
  hostLan: (code) => ipcRenderer.invoke('lan:host', code),
  joinLan: (code) => ipcRenderer.invoke('lan:join', code),
  sendLan: (data) => ipcRenderer.send('lan:send', data),
  leaveLan: () => ipcRenderer.invoke('lan:leave'),
  onLanEvent: (callback) => ipcRenderer.on('lan:event', (_event, data) => callback(data))
});
