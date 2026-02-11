import { Synthesizer, SoundBankLoader } from './libs/spessasynth_lib.js';

// --- Constants & State ---
let synth = null;
let audioCtx = null;
let midiData = null; // Store loaded MIDI data
const visualizerCanvas = document.getElementById('visualizer');
const ctx = visualizerCanvas.getContext('2d');
const statusBar = document.getElementById('status-bar');
const timeDisplay = document.getElementById('time-display');
const trackName = document.getElementById('track-name');

// Visualizer State
let notes = []; // Active notes for visualization
const FALL_SPEED = 200; // Pixels per second

// --- Initialization ---

async function initAudio() {
    if (audioCtx) return;

    try {
        audioCtx = new AudioContext();
        await audioCtx.resume();
        statusBar.textContent = "AUDIO ENGINE STARTING...";

        // Audio is ready. Check if we need to load the selected SoundFont.
        if (!synth) {
            const sfSelector = document.getElementById('sf-selector');
            if (sfSelector.value && sfSelector.value !== 'custom') {
                await loadSoundFontURL(sfSelector.value);
            } else {
                statusBar.textContent = "PLEASE SELECT OR DROP A SOUNDFONT";
            }
        }

    } catch (e) {
        console.error(e);
        statusBar.textContent = "ERROR STARTING AUDIO: " + e.message;
    }
}

async function loadSoundFontList() {
    // Check our generated list
    try {
        statusBar.textContent = "LOADING SF LIST...";
        const response = await fetch('soundfonts/sf2/soundfont_list.json?t=' + Date.now());
        if (!response.ok) throw new Error("SF LIST 404");
        const sfList = await response.json();
        console.log("SF List:", sfList);

        const sfSelector = document.getElementById('sf-selector');

        // Populate Dropdown (keep "Custom" option)
        // Clear existing except custom
        while (sfSelector.options.length > 1) {
            sfSelector.remove(0);
        }

        if (sfList.length === 0) {
            statusBar.textContent = "NO SOUNDFONTS INDEXED.";
        } else {
            statusBar.textContent = "READY PLAYER ONE";
        }

        sfList.forEach(file => {
            const option = document.createElement('option');
            option.value = `soundfonts/sf2/${file}`;
            option.textContent = file.toUpperCase();
            sfSelector.prepend(option); // Add to top
        });

        if (sfList.length > 0) {
            const defaultSF = `soundfonts/sf2/${sfList[0]}`;
            sfSelector.value = defaultSF;
            // WE DO NOT AUTO-LOAD here because it requires AudioContext click
            // We just select it in the UI.
        } else {
            sfSelector.value = "custom";
        }

    } catch (e) {
        console.warn("Could not load SF list", e);
        statusBar.textContent = "ERR LOADING SF LIST: " + e.message;
    }
}

async function loadSoundFontURL(url) {
    statusBar.textContent = "DL SF2 (0%)...";
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("SF2 404");

        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (total) {
                const percent = Math.floor((loaded / total) * 100);
                if (percent % 10 === 0) statusBar.textContent = `DL SF2 (${percent}%)...`;
            }
        }

        statusBar.textContent = "BUILDING BUFFER...";
        const buffer = new Uint8Array(loaded);
        let position = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, position);
            position += chunk.length;
        }

        await loadSoundFontBuffer(buffer.buffer); // Pass ArrayBuffer
        statusBar.textContent = "READY PLAYER ONE";
    } catch (e) {
        statusBar.textContent = "ERR SF2 DL: " + e.message;
        console.error(e);
        throw e;
    }
}

async function loadSoundFontBuffer(buffer) {
    statusBar.textContent = "INIT AUDIO ENGINE...";
    if (!audioCtx) await initAudio();

    statusBar.textContent = "PARSING SF2...";

    try {
        if (synth) {
            // Reload
            const font = SoundBankLoader.fromArrayBuffer(buffer);
            synth.soundBankManager.addSoundBank(font);
        } else {
            // Initialize
            statusBar.textContent = "LOADING WORKLET...";
            try {
                await audioCtx.audioWorklet.addModule('./libs/spessasynth_worklet_processor.js');
                console.log("Worklet module added");
            } catch (e) {
                console.warn("Worklet addModule failed (maybe already added?)", e);
            }

            statusBar.textContent = "CREATING SYNTH...";
            synth = new Synthesizer(audioCtx);
            const font = SoundBankLoader.fromArrayBuffer(buffer);
            synth.soundBankManager.addSoundBank(font);
            synth.connect(audioCtx.destination); // Connect to output
            try {
                await synth.isReady; // Wait for it to be ready
            } catch (e) {
                console.warn("No isReady found or failed", e);
            }

            setupVisualizer();
        }
        statusBar.textContent = "SYNTH READY.";
    } catch (e) {
        console.error("Synth Error", e);
        statusBar.textContent = "SYNTH ERR: " + e.message;
        throw e;
    }
}

// --- Player Controls ---

document.getElementById('play-btn').addEventListener('click', async () => {
    if (!audioCtx) await initAudio();
    if (!synth) {
        statusBar.textContent = "PLEASE LOAD A SOUNDFONT FIRST";
        return;
    }
    synth.play();
    statusBar.textContent = "PLAYING >>";
});

document.getElementById('stop-btn').addEventListener('click', () => {
    if (synth) {
        synth.stop(); // This usually pauses/stops
        synth.currentTime = 0;
        statusBar.textContent = "STOPPED";
    }
});

// Play/Pause toggle logic might be needed on 'play' if it's already playing.
// SpessaSynth play() resumes.

// --- File Handling ---

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#00ff00';
    dropZone.textContent = "DROP IT!";
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#444';
    dropZone.textContent = "DRAG & DROP MIDI OR SF2 FILE HERE";
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#444';
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

async function handleFile(file) {
    const reader = new FileReader();

    reader.onload = async (e) => {
        const buffer = e.target.result;

        if (file.name.toLowerCase().endsWith('.sf2')) {
            statusBar.textContent = "LOADING CUSTOM SOUNDFONT...";
            await loadSoundFontBuffer(buffer);
            statusBar.textContent = `LOADED SF2: ${file.name.toUpperCase()}`;
        } else if (file.name.toLowerCase().endsWith('.mid') || file.name.toLowerCase().endsWith('.midi')) {
            if (!synth) {
                statusBar.textContent = "LOAD A SOUNDFONT FIRST!";
                return;
            }
            statusBar.textContent = "PARSING MIDI...";
            try {
                synth.reload(buffer); // Loads the MIDI data
                trackName.textContent = file.name.toUpperCase().replace('.MID', '').replace('.MIDI', '');
                synth.play();
                statusBar.textContent = "PLAYING NEW TRACK";
            } catch (err) {
                statusBar.textContent = "INVALID MIDI FILE";
                console.error(err);
            }
        }
    };

    reader.readAsArrayBuffer(file);
}

// --- Track & SF Selector Logic ---

const trackSelector = document.getElementById('track-selector');
const sfSelector = document.getElementById('sf-selector');

sfSelector.addEventListener('change', async (e) => {
    if (e.target.value === 'custom') {
        fileInput.accept = ".sf2";
        fileInput.click();
    } else if (e.target.value) {
        await loadSoundFontURL(e.target.value);
    }
});

// Load MIDI list
async function loadTrackList() {
    try {
        const response = await fetch('midis/file_list.json');
        const files = await response.json();

        // Clear loading option
        trackSelector.innerHTML = '<option value="">-- SELECT A FIGHTER (TRACK) --</option>';

        files.forEach(file => {
            const option = document.createElement('option');
            option.value = `midis/${file}`;
            option.textContent = file.replace(/_/g, ' ').replace('.mid', '').replace('.midi', '').toUpperCase();
            trackSelector.appendChild(option);
        });
    } catch (e) {
        trackSelector.innerHTML = '<option>ERROR LOADING TRACKS</option>';
    }
}

trackSelector.addEventListener('change', async (e) => {
    if (!e.target.value) return;
    if (!synth) {
        statusBar.textContent = "LOAD SOUNDFONT FIRST";
        return;
    }

    statusBar.textContent = "LOADING TRACK...";
    const response = await fetch(e.target.value);
    const buffer = await response.arrayBuffer();
    synth.reload(buffer);
    trackName.textContent = e.target.options[e.target.selectedIndex].text;
    synth.play();
    statusBar.textContent = "FIGHT!";
});

// --- Visualizer ---

function setupVisualizer() {
    if (!synth) return;

    // Safety check for event system
    try {
        // SpessaSynth 2.x event handler
        // If eventHandler is exposed
        if (synth.eventHandler) {
            synth.eventHandler.addEvent("noteOn", "vis-note-on", (data) => {
                notes.push({
                    note: data.midiNote,
                    velocity: data.velocity,
                    y: 0,
                    channel: data.channel,
                    color: `hsl(${data.channel * 25}, 100%, 50%)`
                });
            });
        }
    } catch (e) {
        console.warn("Visualizer setup failed:", e);
    }
}

function drawVisualizer() {
    // Setup canvas size
    visualizerCanvas.width = visualizerCanvas.clientWidth;
    visualizerCanvas.height = visualizerCanvas.clientHeight;

    const w = visualizerCanvas.width;
    const h = visualizerCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw notes
    const noteWidth = w / 128;

    // Update and draw
    for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        n.y += 2; // speed

        ctx.fillStyle = n.color;
        ctx.fillRect(n.note * noteWidth, n.y, noteWidth, 10); // Simple falling rectangle

        // Remove if off screen
        if (n.y > h) {
            notes.splice(i, 1);
        }
    }

    // Time display update
    if (synth && synth.currentTime) {
        const now = Math.floor(synth.currentTime);
        const total = Math.floor(synth.duration || 0);
        timeDisplay.textContent = formatTime(now) + " / " + formatTime(total);

        // Update status bar if playing
        if (now >= total && total > 0) {
            statusBar.textContent = "GAME OVER (TRACK ENDED)";
        }
    }

    requestAnimationFrame(drawVisualizer);
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// Start loop
requestAnimationFrame(drawVisualizer);

// Init on load
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready, loading list...");
    loadSoundFontList();
    loadTrackList();
});
