const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { buildMap } = require('./build.cjs');
let window;
let controller;
const files = new Set();
function prefsPath() {
  return path.join(app.getPath('userData'), 'sdk.json');
}
app.whenReady().then(() => {
  window = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1000,
    minHeight: 700,
    title: 'Forge — Source Editor',
    backgroundColor: '#444444',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.loadFile(path.join(__dirname, '../dist/index.html'));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', e => e.preventDefault());
  window.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question',
      buttons: ['Keep editing', 'Close'],
      defaultId: 0,
      cancelId: 0,
      title: 'Close Forge?',
      message: 'Your project has changes since the last file save.',
      detail: 'A local recovery copy is saved automatically. Save a .forge file for a portable copy.'
    });
    if (choice === 1) {
      controller?.abort();
      event.preventDefault();
    }
  });
  window.on('closed', () => controller?.abort());
});
app.on('window-all-closed', () => app.quit());
ipcMain.handle('open', async () => {
  const result = await dialog.showOpenDialog(window, { filters: [{ name: 'Forge / Source maps', extensions: ['forge', 'vmf'] }], properties: ['openFile'] });
  if (result.canceled) return null;
  const file = result.filePaths[0];
  const stat = await fs.stat(file);
  if (stat.size > 32 * 1024 * 1024) throw Error('Map files are limited to 32 MB in this version.');
  return { name: path.basename(file), text: await fs.readFile(file, 'utf8') };
});
ipcMain.handle('save', async (_, { name, text, extension }) => {
  if (!['forge', 'vmf'].includes(extension) || typeof text !== 'string') throw Error('Invalid save request');
  const result = await dialog.showSaveDialog(window, {
    defaultPath: `${path.basename(name)}.${extension}`,
    filters: [{ name: extension === 'vmf' ? 'Valve Map Format' : 'Forge project', extensions: [extension] }]
  });
  if (result.canceled) return null;
  await fs.writeFile(result.filePath, text, 'utf8');
  files.add(result.filePath);
  return result.filePath;
});
ipcMain.handle('directory', async () => {
  const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('prefs-read', async () => {
  try {
    return JSON.parse(await fs.readFile(prefsPath(), 'utf8'));
  } catch {
    return {};
  }
});
ipcMain.handle('prefs-save', async (_, config) => {
  const clean = { binDir: String(config.binDir ?? ''), gameDir: String(config.gameDir ?? ''), fast: !!config.fast };
  await fs.writeFile(prefsPath(), JSON.stringify(clean), 'utf8');
  return clean;
});
ipcMain.handle('build', async (_, { config, vmf, name }) => {
  if (controller) throw Error('A build is already running');
  const result = await dialog.showSaveDialog(window, { defaultPath: `${path.basename(name)}.vmf`, filters: [{ name: 'Map build source', extensions: ['vmf'] }] });
  if (result.canceled) return null;
  controller = new AbortController();
  try {
    const bsp = await buildMap(
      config,
      vmf,
      result.filePath,
      s => {
        if (!window.isDestroyed()) window.webContents.send('build-log', s);
      },
      controller.signal
    );
    files.add(bsp);
    return bsp;
  } finally {
    controller = null;
  }
});
ipcMain.handle('build-cancel', () => controller?.abort());
ipcMain.handle('reveal', (_, file) => {
  if (files.has(file)) shell.showItemInFolder(file);
});
