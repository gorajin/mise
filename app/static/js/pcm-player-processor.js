/**
 * PCM Player AudioWorklet Processor
 * 
 * Receives PCM audio data from the main thread and plays it back.
 * Handles the agent's voice responses.
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.queue = [];
        this.currentBuffer = null;
        this.currentIndex = 0;

        this.port.onmessage = (event) => {
            if (event.data && event.data.type === 'flush') {
                // Barge-in: clear all queued audio immediately
                this.queue = [];
                this.currentBuffer = null;
                this.currentIndex = 0;
            } else {
                // Receive Float32Array audio data
                this.queue.push(event.data);
            }
        };
    }

    process(inputs, outputs) {
        const output = outputs[0];
        if (!output || !output[0]) return true;

        const channelData = output[0];

        for (let i = 0; i < channelData.length; i++) {
            if (!this.currentBuffer || this.currentIndex >= this.currentBuffer.length) {
                if (this.queue.length > 0) {
                    this.currentBuffer = this.queue.shift();
                    this.currentIndex = 0;
                } else {
                    channelData[i] = 0;
                    continue;
                }
            }

            channelData[i] = this.currentBuffer[this.currentIndex++];
        }

        return true;
    }
}

registerProcessor('pcm-player-processor', PCMPlayerProcessor);
