'use strict';
// Electron main process: owns the Library (all file work) and answers the renderer over IPC.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { Library } = require('./lib/library');

let win = null;
let lib = null;

// Every handler returns { ok: true, value } or { ok: false, error } so the renderer can show plain words.
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try { return { ok: true, value: await fn(event, ...args) }; }
    catch (err) { return { ok: false, error: err && err.message ? err.message : String(err) }; }
  });
}

// Adds a file:// URL for art that exists, so the renderer never needs to know the data folder.
function withArt(manifest) {
  const games = manifest.games.map(g => ({
    ...g,
    artUrl: g.art ? pathToFileURL(path.join(lib.dataDir, g.art)).href : null,
  }));
  return { ...manifest, games };
}

function gameOut(g) { return withArt({ games: [g] }).games[0]; }

function registerIpc() {
  handle('config:get', () => lib.getConfig());
  handle('config:set', (_e, patch) => lib.setConfig(patch));
  handle('library:get', () => withArt(lib.manifest));
  handle('library:scan', async () => withArt(await lib.scan()));
  handle('game:install', async (event, id) => {
    let last = 0;
    const g = await lib.install(id, p => {
      const now = Date.now();
      if (now - last < 80 && p.copied < p.total) return; // ~12 updates a second is plenty
      last = now;
      if (!event.sender.isDestroyed()) event.sender.send('progress', { id, copied: p.copied, total: p.total });
    });
    return gameOut(g);
  });
  handle('game:uninstall', async (_e, id) => gameOut(await lib.uninstall(id)));
  handle('game:play', (_e, id) => lib.play(id));
  handle('game:openFolder', async (_e, id) => {
    const dir = lib.folderOf(id);
    if (!fs.existsSync(dir)) throw new Error(`Folder not found: ${dir}`);
    const err = await shell.openPath(dir);
    if (err) throw new Error(err);
    return dir;
  });
  handle('roots:freeSpace', () => lib.freeSpace());
  handle('pick:folder', async (_e, current) => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: current || undefined });
    return r.canceled ? null : r.filePaths[0];
  });
  handle('pick:file', async (_e, current) => {
    const filters = process.platform === 'win32' ? [{ name: 'Programs', extensions: ['exe', 'bat', 'cmd'] }, { name: 'All files', extensions: ['*'] }] : [];
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], defaultPath: current || undefined, filters });
    return r.canceled ? null : r.filePaths[0];
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: '#15171c',
    title: 'ROM Loader',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

const ready = app.whenReady().then(() => {
  lib = new Library({
    dataDir: app.getPath('userData'),
    trash: shell.trashItem ? f => shell.trashItem(f) : null,
    copyDelayMs: Number(process.env.ROM_LOADER_COPY_DELAY_MS) || 0, // demo knob for screenshots; 0 in real use
  });
  registerIpc();
  return createWindow();
});

app.on('window-all-closed', () => app.quit());

module.exports = { ready, getLibrary: () => lib };
