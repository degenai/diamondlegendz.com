'use strict';
// The whole bridge between the page and the main process. Nothing else is exposed.
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  getConfig: () => call('config:get'),
  setConfig: patch => call('config:set', patch),
  library: () => call('library:get'),
  scan: () => call('library:scan'),
  install: id => call('game:install', id),
  uninstall: id => call('game:uninstall', id),
  play: id => call('game:play', id),
  openFolder: id => call('game:openFolder', id),
  freeSpace: () => call('roots:freeSpace'),
  pickFolder: current => call('pick:folder', current),
  pickFile: current => call('pick:file', current),
  onProgress: cb => {
    const listener = (_e, p) => cb(p);
    ipcRenderer.on('progress', listener);
    return () => ipcRenderer.removeListener('progress', listener);
  },
});
