'use strict';
// Builds a fake external drive and a fake local folder in a temp dir.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function put(root, rel, content) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof content === 'number' ? crypto.randomBytes(content) : content);
  return f;
}

function makeFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rom-loader-test-'));
  const drive = path.join(base, 'drive');
  const local = path.join(base, 'local');
  const data = path.join(base, 'userData');
  fs.mkdirSync(local, { recursive: true });
  // PS2: single-file games (one bigger than the 1 MB hash window).
  put(drive, 'PS2/Gran Turismo 4 (USA) [!].iso', 1024 * 1024 + 4096);
  put(drive, 'PS2/Shadow of the Colossus (USA).chd', 50000);
  put(drive, 'PS2/readme.txt', 'not a game');
  // PS1: a .cue + two .bin tracks in their own folder.
  const cb = 'PS1/Crash Bandicoot (USA)/';
  put(drive, cb + 'Crash Bandicoot (USA).cue',
    'FILE "Crash Bandicoot (USA) (Track 1).bin" BINARY\r\n  TRACK 01 MODE2/2352\r\n' +
    'FILE "Crash Bandicoot (USA) (Track 2).bin" BINARY\r\n  TRACK 02 AUDIO\r\n');
  put(drive, cb + 'Crash Bandicoot (USA) (Track 1).bin', 70000);
  put(drive, cb + 'Crash Bandicoot (USA) (Track 2).bin', 30000);
  // PS1: an .m3u over two discs, each a .cue + .bin.
  put(drive, 'PS1/FF7/Final Fantasy VII (USA).m3u', 'Final Fantasy VII (USA) (Disc 1).cue\nFinal Fantasy VII (USA) (Disc 2).cue\n');
  put(drive, 'PS1/FF7/Final Fantasy VII (USA) (Disc 1).cue', 'FILE "Final Fantasy VII (USA) (Disc 1).bin" BINARY\n');
  put(drive, 'PS1/FF7/Final Fantasy VII (USA) (Disc 1).bin', 20000);
  put(drive, 'PS1/FF7/Final Fantasy VII (USA) (Disc 2).cue', 'FILE "Final Fantasy VII (USA) (Disc 2).bin" BINARY\n');
  put(drive, 'PS1/FF7/Final Fantasy VII (USA) (Disc 2).bin', 20000);
  // Dreamcast: a .gdi with tracks.
  put(drive, 'Dreamcast/Crazy Taxi/Crazy Taxi.gdi', '3\n1 0 4 2352 track01.bin 0\n2 756 0 2352 "track 02.raw" 0\n3 45000 4 2352 track03.bin 0\n');
  put(drive, 'Dreamcast/Crazy Taxi/track01.bin', 1000);
  put(drive, 'Dreamcast/Crazy Taxi/track 02.raw', 1000);
  put(drive, 'Dreamcast/Crazy Taxi/track03.bin', 1000);
  // Genesis .bin (same extension as PS1/PS2 tracks, told apart by folder).
  put(drive, 'Genesis/Sonic the Hedgehog (USA, Europe).bin', 5000);
  put(drive, 'GBA/Metroid Fusion (USA).gba', 8000);
  put(drive, 'Movies/not a system.iso', 100);
  put(drive, 'notes.txt', 'loose file at the root');
  // Local: one game also on the drive (same bytes), one only local.
  fs.mkdirSync(path.join(local, 'GBA'), { recursive: true });
  fs.copyFileSync(path.join(drive, 'GBA/Metroid Fusion (USA).gba'), path.join(local, 'GBA/Metroid Fusion (USA).gba'));
  put(local, 'SNES/Super Metroid (USA).sfc', 4000);
  return { base, drive, local, data, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

// Collects every file under root as relative forward-slash paths with sizes.
function listTree(root) {
  const out = {};
  const walk = (d, rel) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r); else out[r] = fs.statSync(path.join(d, e.name)).size;
    }
  };
  walk(root, '');
  return out;
}

module.exports = { makeFixture, listTree, put };
