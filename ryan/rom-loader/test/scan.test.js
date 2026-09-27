'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeFixture } = require('./helpers');
const { scanRoot, cleanTitle } = require('../lib/scan');
const { defaultSystems } = require('../lib/systems');
const { loadConfig, CONFIG_FILE } = require('../lib/config');

test('config: defaults written on first run, emulator paths blank, edits kept', () => {
  const fx = makeFixture();
  try {
    const cfg = loadConfig(fx.data);
    assert.ok(fs.existsSync(path.join(fx.data, CONFIG_FILE)));
    assert.deepEqual(cfg.systems.map(s => s.id), ['ps2', 'ps1', 'gc', 'n64', 'snes', 'genesis', 'gba', 'nds', 'dc']);
    assert.ok(cfg.systems.every(s => s.emulator.path === ''));
    assert.deepEqual(cfg.systems.find(s => s.id === 'ps2').extensions, ['.iso', '.bin', '.chd', '.cso']);
    const saved = JSON.parse(fs.readFileSync(path.join(fx.data, CONFIG_FILE), 'utf8'));
    saved.systems = saved.systems.filter(s => s.id !== 'nds');
    saved.systems[0].emulator.path = 'C:/Emu/pcsx2.exe';
    fs.writeFileSync(path.join(fx.data, CONFIG_FILE), JSON.stringify(saved));
    const again = loadConfig(fx.data);
    assert.equal(again.systems.find(s => s.id === 'ps2').emulator.path, 'C:/Emu/pcsx2.exe');
    assert.ok(again.systems.find(s => s.id === 'nds'), 'a missing default system is merged back');
  } finally { fx.cleanup(); }
});

test('cleanTitle strips bracket and paren tags but keeps them', () => {
  assert.deepEqual(cleanTitle('Gran Turismo 4 (USA) [!]'), { cleanTitle: 'Gran Turismo 4', tags: '(USA) [!]' });
  assert.deepEqual(cleanTitle('Tetris'), { cleanTitle: 'Tetris', tags: '' });
});

test('scan: games by system folder, multi-file games grouped under their sheet', async () => {
  const fx = makeFixture();
  try {
    const r = await scanRoot(fx.drive, defaultSystems());
    assert.equal(r.online, true);
    const games = [...r.games.values()];
    const byTitle = Object.fromEntries(games.map(g => [g.cleanTitle, g]));
    assert.deepEqual(Object.keys(byTitle).sort(), [
      'Crash Bandicoot', 'Crazy Taxi', 'Final Fantasy VII', 'Gran Turismo 4', 'Metroid Fusion',
      'Shadow of the Colossus', 'Sonic the Hedgehog',
    ]);
    const crash = byTitle['Crash Bandicoot'];
    assert.equal(crash.system, 'ps1');
    assert.equal(crash.primary, 'PS1/Crash Bandicoot (USA)/Crash Bandicoot (USA).cue');
    assert.equal(crash.files.length, 3, 'cue + 2 bins');
    assert.equal(crash.size, fs.statSync(path.join(fx.drive, crash.primary)).size + 70000 + 30000);
    const ff7 = byTitle['Final Fantasy VII'];
    assert.ok(ff7.primary.endsWith('.m3u'));
    assert.equal(ff7.files.length, 5, 'm3u + 2 cues + 2 bins');
    const taxi = byTitle['Crazy Taxi'];
    assert.equal(taxi.system, 'dc');
    assert.equal(taxi.files.length, 4, 'gdi + 3 tracks, one with a space in its name');
    assert.equal(byTitle['Sonic the Hedgehog'].system, 'genesis');
    assert.equal(byTitle['Gran Turismo 4'].title, 'Gran Turismo 4 (USA) [!]');
    assert.equal(byTitle['Gran Turismo 4'].tags, '(USA) [!]');
  } finally { fx.cleanup(); }
});

test('scan: a missing root is offline with no games, not an error', async () => {
  const r = await scanRoot(path.join(__dirname, 'no-such-drive-xyz'), defaultSystems());
  assert.equal(r.online, false);
  assert.equal(r.games.size, 0);
  const blank = await scanRoot('', defaultSystems());
  assert.equal(blank.online, false);
});
