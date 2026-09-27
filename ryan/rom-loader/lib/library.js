'use strict';
// The one object main.js talks to: config + manifest + scan/install/uninstall/play.
// Side effects (spawn, trash, free space) are injectable so tests never launch or delete for real.
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { loadConfig, saveConfig } = require('./config');
const { scanRoot } = require('./scan');
const { loadManifest, saveManifest, mergeScan, refresh } = require('./manifest');
const copy = require('./copy');

// '-b -e "{rom}"' -> ['-b', '-e', '<rom path>']. Double quotes group; {rom} is substituted per argument.
function buildArgs(template, romPath) {
  const tokens = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(template || '"{rom}"'))) tokens.push(m[1] !== undefined ? m[1] : m[2]);
  if (!tokens.some(t => t.includes('{rom}'))) tokens.push('{rom}');
  return tokens.map(t => t.split('{rom}').join(romPath));
}

class Library {
  constructor({ dataDir, spawn = childProcess.spawn, trash = null, freeSpace = copy.freeSpace, copyDelayMs = 0 }) {
    this.dataDir = dataDir;
    this.spawn = spawn;
    this.trash = trash;
    this.freeSpaceFn = freeSpace;
    this.copyDelayMs = copyDelayMs;
    this.cfg = loadConfig(dataDir);
    this.manifest = loadManifest(dataDir);
    this.busy = new Set();
  }

  getConfig() { return this.cfg; }

  setConfig(patch) {
    this.cfg = saveConfig(this.dataDir, { ...this.cfg, ...patch });
    return this.cfg;
  }

  checkRoots() {
    const { driveRoot, localRoot } = this.cfg;
    if (!driveRoot || !localRoot) throw new Error('Set both folders in Settings first: the drive folder and the local folder.');
    if (copy.isInside(driveRoot, localRoot) || copy.isInside(localRoot, driveRoot)) {
      throw new Error('The drive folder and the local folder must be separate folders (neither inside the other).');
    }
  }

  async scan() {
    const [drive, local] = await Promise.all([
      scanRoot(this.cfg.driveRoot, this.cfg.systems),
      scanRoot(this.cfg.localRoot, this.cfg.systems),
    ]);
    this.manifest = await mergeScan(this.manifest, drive, local, this.cfg.systems, this.dataDir);
    saveManifest(this.dataDir, this.manifest);
    return this.manifest;
  }

  game(id) {
    const g = this.manifest.games.find(x => x.id === id);
    if (!g) throw new Error('That game is not in the library any more. Press Rescan.');
    return g;
  }

  save() { saveManifest(this.dataDir, this.manifest); }

  rootsOnline() {
    return { drive: !!this.cfg.driveRoot && fs.existsSync(this.cfg.driveRoot), local: !!this.cfg.localRoot && fs.existsSync(this.cfg.localRoot) };
  }

  async install(id, onProgress = () => {}) {
    this.checkRoots();
    const g = this.game(id);
    if (!this.rootsOnline().drive) throw new Error('The drive is not connected. Plug it in and press Rescan.');
    if (this.busy.has(id)) throw new Error('This game is already being copied.');
    const pairs = [];
    for (const rel of g.files) {
      const from = path.join(this.cfg.driveRoot, rel);
      const to = path.join(this.cfg.localRoot, rel);
      let size;
      try { size = (await fs.promises.stat(from)).size; } catch { throw new Error(`Missing on the drive: ${rel}. Press Rescan.`); }
      const have = fs.existsSync(to) ? (await fs.promises.stat(to)).size : -1;
      if (have !== size) pairs.push({ from, to, size });
    }
    const needed = pairs.reduce((a, p) => a + p.size, 0);
    fs.mkdirSync(this.cfg.localRoot, { recursive: true });
    const free = await this.freeSpaceFn(this.cfg.localRoot);
    if (needed > free) throw new Error(copy.notEnoughSpace(needed, free));
    this.busy.add(id);
    try {
      if (pairs.length) await copy.copyFiles(pairs, { onProgress: p => onProgress({ id, ...p }), delayMs: this.copyDelayMs });
      else onProgress({ id, copied: g.size, total: g.size, file: '' });
    } finally { this.busy.delete(id); }
    g.onLocal = true;
    refresh(g, this.rootsOnline().drive, true);
    this.save();
    return g;
  }

  // confirm(game) must resolve true before anything is deleted; main.js asks with a native dialog.
  // Returns the updated game, or null when the user said no.
  async uninstall(id, { confirm } = {}) {
    this.checkRoots();
    const g = this.game(id);
    if (!g.onLocal) throw new Error('This game is not installed.');
    if (!g.onDrive) throw new Error("This game isn't on the drive, so uninstalling would delete your only copy. Copy it to the drive first.");
    if (this.busy.has(id)) throw new Error('This game is being copied right now. Wait for it to finish.');
    if (typeof confirm !== 'function') throw new Error('Uninstall needs a confirmation first.');
    if (!(await confirm(g))) return null;
    await copy.deleteLocal(this.cfg.localRoot, g.files.map(rel => path.join(this.cfg.localRoot, rel)),
      { trash: this.cfg.uninstallToRecycleBin ? this.trash : null });
    g.onLocal = false;
    refresh(g, this.rootsOnline().drive, true);
    this.save();
    return g;
  }

  // Returns { command, args, rom } without launching anything.
  playCommand(id) {
    const g = this.game(id);
    const sys = this.cfg.systems.find(s => s.id === g.system);
    const online = this.rootsOnline();
    let rom;
    if (g.onLocal && online.local) rom = path.join(this.cfg.localRoot, g.primary);
    else if (g.onDrive && online.drive && this.cfg.playFromDrive) rom = path.join(this.cfg.driveRoot, g.primary);
    else if (g.onDrive && online.drive) throw new Error('This game is only on the drive. Install it, or turn on "play from drive" in Settings.');
    else throw new Error('This game is not available: the drive is not connected and it is not installed.');
    const emu = sys && sys.emulator;
    if (!emu || !emu.path) throw new Error(`No emulator set for ${sys ? sys.name : g.system}. Add its path in Settings.`);
    if (!fs.existsSync(emu.path)) throw new Error(`Emulator not found at ${emu.path}. Check the path in Settings.`);
    return { command: emu.path, args: buildArgs(emu.args, rom), rom };
  }

  play(id) {
    const { command, args } = this.playCommand(id);
    const child = this.spawn(command, args, { cwd: path.dirname(command), detached: true, stdio: 'ignore' });
    if (child && child.on) child.on('error', () => {});
    if (child && child.unref) child.unref();
    const g = this.game(id);
    g.lastPlayed = new Date().toISOString();
    this.save();
    return { command, args, lastPlayed: g.lastPlayed };
  }

  folderOf(id) {
    const g = this.game(id);
    const online = this.rootsOnline();
    const root = g.onLocal && online.local ? this.cfg.localRoot : this.cfg.driveRoot;
    return path.dirname(path.join(root, g.primary));
  }

  async freeSpace() {
    const read = async r => { try { return r && fs.existsSync(r) ? await this.freeSpaceFn(r) : null; } catch { return null; } };
    return { drive: await read(this.cfg.driveRoot), local: await read(this.cfg.localRoot) };
  }
}

module.exports = { Library, buildArgs };
