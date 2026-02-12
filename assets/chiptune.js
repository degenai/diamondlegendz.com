// Simple Chiptune Player using Web Audio API

let audioCtx;
let isPlaying = false;
let nextNoteTime = 0.0;
let timerID;
let currentNoteIndex = 0;

const tempo = 120.0;
const secondsPerBeat = 60.0 / tempo;

// Notes frequencies (C4 scale)
const notes = {
    'C4': 261.63,
    'D4': 293.66,
    'E4': 329.63,
    'F4': 349.23,
    'G4': 392.00,
    'A4': 440.00,
    'B4': 493.88,
    'C5': 523.25
};

// Simple melody: Note, Duration (in 16th notes)
const melody = [
    ['C4', 4], ['E4', 4], ['G4', 4], ['C5', 4],
    ['G4', 4], ['E4', 4], ['C4', 8],
    ['D4', 4], ['F4', 4], ['A4', 4], ['D4', 4],
    ['A4', 4], ['F4', 4], ['D4', 8]
];

function scheduleNote(noteName, time, duration16th) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.value = notes[noteName];

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const durationSeconds = (secondsPerBeat / 4) * duration16th;

    osc.start(time);

    // Envelope to make it sound plucky
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + durationSeconds - 0.05);

    osc.stop(time + durationSeconds);
}

function scheduler() {
    // While there are notes that will need to play before the next interval,
    // schedule them and advance the pointer.
    while (nextNoteTime < audioCtx.currentTime + 0.1) {
        const [noteName, duration16th] = melody[currentNoteIndex];
        scheduleNote(noteName, nextNoteTime, duration16th);

        // Advance time
        nextNoteTime += (secondsPerBeat / 4) * duration16th;

        // Advance note index
        currentNoteIndex++;
        if (currentNoteIndex === melody.length) {
            currentNoteIndex = 0;
        }
    }
    timerID = window.setTimeout(scheduler, 25.0);
}

function toggleMusic() {
    const btn = document.getElementById('music-btn');
    if (isPlaying) {
        isPlaying = false;
        window.clearTimeout(timerID);
        btn.innerText = "▶ Play 8-Bit Music";
        return;
    }

    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    isPlaying = true;
    nextNoteTime = audioCtx.currentTime;
    currentNoteIndex = 0;
    scheduler();
    btn.innerText = "⏹ Stop Music";
}

// Attach event listener to music button
document.addEventListener('DOMContentLoaded', () => {
    const musicBtn = document.getElementById('music-btn');
    if (musicBtn) {
        musicBtn.addEventListener('click', toggleMusic);
    }
});
