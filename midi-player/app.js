// --- State ---
let midiList = [];
let currentMidiIndex = 0;
let shouldAutoplay = false;

// --- Elements ---
const elTrackSelect = document.getElementById('track-select');
const elSoundFontSelect = document.getElementById('soundfont-select');
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
        player.addEventListener('load', () => {
            // Fired when the MIDI file or soundfont finishes loading
            if (shouldAutoplay) {
                if (typeof player.start === 'function') {
                    const startPromise = player.start();
                    if (startPromise && typeof startPromise.catch === 'function') {
                        startPromise.catch(err => console.log("Autoplay blocked:", err));
                    }
                }
            } else {
                updateUIState();
            }
        });

        player.addEventListener('start', () => {
            updateUIState();
        });

        player.addEventListener('stop', () => {
            updateUIState();
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

function updateUIState() {
    const isPlaying = player.playing;

    if (isPlaying) {
        btnPlay.textContent = "⏸";
        if (elStatus.textContent.startsWith('LOADING CUSTOM')) {
            elStatus.textContent = `PLAYING: ${elTrackInfo.textContent}`;
        } else {
            elStatus.textContent = "PLAYING";
        }
    } else {
        btnPlay.textContent = "▶";
        // Only override status if it's not currently loading something
        if (!elStatus.textContent.startsWith('LOADING')) {
             if (player.currentTime > 0) {
                 elStatus.textContent = "PAUSED";
             } else {
                 elStatus.textContent = "STOPPED";
             }
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

        // Let the 'load' event trigger the playback start via shouldAutoplay
        shouldAutoplay = true;
        player.src = url;

        btnPlay.textContent = "⏳";
        elTrackSelect.value = index;

    } catch (e) {
        console.error(e);
        elStatus.textContent = "LOAD ERROR";
        shouldAutoplay = false;
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

    if (player.playing) {
        // Pause
        shouldAutoplay = false;
        if (typeof player.stop === 'function') {
            player.stop();
        }
    } else {
        // Resume / Start
        if (player.src) {
            shouldAutoplay = true;
            if (typeof player.start === 'function') {
                const startPromise = player.start();
                if (startPromise && typeof startPromise.catch === 'function') {
                    startPromise.catch(err => console.log(err));
                }
            }
        } else if (midiList.length > 0) {
            shouldAutoplay = true;
            loadMidi(currentMidiIndex);
        }
    }
});

document.getElementById('btn-stop').addEventListener('click', () => {
    shouldAutoplay = false;
    // Hard stop and reset
    if (typeof player.stop === 'function') {
        player.stop();
    }

    try {
        // Force Magenta player back to the start!
        player.currentTime = 0;
    } catch(e) {}

    updateUIState();
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

elSoundFontSelect.addEventListener('change', async (e) => {
    const url = e.target.value;

    // Remember if it was playing, so we can autoplay after the soundfont loads
    shouldAutoplay = player.playing;

    if (typeof player.stop === 'function') {
        player.stop();
    }

    elStatus.textContent = "LOADING SOUNDFONT...";
    btnPlay.textContent = "⏳";

    // This triggers the fetch, and eventually the 'load' event
    player.setAttribute('sound-font', url);
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

        if (typeof player.stop === 'function') {
            player.stop();
        }

        await customElements.whenDefined('midi-player');
        await ensureAudioContext();

        shouldAutoplay = true;
        player.src = url;

        btnPlay.textContent = "⏳";
        elStatus.textContent = `LOADING: ${file.name.toUpperCase()}`;
        elTrackInfo.textContent = file.name.toUpperCase();

    } else {
        elStatus.textContent = "INVALID FILE (.MID ONLY)";
    }
});

// --- Visualizer handled by html-midi-player ---
