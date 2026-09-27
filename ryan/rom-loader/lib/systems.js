'use strict';
// Default systems. Emulator paths are blank on purpose: the app never guesses an executable.
// `folders` are the folder names a system is found under, inside each library root (case-insensitive).
// `args` is the argument template; {rom} is replaced with the full path of the game's primary file.

const DEFAULT_SYSTEMS = [
  { id: 'ps2', name: 'PlayStation 2', extensions: ['.iso', '.bin', '.chd', '.cso'],
    folders: ['ps2', 'playstation 2', 'playstation2'], emulator: { hint: 'PCSX2', path: '', args: '-batch "{rom}"' } },
  { id: 'ps1', name: 'PlayStation', extensions: ['.cue', '.bin', '.chd', '.m3u'],
    folders: ['ps1', 'psx', 'playstation', 'playstation 1'], emulator: { hint: 'DuckStation', path: '', args: '-batch "{rom}"' } },
  { id: 'gc', name: 'GameCube / Wii', extensions: ['.iso', '.rvz', '.gcz'],
    folders: ['gc', 'gamecube', 'wii', 'gamecube-wii', 'ngc'], emulator: { hint: 'Dolphin', path: '', args: '-b -e "{rom}"' } },
  { id: 'n64', name: 'Nintendo 64', extensions: ['.n64', '.z64', '.v64'],
    folders: ['n64', 'nintendo 64'], emulator: { hint: '', path: '', args: '"{rom}"' } },
  { id: 'snes', name: 'Super Nintendo', extensions: ['.sfc', '.smc'],
    folders: ['snes', 'super nintendo'], emulator: { hint: '', path: '', args: '"{rom}"' } },
  { id: 'genesis', name: 'Genesis / Mega Drive', extensions: ['.md', '.bin'],
    folders: ['genesis', 'megadrive', 'mega drive', 'md'], emulator: { hint: '', path: '', args: '"{rom}"' } },
  { id: 'gba', name: 'Game Boy Advance', extensions: ['.gba'],
    folders: ['gba', 'game boy advance'], emulator: { hint: '', path: '', args: '"{rom}"' } },
  { id: 'nds', name: 'Nintendo DS', extensions: ['.nds'],
    folders: ['nds', 'ds', 'nintendo ds'], emulator: { hint: '', path: '', args: '"{rom}"' } },
  { id: 'dc', name: 'Dreamcast', extensions: ['.gdi', '.chd', '.cdi'],
    folders: ['dc', 'dreamcast'], emulator: { hint: '', path: '', args: '"{rom}"' } },
];

// Extensions that point at other files (a playlist or a disc sheet). When one is present,
// the files it lists belong to it and are not separate games.
const SHEET_EXTENSIONS = ['.m3u', '.cue', '.gdi'];

function defaultSystems() {
  return JSON.parse(JSON.stringify(DEFAULT_SYSTEMS));
}

// Which system owns a top-level folder name under a root, or null.
function systemForFolder(systems, folderName) {
  const f = folderName.toLowerCase();
  return systems.find(s => s.folders.map(x => x.toLowerCase()).includes(f)) || null;
}

module.exports = { DEFAULT_SYSTEMS, SHEET_EXTENSIONS, defaultSystems, systemForFolder };
