/**
 * MISE — Main Application Logic
 * 
 * Handles WebSocket connection, camera/mic streaming, dinner planning flow,
 * and UI state management for the live cooking assistant.
 */

class MiseApp {
    constructor() {
        // State
        this.ws = null;
        this.userId = this.generateId();
        this.sessionId = this.generateId();
        this.isConnected = false;
        this.isRecording = false;
        this.isCameraActive = false;
        this.frameInterval = null;
        this.timerInterval = null;
        this.sessionStartTime = null;
        this.mealPlan = null;  // { meal, dinnerTime }
        this.currentAgentMessage = '';   // Buffer for agent transcription
        this.currentAgentElement = null; // DOM element being updated
        this.currentUserMessage = '';    // Buffer for user transcription
        this.currentUserElement = null;  // DOM element being updated

        // Audio
        this.recordingContext = null;  // 16kHz for mic recording
        this.playbackContext = null;   // 24kHz for agent voice
        this.playerNode = null;

        // DOM Elements
        this.cameraFeed = document.getElementById('cameraFeed');
        this.captureCanvas = document.getElementById('captureCanvas');
        this.cameraPlaceholder = document.getElementById('cameraPlaceholder');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.sessionTimer = document.getElementById('sessionTimer');
        this.transcriptMessages = document.getElementById('transcriptMessages');
        this.textInput = document.getElementById('textInput');
        this.safetyOverlay = document.getElementById('safetyOverlay');
        this.safetyMessage = document.getElementById('safetyMessage');
        this.agentSpeaking = document.getElementById('agentSpeaking');

        this.init();
    }

    generateId() {
        return crypto.randomUUID ? crypto.randomUUID() :
            'xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
    }

    init() {
        // Start with dinner plan
        document.getElementById('startButton').addEventListener('click', () => {
            const meal = document.getElementById('mealInput').value.trim();
            const time = document.getElementById('timeInput').value;
            if (meal) {
                this.mealPlan = { meal, dinnerTime: time || '19:00' };
            }
            this.start();
        });

        // Start without a plan (free mode)
        document.getElementById('startFreeButton').addEventListener('click', () => {
            this.mealPlan = null;
            this.start();
        });

        // Text input
        document.getElementById('sendButton').addEventListener('click', () => this.sendText());
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.sendText();
        });

        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.text;
                this.sendTextMessage(text);
            });
        });

        // Clear transcript
        document.getElementById('clearTranscript').addEventListener('click', () => {
            this.transcriptMessages.innerHTML = '';
        });
    }

    async start() {
        try {
            await this.startCamera();
            await this.connectWebSocket();
            await this.startAudio();
            this.startTimer();
            this.cameraPlaceholder.classList.add('hidden');

            // Send the dinner plan to the agent if one was provided
            if (this.mealPlan) {
                const now = new Date();
                const [hours, mins] = this.mealPlan.dinnerTime.split(':');
                const dinnerDate = new Date();
                dinnerDate.setHours(parseInt(hours), parseInt(mins), 0);
                const minutesUntil = Math.round((dinnerDate - now) / 60000);

                const planMessage = `I'm making ${this.mealPlan.meal}. I want to eat at ${this.mealPlan.dinnerTime}. That's about ${minutesUntil} minutes from now. Please build me a cooking timeline and walk me through it step by step.`;

                // Small delay to let the connection stabilize
                setTimeout(() => {
                    this.sendTextMessage(planMessage);
                }, 1000);
            }
        } catch (error) {
            console.error('[MISE] Start error:', error);
            this.addMessage('system', `Error: ${error.message}. Please check camera/mic permissions.`);
        }
    }

    // ── Camera ──────────────────────────────────────────────

    async startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',  // Back camera on mobile
                width: { ideal: 640 },
                height: { ideal: 480 },
            },
            audio: false,  // Audio handled separately
        });

        this.cameraFeed.srcObject = stream;
        this.isCameraActive = true;

        // Set up canvas for frame capture
        this.captureCanvas.width = 640;
        this.captureCanvas.height = 480;

        // Start sending frames at 1 FPS
        this.frameInterval = setInterval(() => this.captureAndSendFrame(), 1000);
    }

    captureAndSendFrame() {
        if (!this.isCameraActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const ctx = this.captureCanvas.getContext('2d');
        ctx.drawImage(this.cameraFeed, 0, 0, 640, 480);

        // Convert to JPEG base64
        const dataUrl = this.captureCanvas.toDataURL('image/jpeg', 0.6);
        const base64Data = dataUrl.split(',')[1];

        this.ws.send(JSON.stringify({
            type: 'video_frame',
            data: base64Data,
        }));
    }

    // ── Audio ───────────────────────────────────────────────

    async startAudio() {
        // Separate contexts: recording at 16kHz, playback at 24kHz
        this.recordingContext = new AudioContext({ sampleRate: 16000 });
        this.playbackContext = new AudioContext({ sampleRate: 24000 });

        // Get mic stream
        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
            },
        });

        // Set up audio recorder (PCM 16kHz mono)
        await this.recordingContext.audioWorklet.addModule('/static/js/pcm-recorder-processor.js');
        const micSource = this.recordingContext.createMediaStreamSource(micStream);
        const recorderNode = new AudioWorkletNode(this.recordingContext, 'pcm-recorder-processor');

        recorderNode.port.onmessage = (event) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Send raw PCM audio as binary
                this.ws.send(event.data.buffer);
            }
        };

        micSource.connect(recorderNode);
        recorderNode.connect(this.recordingContext.destination);
        this.isRecording = true;

        // Set up audio player for agent responses (24kHz)
        await this.playbackContext.audioWorklet.addModule('/static/js/pcm-player-processor.js');
        this.playerNode = new AudioWorkletNode(this.playbackContext, 'pcm-player-processor');
        this.playerNode.connect(this.playbackContext.destination);

        document.getElementById('micIcon').textContent = '🔴';
        document.getElementById('micLabel').textContent = 'Listening...';
    }

    playAudio(base64Data) {
        if (!this.playerNode) return;

        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
        }

        // Convert bytes to Int16 PCM samples then to Float32
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
        }

        this.playerNode.port.postMessage(float32);
        this.showAgentSpeaking(true);

        // Auto-hide speaking indicator after audio finishes
        const durationMs = (float32.length / 24000) * 1000;
        setTimeout(() => this.showAgentSpeaking(false), durationMs);
    }

    // ── WebSocket ───────────────────────────────────────────

    async connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws/${this.userId}/${this.sessionId}`;

        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.updateConnectionStatus(true);

                if (this.mealPlan) {
                    this.addMessage('system', `🔥 Connected! Planning dinner: ${this.mealPlan.meal} for ${this.mealPlan.dinnerTime}. Let's go!`);
                } else {
                    this.addMessage('system', '🔥 Connected! I can see your kitchen. Tell me what you\'re making or just start cooking — I\'m here to help.');
                }
                resolve();
            };

            this.ws.onmessage = (event) => this.handleMessage(event);

            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.addMessage('system', '📡 Disconnected. Refresh to reconnect.');
            };

            this.ws.onerror = (error) => {
                console.error('[MISE] WebSocket error:', error);
                reject(new Error('WebSocket connection failed'));
            };
        });
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);

            if (data.parts) {
                for (const part of data.parts) {
                    if (part.type === 'text' && part.text) {
                        // Agent transcription — replace with cumulative text
                        this.currentAgentMessage = part.text;

                        if (!this.currentAgentElement) {
                            // Create new message element
                            this.currentAgentElement = this.addStreamingMessage('agent', this.currentAgentMessage);
                        } else {
                            // Update existing message in place
                            this.updateStreamingMessage(this.currentAgentElement, this.currentAgentMessage);
                        }

                        // Check for safety keywords on accumulated text
                        const alertKeywords = [
                            'wash', 'rinse', 'pesticide', 'dirty dozen',
                            'cross-contamination', 'bacteria', 'danger zone',
                            'watch out', 'careful', 'burning'
                        ];
                        const lower = this.currentAgentMessage.toLowerCase();
                        if (alertKeywords.some(kw => lower.includes(kw))) {
                            this.showSafetyAlert(this.currentAgentMessage);
                        }
                    }

                    if (part.type === 'input_transcription' && part.text) {
                        // User's speech transcription — replace with cumulative text
                        this.currentUserMessage = part.text;

                        if (!this.currentUserElement) {
                            this.currentUserElement = this.addStreamingMessage('user', this.currentUserMessage);
                        } else {
                            this.updateStreamingMessage(this.currentUserElement, this.currentUserMessage);
                        }
                    }

                    if (part.type === 'audio' && part.data) {
                        this.playAudio(part.data);
                    }
                }
            }

            // When the agent's turn is complete, finalize the message
            if (data.turn_complete) {
                this.currentAgentMessage = '';
                this.currentAgentElement = null;
                this.currentUserMessage = '';
                this.currentUserElement = null;
            }
        } catch (e) {
            console.error('[MISE] Message parse error:', e);
        }
    }

    addStreamingMessage(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}-message`;
        const label = role === 'agent' ? '🔥 MISE' : role === 'user' ? '👤 You' : '📌 System';
        div.innerHTML = `
            <div class="message-label">${label}</div>
            <div class="message-content">
                <p>${this.escapeHtml(text)}</p>
            </div>
        `;
        this.transcriptMessages.appendChild(div);
        this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight;
        return div;
    }

    updateStreamingMessage(element, text) {
        const p = element.querySelector('.message-content p');
        if (p) {
            p.textContent = text;
            this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight;
        }
    }

    // ── UI Methods ──────────────────────────────────────────

    sendText() {
        const text = this.textInput.value.trim();
        if (!text) return;
        this.sendTextMessage(text);
        this.textInput.value = '';
    }

    sendTextMessage(text) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.ws.send(JSON.stringify({ type: 'text', text }));
        this.addMessage('user', text);
    }

    addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}-message`;

        const label = role === 'agent' ? '🔥 MISE' : role === 'user' ? '👤 You' : '📌 System';

        div.innerHTML = `
            <div class="message-label">${label}</div>
            <div class="message-content">
                <p>${this.escapeHtml(text)}</p>
            </div>
        `;

        this.transcriptMessages.appendChild(div);
        this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSafetyAlert(message) {
        // Truncate long messages for the overlay
        const short = message.length > 120 ? message.substring(0, 120) + '...' : message;
        this.safetyMessage.textContent = short;
        this.safetyOverlay.classList.add('active');

        setTimeout(() => {
            this.safetyOverlay.classList.remove('active');
        }, 5000);
    }

    showAgentSpeaking(active) {
        if (active) {
            this.agentSpeaking.classList.add('active');
        } else {
            this.agentSpeaking.classList.remove('active');
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = this.connectionStatus;
        const textEl = statusEl.querySelector('.status-text');

        if (connected) {
            statusEl.classList.add('connected');
            textEl.textContent = 'Connected';
        } else {
            statusEl.classList.remove('connected');
            textEl.textContent = 'Disconnected';
        }
    }

    startTimer() {
        this.sessionStartTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const secs = (elapsed % 60).toString().padStart(2, '0');
            this.sessionTimer.textContent = `${mins}:${secs}`;
        }, 1000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.miseApp = new MiseApp();
});
