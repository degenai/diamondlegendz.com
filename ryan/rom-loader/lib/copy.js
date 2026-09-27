'use strict';
// Streamed copies with byte progress, free-space checks, and local-only deletes.
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');

function formatBytes(n) {
  if (!Number.isFinite(n)) return '?';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return (i === 0 ? n : n.toFixed(1)) + ' ' + units[i];
}

// Free bytes on the volume holding `dir` (walks up to the nearest existing folder).
async function freeSpace(dir) {
  let p = path.resolve(dir);
  while (!fs.existsSync(p)) { const up = path.dirname(p); if (up === p) break; p = up; }
  const s = await fs.promises.statfs(p);
  return Number(s.bavail) * Number(s.bsize);
}

function notEnoughSpace(needed, free) {
  return `not enough space: needs ${formatBytes(needed)}, ${formatBytes(free)} free`;
}

// True if child is inside (or equal to) parent.
function isInside(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// pairs: [{ from, to, size }]. Each file is written to <to>.part, size-checked, then renamed.
// onProgress({ copied, total, file }). delayMs slows each chunk (demo/screenshot knob only).
async function copyFiles(pairs, { onProgress = () => {}, delayMs = 0 } = {}) {
  const total = pairs.reduce((a, p) => a + p.size, 0);
  let copied = 0;
  onProgress({ copied, total, file: pairs[0]?.to || '' });
  for (const p of pairs) {
    await fs.promises.mkdir(path.dirname(p.to), { recursive: true });
    const part = p.to + '.part';
    const counter = new Transform({
      transform(chunk, _enc, cb) {
        copied += chunk.length;
        onProgress({ copied, total, file: p.to });
        if (delayMs) setTimeout(() => cb(null, chunk), delayMs); else cb(null, chunk);
      },
    });
    try {
      await pipeline(fs.createReadStream(p.from), counter, fs.createWriteStream(part));
      const got = (await fs.promises.stat(part)).size;
      if (got !== p.size) throw new Error(`copy check failed for ${path.basename(p.to)}: expected ${p.size} bytes, got ${got}`);
      await fs.promises.rename(part, p.to);
    } catch (err) {
      await fs.promises.rm(part, { force: true });
      throw err;
    }
  }
  onProgress({ copied: total, total, file: '' });
  return { copied: total, total };
}

// Deletes files under localRoot only, then prunes empty folders up to (not including) localRoot.
// trash(absPath) is used when given (Recycle Bin), otherwise a plain delete.
async function deleteLocal(localRoot, absFiles, { trash } = {}) {
  for (const f of absFiles) {
    if (!isInside(localRoot, f) || path.resolve(f) === path.resolve(localRoot)) {
      throw new Error(`refusing to delete outside the local folder: ${f}`);
    }
  }
  for (const f of absFiles) {
    if (!fs.existsSync(f)) continue;
    if (trash) await trash(f); else await fs.promises.rm(f, { force: true });
  }
  const root = path.resolve(localRoot);
  const dirs = [...new Set(absFiles.map(f => path.dirname(path.resolve(f))))];
  for (let d of dirs) {
    while (d !== root && isInside(root, d)) {
      try { await fs.promises.rmdir(d); } catch { break; } // not empty or already gone
      d = path.dirname(d);
    }
  }
}

module.exports = { formatBytes, freeSpace, notEnoughSpace, isInside, copyFiles, deleteLocal };
