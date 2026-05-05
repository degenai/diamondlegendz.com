"""Quantization pedal — snap basic-pitch MIDI to a beat grid detected from source audio.

Usage: python quantize.py <audio.wav> <input.mid> <output.mid> [--subdiv N]
  --subdiv: subdivisions per beat (default 4 = 16th notes)
"""
import sys, os, argparse
import librosa
import numpy as np
import pretty_midi

def quantize(audio_path, midi_in, midi_out, subdiv=4, drop_short_ms=80, merge_window_ms=30):
    print(f"Loading {audio_path}...")
    y, sr = librosa.load(audio_path, sr=22050)
    print(f"Beat-tracking {len(y)/sr:.1f}s of audio...")
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units='frames')
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    if hasattr(tempo, '__len__'): tempo = float(tempo[0])
    print(f"Detected tempo: {tempo:.1f} BPM, {len(beat_times)} beats")

    # Build sub-beat grid via interpolation between detected beats.
    grid = []
    for i in range(len(beat_times) - 1):
        span = beat_times[i+1] - beat_times[i]
        for j in range(subdiv):
            grid.append(beat_times[i] + j * span / subdiv)
    grid.append(beat_times[-1])
    grid = np.array(grid)
    print(f"Grid: {len(grid)} ticks, ~{1000*(grid[1]-grid[0]):.0f}ms per tick")

    pm = pretty_midi.PrettyMIDI(midi_in)
    print(f"Input notes: {sum(len(inst.notes) for inst in pm.instruments)}")

    def snap(t):
        idx = int(np.argmin(np.abs(grid - t)))
        return float(grid[idx])

    out = pretty_midi.PrettyMIDI(initial_tempo=tempo)
    instr = pretty_midi.Instrument(program=21)  # accordion in GM
    for src in pm.instruments:
        for n in src.notes:
            new_start = snap(n.start)
            new_end = snap(n.end)
            if new_end <= new_start:
                # snap collapsed the note; bump it one grid tick
                idx = int(np.argmin(np.abs(grid - new_start)))
                if idx + 1 < len(grid):
                    new_end = float(grid[idx + 1])
                else:
                    continue  # at end of audio
            duration_ms = 1000 * (new_end - new_start)
            if duration_ms < drop_short_ms:
                continue
            instr.notes.append(pretty_midi.Note(
                velocity=n.velocity, pitch=n.pitch,
                start=new_start, end=new_end))

    # Merge consecutive same-pitch notes within merge_window
    instr.notes.sort(key=lambda n: (n.pitch, n.start))
    merged = []
    for n in instr.notes:
        if merged and merged[-1].pitch == n.pitch and (n.start - merged[-1].end) * 1000 < merge_window_ms:
            merged[-1].end = max(merged[-1].end, n.end)
        else:
            merged.append(n)
    instr.notes = merged
    instr.notes.sort(key=lambda n: n.start)

    out.instruments.append(instr)
    out.write(midi_out)
    print(f"Output notes: {len(instr.notes)} -> {midi_out}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("audio"); ap.add_argument("midi_in"); ap.add_argument("midi_out")
    ap.add_argument("--subdiv", type=int, default=4)
    ap.add_argument("--drop-short", type=float, default=80, help="drop notes shorter than this (ms)")
    ap.add_argument("--merge-window", type=float, default=30, help="merge same-pitch notes within this gap (ms)")
    a = ap.parse_args()
    quantize(a.audio, a.midi_in, a.midi_out, a.subdiv, a.drop_short, a.merge_window)
