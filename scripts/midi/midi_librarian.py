import os
import json

def generate_midi_list():
    # Determine base directory (project root)
    # If run from scripts/midi/, root is ../../
    # If run from root, root is ./
    
    current_dir = os.getcwd()
    base_dir = current_dir
    
    # Check if we are inside scripts/midi
    if os.path.basename(current_dir) == 'midi' and os.path.basename(os.path.dirname(current_dir)) == 'scripts':
        base_dir = os.path.join(current_dir, '..', '..')
    elif os.path.basename(current_dir) == 'scripts':
        base_dir = os.path.join(current_dir, '..')
        
    base_dir = os.path.abspath(base_dir)
    print(f"Base Directory: {base_dir}")

    midi_dir = os.path.join(base_dir, 'midi-player', 'midis')
    sf2_dir = os.path.join(base_dir, 'midi-player', 'soundfonts', 'sf2')

    # Ensure directories exist
    if not os.path.exists(midi_dir):
        print(f"Error: MIDI directory not found at {midi_dir}")
        return

    if not os.path.exists(sf2_dir):
        try:
            os.makedirs(sf2_dir)
            print(f"Created SoundFont directory: {sf2_dir}")
        except OSError as e:
            print(f"Error creating directory {sf2_dir}: {e}")
            return

    # --- Scan for MIDIs ---
    print(f"Scanning MIDIs in: {midi_dir}")
    midi_files = [f for f in os.listdir(midi_dir) if f.lower().endswith(('.mid', '.midi'))]
    midi_files.sort()

    with open(os.path.join(midi_dir, 'file_list.json'), 'w') as f:
        json.dump(midi_files, f, indent=4)

    print(f"Generated file_list.json with {len(midi_files)} files.")

    # --- Scan for SoundFonts ---
    print(f"Scanning SoundFonts in: {sf2_dir}")
    sf2_files = [f for f in os.listdir(sf2_dir) if f.lower().endswith('.sf2')]
    sf2_files.sort()

    with open(os.path.join(sf2_dir, 'soundfont_list.json'), 'w') as f:
        json.dump(sf2_files, f, indent=4)

    print(f"Generated soundfont_list.json with {len(sf2_files)} files.")

if __name__ == "__main__":
    generate_midi_list()
