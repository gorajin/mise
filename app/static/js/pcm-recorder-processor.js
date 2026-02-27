/**
 * PCM Recorder AudioWorklet Processor
 * 
 * Captures audio input and converts to 16-bit PCM at 16kHz mono,
 * sending chunks to the main thread for WebSocket transmission.
 */
class PCMRecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 2048;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const channelData = input[0];

        for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i];

            if (this.bufferIndex >= this.bufferSize) {
                // Convert Float32 to Int16 PCM
                const pcmData = new Int16Array(this.bufferSize);
                for (let j = 0; j < this.bufferSize; j++) {
                    const s = Math.max(-1, Math.min(1, this.buffer[j]));
                    pcmData[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Send to main thread
                this.port.postMessage(pcmData);
                this.bufferIndex = 0;
            }
        }

        return true;
    }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
