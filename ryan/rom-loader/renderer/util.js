'use strict';
// Shared renderer state and small helpers. Plain globals under RL; no framework.
window.RL = {
  state: {
    config: null,
    manifest: null,
    progress: {},   // id -> { copied, total }
    busy: {},       // id -> 'install' | 'uninstall'
    selectedId: null,
  },

  $: id => document.getElementById(id),

  el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  },

  bytes(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '?';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(1)) + ' ' + units[i];
  },

  when(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ', ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  },

  // One hue per system so the shelf reads at a glance.
  systemHue(id) {
    const hues = { ps2: 222, ps1: 210, gc: 268, n64: 150, snes: 285, genesis: 0, gba: 250, nds: 190, dc: 24 };
    if (id in hues) return hues[id];
    let h = 0;
    for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  },

  shortSystem(id) {
    return { ps2: 'PS2', ps1: 'PS1', gc: 'GC/Wii', n64: 'N64', snes: 'SNES', genesis: 'GEN', gba: 'GBA', nds: 'NDS', dc: 'DC' }[id] || String(id).toUpperCase();
  },

  // What the chip on a tile says.
  chip(g) {
    if (RL.state.busy[g.id] === 'install') return { cls: 'busy', text: 'Installing' };
    if (RL.state.busy[g.id] === 'uninstall') return { cls: 'busy', text: 'Removing' };
    if (!g.available) return { cls: 'off', text: 'Drive offline' };
    if (g.state === 'both') return { cls: 'both', text: 'Installed' };
    if (g.state === 'installed') return { cls: 'local', text: 'Laptop only' };
    return { cls: 'drive', text: 'On drive' };
  },

  whereText(g) {
    const parts = {
      both: 'Installed on the laptop, and on the drive',
      installed: 'Only on the laptop (not on the drive)',
      drive: 'On the drive, not installed',
    };
    return parts[g.state] + (g.available ? '' : ' (drive not connected)');
  },

  game(id) {
    return RL.state.manifest ? RL.state.manifest.games.find(g => g.id === id) : null;
  },

  // Replace one game record after install/uninstall without a full rescan.
  putGame(g) {
    const list = RL.state.manifest.games;
    const i = list.findIndex(x => x.id === g.id);
    if (i >= 0) list[i] = g; else list.push(g);
  },

  // Unwraps { ok, value, error } from the bridge; throws Error(error) so callers can show it.
  async call(promise) {
    const r = await promise;
    if (!r.ok) throw new Error(r.error);
    return r.value;
  },
};
