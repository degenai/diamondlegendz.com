import { Synthesizer, Sequencer } from './libs/spessasynth_lib.js';

// --- State ---
let synth;
let sequencer;
let audioCtx;
let midiList = [];
let sfList = [];
let currentMidiIndex = 0;
let isPlaying = false;
let analyser;

// --- Elements ---
const elTrackSelect = document.getElementById('track-select');
const elSfSelect = document.getElementById('sf-select');
const elStatus = document.getElementById('status-bar');
const elStartOverlay = document.getElementById('start-overlay');
const elVisualizer = document.getElementById('visualizer');
const elTrackInfo = document.getElementById('track-info');
const btnPlay = document.getElementById('btn-play');

// --- Initialization ---

async function init() {
    try {
        // Init AudioContext
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();

        // Load Worklet Module
        elStatus.textContent = "LOADING AUDIO WORKLET...";
        try {
            await audioCtx.audioWorklet.addModule('./libs/spessasynth_worklet_processor.js');
        } catch (e) {
            throw new Error("Failed to load AudioWorklet. Check file path.");
        }

        // Init SpessaSynth
        elStatus.textContent = "INITIALIZING SYNTH...";
        synth = new Synthesizer(audioCtx, {
            enableEventSystem: true
        });

        // --- Audio Visualization & Output ---
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        // Connect: Synth -> Analyser -> Destination
        synth.connect(analyser);
        analyser.connect(audioCtx.destination);
        console.log("Audio graph connected: Synth -> Analyser -> Destination");

        // Create Sequencer
        sequencer = new Sequencer(synth);

        // Expose for debugging
        window.synth = synth;
        window.sequencer = sequencer;
        window.audioCtx = audioCtx;
        window.analyser = analyser;

        // Load Lists
        elStatus.textContent = "LOADING ASSETS...";
        await loadLists();

        // Load Default SoundFont
        if (sfList.length > 0) {
            await loadSoundFont(`soundfonts/sf2/${sfList[0]}`);
        }

        // Start Visualizer
        requestAnimationFrame(drawVisualizer);

        elStatus.textContent = "READY";
        elStartOverlay.classList.add('hidden');

    } catch (e) {
        console.error(e);
        elStatus.textContent = "ERROR INITIALIZING";

        // Feedback on overlay
        const overlayText = elStartOverlay.querySelector('h2');
        if (overlayText) {
            overlayText.textContent = "SYSTEM ERROR";
            overlayText.style.color = "red";
        }
        const overlaySub = elStartOverlay.querySelector('p');
        if (overlaySub) overlaySub.textContent = "CHECK CONSOLE.";

        // Reset to allow retry manually if needed (requires reloading usually)
        audioCtx = null;
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

    // Load SF List
    const sfResp = await fetch('soundfonts/sf2/soundfont_list.json');
    sfList = await sfResp.json();

    elSfSelect.innerHTML = '';
    sfList.forEach(file => {
        const opt = document.createElement('option');
        opt.value = file;
        opt.textContent = file;
        elSfSelect.appendChild(opt);
    });
}

// --- Player Logic ---

async function loadMidi(index) {
    if (index < 0 || index >= midiList.length) return;
    currentMidiIndex = index;

    const filename = midiList[index];
    elStatus.textContent = `LOADING TRACK: ${filename}...`;
    elTrackInfo.textContent = filename.replace('.mid', '').toUpperCase();

    try {
        const resp = await fetch(`midis/${filename}`);
        const buffer = await resp.arrayBuffer();

        // SpessaSynth expects arrays of binary data
        await sequencer.loadNewSongList([new Uint8Array(buffer)]);
        sequencer.currentTime = 0;

        if (isPlaying) {
            sequencer.play();
            btnPlay.textContent = "⏸";
        }

        // Highlight in list
        elTrackSelect.value = index;
        elStatus.textContent = "PLAYING";

    } catch (e) {
        console.error(e);
        elStatus.textContent = "LOAD ERROR";
    }
}

async function loadSoundFont(path) {
    elStatus.textContent = `LOADING SF2...`;
    try {
        // If path is external/absolute, use as is, else relative
        const url = path.includes('/') ? path : `soundfonts/sf2/${path}`;

        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();

        // Add to manager
        await synth.soundBankManager.addSoundBank(buffer, path);
        elStatus.textContent = "SF2 LOADED";
    } catch (e) {
        console.error("SF2 Load Error", e);
        elStatus.textContent = "SF2 ERROR";
    }
}

// --- Event Listeners ---

// Start Overlay (User Interaction for AudioContext)
elStartOverlay.addEventListener('click', () => {
    if (elStartOverlay.classList.contains('hidden')) return;

    // Provide immediate feedback
    const overlayText = elStartOverlay.querySelector('h2');
    if (overlayText) overlayText.textContent = "INITIALIZING...";

    if (!audioCtx) {
        init();
    } else if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            elStartOverlay.classList.add('hidden');
            if (isPlaying && sequencer) sequencer.play();
        });
    }
});

// Controls
document.getElementById('btn-play').addEventListener('click', () => {
    if (!sequencer) return;

    if (sequencer.paused) { // Check if paused
        if (!sequencer.midiData) {
            // If nothing loaded, load first
            loadMidi(currentMidiIndex);
            isPlaying = true;
        } else {
            sequencer.play();
            isPlaying = true;
        }
        btnPlay.textContent = "⏸";
    } else {
        sequencer.pause();
        isPlaying = false;
        btnPlay.textContent = "▶";
    }
});

document.getElementById('btn-stop').addEventListener('click', () => {
    if (!sequencer) return;
    sequencer.currentTime = 0;
    sequencer.stop();
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
    isPlaying = true; // Auto play on select
});

elSfSelect.addEventListener('change', (e) => {
    loadSoundFont(e.target.value);
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

    const buffer = await file.arrayBuffer();

    if (file.name.toLowerCase().endsWith('.sf2')) {
        elStatus.textContent = "LOADING CUSTOM SF2...";
        try {
            await synth.soundBankManager.addSoundBank(buffer, file.name);
            elStatus.textContent = "CUSTOM SF2 LOADED";
        } catch (e) {
            elStatus.textContent = "SF2 ERROR";
        }
    } else if (file.name.toLowerCase().endsWith('.mid')) {
        elStatus.textContent = "LOADING CUSTOM MIDI...";
        await sequencer.loadNewSongList([new Uint8Array(buffer)]);
        sequencer.play();
        isPlaying = true;
        btnPlay.textContent = "⏸";
        elStatus.textContent = `PLAYING: ${file.name.toUpperCase()}`;
        elTrackInfo.textContent = file.name.toUpperCase();
    }
});


// --- Visualization ---
const canvas = elVisualizer;
const ctx = canvas.getContext('2d');

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Progress Background
    if (sequencer && sequencer.duration) {
        const pct = sequencer.currentTime / sequencer.duration;
        ctx.fillStyle = '#333';
        ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

        ctx.fillStyle = '#39ff14'; // Neon Green
        const barWidth = canvas.width * pct;
        ctx.fillRect(0, canvas.height - 20, barWidth, 20);
    }

    // Draw Real Spectrum
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * (canvas.height - 30);

        const gradient = ctx.createLinearGradient(0, canvas.height - 30, 0, 0);
        gradient.addColorStop(0, '#00ff00');
        gradient.addColorStop(0.5, '#ffff00');
        gradient.addColorStop(1, '#ff0000');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, (canvas.height - 30) - barHeight, barWidth, barHeight);

        x += barWidth + 1;
    }
}
