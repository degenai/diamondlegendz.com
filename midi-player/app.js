// --- State ---
let midiList = [];
let currentMidiIndex = 0;
let isPlaying = false;

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
            noteHeight: 3,
            pixelsPerTimeStep: 45,
            minPitch: 20,
            maxPitch: 100,
            noteSpacing: 1
        };

        // Listen to player events to update UI
        // Note: html-midi-player doesn't natively fire standard 'start' / 'stop' DOM events
        // the same way an audio element does, but we will attach event listeners
        // using Tone.js / Magenta hooks if needed, or rely on our manual state checks.
        // The element fires 'load' when the sequence is fully loaded.
        // Let the player handle its internal state.
        // We will just make sure it displays READY when fully loaded if not playing.
        player.addEventListener('load', () => {
            if (!isPlaying) {
                elStatus.textContent = "READY TO PLAY";
            }
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

// Helper function to ensure Tone.js audio context is running
async function ensureAudioContext() {
    if (window.Tone && window.Tone.context.state !== 'running') {
        try {
            await window.Tone.start();
        } catch (e) {
            console.error("Failed to start Tone context", e);
        }
    }
}

async function loadMidi(index) {
    if (index < 0 || index >= midiList.length) return;
    currentMidiIndex = index;

    const filename = midiList[index];
    elStatus.textContent = `LOADING TRACK: ${filename}...`;
    elTrackInfo.textContent = filename.replace('.mid', '').toUpperCase();

    try {
        const url = `midis/${filename}`;

        // Stop current if playing
        if (typeof player.stop === 'function') {
            player.stop();
        }

        // Ensure the custom element is defined and ready
        await customElements.whenDefined('midi-player');
        await ensureAudioContext();

        // Start load
        player.src = url;
        isPlaying = true;
        btnPlay.textContent = "⏸";
        elTrackSelect.value = index;
        elStatus.textContent = "PLAYING";

        if (typeof player.start === 'function') {
            const startPromise = player.start();
            if (startPromise && typeof startPromise.catch === 'function') {
                startPromise.catch(err => console.log(err));
            }
        }

    } catch (e) {
        console.error(e);
        elStatus.textContent = "LOAD ERROR";
        isPlaying = false;
        btnPlay.textContent = "▶";
    }
}

// --- Event Listeners ---

elStartOverlay.addEventListener('click', () => {
    if (elStartOverlay.classList.contains('hidden')) return;
    const overlayText = elStartOverlay.querySelector('h2');
    if (overlayText) overlayText.textContent = "INITIALIZING...";
    init();
});

document.getElementById('btn-play').addEventListener('click', async () => {
    if (elStatus.textContent.startsWith('LOADING')) {
        return;
    }

    await ensureAudioContext();

    if (isPlaying) {
        // Pause
        if (typeof player.stop === 'function') {
            // Note: calling stop() in Magenta API without resetting currentTime is effectively a pause!
            player.stop();
        }
        isPlaying = false;
        btnPlay.textContent = "▶";
        elStatus.textContent = "PAUSED";
    } else {
        // Resume / Start
        if (player.src) {
            if (typeof player.start === 'function') {
                const startPromise = player.start();
                if (startPromise && typeof startPromise.catch === 'function') {
                    startPromise.catch(err => console.log(err));
                }
            }
            isPlaying = true;
            btnPlay.textContent = "⏸";
            elStatus.textContent = "PLAYING";
        } else if (midiList.length > 0) {
            loadMidi(currentMidiIndex);
        }
    }
});

document.getElementById('btn-stop').addEventListener('click', () => {
    // Hard stop and reset
    if (typeof player.stop === 'function') {
        player.stop();
    }

    try {
        // Force Magenta player back to the start!
        player.currentTime = 0;
    } catch(e) {}

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

dropZone.addEventListener('drop', async (e) => {
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

        await customElements.whenDefined('midi-player');
        await ensureAudioContext();

        player.src = url;
        player.playing = true;
        isPlaying = true;
        btnPlay.textContent = "⏸";
        elStatus.textContent = `PLAYING: ${file.name.toUpperCase()}`;
        elTrackInfo.textContent = file.name.toUpperCase();
    } else {
        elStatus.textContent = "INVALID FILE (.MID ONLY)";
    }
});

// --- Visualizer handled by html-midi-player ---
