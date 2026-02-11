# How to Add SoundFonts

The MIDI player needs a SoundFont file (.sf2) to produce sound.
Because automated downloads failed, please add one manually:

1.  **Download a SoundFont:**
    *   **TimGM6mb.sf2** (Recommended, ~6MB): Search for "TimGM6mb.sf2 download" or check Musescore repositories.
    *   **FluidR3_GM.sf2** (High Quality, ~140MB): Search for "FluidR3_GM.sf2 download".
    *   **GeneralUser GS.sf2** (Balanced, ~30MB): http://www.schristiancollins.com/generaluser.php

2.  **Place the file here:**
    Copy your `.sf2` file into this folder:
    `midi-player/soundfonts/sf2/`

3.  **Run the Librarian:**
    Run the python script to detect the new file:
    `python scripts/midi/midi_librarian.py`

4.  **Refresh:**
    Reload the MIDI player page.
