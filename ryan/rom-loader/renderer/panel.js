'use strict';
// Game panel: facts, Install / Uninstall / Play / Open folder, the progress bar, plain-words errors.
(function () {
  const { $, el, state } = RL;

  function showError(msg) {
    const e = $('panel-error');
    e.hidden = !msg;
    e.textContent = msg || '';
  }

  function renderProgress() {
    const g = RL.game(state.selectedId);
    const box = $('progress');
    const p = g && state.progress[g.id];
    if (!g || state.busy[g.id] !== 'install' || !p) { box.hidden = true; return; }
    box.hidden = false;
    const pct = p.total ? (100 * p.copied / p.total) : 0;
    $('progress-fill').style.width = pct.toFixed(1) + '%';
    $('progress-text').textContent = `Copying to the laptop: ${RL.bytes(p.copied)} of ${RL.bytes(p.total)} (${Math.floor(pct)}%)`;
  }

  function render() {
    const panel = $('panel');
    const g = RL.game(state.selectedId);
    if (!g) { panel.hidden = true; document.body.classList.remove('panel-open'); return; }
    panel.hidden = false;
    document.body.classList.add('panel-open');
    panel.style.setProperty('--hue', RL.systemHue(g.system));
    const art = $('panel-art');
    art.replaceChildren();
    if (g.artUrl) { const img = el('img'); img.src = g.artUrl; img.alt = ''; art.appendChild(img); }
    else { art.appendChild(el('div', 'spine', RL.shortSystem(g.system))); art.appendChild(el('div', 'cover-title', g.cleanTitle)); }
    $('panel-title').textContent = g.cleanTitle;
    $('panel-tags').textContent = g.tags || '';
    $('panel-system').textContent = g.systemName;
    $('panel-size').textContent = RL.bytes(g.size);
    $('panel-state').textContent = RL.whereText(g);
    $('panel-played').textContent = RL.when(g.lastPlayed);
    $('panel-file-count').textContent = g.files.length;
    $('panel-files').replaceChildren(...g.files.map(f => el('li', null, f)));

    const busy = state.busy[g.id];
    const onLaptop = g.state === 'installed' || g.state === 'both';
    const cfg = state.config || {};
    const canPlay = g.available && (onLaptop || cfg.playFromDrive);
    $('act-play').disabled = !!busy || !canPlay;
    $('act-play').title = canPlay ? '' : (g.available ? 'Install it first, or allow playing from the drive in Settings' : 'The drive is not connected');
    $('act-install').hidden = onLaptop;
    $('act-install').disabled = !!busy || !g.available;
    $('act-install').textContent = busy === 'install' ? 'Installing...' : 'Install';
    $('act-uninstall').hidden = !onLaptop;
    $('act-uninstall').disabled = !!busy || g.state !== 'both';
    $('act-uninstall').title = g.state === 'installed' ? 'Not on the drive: this is the only copy' : '';
    $('act-uninstall').textContent = busy === 'uninstall' ? 'Removing...' : 'Uninstall';
    $('act-folder').disabled = !g.available;
    renderProgress();
  }

  function open(id) {
    if (state.selectedId !== id) showError('');
    state.selectedId = id;
    render();
    RL.app.renderGrid();
  }

  function close() {
    state.selectedId = null;
    render();
    RL.app.renderGrid();
  }

  async function run(kind, id, fn) {
    showError('');
    state.busy[id] = kind;
    render(); RL.app.renderGrid();
    try {
      const g = await RL.call(fn());
      if (g && g.id) RL.putGame(g);
    } catch (err) {
      if (state.selectedId === id) showError(err.message);
      else alert(err.message);
    } finally {
      delete state.busy[id];
      delete state.progress[id];
      render(); RL.app.renderGrid();
      RL.app.refreshSpace();
    }
  }

  $('panel-close').addEventListener('click', close);
  $('act-install').addEventListener('click', () => {
    const id = state.selectedId;
    state.progress[id] = { id, copied: 0, total: RL.game(id).size };
    run('install', id, () => window.api.install(id));
  });
  $('act-uninstall').addEventListener('click', () => {
    const g = RL.game(state.selectedId);
    if (!confirm(`Remove "${g.cleanTitle}" from the laptop?\n\nThe copy on the drive stays. You can install it again any time.`)) return;
    run('uninstall', g.id, () => window.api.uninstall(g.id));
  });
  $('act-play').addEventListener('click', async () => {
    const id = state.selectedId;
    showError('');
    try {
      const r = await RL.call(window.api.play(id));
      const g = RL.game(id);
      if (g) g.lastPlayed = r.lastPlayed;
      render();
    } catch (err) { showError(err.message); }
  });
  $('act-folder').addEventListener('click', async () => {
    try { await RL.call(window.api.openFolder(state.selectedId)); } catch (err) { showError(err.message); }
  });

  RL.panel = { open, close, render, renderProgress, showError };
})();
