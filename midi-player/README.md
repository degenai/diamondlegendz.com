# Street Fighter MIDI Player (Turbo Edition)

Welcome to the new and improved Street Fighter II themed MIDI Player for DiamondLegendz. This player brings retro arcade vibes to your browser using high-performance SoundFont synthesis.

## 🎹 Technology Stack

*   **Core**: HTML5, Vanilla JavaScript (ES6 Modules), CSS3
*   **Synthesis**: [SpessaSynth](https://github.com/spessasus/SpessaSynth)
    *   Uses AudioWorklets for low-latency audio.
    *   Supports `.sf2` SoundFonts and `.mid` files.
*   **Visuals**: Custom HTML5 Canvas visualizer.

## 🛠️ Integration Details

### Initialization
The player uses `libs/spessasynth_lib.js`. It initializes the `Synthesizer` interacting with the browser's `AudioContext`.

```javascript
import { Synthesizer, Sequencer } from './libs/spessasynth_lib.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const synth = new Synthesizer(audioCtx.destination, {
    workletProcessorUrl: './libs/spessasynth_worklet_processor.js',
    enableEventSystem: true
});
```

### Loading Assets
We load assets via `fetch` as ArrayBuffers.

*   **SoundFonts**: Loaded into `synth.soundBankManager`.
*   **MIDIs**: Loaded into a `Sequencer` instance attached to the synthesizer.

### Directory Structure
*   `midis/`: Contains `.mid` files and `file_list.json`.
*   `soundfonts/sf2/`: Contains `.sf2` files and `soundfont_list.json`.
*   `libs/`: SpessaSynth library files.

## 🕹️ Controls
*   **Play/Pause**: Start or stop the sequencer.
*   **Stop**: Resets sequence to start.
*   **Next/Prev**: Cycles through `midis/file_list.json`.
*   **SoundFont Selector**: Hot-swap instrument banks.
*   **Drag & Drop**: Drop any `.mid` or `.sf2` file onto the player to load it instantly.

## 🚀 How to Run
Simply serve the root directory with a web server (e.g., `python -m http.server`) and navigate to this folder.
