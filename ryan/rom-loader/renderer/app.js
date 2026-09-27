'use strict';
// Library screen: the shelf grid, search / filters / sort, rescan, status and banners.
(function () {
  const { $, el, state } = RL;

  function filtered() {
    const games = state.manifest ? state.manifest.games.slice() : [];
    const q = $('search').value.trim().toLowerCase();
    const sys = $('filter-system').value;
    const where = $('filter-state').value;
    const out = games.filter(g => {
      if (sys && g.system !== sys) return false;
      if (where === 'local' && !(g.state === 'installed' || g.state === 'both')) return false;
      if (where === 'drive' && g.state !== 'drive') return false;
      if (where === 'both' && g.state !== 'both') return false;
      if (where === 'unavailable' && g.available) return false;
      if (q && !(g.cleanTitle + ' ' + g.title + ' ' + g.systemName).toLowerCase().includes(q)) return false;
      return true;
    });
    const sort = $('sort').value;
    const byTitle = (a, b) => a.cleanTitle.localeCompare(b.cleanTitle, undefined, { sensitivity: 'base', numeric: true });
    if (sort === 'size') out.sort((a, b) => b.size - a.size || byTitle(a, b));
    else if (sort === 'played') out.sort((a, b) => (b.lastPlayed || '').localeCompare(a.lastPlayed || '') || byTitle(a, b));
    else out.sort(byTitle);
    return out;
  }

  function tile(g) {
    const t = el('button', 'tile' + (g.available ? '' : ' unavailable') + (state.selectedId === g.id ? ' selected' : ''));
    t.dataset.id = g.id;
    t.style.setProperty('--hue', RL.systemHue(g.system));
    t.title = g.title;
    const cover = el('div', 'cover');
    if (g.artUrl) {
      const img = el('img');
      img.src = g.artUrl; img.alt = '';
      cover.appendChild(img);
    } else {
      cover.appendChild(el('div', 'spine', RL.shortSystem(g.system)));
      cover.appendChild(el('div', 'cover-title', g.cleanTitle));
      if (g.tags) cover.appendChild(el('div', 'cover-tags', g.tags));
    }
    const chip = RL.chip(g);
    cover.appendChild(el('span', 'chip ' + chip.cls, chip.text));
    const p = state.progress[g.id];
    if (p && state.busy[g.id] === 'install') {
      const mini = el('div', 'mini-progress');
      const fill = el('div');
      fill.style.width = (p.total ? (100 * p.copied / p.total) : 0).toFixed(1) + '%';
      mini.appendChild(fill);
      cover.appendChild(mini);
    }
    t.appendChild(cover);
    const meta = el('div', 'meta');
    meta.appendChild(el('span', 'meta-title', g.cleanTitle));
    const line = el('div', 'meta-line');
    line.appendChild(el('span', 'badge', RL.shortSystem(g.system)));
    line.appendChild(el('span', 'size', RL.bytes(g.size)));
    meta.appendChild(line);
    t.appendChild(meta);
    t.addEventListener('click', () => RL.panel.open(g.id));
    return t;
  }

  function renderGrid() {
    const grid = $('grid');
    const list = filtered();
    grid.replaceChildren(...list.map(tile));
    const total = state.manifest ? state.manifest.games.length : 0;
    const installed = state.manifest ? state.manifest.games.filter(g => g.state !== 'drive').length : 0;
    $('count').textContent = total ? `${list.length} of ${total} games, ${installed} on the laptop` : '';
    const empty = $('empty');
    const cfg = state.config || {};
    if (!cfg.driveRoot && !cfg.localRoot) {
      empty.hidden = false;
      empty.textContent = 'No folders set yet. Open Settings, pick the external drive and a laptop folder, then press Rescan.';
    } else if (!total) {
      empty.hidden = false;
      empty.textContent = 'No games found. Games are found in folders named after the system, like "PS2" or "PS1", at the top of each folder.';
    } else if (!list.length) {
      empty.hidden = false;
      empty.textContent = 'Nothing matches the search or filters.';
    } else empty.hidden = true;
  }

  function renderBanner() {
    const b = $('banner');
    const m = state.manifest;
    const cfg = state.config || {};
    if (m && cfg.driveRoot && m.roots && !m.roots.drive.online) {
      b.hidden = false;
      b.textContent = `The drive isn't connected (${cfg.driveRoot}). Installed games still play; plug it in and press Rescan for the rest.`;
    } else b.hidden = true;
  }

  function fillSystemFilter() {
    const sel = $('filter-system');
    const keep = sel.value;
    const present = new Set((state.manifest ? state.manifest.games : []).map(g => g.system));
    const opts = [el('option', null, 'All systems')];
    opts[0].value = '';
    for (const s of (state.config ? state.config.systems : [])) {
      if (!present.has(s.id)) continue;
      const o = el('option', null, s.name);
      o.value = s.id;
      opts.push(o);
    }
    sel.replaceChildren(...opts);
    sel.value = [...sel.options].some(o => o.value === keep) ? keep : '';
  }

  async function refreshSpace() {
    try {
      const s = await RL.call(window.api.freeSpace());
      const parts = [];
      if (s.local !== null) parts.push('Laptop: ' + RL.bytes(s.local) + ' free');
      if (s.drive !== null) parts.push('Drive: ' + RL.bytes(s.drive) + ' free');
      $('space').textContent = parts.join('   ');
      return s;
    } catch { $('space').textContent = ''; return null; }
  }

  function render() {
    fillSystemFilter();
    renderBanner();
    renderGrid();
    RL.panel.render();
  }

  async function rescan() {
    const btn = $('btn-rescan');
    btn.disabled = true; btn.textContent = 'Scanning...';
    try {
      state.manifest = await RL.call(window.api.scan());
    } catch (err) {
      $('banner').hidden = false;
      $('banner').textContent = 'Scan failed: ' + err.message;
    } finally { btn.disabled = false; btn.textContent = 'Rescan'; }
    render();
    refreshSpace();
  }

  // Called by the panel after install/uninstall changes one game.
  RL.app = { render, renderGrid, rescan, refreshSpace };

  window.api.onProgress(p => {
    state.progress[p.id] = p;
    const t = document.querySelector(`.tile[data-id="${p.id}"] .mini-progress > div`);
    if (t) t.style.width = (p.total ? (100 * p.copied / p.total) : 0).toFixed(1) + '%';
    else renderGrid();
    if (state.selectedId === p.id) RL.panel.renderProgress();
  });

  for (const id of ['search', 'filter-system', 'filter-state', 'sort']) $(id).addEventListener('input', renderGrid);
  $('btn-rescan').addEventListener('click', rescan);
  $('btn-settings').addEventListener('click', () => RL.settings.open());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('settings').hidden) RL.settings.close(); else RL.panel.close(); }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('search').focus(); }
  });

  (async function init() {
    state.config = await RL.call(window.api.getConfig());
    state.manifest = await RL.call(window.api.library());
    render();
    if (!state.config.driveRoot && !state.config.localRoot) RL.settings.open();
    else rescan();
  })().catch(err => { $('banner').hidden = false; $('banner').textContent = err.message; });
})();
