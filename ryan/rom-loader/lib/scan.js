'use strict';
// Scans one library root: <root>/<system folder>/**/<files>. Groups multi-file games under their
// sheet (.m3u > .cue / .gdi > tracks). Tolerant of a missing root (online: false, no games).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SHEET_EXTENSIONS, systemForFolder } = require('./systems');

const HASH_BYTES = 1024 * 1024;

async function exists(p) {
  try { await fs.promises.access(p); return true; } catch { return false; }
}

async function walk(dir, rel = '') {
  let entries;
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...await walk(path.join(dir, e.name), r));
    else if (e.isFile() && !e.name.endsWith('.part')) out.push(r);
  }
  return out;
}

// Files a sheet points at, relative to the system folder (forward slashes).
async function sheetRefs(absSheet, relSheet) {
  let text;
  try { text = await fs.promises.readFile(absSheet, 'utf8'); } catch { return []; }
  const ext = path.extname(absSheet).toLowerCase();
  const names = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (ext === '.cue') {
    for (const l of lines) {
      const m = /^FILE\s+(?:"([^"]+)"|(\S+))/i.exec(l);
      if (m) names.push(m[1] || m[2]);
    }
  } else if (ext === '.gdi') {
    for (const l of lines.slice(1)) {
      const m = /^\d+\s+\d+\s+\d+\s+\d+\s+(?:"([^"]+)"|(\S+))/.exec(l);
      if (m) names.push(m[1] || m[2]);
    }
  } else if (ext === '.m3u') {
    for (const l of lines) if (!l.startsWith('#')) names.push(l);
  }
  const base = path.posix.dirname(relSheet);
  return names.map(n => path.posix.normalize(path.posix.join(base === '.' ? '' : base, n.replace(/\\/g, '/'))));
}

// "Gran Turismo 4 (USA) [!]" -> { cleanTitle: "Gran Turismo 4", tags: "(USA) [!]" }
function cleanTitle(title) {
  const tags = (title.match(/\([^)]*\)|\[[^\]]*\]/g) || []).join(' ');
  const clean = title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { cleanTitle: clean || title, tags };
}

// sha1 of the first 1 MB of the primary file plus the total size. Fast, good enough to name art.
async function quickHash(absPrimary, totalSize) {
  const h = crypto.createHash('sha1');
  const fh = await fs.promises.open(absPrimary, 'r');
  try {
    const buf = Buffer.alloc(HASH_BYTES);
    const { bytesRead } = await fh.read(buf, 0, HASH_BYTES, 0);
    h.update(buf.subarray(0, bytesRead));
  } finally { await fh.close(); }
  h.update(':' + totalSize);
  return h.digest('hex');
}

// Groups one system folder's file list into games.
async function groupSystem(sysAbs, system, relFiles) {
  const exts = new Set(system.extensions.map(e => e.toLowerCase()));
  const byLower = new Map(relFiles.map(r => [r.toLowerCase(), r]));
  const isCandidate = r => { const e = path.extname(r).toLowerCase(); return exts.has(e) || SHEET_EXTENSIONS.includes(e); };
  const candidates = relFiles.filter(isCandidate);
  const children = new Map();
  for (const r of candidates) {
    if (!SHEET_EXTENSIONS.includes(path.extname(r).toLowerCase())) continue;
    const refs = (await sheetRefs(path.join(sysAbs, r), r)).map(x => byLower.get(x.toLowerCase())).filter(Boolean);
    children.set(r, refs);
  }
  const claimed = new Set();
  for (const refs of children.values()) refs.forEach(x => claimed.add(x));
  const games = [];
  for (const primary of candidates) {
    if (claimed.has(primary)) continue;
    if (!exts.has(path.extname(primary).toLowerCase()) && !children.get(primary)?.length) continue;
    const files = [];
    const add = r => { if (files.includes(r)) return; files.push(r); (children.get(r) || []).forEach(add); };
    add(primary);
    let size = 0, mtimeMs = 0;
    for (const f of files) {
      const st = await fs.promises.stat(path.join(sysAbs, f));
      size += st.size; mtimeMs = Math.max(mtimeMs, st.mtimeMs);
    }
    games.push({ primary, files, size, mtimeMs });
  }
  return games;
}

// Returns { root, online, games: Map<key, entry> }. key = "<systemId>/<path inside system folder, lowercased>".
// entry.primary / entry.files are relative to the root, forward slashes (e.g. "PS1/Game/Game.cue").
async function scanRoot(root, systems) {
  const result = { root, online: false, games: new Map() };
  if (!root || !(await exists(root))) return result;
  result.online = true;
  let top;
  try { top = await fs.promises.readdir(root, { withFileTypes: true }); } catch { result.online = false; return result; }
  for (const d of top) {
    if (!d.isDirectory()) continue;
    const system = systemForFolder(systems, d.name);
    if (!system) continue;
    const sysAbs = path.join(root, d.name);
    const grouped = await groupSystem(sysAbs, system, await walk(sysAbs));
    for (const g of grouped) {
      const key = system.id + '/' + g.primary.toLowerCase();
      if (result.games.has(key)) continue; // two folders for one system: first wins
      const title = path.posix.basename(g.primary, path.posix.extname(g.primary));
      result.games.set(key, {
        key, system: system.id, title, ...cleanTitle(title),
        primary: d.name + '/' + g.primary,
        files: g.files.map(f => d.name + '/' + f),
        size: g.size, mtimeMs: g.mtimeMs,
      });
    }
  }
  return result;
}

module.exports = { scanRoot, quickHash, cleanTitle, sheetRefs, HASH_BYTES };
