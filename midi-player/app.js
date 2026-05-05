// --- State ---
let midiList = [];
let currentMidiIndex = 0;
let isPlaying = false;
let fakeVisualizerActive = false;
let startTime = 0;
let lastDropUrl = null;

// --- Elements ---
const elTrackSelect = document.getElementById('track-select');
const elStatus = document.getElementById('status-bar');
const elStartOverlay = document.getElementById('start-overlay');
const elVisualizer = document.getElementById('visualizer');
const elTrackInfo = document.getElementById('track-info');
const btnPlay = document.getElementById('btn-play');

// --- Initialization ---
async function init() {
    elStatus.textContent = "LOADING DIRECTORY...";
    try {
        await loadLists();
        elStatus.textContent = "READY";
        elStartOverlay.classList.add('hidden');

        // Start "fake" Visualizer loop
        requestAnimationFrame(drawVisualizer);
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

        // Play directly via MIDIjs
        MIDIjs.play(url);

        isPlaying = true;
        btnPlay.textContent = "⏸";
        elTrackSelect.value = index;
        elStatus.textContent = "PLAYING";
        fakeVisualizerActive = true;
        startTime = Date.now();

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
        MIDIjs.pause();
        isPlaying = false;
        fakeVisualizerActive = false;
        btnPlay.textContent = "▶";
        elStatus.textContent = "PAUSED";
    } else {
        if (elTrackSelect.value === 'LOADING...') return;

        // If nothing is playing and hasn't started yet, play the selected
        if (elStatus.textContent === "READY" || elStatus.textContent === "STOPPED") {
            loadMidi(currentMidiIndex);
        } else {
            // It was paused, so resume
            MIDIjs.resume();
            isPlaying = true;
            fakeVisualizerActive = true;
            btnPlay.textContent = "⏸";
            elStatus.textContent = "PLAYING";
        }
    }
});

document.getElementById('btn-stop').addEventListener('click', () => {
    MIDIjs.stop();
    isPlaying = false;
    fakeVisualizerActive = false;
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

    const lower = file.name.toLowerCase();
    if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
        elStatus.textContent = "LOADING CUSTOM MIDI...";

        if (lastDropUrl) URL.revokeObjectURL(lastDropUrl);
        const url = URL.createObjectURL(file);
        lastDropUrl = url;

        MIDIjs.play(url);
        isPlaying = true;
        fakeVisualizerActive = true;
        btnPlay.textContent = "⏸";
        elStatus.textContent = `PLAYING: ${file.name.toUpperCase()}`;
        elTrackInfo.textContent = file.name.toUpperCase();
        startTime = Date.now();
    } else {
        elStatus.textContent = "INVALID FILE (.MID / .MIDI ONLY)";
    }
});

// --- Fake Visualization ---
const canvas = elVisualizer;
const ctx = canvas.getContext('2d');
let fakeHeights = [];

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);

    // Resize handling if needed, though hardcoded in css initially
    const bufferLength = 32; // nice chunky retro bars

    if (fakeHeights.length !== bufferLength) {
        fakeHeights = new Array(bufferLength).fill(0);
    }

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fake Progress loop (since MIDIjs doesn't easily expose current time)
    ctx.fillStyle = '#333';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    if (isPlaying) {
        // Just loop a progress bar every 60s for visual feedback
        const elapsed = (Date.now() - startTime) % 60000;
        const pct = elapsed / 60000;
        ctx.fillStyle = '#39ff14'; // Neon Green
        const barWidthProgress = canvas.width * pct;
        ctx.fillRect(0, canvas.height - 20, barWidthProgress, 20);
    }

    // Draw spectrum
    const barWidth = (canvas.width / bufferLength) * 0.9;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        // Generate bouncy fake data
        if (fakeVisualizerActive) {
            // Randomly jump up, smoothly decay
            if (Math.random() > 0.8) {
                fakeHeights[i] = Math.random() * 255;
            } else {
                fakeHeights[i] = Math.max(0, fakeHeights[i] - 10);
            }
        } else {
            fakeHeights[i] = Math.max(0, fakeHeights[i] - 15);
        }

        const barHeight = (fakeHeights[i] / 255) * (canvas.height - 30);

        const gradient = ctx.createLinearGradient(0, canvas.height - 30, 0, 0);
        gradient.addColorStop(0, '#00ff00');
        gradient.addColorStop(0.5, '#ffff00');
        gradient.addColorStop(1, '#ff0000');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, (canvas.height - 30) - barHeight, barWidth, barHeight);

        x += (canvas.width / bufferLength);
    }
}
