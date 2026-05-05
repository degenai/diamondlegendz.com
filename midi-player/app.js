// SF Turbo MIDI Player — html-midi-player engine.
// Replaced MIDIjs (no time tracking, no seek) with @magenta/music's html-midi-player
// which gives us a real seekable timeline, time display, and a piano-roll visualizer.

const elTrackSelect = document.getElementById('track-select');
const elStatus = document.getElementById('status-bar');
const elTrackInfo = document.getElementById('track-info');
const elDropZone = document.getElementById('drop-zone');
const player = document.getElementById('player');

let midiList = [];
let lastDropUrl = null;

async function loadLists() {
    try {
        const resp = await fetch('midis/file_list.json');
        midiList = await resp.json();

        elTrackSelect.innerHTML = '';
        midiList.forEach((file, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = file.replace(/\.midi?$/i, '').replace(/_/g, ' ').toUpperCase();
            elTrackSelect.appendChild(opt);
        });
        elStatus.textContent = "READY";
    } catch (e) {
        console.error(e);
        elStatus.textContent = "ERROR LOADING TRACK LIST";
    }
}

function loadIntoPlayer(url, label) {
    if (lastDropUrl && lastDropUrl !== url) URL.revokeObjectURL(lastDropUrl);
    player.src = url;
    elTrackInfo.textContent = label.toUpperCase();
    elStatus.textContent = `LOADED: ${label.toUpperCase()}`;
}

elTrackSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= midiList.length) return;
    const filename = midiList[idx];
    loadIntoPlayer(`midis/${filename}`, filename.replace(/\.midi?$/i, ''));
});

elDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elDropZone.style.borderColor = '#fff';
});
elDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elDropZone.style.borderColor = '#555';
});
elDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elDropZone.style.borderColor = '#555';

    const file = e.dataTransfer.files[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.mid') && !lower.endsWith('.midi')) {
        elStatus.textContent = "INVALID FILE (.MID / .MIDI ONLY)";
        return;
    }
    const url = URL.createObjectURL(file);
    lastDropUrl = url;
    loadIntoPlayer(url, file.name);
});

// Hook a couple of player events so the status bar reflects state.
player.addEventListener('start', () => { elStatus.textContent = "PLAYING"; });
player.addEventListener('stop', () => { elStatus.textContent = "STOPPED"; });
player.addEventListener('load', () => { elStatus.textContent = "LOADED"; });

loadLists();
