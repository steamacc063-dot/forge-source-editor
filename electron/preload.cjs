const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('forgeDesktop', {
  open: () => ipcRenderer.invoke('open'),
  save: data => ipcRenderer.invoke('save', data),
  directory: () => ipcRenderer.invoke('directory'),
  readPrefs: () => ipcRenderer.invoke('prefs-read'),
  savePrefs: config => ipcRenderer.invoke('prefs-save', config),
  build: data => ipcRenderer.invoke('build', data),
  cancelBuild: () => ipcRenderer.invoke('build-cancel'),
  reveal: file => ipcRenderer.invoke('reveal', file),
  onBuildLog: callback => {
    const listener = (_, text) => callback(text);
    ipcRenderer.on('build-log', listener);
    return () => ipcRenderer.removeListener('build-log', listener);
  }
});
