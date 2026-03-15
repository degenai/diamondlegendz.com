// --- State ---
let midiList = [];
let currentMidiIndex = 0;
let isPlaying = false;
let fakeVisualizerActive = false;
let startTime = 0;

// --- Elements ---
const elTrackSelect = document.getElementById('track-select');
const elStatus = document.getElementById('status-bar');
const elStartOverlay = document.getElementById('start-overlay');
const elTrackInfo = document.getElementById('track-info');
const btnPlay = document.getElementById('btn-play');
const player = document.getElementById('myPlayer');
const visualizer = document.getElementById('myVisualizer');

// --- Initialization ---
async function init() {
    elStatus.textContent = "LOADING DIRECTORY...";
    try {
        await loadLists();
        elStatus.textContent = "READY";
        elStartOverlay.classList.add('hidden');

        // Configure visualizer
        visualizer.config = {
            noteHeight: 4,
            pixelsPerTimeStep: 40,
            minPitch: 30
        };

        // Listen to player events to update UI
        player.addEventListener('start', () => {
            isPlaying = true;
            btnPlay.textContent = "⏸";
            elStatus.textContent = "PLAYING";
        });
        player.addEventListener('stop', () => {
            isPlaying = false;
            btnPlay.textContent = "▶";
            // Only overwrite if it wasn't paused manually
            if (elStatus.textContent !== "PAUSED") {
                elStatus.textContent = "STOPPED";
            }
        });
        player.addEventListener('load', () => {
            elStatus.textContent = "READY TO PLAY";
        });

    } catch (e) {
        console.error(e);
        elStatus.textContent = "ERROR INITIALIZING";
        const overlayText = elStartOverlay.querySelector('h2');
        if (overlayText) {
            overlayText.textContent = "SYSTEM ERROR";
            overlayText.style.color = "red";
        }
    }
}

async function loadLists() {
    // Load MIDI List
    const midiResp = await fetch('midis/file_list.json');
    midiList = await midiResp.json();

    elTrackSelect.innerHTML = '';
    midiList.forEach((file, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = file.replace('.mid', '').replace(/_/g, ' ').toUpperCase();
        elTrackSelect.appendChild(opt);
    });
}

// --- Player Logic ---

function loadMidi(index) {
    if (index < 0 || index >= midiList.length) return;
    currentMidiIndex = index;

    const filename = midiList[index];
    elStatus.textContent = `LOADING TRACK: ${filename}...`;
    elTrackInfo.textContent = filename.replace('.mid', '').toUpperCase();

    try {
        const url = `midis/${filename}`;

        // Stop current if playing
        if (isPlaying) {
            player.stop();
        }

        // Play via html-midi-player
        player.src = url;

        // Note: setting src auto-loads. Calling play directly might throw if not loaded,
        // but html-midi-player starts playing on start() which awaits load internally.
        player.start();

        isPlaying = true;
        btnPlay.textContent = "⏸";
        elTrackSelect.value = index;
        elStatus.textContent = "LOADING/PLAYING...";

    } catch (e) {
        console.error(e);
        elStatus.textContent = "LOAD ERROR";
    }
}

// --- Event Listeners ---

elStartOverlay.addEventListener('click', () => {
    if (elStartOverlay.classList.contains('hidden')) return;
    const overlayText = elStartOverlay.querySelector('h2');
    if (overlayText) overlayText.textContent = "INITIALIZING...";
    init();
});

document.getElementById('btn-play').addEventListener('click', () => {
    if (isPlaying) {
        // html-midi-player has stop() not pause(), but we can just use stop
        // or actually since it uses magenta it doesn't easily expose pause/resume natively
        // but we can just stop it. Let's check if it exposes pause.
        // HTMLMidiPlayer handles playing via .playing property.
        if (player.playing) {
            player.playing = false; // toggles pause/stop depending on API, or just player.stop()
            // actually standard html-midi-player API just has start() and stop().
            player.stop();
        }
        isPlaying = false;
        btnPlay.textContent = "▶";
        elStatus.textContent = "PAUSED";
    } else {
        if (elTrackSelect.value === 'LOADING...') return;

        // If nothing is playing and hasn't started yet, play the selected
        if (elStatus.textContent === "READY" || elStatus.textContent === "STOPPED" || elStatus.textContent === "PAUSED") {
            // html-midi-player doesn't easily "resume" from stopped, so we just start() again
            // start() might resume if it wasn't fully unloaded.
            if (!player.src && midiList.length > 0) {
                loadMidi(currentMidiIndex);
            } else {
                player.start();
                isPlaying = true;
                btnPlay.textContent = "⏸";
                elStatus.textContent = "PLAYING";
            }
        }
    }
});

document.getElementById('btn-stop').addEventListener('click', () => {
    player.stop();
    isPlaying = false;
    btnPlay.textContent = "▶";
    elStatus.textContent = "STOPPED";
});

document.getElementById('btn-next').addEventListener('click', () => {
    let next = currentMidiIndex + 1;
    if (next >= midiList.length) next = 0;
    loadMidi(next);
});

document.getElementById('btn-prev').addEventListener('click', () => {
    let prev = currentMidiIndex - 1;
    if (prev < 0) prev = midiList.length - 1;
    loadMidi(prev);
});

elTrackSelect.addEventListener('change', (e) => {
    loadMidi(parseInt(e.target.value));
});

// Drag & Drop
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#fff';
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#555';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#555';

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.mid')) {
        elStatus.textContent = "LOADING CUSTOM MIDI...";

        // Create an object URL from the dropped file to play locally
        const url = URL.createObjectURL(file);

        if (isPlaying) {
            player.stop();
        }

        player.src = url;
        player.start();

        isPlaying = true;
        btnPlay.textContent = "⏸";
        elStatus.textContent = `PLAYING: ${file.name.toUpperCase()}`;
        elTrackInfo.textContent = file.name.toUpperCase();
    } else {
        elStatus.textContent = "INVALID FILE (.MID ONLY)";
    }
});

// --- Visualizer handled by html-midi-player ---
