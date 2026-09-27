'use strict';
// Takes the two README screenshots against a throwaway fake drive in the temp folder:
//   npm run screenshots   (-> docs/screenshot-library.png, docs/screenshot-panel.png)
// Plain Node: builds the fixture, runs Electron on tools/shoot-app.js, then deletes the fixture
// (Electron keeps its data folder locked until it exits, so cleanup happens out here).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const electron = require('electron'); // in plain Node this is the path to the Electron binary
const { makeFixture, put } = require('../test/helpers');
const { saveConfig, defaultConfig } = require('../lib/config');

const fx = makeFixture();
try {
  put(fx.drive, 'PS2/Kingdom Hearts II (USA).iso', 48 * 1024 * 1024);
  put(fx.drive, 'PS2/Okami (USA).iso', 3 * 1024 * 1024);
  put(fx.drive, 'GC/Metroid Prime (USA).rvz', 2 * 1024 * 1024);
  put(fx.drive, 'N64/The Legend of Zelda - Ocarina of Time (USA) (Rev 2).z64', 900 * 1024);
  fs.mkdirSync(path.join(fx.local, 'PS2'), { recursive: true }); // Okami is already installed
  fs.copyFileSync(path.join(fx.drive, 'PS2/Okami (USA).iso'), path.join(fx.local, 'PS2/Okami (USA).iso'));
  saveConfig(fx.data, { ...defaultConfig(), driveRoot: fx.drive, localRoot: fx.local, uninstallToRecycleBin: false });
  const r = spawnSync(electron, [path.join(__dirname, 'shoot-app.js')], {
    stdio: 'inherit',
    timeout: 120000,
    env: { ...process.env, ROM_LOADER_FIXTURE: JSON.stringify(fx) },
  });
  process.exitCode = r.status === null ? 1 : r.status;
} finally {
  fs.rmSync(fx.base, { recursive: true, force: true });
}
