// SF Turbo MIDI Player — html-midi-player engine + anime.js v4 entrance choreography.

import { animate, stagger, spring, utils } from '../facets/vendor/anime.esm.min.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Stop browser from navigating to / opening dropped files when the drag misses
// the drop-zone proper. Without these the page falls back to the OS default which
// looks like the browser has hijacked the drop.
['dragover', 'drop'].forEach(evt => {
    window.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

const elTrackSelect = document.getElementById('track-select');
const elStatus = document.getElementById('status-bar');
const elTrackInfo = document.getElementById('track-info');
const elDropZone = document.getElementById('drop-zone');

let player = null;
let midiList = [];
let lastDropUrl = null;
let pendingSrc = null;

async function loadLists() {
    try {
        const resp = await fetch('midis/file_list.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        midiList = await resp.json();

        elTrackSelect.innerHTML = '';
        midiList.forEach((file, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = file.replace(/\.midi?$/i, '').replace(/_/g, ' ').toUpperCase();
            elTrackSelect.appendChild(opt);
        });
        elStatus.textContent = `READY — ${midiList.length} TRACKS`;
    } catch (e) {
        console.error('Track list load failed:', e);
        elTrackSelect.innerHTML = '<option>FAILED TO LOAD</option>';
        elStatus.textContent = `ERROR: ${e.message}`;
    }
}

function loadIntoPlayer(url, label) {
    if (lastDropUrl && lastDropUrl !== url && url.startsWith('blob:')) {
        URL.revokeObjectURL(lastDropUrl);
    }
    elTrackInfo.textContent = label.toUpperCase();
    if (!player) {
        pendingSrc = { url, label };
        elStatus.textContent = "WAITING FOR PLAYER...";
        return;
    }
    player.src = url;
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
    e.stopPropagation();
    elDropZone.style.borderColor = '#fff';
});
elDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    elDropZone.style.borderColor = '#555';
});
elDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
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

// Wait for the html-midi-player custom element to register before we trust it.
async function bindPlayer() {
    if (!window.customElements) {
        console.error('No customElements support');
        elStatus.textContent = "BROWSER UNSUPPORTED";
        return;
    }
    try {
        await Promise.all([
            customElements.whenDefined('midi-player'),
            customElements.whenDefined('midi-visualizer'),
        ]);
    } catch (e) {
        console.error('Player components failed to register:', e);
        elStatus.textContent = "PLAYER COMPONENTS FAILED";
        return;
    }
    player = document.getElementById('player');
    if (!player) {
        elStatus.textContent = "PLAYER ELEMENT MISSING";
        return;
    }
    player.addEventListener('start', () => { elStatus.textContent = "PLAYING"; });
    player.addEventListener('stop', () => { elStatus.textContent = "STOPPED"; });
    player.addEventListener('load', () => { /* keep current label */ });
    if (pendingSrc) {
        player.src = pendingSrc.url;
        elStatus.textContent = `LOADED: ${pendingSrc.label.toUpperCase()}`;
        pendingSrc = null;
    }
}

bindPlayer();
loadLists();

// --- anime.js v4 entrance choreography ---
const cabinet = document.querySelector('.arcade-cabinet');
const h1 = document.querySelector('header h1');
const panels = document.querySelectorAll('.panel');
const visFrame = document.querySelector('.vis-frame');

// Title char-stagger entrance — splits "STREET FIGHTER II / TURBO MIDI PLAYER" into spans
if (h1) {
    const text = h1.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    h1.innerHTML = text.split('').map(c => {
        if (c === '\n') return '<br>';
        if (c === ' ') return '<span class="ch">&nbsp;</span>';
        return `<span class="ch">${c}</span>`;
    }).join('');
}
const chars = h1 ? h1.querySelectorAll('.ch') : [];

if (REDUCED_MOTION) {
    if (cabinet) utils.set(cabinet, { scale: 1, opacity: 1 });
    if (panels.length) utils.set(panels, { x: 0, opacity: 1 });
    if (visFrame) utils.set(visFrame, { opacity: 1 });
    if (chars.length) utils.set(chars, { y: 0, opacity: 1 });
} else {
    if (cabinet) {
        utils.set(cabinet, { scale: 0.92, opacity: 0 });
        animate(cabinet, {
            scale: [0.92, 1], opacity: [0, 1],
            duration: 700,
            ease: spring({ mass: 1, stiffness: 90, damping: 12 }),
        });
    }
    if (chars.length) {
        utils.set(chars, { y: -30, opacity: 0 });
        animate(chars, {
            y: [-30, 0], opacity: [0, 1],
            duration: 600,
            delay: stagger(28, { start: 200 }),
            ease: spring({ mass: 1, stiffness: 110, damping: 11 }),
        });
    }
    if (panels.length) {
        utils.set(panels, { x: -20, opacity: 0 });
        animate(panels, {
            x: [-20, 0], opacity: [0, 1],
            duration: 500,
            delay: stagger(120, { start: 400 }),
            ease: 'outQuad',
        });
    }
    if (visFrame) {
        utils.set(visFrame, { opacity: 0 });
        animate(visFrame, {
            opacity: [0, 1],
            duration: 400,
            delay: 350,
            ease: 'outQuad',
        });
    }
}

// --- Pulse the visualizer frame on play / cool it on stop ---
let pulseAnim = null;
function startPulse() {
    if (REDUCED_MOTION || !visFrame) return;
    if (pulseAnim) pulseAnim.pause();
    pulseAnim = animate(visFrame, {
        boxShadow: [
            '0 0 0 var(--neon-green)',
            '0 0 18px var(--neon-pink)',
            '0 0 0 var(--neon-green)',
        ],
        duration: 1600,
        ease: 'inOutSine',
        loop: true,
    });
}
function stopPulse() {
    if (pulseAnim) { pulseAnim.pause(); pulseAnim = null; }
    if (visFrame) visFrame.style.boxShadow = '';
}

// Hook the pulse to player events once player is bound.
const origBindPlayer = bindPlayer;
window.__playerPulseHooked = false;
async function hookPulse() {
    while (!player) await new Promise(r => setTimeout(r, 50));
    if (window.__playerPulseHooked) return;
    window.__playerPulseHooked = true;
    player.addEventListener('start', startPulse);
    player.addEventListener('stop', stopPulse);
}
hookPulse();
