'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeFixture, listTree } = require('./helpers');
const { Library, buildArgs } = require('../lib/library');
const { MANIFEST_FILE } = require('../lib/manifest');
const { notEnoughSpace, deleteLocal } = require('../lib/copy');

const PLENTY = async () => 1e12;
const YES = async () => true;

async function setup(opts = {}) {
  const fx = makeFixture();
  const lib = new Library({ dataDir: fx.data, freeSpace: PLENTY, ...opts });
  lib.setConfig({ driveRoot: fx.drive, localRoot: fx.local, uninstallToRecycleBin: false });
  await lib.scan();
  const find = t => lib.manifest.games.find(g => g.cleanTitle === t);
  return { fx, lib, find };
}

test('scan: states drive / installed / both, manifest on disk', async () => {
  const { fx, lib, find } = await setup();
  try {
    assert.equal(lib.manifest.games.length, 8);
    assert.equal(find('Metroid Fusion').state, 'both');
    assert.equal(find('Super Metroid').state, 'installed');
    assert.equal(find('Crash Bandicoot').state, 'drive');
    assert.ok(lib.manifest.games.every(g => g.available));
    const onDisk = JSON.parse(fs.readFileSync(path.join(fx.data, MANIFEST_FILE), 'utf8'));
    assert.equal(onDisk.games.length, 8);
    const g = onDisk.games.find(x => x.cleanTitle === 'Gran Turismo 4');
    for (const k of ['system', 'title', 'cleanTitle', 'hash', 'size', 'files', 'state', 'lastPlayed']) assert.ok(k in g, k);
    assert.match(g.hash, /^[0-9a-f]{40}$/);
    assert.equal(g.art, null);
  } finally { fx.cleanup(); }
});

test('rescan is idempotent (same games, ids, hashes)', async () => {
  const { fx, lib } = await setup();
  try {
    const strip = m => m.games.map(({ id, key, hash, state, size, files }) => ({ id, key, hash, state, size, files }));
    const first = strip(lib.manifest);
    await lib.scan();
    assert.deepEqual(strip(lib.manifest), first);
    const fresh = new Library({ dataDir: fx.data, freeSpace: PLENTY });
    await fresh.scan();
    assert.deepEqual(strip(fresh.manifest), first);
  } finally { fx.cleanup(); }
});

test('install copies every file of a .cue + .bin game with byte progress; drive untouched', async () => {
  const { fx, lib, find } = await setup();
  try {
    const driveBefore = listTree(fx.drive);
    const crash = find('Crash Bandicoot');
    const events = [];
    await lib.install(crash.id, p => events.push(p));
    for (const rel of crash.files) {
      assert.equal(fs.statSync(path.join(fx.local, rel)).size, fs.statSync(path.join(fx.drive, rel)).size, rel);
    }
    assert.ok(events.length >= 3);
    for (let i = 1; i < events.length; i++) assert.ok(events[i].copied >= events[i - 1].copied, 'progress never goes back');
    assert.equal(events.at(-1).copied, crash.size);
    assert.equal(events.at(-1).total, crash.size);
    assert.equal(find('Crash Bandicoot').state, 'both');
    assert.deepEqual(listTree(fx.drive), driveBefore);
    assert.ok(!Object.keys(listTree(fx.local)).some(f => f.endsWith('.part')));
    await lib.scan();
    assert.equal(find('Crash Bandicoot').state, 'both', 'rescan agrees');
  } finally { fx.cleanup(); }
});

test('uninstall removes only the local files and prunes empty folders; drive untouched', async () => {
  const { fx, lib, find } = await setup();
  try {
    const crash = find('Crash Bandicoot');
    await lib.install(crash.id);
    const driveBefore = listTree(fx.drive);
    await lib.uninstall(crash.id, { confirm: YES });
    assert.deepEqual(listTree(fx.drive), driveBefore);
    for (const rel of crash.files) assert.equal(fs.existsSync(path.join(fx.local, rel)), false, rel);
    assert.equal(fs.existsSync(path.join(fx.local, 'PS1')), false, 'empty folders pruned');
    assert.ok(fs.existsSync(path.join(fx.local, 'SNES/Super Metroid (USA).sfc')), 'other local games kept');
    assert.equal(find('Crash Bandicoot').state, 'drive');
    await lib.scan();
    assert.equal(find('Crash Bandicoot').state, 'drive');
  } finally { fx.cleanup(); }
});

test('uninstall uses the Recycle Bin hook when turned on', async () => {
  const trashed = [];
  const { fx, lib, find } = await setup({ trash: async f => { trashed.push(f); fs.rmSync(f); } });
  try {
    lib.setConfig({ uninstallToRecycleBin: true });
    await lib.uninstall(find('Metroid Fusion').id, { confirm: YES });
    assert.deepEqual(trashed, [path.join(fx.local, 'GBA/Metroid Fusion (USA).gba')]);
    assert.ok(fs.existsSync(path.join(fx.drive, 'GBA/Metroid Fusion (USA).gba')));
  } finally { fx.cleanup(); }
});

test('uninstall refuses a game that is only on the laptop; deletes refuse paths outside the local folder', async () => {
  const { fx, lib, find } = await setup();
  try {
    await assert.rejects(lib.uninstall(find('Super Metroid').id, { confirm: YES }), /only copy/);
    assert.ok(fs.existsSync(path.join(fx.local, 'SNES/Super Metroid (USA).sfc')));
    const onDrive = path.join(fx.drive, 'GBA/Metroid Fusion (USA).gba');
    await assert.rejects(deleteLocal(fx.local, [onDrive]), /refusing to delete outside/);
    await assert.rejects(deleteLocal(fx.local, [path.join(fx.local, '..', 'drive', 'GBA')]), /refusing/);
    assert.ok(fs.existsSync(onDrive));
  } finally { fx.cleanup(); }
});

test('missing drive: games stay in the manifest, drive-only ones unavailable; back when plugged in', async () => {
  const { fx, lib, find } = await setup();
  try {
    const unplugged = fx.drive + '-unplugged';
    fs.renameSync(fx.drive, unplugged);
    await lib.scan();
    assert.equal(lib.manifest.games.length, 8, 'nothing dropped');
    assert.equal(lib.manifest.roots.drive.online, false);
    assert.equal(find('Gran Turismo 4').available, false);
    assert.equal(find('Gran Turismo 4').state, 'drive');
    assert.equal(find('Metroid Fusion').available, true, 'installed games still play');
    assert.equal(find('Metroid Fusion').state, 'both');
    assert.equal(find('Super Metroid').available, true);
    await assert.rejects(lib.install(find('Gran Turismo 4').id), /drive is not connected/);
    fs.renameSync(unplugged, fx.drive);
    await lib.scan();
    assert.ok(lib.manifest.games.every(g => g.available));
  } finally { fx.cleanup(); }
});

test('install refuses when free space is short, in plain words, and writes nothing', async () => {
  const { fx, lib, find } = await setup({ freeSpace: async () => 1000 });
  try {
    const gt4 = find('Gran Turismo 4'); // 1 MB + 4 KB on the fake drive
    await assert.rejects(lib.install(gt4.id), { message: 'not enough space: needs 1.0 MB, 1000 B free' });
    assert.equal(fs.existsSync(path.join(fx.local, 'PS2')), false);
    assert.equal(find('Gran Turismo 4').state, 'drive');
    assert.equal(notEnoughSpace(4.2 * 1024 ** 3, 1.1 * 1024 ** 3), 'not enough space: needs 4.2 GB, 1.1 GB free');
  } finally { fx.cleanup(); }
});

test('play: spawn gets the emulator and the substituted args; nothing is launched', async () => {
  const calls = [];
  const fakeSpawn = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { on() {}, unref() {} }; };
  const { fx, lib, find } = await setup({ spawn: fakeSpawn });
  try {
    const gba = find('Metroid Fusion');
    assert.throws(() => lib.play(gba.id), /No emulator set for Game Boy Advance/);
    const emu = path.join(fx.base, 'emus', 'mgba.exe');
    fs.mkdirSync(path.dirname(emu)); fs.writeFileSync(emu, '');
    const systems = lib.getConfig().systems.map(s => s.id === 'gba' ? { ...s, emulator: { ...s.emulator, path: emu, args: '-f "{rom}"' } } : s);
    lib.setConfig({ systems });
    const r = lib.play(gba.id);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].cmd, emu);
    assert.deepEqual(calls[0].args, ['-f', path.join(fx.local, 'GBA/Metroid Fusion (USA).gba')]);
    assert.equal(calls[0].opts.detached, true);
    assert.ok(r.lastPlayed);
    const onDisk = JSON.parse(fs.readFileSync(path.join(fx.data, MANIFEST_FILE), 'utf8'));
    assert.equal(onDisk.games.find(g => g.id === gba.id).lastPlayed, r.lastPlayed);
  } finally { fx.cleanup(); }
});

test('play: drive-only games need "play from drive"; then the drive path is used', async () => {
  const calls = [];
  const { fx, lib, find } = await setup({ spawn: (cmd, args) => { calls.push(args); return {}; } });
  try {
    const emu = path.join(fx.base, 'pcsx2.exe');
    fs.writeFileSync(emu, '');
    lib.setConfig({ systems: lib.getConfig().systems.map(s => s.id === 'ps2' ? { ...s, emulator: { ...s.emulator, path: emu } } : s) });
    const gt4 = find('Gran Turismo 4');
    assert.throws(() => lib.play(gt4.id), /only on the drive/);
    lib.setConfig({ playFromDrive: true });
    lib.play(gt4.id);
    assert.deepEqual(calls[0], ['-batch', path.join(fx.drive, 'PS2/Gran Turismo 4 (USA) [!].iso')]);
  } finally { fx.cleanup(); }
});

test('buildArgs: quotes group, {rom} substituted, appended when missing', () => {
  assert.deepEqual(buildArgs('-b -e "{rom}"', 'C:/g/a b.iso'), ['-b', '-e', 'C:/g/a b.iso']);
  assert.deepEqual(buildArgs('--fullscreen', 'x.gba'), ['--fullscreen', 'x.gba']);
  assert.deepEqual(buildArgs('', 'x.gba'), ['x.gba']);
});

test('uninstall needs a confirmation: none refuses, "no" keeps the files, "yes" deletes; default is a real delete', async () => {
  const trashed = [];
  const { fx, lib, find } = await setup({ trash: async f => { trashed.push(f); fs.rmSync(f); } });
  try {
    const { defaultConfig } = require('../lib/config');
    assert.equal(defaultConfig().uninstallToRecycleBin, false);
    const gba = find('Metroid Fusion');
    const file = path.join(fx.local, 'GBA/Metroid Fusion (USA).gba');
    await assert.rejects(lib.uninstall(gba.id), /needs a confirmation/);
    assert.ok(fs.existsSync(file));
    let asked = null;
    assert.equal(await lib.uninstall(gba.id, { confirm: async g => { asked = g; return false; } }), null);
    assert.equal(asked.cleanTitle, 'Metroid Fusion');
    assert.equal(asked.size, 8000);
    assert.ok(fs.existsSync(file));
    assert.equal(find('Metroid Fusion').state, 'both');
    const g = await lib.uninstall(gba.id, { confirm: YES });
    assert.equal(g.state, 'drive');
    assert.equal(fs.existsSync(file), false);
    assert.deepEqual(trashed, [], 'deleted directly, not via the Recycle Bin');
  } finally { fx.cleanup(); }
});
