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
    if (!notes.length) {
        staffEl.innerHTML = '<p style="color:#900;">No notes to render</p>';
        return;
    }

    const bpm = currentMidi.header.tempos[0]?.bpm || 120;
    const beatSec = 60 / bpm;
    const measureSec = beatSec * 4; // 4/4 default
    const slice = notes.slice(0, 64);
    const isHigh = (n) => n.midi >= 60;

    // Group notes into measures by start-time. Pickup notes (anything before
    // the first downbeat at t=0) collapse into measure 0 as an anacrusis bar.
    const measures = []; // [{start, end, treble:[], bass:[]}]
    const totalSpan = slice[slice.length - 1].time + slice[slice.length - 1].duration;
    const numMeasures = Math.max(1, Math.ceil(totalSpan / measureSec));
    for (let m = 0; m < numMeasures; m++) {
        measures.push({
            start: m * measureSec,
            end: (m + 1) * measureSec,
            treble: [],
            bass: [],
        });
    }
    slice.forEach(n => {
        const m = Math.min(numMeasures - 1, Math.floor(n.time / measureSec));
        (isHigh(n) ? measures[m].treble : measures[m].bass).push(n);
    });

    // Render each measure as its own pair of staves side-by-side so barlines
    // come naturally from the stave's own end-bar.
    const measureWidth = 220;
    const totalWidth = Math.max(800, 60 + measureWidth * Math.min(measures.length, 8));
    const visibleMeasures = measures.slice(0, 8);
    const renderer = new VF.Renderer(staffEl, VF.Renderer.Backends.SVG);
    renderer.resize(totalWidth, 240);
    const ctx = renderer.getContext();

    let x = 10;
    visibleMeasures.forEach((meas, idx) => {
        const w = idx === 0 ? measureWidth + 60 : measureWidth;
        const trebleStave = new VF.Stave(x, 10, w);
        const bassStave = new VF.Stave(x, 110, w);
        if (idx === 0) {
            trebleStave.addClef('treble').addTimeSignature('4/4');
            bassStave.addClef('bass');
        }
        trebleStave.setContext(ctx).draw();
        bassStave.setContext(ctx).draw();

        const fillVoice = (arr, clef) => {
            const v = new VF.Voice({ num_beats: 4, beat_value: 4 });
            v.setMode(VF.Voice.Mode.SOFT);
            if (!arr.length) {
                v.addTickables([new VF.StaveNote({ keys: ['b/4'], duration: 'wr', clef })]);
                return v;
            }
            const tickables = arr.slice(0, 8).map(n => {
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
            v.addTickables(tickables);
            return v;
        };

        try {
            const tv = fillVoice(meas.treble, 'treble');
            const bv = fillVoice(meas.bass, 'bass');
            new VF.Formatter().joinVoices([tv]).format([tv], w - 30);
            new VF.Formatter().joinVoices([bv]).format([bv], w - 30);
            tv.draw(ctx, trebleStave);
            bv.draw(ctx, bassStave);
        } catch (e) {
            // Non-fatal — skip the measure if VexFlow chokes.
        }

        x += w;
    });

    if (measures.length > 8) {
        const note = document.createElement('p');
        note.style.cssText = 'color:#5A3F8C;font-style:italic;margin-top:6px;';
        note.textContent = `Showing 8 of ${measures.length} measures · first ${slice.length} of ${notes.length} notes`;
        staffEl.appendChild(note);
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
    // Tab is measure-less by tradition — like guitar tab. No bar lines, no time
    // signature. Just sequential button-press order with section dividers every
    // 16 notes for visual orientation. Pickup notes need no special handling
    // because there's no downbeat for them to fall before.
    const slice = notes.slice(0, 96);
    const bpm = currentMidi.header.tempos[0]?.bpm || 120;
    const lines = [];
    slice.forEach((n, i) => {
        if (i > 0 && i % 16 === 0) {
            lines.push(`<div class="tab-line" style="text-align:center;color:#5A3F8C;border-top:2px solid #2a2a3e;border-bottom:none;padding-top:6px;">— phrase ${Math.floor(i / 16) + 1} —</div>`);
        }
        const ix = String(i + 1).padStart(2, '0');
        const pn = pitchName(n.midi).padEnd(4);
        let line;
        if (tier === 'universal') {
            const startBeat = (n.time / (60 / bpm)).toFixed(2);
            line = `<span class="ix">${ix}</span><span class="pn">${pn}</span> beat ${startBeat}, dur ${n.duration.toFixed(2)}s`;
        } else if (tier === 'harmony') {
            const isLeft = n.midi < 60;
            const where = isLeft
                ? `LH button (1-of-12) — TBD per Phase 1 dataset`
                : `RH ${buttonPlaceholder(n.midi, tuning)}`;
            line = `<span class="ix">${ix}</span><span class="pn">${pn}</span> <span class="bn">${where}</span>`;
        } else {
            line = `<span class="ix">${ix}</span><span class="pn">${pn}</span> <span class="bn">${buttonPlaceholder(n.midi, tuning)}</span> · bellows ?`;
        }
        lines.push(`<div class="tab-line">${line}</div>`);
    });
    if (slice.length < notes.length) {
        lines.push(`<div class="tab-line" style="opacity:0.6;font-style:italic;text-align:center;">… ${notes.length - slice.length} more notes — full tab needs the Phase 1 button-map dataset</div>`);
    }
    tabEl.innerHTML = lines.join('');
}

// === DeepSeek mapping (Stage 6, alpha) =====================================
// Sends notes + button-map dataset to DeepSeek's chat-completion API. The user
// provides their own API key via the page-side input (saved to localStorage only).
// For production, swap this for a Cloudflare Worker that holds the key server-side.

const keyInput = document.getElementById('forge-deepseek-key');
const mapBtn = document.getElementById('forge-map-btn');
const mapStatus = document.getElementById('forge-map-status');
const llmHeading = document.getElementById('forge-llm-heading');
const llmMeta = document.getElementById('forge-llm-meta');
const llmEl = document.getElementById('forge-llm');

const KEY_STORAGE = 'forge_deepseek_key_v1';

if (keyInput) {
    keyInput.value = localStorage.getItem(KEY_STORAGE) || '';
    keyInput.addEventListener('input', () => {
        localStorage.setItem(KEY_STORAGE, keyInput.value.trim());
    });
}

let buttonMap = null;
fetch('data/gcf-button-map.json')
    .then(r => r.json())
    .then(d => { buttonMap = d; })
    .catch(e => console.error('Button-map load failed:', e));

if (mapBtn) {
    mapBtn.addEventListener('click', mapWithDeepSeek);
}

async function mapWithDeepSeek() {
    const key = (keyInput.value || '').trim();
    if (!key.startsWith('sk-')) {
        mapStatus.textContent = '❌ Need a DeepSeek API key (sk-...) — paste above';
        mapStatus.style.color = '#FF6666';
        return;
    }
    if (!currentMidi) {
        mapStatus.textContent = '❌ Drop a MIDI first';
        mapStatus.style.color = '#FF6666';
        return;
    }
    if (!buttonMap) {
        mapStatus.textContent = '❌ Button-map dataset still loading';
        mapStatus.style.color = '#FF6666';
        return;
    }

    mapBtn.disabled = true;
    mapBtn.textContent = '🤖 THINKING...';
    mapStatus.textContent = 'Calling DeepSeek (deepseek-chat)…';
    mapStatus.style.color = '#FFD700';

    const tier = currentTier();
    const tuning = tuningSelect.value;

    // Compact note list — first 32 to keep the round-trip fast and the prompt small.
    const allNotes = currentMidi.tracks.flatMap(t => t.notes).sort((a, b) => a.time - b.time);
    const notes = allNotes.slice(0, 32).map((n, i) => ({
        i: i + 1,
        pitch: pitchName(n.midi),
        midi: n.midi,
        beat: +(n.time / (60 / (currentMidi.header.tempos[0]?.bpm || 120))).toFixed(2),
    }));

    const systemPrompt = `You are an assistant that maps MIDI notes to button presses on a Hohner Panther GCF diatonic button accordion. The instrument has 3 right-hand rows (outer/G, middle/C, inner/F). Each button plays one pitch when the bellows push (closed) and a different pitch when the bellows pull (open).

Rules:
1. Use the button-map dataset provided. Pick the row + button that matches each note's pitch.
2. Bellows direction must be continuous within a phrase — minimize push/pull alternation. Group consecutive same-direction notes when possible.
3. If a note appears on multiple rows, prefer the row that maintains current bellows direction.
4. If a note isn't in the dataset (out of range, accidental missing), output "skip" for that note.
5. Output ONE LINE PER NOTE in this format: "<index>. <pitch> -> row <outer/middle/inner> button <n> <P|U>" (P=push closed, U=pull open).
6. After the note list, add a one-paragraph summary of bellows changes and any problem notes.

Be concise. No preamble. Start directly with note 1.`;

    const userPrompt = `Tier: ${tier}
Tuning: ${tuning}

Button-map (right-hand rows):
${JSON.stringify(buttonMap.rows, null, 2)}

Notes to map:
${notes.map(n => `${n.i}. ${n.pitch} (MIDI ${n.midi}) at beat ${n.beat}`).join('\n')}`;

    const t0 = performance.now();
    try {
        const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.2,
                max_tokens: 2000,
            }),
        });
        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 200)}`);
        }
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '(empty)';
        const usage = data.usage || {};
        const cached = usage.prompt_cache_hit_tokens || 0;
        const total = usage.total_tokens || 0;

        llmHeading.style.display = 'block';
        llmEl.style.display = 'block';
        llmMeta.textContent = `· ${elapsed}s · ${total} tokens (${cached} cached) · model: ${data.model || 'deepseek-chat'}`;
        llmEl.innerHTML = formatLlmOutput(content);

        mapStatus.textContent = `✅ Done in ${elapsed}s · ${total} tokens · ${cached} cached`;
        mapStatus.style.color = '#00FF00';

        if (!REDUCED_MOTION) {
            utils.set(llmEl, { opacity: 0, y: 12 });
            animate(llmEl, { opacity: [0, 1], y: [12, 0], duration: 500, ease: 'outQuad' });
        }
    } catch (err) {
        mapStatus.textContent = `❌ ${err.message}`;
        mapStatus.style.color = '#FF6666';
    } finally {
        mapBtn.disabled = false;
        mapBtn.textContent = '🤖 MAP WITH DEEPSEEK';
    }
}

function formatLlmOutput(text) {
    // Render the LLM's plain-text-with-arrows output into colored tab-line divs.
    const lines = text.split('\n').filter(l => l.trim());
    return lines.map(line => {
        const m = line.match(/^(\d+)\.\s*([A-G][#b]?\d+)\s*->?\s*(.+)$/i);
        if (m) {
            return `<div class="tab-line"><span class="ix">${m[1].padStart(2, '0')}</span><span class="pn">${m[2].padEnd(4)}</span><span class="bn">${m[3]}</span></div>`;
        }
        return `<div class="tab-line" style="color:#BFAFCF;font-style:italic;border-bottom:none;">${line}</div>`;
    }).join('');
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
