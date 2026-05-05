// Accordion-Tab Forge — interactive layer.
// Drop a MIDI → preview via html-midi-player + render staff (VexFlow) + tab-strip placeholder.
// Audio ingestion + LLM mapping land in later phases.

import { animate, stagger, spring, utils } from '../facets/vendor/anime.esm.min.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const dropZone = document.getElementById('forge-drop');
const dropText = document.getElementById('forge-drop-text');
const fileInput = document.getElementById('forge-file');
const tuningSelect = document.getElementById('forge-tuning');
const tierRadios = document.querySelectorAll('input[name="forge-tier"]');
const outSection = document.getElementById('forge-out');
const player = document.getElementById('forge-player');
const visualizer = document.getElementById('forge-visualizer');
const staffEl = document.getElementById('forge-staff');
const tabEl = document.getElementById('forge-tab');
const metaEl = document.getElementById('forge-meta');

let lastBlobUrl = null;
let currentMidi = null;

// === Document-level drag prevent so missed drops don't navigate the browser. ===
['dragover', 'drop'].forEach(evt => {
    window.addEventListener(evt, (e) => {
        if (!dropZone.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, false);
});

// === Drop / click handlers ===
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
});
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('over');
});
dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('over');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
});

async function handleFile(file) {
    if (!/\.midi?$/i.test(file.name)) {
        dropText.textContent = `❌ ${file.name} — must be .mid / .midi`;
        return;
    }
    dropText.textContent = `📂 ${file.name}`;

    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    const url = URL.createObjectURL(file);
    lastBlobUrl = url;

    // Wait for player custom element if not ready yet.
    if (window.customElements) {
        await Promise.all([
            customElements.whenDefined('midi-player'),
            customElements.whenDefined('midi-visualizer'),
        ]).catch(() => {});
    }
    player.src = url;

    // Parse for staff + tab.
    const buf = await file.arrayBuffer();
    try {
        currentMidi = new Midi(buf);
        renderAll();
        outSection.classList.add('live');
        animateForgeOut();
    } catch (err) {
        metaEl.textContent = `Parse error: ${err.message}`;
    }
}

// === Re-render on tier / tuning change ===
tierRadios.forEach(r => r.addEventListener('change', () => { if (currentMidi) renderAll(); }));
tuningSelect.addEventListener('change', () => { if (currentMidi) renderAll(); });

function currentTier() {
    return Array.from(tierRadios).find(r => r.checked).value;
}

function renderAll() {
    const tier = currentTier();
    const tuning = tuningSelect.value;
    const allNotes = currentMidi.tracks.flatMap(t => t.notes);
    const trackName = currentMidi.tracks.find(t => t.notes.length)?.name || 'untitled';

    metaEl.innerHTML = `
        <strong>${currentMidi.tracks.length}</strong> track${currentMidi.tracks.length === 1 ? '' : 's'} ·
        <strong>${allNotes.length}</strong> notes ·
        duration <strong>${currentMidi.duration.toFixed(1)}s</strong> ·
        tempo <strong>${(currentMidi.header.tempos[0]?.bpm || 120).toFixed(1)}</strong> BPM ·
        tier <strong>${tier}</strong> · tuning <strong>${tuning}</strong>
    `;

    renderStaff(allNotes.slice().sort((a, b) => a.time - b.time));
    renderTab(allNotes.slice().sort((a, b) => a.time - b.time), tier, tuning);
}

// === VexFlow staff render ===
const VF = window.Vex ? window.Vex.Flow : null;

function midiToVexKey(midiNum) {
    const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const oct = Math.floor(midiNum / 12) - 1;
    return `${names[midiNum % 12]}/${oct}`;
}

function durationToVfDur(seconds, bpm) {
    const beat = 60 / bpm;
    const ratio = seconds / beat;
    if (ratio >= 3.5) return 'w';
    if (ratio >= 1.75) return 'h';
    if (ratio >= 0.875) return 'q';
    if (ratio >= 0.4) return '8';
    if (ratio >= 0.2) return '16';
    return '16';
}

function renderStaff(notes) {
    if (!VF) {
        staffEl.innerHTML = '<p style="color:#900;">VexFlow not loaded</p>';
        return;
    }
    staffEl.innerHTML = '';
    const slice = notes.slice(0, 32);
    if (!slice.length) {
        staffEl.innerHTML = '<p style="color:#900;">No notes to render</p>';
        return;
    }

    const bpm = currentMidi.header.tempos[0]?.bpm || 120;
    const isHigh = (n) => n.midi >= 60;
    const trebleNotes = slice.filter(isHigh);
    const bassNotes = slice.filter(n => !isHigh(n));

    const renderer = new VF.Renderer(staffEl, VF.Renderer.Backends.SVG);
    const w = Math.max(800, slice.length * 30);
    renderer.resize(w, 240);
    const ctx = renderer.getContext();

    const trebleStave = new VF.Stave(10, 10, w - 20).addClef('treble').addTimeSignature('4/4');
    const bassStave = new VF.Stave(10, 110, w - 20).addClef('bass');
    trebleStave.setContext(ctx).draw();
    bassStave.setContext(ctx).draw();

    const buildVoice = (arr, clef) => {
        if (!arr.length) {
            const rest = new VF.StaveNote({ keys: ['b/4'], duration: 'wr', clef });
            const v = new VF.Voice({ num_beats: 4, beat_value: 4 });
            v.setMode(VF.Voice.Mode.SOFT);
            v.addTickables([rest]);
            return v;
        }
        const tickables = arr.slice(0, 16).map(n => {
            try {
                return new VF.StaveNote({
                    keys: [midiToVexKey(n.midi)],
                    duration: durationToVfDur(n.duration, bpm),
                    clef,
                });
            } catch (e) {
                return new VF.StaveNote({ keys: ['b/4'], duration: 'q', clef });
            }
        });
        const v = new VF.Voice({ num_beats: 4, beat_value: 4 });
        v.setMode(VF.Voice.Mode.SOFT);
        v.addTickables(tickables);
        return v;
    };

    try {
        const trebleVoice = buildVoice(trebleNotes, 'treble');
        const bassVoice = buildVoice(bassNotes, 'bass');
        new VF.Formatter().joinVoices([trebleVoice]).format([trebleVoice], w - 100);
        new VF.Formatter().joinVoices([bassVoice]).format([bassVoice], w - 100);
        trebleVoice.draw(ctx, trebleStave);
        bassVoice.draw(ctx, bassStave);
    } catch (e) {
        staffEl.innerHTML = `<p style="color:#900;">Render error: ${e.message}</p>`;
    }
}

// === Tab strip placeholder ===
function pitchName(midi) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return names[midi % 12] + (Math.floor(midi / 12) - 1);
}

function buttonPlaceholder(midiNum, tuning) {
    // Placeholder logic until the GCF button-map dataset (Phase 1) lands.
    // Indicates which row a pitch *might* sit on for a 3-row GCF Panther; bellows direction TBD.
    if (tuning !== 'GCF') return '? — tuning data TBD';
    const pc = midiNum % 12;
    const rowMap = {
        7: 'outer (G/Sol)', 11: 'outer', 2: 'outer',
        0: 'middle (C/Do)', 4: 'middle', 9: 'middle',
        5: 'inner (F/Fa)', 10: 'inner', 3: 'inner',
    };
    return rowMap[pc] || `chromatic ${pitchName(midiNum)} — TBD`;
}

function renderTab(notes, tier, tuning) {
    const slice = notes.slice(0, 60);
    const lines = slice.map((n, i) => {
        const ix = String(i + 1).padStart(2, '0');
        const pn = pitchName(n.midi).padEnd(4);
        const startBeat = (n.time / (60 / (currentMidi.header.tempos[0]?.bpm || 120))).toFixed(2);
        let line;
        if (tier === 'universal') {
            line = `<span class="ix">${ix}</span><span class="pn">${pn}</span> at beat ${startBeat}, dur ${n.duration.toFixed(2)}s`;
        } else if (tier === 'harmony') {
            const isLeft = n.midi < 60;
            const where = isLeft
                ? `LH button (1-of-12) — TBD per Phase 1 dataset`
                : `RH ${buttonPlaceholder(n.midi, tuning)}`;
            line = `<span class="ix">${ix}</span><span class="pn">${pn}</span> <span class="bn">${where}</span>`;
        } else {
            line = `<span class="ix">${ix}</span><span class="pn">${pn}</span> <span class="bn">${buttonPlaceholder(n.midi, tuning)}</span> · bellows ?`;
        }
        return `<div class="tab-line">${line}</div>`;
    });
    if (slice.length < notes.length) {
        lines.push(`<div class="tab-line" style="opacity:0.6;font-style:italic;">… ${notes.length - slice.length} more notes (full tab needs the Phase 1 button-map dataset)</div>`);
    }
    tabEl.innerHTML = lines.join('');
}

// === anime.js entrance for the forge section ===
const forgeSection = document.getElementById('forge');
if (forgeSection && !REDUCED_MOTION) {
    utils.set(forgeSection, { opacity: 0, scale: 0.96 });
    animate(forgeSection, {
        opacity: [0, 1], scale: [0.96, 1],
        duration: 700,
        delay: 200,
        ease: spring({ mass: 1, stiffness: 90, damping: 12 }),
    });
}

function animateForgeOut() {
    if (REDUCED_MOTION) {
        utils.set('#forge-out > *', { opacity: 1, y: 0 });
        return;
    }
    const kids = document.querySelectorAll('#forge-out > *');
    utils.set(kids, { opacity: 0, y: 12 });
    animate(kids, {
        opacity: [0, 1], y: [12, 0],
        duration: 450,
        delay: stagger(80),
        ease: 'outQuad',
    });
}
