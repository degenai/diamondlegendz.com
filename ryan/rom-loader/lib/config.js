'use strict';
const fs = require('fs');
const path = require('path');
const { defaultSystems } = require('./systems');

const CONFIG_FILE = 'config.json';

function defaultConfig() {
  return {
    driveRoot: '',          // the external drive (source); never written to
    localRoot: '',          // the laptop folder where installed games live
    playFromDrive: false,   // allow Play on games that are only on the drive
    uninstallToRecycleBin: true, // true: uninstall sends the local copy to the Recycle Bin (space frees when emptied)
    systems: defaultSystems(),
  };
}

// Reads config.json from dataDir, writing the defaults on first run. Systems added to the
// defaults later are merged in; systems Ryan edited keep his values.
function loadConfig(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, CONFIG_FILE);
  const defaults = defaultConfig();
  if (!fs.existsSync(file)) {
    saveConfig(dataDir, defaults);
    return defaults;
  }
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`config.json is not valid JSON (${err.message}). Fix it or delete it to get the defaults back: ${file}`);
  }
  const cfg = { ...defaults, ...saved };
  const have = new Set((cfg.systems || []).map(s => s.id));
  cfg.systems = (cfg.systems || []).concat(defaults.systems.filter(s => !have.has(s.id)));
  return cfg;
}

function saveConfig(dataDir, cfg) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, CONFIG_FILE);
  const tmp = file + '.part';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, file);
  return cfg;
}

module.exports = { CONFIG_FILE, defaultConfig, loadConfig, saveConfig };
