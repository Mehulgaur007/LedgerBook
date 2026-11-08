// Pawn Ledger – the only bridge between the page and Windows. The page can read/write its own encrypted files and nothing else.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('PLHost', {
  platform: 'windows',
  id: () => ipcRenderer.invoke('pl:id'),
  get: n => ipcRenderer.invoke('pl:get', n),
  set: (n, t) => ipcRenderer.invoke('pl:set', n, t),
  del: n => ipcRenderer.invoke('pl:del', n),
  daily: t => ipcRenderer.invoke('pl:daily', t),
  erase: () => ipcRenderer.invoke('pl:erase'),
  uninstall: () => ipcRenderer.invoke('pl:uninstall'),
  log: m => ipcRenderer.send('pl:log', m)
});
