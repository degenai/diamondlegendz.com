'use strict';
// Settings: the two folders (with free space), play-from-drive, recycle bin, and one emulator per system.
(function () {
  const { $, el, state } = RL;

  function emuRow(s) {
    const row = el('div', 'emu');
    row.dataset.system = s.id;
    row.style.setProperty('--hue', RL.systemHue(s.id));
    const head = el('div', 'emu-head');
    head.appendChild(el('span', 'badge', RL.shortSystem(s.id)));
    head.appendChild(el('span', 'emu-name', s.name));
    head.appendChild(el('span', 'hint', (s.emulator.hint ? 'Suggested: ' + s.emulator.hint + '. ' : '') + 'Files: ' + s.extensions.join(' ')));
    row.appendChild(head);
    const pick = el('div', 'pick');
    const p = el('input');
    p.type = 'text'; p.className = 'emu-path'; p.placeholder = 'Emulator program (.exe)'; p.spellcheck = false;
    p.value = s.emulator.path || '';
    const browse = el('button', 'btn', 'Browse');
    browse.addEventListener('click', async () => {
      const f = await RL.call(window.api.pickFile(p.value));
      if (f) p.value = f;
    });
    const a = el('input');
    a.type = 'text'; a.className = 'emu-args'; a.placeholder = '"{rom}"'; a.spellcheck = false; a.title = 'Arguments; {rom} is the game file';
    a.value = s.emulator.args || '';
    pick.append(p, browse, a);
    row.appendChild(pick);
    return row;
  }

  async function showFree() {
    try {
      const s = await RL.call(window.api.freeSpace());
      $('free-drive').textContent = s.drive === null ? (state.config.driveRoot ? 'Not connected' : '') : RL.bytes(s.drive) + ' free';
      $('free-local').textContent = s.local === null ? (state.config.localRoot ? 'Folder does not exist yet' : '') : RL.bytes(s.local) + ' free';
    } catch { /* readout only */ }
  }

  function open() {
    const cfg = state.config;
    $('set-drive').value = cfg.driveRoot || '';
    $('set-local').value = cfg.localRoot || '';
    $('set-play-drive').checked = !!cfg.playFromDrive;
    $('set-recycle').checked = cfg.uninstallToRecycleBin !== false;
    $('emu-list').replaceChildren(...cfg.systems.map(emuRow));
    $('settings-msg').textContent = '';
    $('settings').hidden = false;
    showFree();
  }

  function close() { $('settings').hidden = true; }

  async function save() {
    const drive = $('set-drive').value.trim();
    const local = $('set-local').value.trim();
    if (drive && local && drive.toLowerCase() === local.toLowerCase()) {
      $('settings-msg').textContent = 'The drive folder and the laptop folder must be different.';
      return;
    }
    const systems = state.config.systems.map(s => {
      const row = document.querySelector(`.emu[data-system="${s.id}"]`);
      if (!row) return s;
      return { ...s, emulator: { ...s.emulator, path: row.querySelector('.emu-path').value.trim(), args: row.querySelector('.emu-args').value.trim() || '"{rom}"' } };
    });
    try {
      state.config = await RL.call(window.api.setConfig({
        driveRoot: drive, localRoot: local, systems,
        playFromDrive: $('set-play-drive').checked,
        uninstallToRecycleBin: $('set-recycle').checked,
      }));
      close();
      RL.app.rescan();
    } catch (err) { $('settings-msg').textContent = err.message; }
  }

  document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', async () => {
    const input = $(b.dataset.pick);
    const f = await RL.call(window.api.pickFolder(input.value));
    if (f) input.value = f;
  }));
  $('settings-cancel').addEventListener('click', close);
  $('settings-save').addEventListener('click', save);
  $('settings').addEventListener('click', e => { if (e.target.id === 'settings') close(); });

  RL.settings = { open, close };
})();
