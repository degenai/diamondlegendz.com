'use strict';
// library.json: every game seen, with where it lives and what state it is in.
// Merging is idempotent: the same two scans produce the same manifest.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { quickHash } = require('./scan');

const MANIFEST_FILE = 'library.json';

function emptyManifest() {
  return { version: 1, scannedAt: null, roots: { drive: { path: '', online: false }, local: { path: '', online: false } }, games: [] };
}

function loadManifest(dataDir) {
  const file = path.join(dataDir, MANIFEST_FILE);
  if (!fs.existsSync(file)) return emptyManifest();
  try { return { ...emptyManifest(), ...JSON.parse(fs.readFileSync(file, 'utf8')) }; }
  catch { return emptyManifest(); } // a corrupt manifest is rebuilt by the next scan
}

function saveManifest(dataDir, manifest) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, MANIFEST_FILE);
  fs.writeFileSync(file + '.part', JSON.stringify(manifest, null, 2));
  fs.renameSync(file + '.part', file);
  return manifest;
}

function gameId(key) {
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
}

function stateOf(onDrive, onLocal) {
  if (onDrive && onLocal) return 'both';
  return onLocal ? 'installed' : 'drive';
}

// Recomputes state and availability of one record given which roots are online.
function refresh(g, driveOnline, localOnline) {
  g.state = stateOf(g.onDrive, g.onLocal);
  g.available = (g.onLocal && localOnline) || (g.onDrive && driveOnline);
  return g;
}

// prev: the old manifest. drive/local: scanRoot results. systems: for display names. dataDir: to find art.
async function mergeScan(prev, drive, local, systems, dataDir) {
  const prevByKey = new Map(prev.games.map(g => [g.key, g]));
  const keys = new Set([...drive.games.keys(), ...local.games.keys(), ...prevByKey.keys()]);
  const games = [];
  for (const key of [...keys].sort()) {
    const old = prevByKey.get(key);
    const d = drive.games.get(key), l = local.games.get(key);
    // An offline root tells us nothing: keep what we knew about it.
    const onDrive = drive.online ? !!d : !!old?.onDrive;
    const onLocal = local.online ? !!l : !!old?.onLocal;
    if (!onDrive && !onLocal) continue;
    const seen = l || d || old;
    const sys = systems.find(s => s.id === seen.system);
    const size = seen.size;
    let hash = old && old.size === size && old.mtimeMs === seen.mtimeMs ? old.hash : null;
    if (!hash && (l || d)) {
      const root = l ? local.root : drive.root;
      try { hash = await quickHash(path.join(root, seen.primary), size); } catch { hash = old?.hash || null; }
    }
    const artRel = hash ? 'art/' + hash + '.png' : null;
    const g = {
      id: gameId(key), key, system: seen.system, systemName: sys ? sys.name : seen.system,
      title: seen.title, cleanTitle: seen.cleanTitle, tags: seen.tags,
      primary: seen.primary, files: seen.files, size, mtimeMs: seen.mtimeMs, hash,
      onDrive, onLocal, state: null, available: false,
      lastPlayed: old?.lastPlayed || null,
      art: artRel && dataDir && fs.existsSync(path.join(dataDir, artRel)) ? artRel : null,
    };
    games.push(refresh(g, drive.online, local.online));
  }
  return {
    version: 1,
    scannedAt: new Date().toISOString(),
    roots: { drive: { path: drive.root || '', online: drive.online }, local: { path: local.root || '', online: local.online } },
    games,
  };
}

module.exports = { MANIFEST_FILE, emptyManifest, loadManifest, saveManifest, mergeScan, refresh, gameId, stateOf };
