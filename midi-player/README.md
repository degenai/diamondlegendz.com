# Street Fighter MIDI Player (Turbo Edition)

Welcome to the new and improved Street Fighter II themed MIDI Player for DiamondLegendz. This player brings retro arcade vibes to your browser.

## 🎹 Technology Stack

*   **Core**: HTML5, Vanilla JavaScript, CSS3
*   **Synthesis**: [MIDI.js](https://www.midijs.net/)
    *   Lightweight playback engine.
    *   Supports `.mid` files easily without complex Web Audio configurations.
*   **Visuals**: Custom HTML5 Canvas visualizer.

## 🛠️ Integration Details

### Initialization
The player uses the lightweight `MIDIjs` library via CDN. It initializes globally and handles the browser's `AudioContext` automatically.

### Loading Assets
We load assets via standard `fetch` or directly via URL for MIDI playback.

### Directory Structure
*   `midis/`: Contains `.mid` files and `file_list.json`.

## 🕹️ Controls
*   **Play/Pause**: Start or pause the currently playing track.
*   **Stop**: Stops the track.
*   **Next/Prev**: Cycles through `midis/file_list.json`.
*   **Drag & Drop**: Drop any `.mid` file onto the player to load it instantly.

## 🚀 How to Run
Simply serve the root directory with a web server (e.g., `python -m http.server`) and navigate to this folder.
