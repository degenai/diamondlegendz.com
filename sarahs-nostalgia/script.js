document.addEventListener('DOMContentLoaded', () => {
    // --- Eyeballs ---
    const bg = document.getElementById('eyeball-bg');
    if (bg) {
        let eyeballs = [];

        function generateEyeballs() {
            // Clear existing
            bg.innerHTML = '';
            eyeballs = [];

            // Create grid of eyes
            // Reduce density for performance if needed, but "moderate amount" requested
            const eyeSize = 60;
            const cols = Math.ceil(window.innerWidth / eyeSize);
            const rows = Math.ceil(window.innerHeight / eyeSize);

            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    // Randomly skip some to make it less grid-like and "moderate"
                    if(Math.random() > 0.7) continue;

                    const eye = document.createElement('div');
                    eye.className = 'eyeball';
                    // Add some random offset
                    const offsetX = Math.random() * 20 - 10;
                    const offsetY = Math.random() * 20 - 10;
                    eye.style.left = (c * eyeSize + 10 + offsetX) + 'px';
                    eye.style.top = (r * eyeSize + 10 + offsetY) + 'px';

                    const pupil = document.createElement('div');
                    pupil.className = 'pupil';
                    eye.appendChild(pupil);

                    bg.appendChild(eye);
                    eyeballs.push({element: eye, pupil: pupil});
                }
            }
        }

        // Initial generation
        generateEyeballs();

        // Handle resize with debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(generateEyeballs, 200);
        });

        document.addEventListener('mousemove', (e) => {
            eyeballs.forEach(obj => {
                const rect = obj.element.getBoundingClientRect();
                const eyeX = rect.left + rect.width / 2;
                const eyeY = rect.top + rect.height / 2;

                const angle = Math.atan2(e.clientY - eyeY, e.clientX - eyeX);

                // Max movement radius for pupil (eye radius 20 - pupil radius 6 - border 2 = ~12, use 8 for safety)
                const r = 8;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;

                obj.pupil.style.transform = `translate(${x}px, ${y}px)`;
            });
        });
    }

    // --- MIDI Player ---
    const synthContainer = document.getElementById('synth-container');
    const status = document.getElementById('status');
    const playBtn = document.getElementById('play-btn');
    const stopBtn = document.getElementById('stop-btn');

    if (synthContainer) {
        // Create synth element
        const synth = document.createElement('webaudio-tinysynth');
        synth.id = 'synth';
        // Options
        synth.setAttribute('voices', '64');
        synthContainer.appendChild(synth);

        // Set src to try loading
        // If file exists, it loads.
        const midiUrl = "../assets/SarahNostalgia/EDSHEERAN.mid";
        synth.src = midiUrl;

        // Hook up buttons
        playBtn.addEventListener('click', () => {
            // AudioContext needs user gesture
            if (synth.getAudioContext && synth.getAudioContext().state === 'suspended') {
                synth.getAudioContext().resume();
            }

            synth.playMIDI();
            status.innerText = "Playing: Ed Sheeran...";
        });

        stopBtn.addEventListener('click', () => {
            synth.stopMIDI();
            status.innerText = "Stopped.";
        });

        // Verify load?
        // We can't easily verify 404 with this lib without modifying it,
        // but we can try to fetch it ourselves to check status
        fetch(midiUrl).then(res => {
            if(!res.ok) {
                status.innerText = "MIDI file not found (404). Please ensure 'EDSHEERAN.mid' is in assets/SarahNostalgia.";
                status.style.color = "red";
            } else {
                status.innerText = "MIDI Loaded! Ready to play.";
            }
        }).catch(e => {
            status.innerText = "Error checking MIDI file.";
        });
    }

    // --- Fallback Images ---
    function handleImageError(img) {
        if(img.dataset.hasFallback) return;
        img.dataset.hasFallback = "true";

        console.log("Image failed to load:", img.src);
        // Replace with placeholder
        const color = img.getAttribute('data-fallback-color') || '#555';
        const div = document.createElement('div');
        div.className = 'fallback-placeholder polaroid-placeholder';
        div.style.backgroundColor = color;
        div.innerText = img.getAttribute('alt') + " (Missing)";

        // Match size if possible
        div.style.width = '100%';
        div.style.height = '200px';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.color = 'white';
        div.style.fontWeight = 'bold';
        div.style.textShadow = '1px 1px black';
        div.style.textAlign = 'center';
        div.style.padding = '10px';
        div.style.boxSizing = 'border-box';

        if(img.parentNode) {
            img.parentNode.replaceChild(div, img);
        }
    }

    document.querySelectorAll('.fallback-img').forEach(img => {
        // Check if already broken
        if (img.complete && img.naturalWidth === 0) {
            handleImageError(img);
        } else {
            // Attach error handler
            img.onerror = function() {
                handleImageError(this);
            };
        }
    });
});
