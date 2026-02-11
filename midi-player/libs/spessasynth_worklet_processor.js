import {
    SpessaSynthProcessor,
    SoundBankLoader,
    SpessaSynthSequencer,
    BasicMIDI
} from "./spessasynth_core.js";

class SpessaSynthWorkletProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const processorOptions = options.processorOptions || {};

        this.synthProcessor = new SpessaSynthProcessor(sampleRate, processorOptions);
        this.sequencers = [];

        // Handle synth events
        this.synthProcessor.onEventCall = (event) => {
            this.port.postMessage({
                type: "eventCall",
                data: event,
                currentTime: this.synthProcessor.currentSynthTime
            });
        };

        this.port.onmessage = (e) => {
            const msg = e.data;
            if (!msg) return;

            try {
                switch (msg.type) {
                    case "soundBankManager":
                        this.handleSoundBankMessage(msg.data);
                        break;

                    case "midiMessage":
                        this.synthProcessor.processMessage(
                            msg.data.messageData,
                            msg.data.channelOffset,
                            msg.data.force,
                            msg.data.options
                        );
                        break;

                    case "requestNewSequencer":
                        this.createNewSequencer();
                        break;

                    case "sequencerSpecific":
                        this.handleSequencerMessage(msg.data);
                        break;

                    // Handle other messages like 'stopAll', 'muteChannel' etc if needed
                    // For now, minimal set to get playback working
                }
            } catch (err) {
                console.error("Worklet Error:", err);
            }
        };
    }

    handleSoundBankMessage(sfMsg) {
        const sfManager = this.synthProcessor.soundBankManager;
        switch (sfMsg.type) {
            case "addSoundBank":
                const font = SoundBankLoader.fromArrayBuffer(
                    sfMsg.data.soundBankBuffer
                );
                sfManager.addSoundBank(
                    font,
                    sfMsg.data.id,
                    sfMsg.data.bankOffset
                );
                this.postReady("soundBankManager", null);
                break;
            // Add delete/rearrange if needed
        }
    }

    createNewSequencer() {
        const sequencer = new SpessaSynthSequencer(this.synthProcessor);
        const id = this.sequencers.length;
        this.sequencers.push(sequencer);

        // Handle sequencer events (bar change, end, etc)
        sequencer.onEventCall = (e) => {
            this.port.postMessage({
                type: "sequencerReturn",
                data: { ...e, id: id },
                currentTime: this.synthProcessor.currentSynthTime
            });
        }
    }

    handleSequencerMessage(msg) {
        const seq = this.sequencers[msg.id];
        if (!seq) return;

        const data = msg.data;
        switch (msg.type) {
            case "loadNewSongList":
                try {
                    // data can be array of Uint8Array OR array of { binary, fileName }
                    const songMap = data.map(s => {
                        if (s instanceof Uint8Array) {
                            return BasicMIDI.fromArrayBuffer(s);
                        } else if (s.binary) {
                            return BasicMIDI.fromArrayBuffer(s.binary, s.fileName);
                        } else {
                            throw new Error("Invalid song format");
                        }
                    });
                    seq.loadNewSongList(songMap);

                    // Notify success (important for unblocking main thread)
                    // The main thread likely listens for a songListChange or similar implicit success
                    // Looking at BasicSynthesizerCore, it doesn't send a specific "loaded" message 
                    // other than what onEventCall might send.
                    // BUT, if we don't send anything, main thread might hang if it waits?
                    // Actually, main thread waits for 'sequencerReturn' with specific types sometimes.

                } catch (e) {
                    console.error("MIDI Load Error", e);
                    this.postReturn(msg.id, "midiError", e);
                }
                break;

            case "play":
                seq.play();
                break;
            case "pause":
                seq.pause();
                break;
            case "setTime":
                seq.currentTime = data;
                break;
            case "setLoopCount":
                seq.loopCount = data;
                break;
            case "getMIDI":
                this.postReturn(msg.id, "getMIDI", seq.midiData);
                break;
        }
    }

    postReady(type, data) {
        this.port.postMessage({
            type: "isFullyInitialized",
            data: { type, data },
            currentTime: this.synthProcessor.currentSynthTime
        });
    }

    postReturn(id, type, data) {
        this.port.postMessage({
            type: "sequencerReturn",
            data: { type, data, id },
            currentTime: this.synthProcessor.currentSynthTime
        });
    }

    process(inputs, outputs, parameters) {
        if (outputs.length < 2) return true;

        // Process sequencers
        for (const seq of this.sequencers) {
            seq.processTick();
        }

        const reverb = outputs[0];
        const chorus = outputs[1];
        const dry = outputs.slice(2);

        this.synthProcessor.renderAudioSplit(reverb, chorus, dry);

        return true;
    }
}

registerProcessor("spessasynth-worklet-processor", SpessaSynthWorkletProcessor);
