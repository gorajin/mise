/**
 * MISE — Main Application Logic
 * 
 * Voice-first, hands-free cooking assistant.
 * Auto-connects camera + mic on load. Supports barge-in interruption.
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
        this.isMuted = false;
        this.isCooking = false;
        this.frameInterval = null;
        this.timerInterval = null;
        this.sessionStartTime = null;
        this.mealPlan = null;
        this.currentAgentMessage = '';
        this.currentAgentElement = null;
        this.currentUserMessage = '';
        this.currentUserElement = null;

        // Barge-in state
        this.isAgentSpeaking = false;
        this.speakingTimeout = null;
        this.bargeInCooldown = false;
        this.BARGE_IN_THRESHOLD = 15; // mic level to trigger barge-in

        // Reconnect state
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectTimeout = null;
        this.wasConnected = false;

        // Timer state
        this.cookingTimer = null;
        this.cookingTimerInterval = null;
        this.cookingTimerSeconds = 0;

        // Audio
        this.recordingContext = null;
        this.playbackContext = null;
        this.playerNode = null;
        this.micStream = null;
        this.micSource = null;
        this.recorderNode = null;
        this.analyserNode = null;
        this.micLevelAnimFrame = null;

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
        this.observationBadge = document.getElementById('observationBadge');
        this.splashScreen = document.getElementById('splashScreen');
        this.splashStatus = document.getElementById('splashStatus');
        this.transcriptPanel = document.getElementById('transcriptPanel');

        this.init();
    }

    generateId() {
        return crypto.randomUUID ? crypto.randomUUID() :
            'xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
    }

    init() {
        // The "Start Cooking" button sends meal plan but also triggers connect if not already connected
        document.getElementById('startButton').addEventListener('click', () => {
            const meal = document.getElementById('mealInput').value.trim();
            const time = document.getElementById('timeInput').value;
            if (meal) {
                this.mealPlan = { meal, dinnerTime: time || '19:00' };
            }
            // If already connected (voice-first auto-connect), just send the plan and hide planner
            if (this.isConnected) {
                this.cameraPlaceholder.classList.add('hidden');
                this.sendMealPlan();
            } else {
                this.start();
            }
        });

        // Start without a plan — just hide the planner overlay
        document.getElementById('startFreeButton').addEventListener('click', () => {
            this.mealPlan = null;
            if (this.isConnected) {
                this.cameraPlaceholder.classList.add('hidden');
            } else {
                this.start();
            }
        });

        // Text input
        document.getElementById('sendButton').addEventListener('click', () => this.sendText());
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.sendText();
        });

        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.sendTextMessage(btn.dataset.text);
            });
        });

        // FAB next step button
        const fabNext = document.getElementById('fabNext');
        if (fabNext) {
            fabNext.addEventListener('click', () => {
                this.sendTextMessage(fabNext.dataset.text);
            });
        }

        // Clear transcript
        document.getElementById('clearTranscript').addEventListener('click', () => {
            this.transcriptMessages.innerHTML = '';
        });

        // Mute button
        const muteBtn = document.getElementById('muteButton');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => this.toggleMute());
        }

        // Timer dismiss
        const timerDismiss = document.getElementById('timerDismiss');
        if (timerDismiss) {
            timerDismiss.addEventListener('click', () => this.dismissTimer());
        }

        // Bottom-sheet drag (mobile)
        this.initBottomSheet();

        // Enter key on meal input triggers start
        document.getElementById('mealInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('startButton').click();
            }
        });

        // ─── VOICE-FIRST: Auto-connect immediately ────────────
        // Don't wait for button press — start camera, mic, and connection right away.
        // The user can optionally type a meal plan, or just start talking.
        this.autoStart();
    }

    // ── Bottom Sheet (Mobile) ───────────────────────────

    initBottomSheet() {
        const handle = document.getElementById('sheetHandle');
        const header = document.querySelector('.transcript-header');
        if (!handle) return;

        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        const onStart = (clientY) => {
            isDragging = true;
            startY = clientY;
            startHeight = this.transcriptPanel.offsetHeight;
            this.transcriptPanel.style.transition = 'none';
        };

        const onMove = (clientY) => {
            if (!isDragging) return;
            const deltaY = startY - clientY;
            const newHeight = Math.max(56, Math.min(window.innerHeight * 0.65, startHeight + deltaY));
            this.transcriptPanel.style.height = newHeight + 'px';
        };

        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            this.transcriptPanel.style.transition = 'height 0.3s ease';
            const currentHeight = this.transcriptPanel.offsetHeight;
            const windowHeight = window.innerHeight;

            if (currentHeight < 100) {
                this.transcriptPanel.classList.add('collapsed');
                this.transcriptPanel.classList.remove('expanded');
            } else if (currentHeight > windowHeight * 0.5) {
                this.transcriptPanel.classList.add('expanded');
                this.transcriptPanel.classList.remove('collapsed');
                this.transcriptPanel.style.height = '';
            } else {
                this.transcriptPanel.classList.remove('collapsed', 'expanded');
                this.transcriptPanel.style.height = '';
            }
        };

        // Touch events
        handle.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY), { passive: true });
        document.addEventListener('touchmove', (e) => onMove(e.touches[0].clientY), { passive: true });
        document.addEventListener('touchend', onEnd);

        // Click to toggle collapsed on header
        header.addEventListener('click', () => {
            if (window.innerWidth >= 768) return;
            if (this.transcriptPanel.classList.contains('collapsed')) {
                this.transcriptPanel.classList.remove('collapsed');
            } else {
                this.transcriptPanel.classList.add('collapsed');
            }
        });
    }

    // ── Auto-Start (Voice-First) ────────────────────────────
    // Connects camera, mic, and WebSocket immediately on page load.
    // The dinner planner form stays as an OPTIONAL overlay — user can type or just talk.

    async autoStart() {
        this.updateSplash('Starting camera...');
        try {
            await this.startCamera();
            this.updateSplash('Connecting to MISE...');
            await this.connectWebSocket();
            this.updateSplash('Starting microphone...');
            await this.startAudio();
            this.startTimer();
            this.isCooking = true;

            // Show FAB on mobile
            const fab = document.getElementById('fabNext');
            if (fab && window.innerWidth < 768) {
                fab.classList.add('visible');
            }

            // Hide splash — planner stays visible as an overlay on the camera
            // User can type a plan OR just dismiss it and start talking
            this.splashScreen.classList.add('hidden');

        } catch (error) {
            console.error('[MISE] Auto-start error:', error);
            this.updateSplash(`Tap "Start Cooking" to begin`);

            // Fall back to manual start — hide splash to reveal planner
            setTimeout(() => {
                this.splashScreen.classList.add('hidden');
            }, 1500);
        }
    }

    // Legacy start() — only called if autoStart failed and user clicks the button
    async start() {
        this.updateSplash('Requesting camera access...');
        this.splashScreen.classList.remove('hidden');
        try {
            await this.startCamera();
            this.updateSplash('Connecting to MISE...');
            await this.connectWebSocket();
            this.updateSplash('Initializing audio...');
            await this.startAudio();
            this.startTimer();
            this.cameraPlaceholder.classList.add('hidden');
            this.isCooking = true;

            const fab = document.getElementById('fabNext');
            if (fab && window.innerWidth < 768) {
                fab.classList.add('visible');
            }

            setTimeout(() => {
                this.splashScreen.classList.add('hidden');
            }, 500);

            if (this.mealPlan) {
                this.sendMealPlan();
            }
        } catch (error) {
            console.error('[MISE] Start error:', error);
            this.updateSplash(`Error: ${error.message}`);
            this.addMessage('system', `Error: ${error.message}. Please check camera/mic permissions.`);
            setTimeout(() => {
                this.splashScreen.classList.add('hidden');
            }, 2000);
        }
    }

    sendMealPlan() {
        if (!this.mealPlan) return;
        const now = new Date();
        const [hours, mins] = this.mealPlan.dinnerTime.split(':');
        const dinnerDate = new Date();
        dinnerDate.setHours(parseInt(hours), parseInt(mins), 0);
        const minutesUntil = Math.round((dinnerDate - now) / 60000);

        const planMessage = `I'm making ${this.mealPlan.meal}. I want to eat at ${this.mealPlan.dinnerTime}. That's about ${minutesUntil} minutes from now. Please build me a cooking timeline and walk me through it step by step.`;

        setTimeout(() => {
            this.sendTextMessage(planMessage);
        }, 500);
    }

    updateSplash(text) {
        if (this.splashStatus) {
            this.splashStatus.textContent = text;
        }
    }

    // ── Camera ──────────────────────────────────────────────

    async startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 },
            },
            audio: false,
        });

        this.cameraFeed.srcObject = stream;
        this.isCameraActive = true;

        this.captureCanvas.width = 640;
        this.captureCanvas.height = 480;

        this.frameInterval = setInterval(() => this.captureAndSendFrame(), 1000);
    }

    captureAndSendFrame() {
        if (!this.isCameraActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const ctx = this.captureCanvas.getContext('2d');
        ctx.drawImage(this.cameraFeed, 0, 0, 640, 480);

        const dataUrl = this.captureCanvas.toDataURL('image/jpeg', 0.6);
        const base64Data = dataUrl.split(',')[1];

        this.ws.send(JSON.stringify({
            type: 'video_frame',
            data: base64Data,
        }));
    }

    // ── Audio ───────────────────────────────────────────────

    async startAudio() {
        this.recordingContext = new AudioContext({ sampleRate: 16000 });
        this.playbackContext = new AudioContext({ sampleRate: 24000 });

        await this.recordingContext.resume();
        await this.playbackContext.resume();

        this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        // Set up audio recorder (PCM 16kHz mono)
        await this.recordingContext.audioWorklet.addModule('/static/js/pcm-recorder-processor.js');
        this.micSource = this.recordingContext.createMediaStreamSource(this.micStream);
        this.recorderNode = new AudioWorkletNode(this.recordingContext, 'pcm-recorder-processor');

        // Set up analyser for mic level + barge-in detection
        this.analyserNode = this.recordingContext.createAnalyser();
        this.analyserNode.fftSize = 256;
        this.micSource.connect(this.analyserNode);

        this.recorderNode.port.onmessage = (event) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isMuted) {
                this.ws.send(event.data.buffer);
            }
        };

        this.micSource.connect(this.recorderNode);
        this.recorderNode.connect(this.recordingContext.destination);
        this.isRecording = true;

        // Set up audio player for agent responses (24kHz)
        await this.playbackContext.audioWorklet.addModule('/static/js/pcm-player-processor.js');
        this.playerNode = new AudioWorkletNode(this.playbackContext, 'pcm-player-processor');
        this.playerNode.connect(this.playbackContext.destination);

        document.getElementById('muteIcon').textContent = '🎙️';
        document.getElementById('micLabel').textContent = 'Listening...';

        // Start mic level animation + barge-in detection
        this.startMicLevel();
    }

    startMicLevel() {
        const levelBar = document.getElementById('micLevelBar');
        if (!levelBar || !this.analyserNode) return;

        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

        const update = () => {
            this.analyserNode.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const pct = Math.min(100, (avg / 128) * 100);

            if (this.isMuted) {
                levelBar.style.width = '0%';
            } else {
                levelBar.style.width = pct + '%';

                // ── BARGE-IN DETECTION ──
                // If user is speaking loud enough while agent is speaking, interrupt
                if (avg > this.BARGE_IN_THRESHOLD && this.isAgentSpeaking && !this.bargeInCooldown) {
                    this.bargeIn();
                }
            }

            this.micLevelAnimFrame = requestAnimationFrame(update);
        };

        update();
    }

    // ── Barge-In (Interruption) ─────────────────────────────
    // When user starts speaking while agent is speaking:
    // 1. Flush the audio playback buffer (stop agent voice immediately)
    // 2. Hide the speaking indicator
    // 3. Brief cooldown to prevent rapid re-triggering

    bargeIn() {
        console.log('[MISE] Barge-in detected — stopping agent audio');

        // Flush the player buffer
        if (this.playerNode) {
            this.playerNode.port.postMessage({ type: 'flush' });
        }

        // Stop speaking indicator
        this.isAgentSpeaking = false;
        this.showAgentSpeaking(false);

        // Clear any pending speaking timeout
        if (this.speakingTimeout) {
            clearTimeout(this.speakingTimeout);
            this.speakingTimeout = null;
        }

        // Cooldown to prevent rapid re-triggering
        this.bargeInCooldown = true;
        setTimeout(() => {
            this.bargeInCooldown = false;
        }, 2000);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const btn = document.getElementById('muteButton');
        const icon = document.getElementById('muteIcon');
        const label = document.getElementById('micLabel');

        if (this.isMuted) {
            btn.classList.add('muted');
            icon.textContent = '🔇';
            label.textContent = 'Muted';
            if (this.micStream) {
                this.micStream.getAudioTracks().forEach(t => t.enabled = false);
            }
        } else {
            btn.classList.remove('muted');
            icon.textContent = '🎙️';
            label.textContent = 'Listening...';
            if (this.micStream) {
                this.micStream.getAudioTracks().forEach(t => t.enabled = true);
            }
        }
    }

    playAudio(base64Data) {
        if (!this.playerNode) return;

        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
        }

        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
        }

        this.playerNode.port.postMessage(float32);

        // Track speaking state for barge-in
        this.isAgentSpeaking = true;
        this.showAgentSpeaking(true);

        // Estimate when this chunk finishes playing
        const durationMs = (float32.length / 24000) * 1000;
        if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
        this.speakingTimeout = setTimeout(() => {
            this.isAgentSpeaking = false;
            this.showAgentSpeaking(false);
        }, durationMs + 200); // small buffer
    }

    // ── WebSocket ───────────────────────────────────────────

    async connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws/${this.userId}/${this.sessionId}`;

        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.wasConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.hideReconnectBanner();

                // Voice-first: no system message clutter — agent will greet via voice
                this.addMessage('system', '🔥 Connected — just start talking! Or type a meal plan above.');
                resolve();
            };

            this.ws.onmessage = (event) => this.handleMessage(event);

            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus(false);

                if (this.wasConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect();
                } else {
                    this.addMessage('system', '📡 Disconnected. Refresh to reconnect.');
                }
            };

            this.ws.onerror = (error) => {
                console.error('[MISE] WebSocket error:', error);
                if (!this.wasConnected) {
                    reject(new Error('WebSocket connection failed'));
                }
            };
        });
    }

    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

        console.log(`[MISE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.showReconnectBanner(this.reconnectAttempts);

        this.reconnectTimeout = setTimeout(async () => {
            try {
                this.sessionId = this.generateId();
                await this.connectWebSocket();

                if (this.isCameraActive && !this.frameInterval) {
                    this.frameInterval = setInterval(() => this.captureAndSendFrame(), 1000);
                }
            } catch (e) {
                console.error('[MISE] Reconnect failed:', e);
            }
        }, delay);
    }

    showReconnectBanner(attempt) {
        let banner = document.querySelector('.reconnect-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.className = 'reconnect-banner';
            const header = document.querySelector('.app-header');
            header.after(banner);
        }
        banner.innerHTML = `<div class="reconnect-spinner"></div> Reconnecting... (attempt ${attempt})`;
        banner.classList.add('active');
    }

    hideReconnectBanner() {
        const banner = document.querySelector('.reconnect-banner');
        if (banner) banner.classList.remove('active');
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);

            if (data.parts) {
                for (const part of data.parts) {
                    if (part.type === 'text' && part.text) {
                        this.currentAgentMessage = part.text;

                        if (!this.currentAgentElement) {
                            this.currentAgentElement = this.addStreamingMessage('agent', this.currentAgentMessage);
                        } else {
                            this.updateStreamingMessage(this.currentAgentElement, this.currentAgentMessage);
                        }

                        // Safety keyword detection
                        const alertKeywords = [
                            'wash', 'rinse', 'pesticide', 'dirty dozen',
                            'cross-contamination', 'bacteria', 'danger zone',
                            'watch out', 'careful', 'burning'
                        ];
                        const lower = this.currentAgentMessage.toLowerCase();
                        if (alertKeywords.some(kw => lower.includes(kw))) {
                            this.showSafetyAlert(this.currentAgentMessage);
                        }

                        // Timer parsing
                        this.parseTimerTriggers(this.currentAgentMessage);
                    }

                    if (part.type === 'input_transcription' && part.text) {
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

            // Observation indicator
            if (data.author === 'agent' && data.parts && data.parts.length > 0) {
                this.flashObservationBadge();
            }

            // Turn complete — finalize messages
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

    // ── Timer Parsing ───────────────────────────────────────

    parseTimerTriggers(text) {
        const patterns = [
            /(\d+)\s*minutes?\b/gi,
            /timer\s*(?:for\s*)?(\d+)/gi,
            /(\d+)\s*min\b/gi,
        ];

        for (const pattern of patterns) {
            const match = pattern.exec(text);
            if (match && match[1]) {
                const minutes = parseInt(match[1]);
                if (minutes > 0 && minutes <= 120) {
                    const idx = text.indexOf(match[0]);
                    const contextStart = Math.max(0, idx - 30);
                    const context = text.substring(contextStart, idx).trim().split(' ').slice(-3).join(' ');
                    this.startCookingTimer(minutes, context || 'Timer');
                    break;
                }
            }
        }
    }

    startCookingTimer(minutes, label) {
        if (this.cookingTimerInterval) {
            clearInterval(this.cookingTimerInterval);
        }

        this.cookingTimerSeconds = minutes * 60;
        const timerWidget = document.getElementById('timerWidget');
        const timerTime = document.getElementById('timerTime');
        const timerLabel = document.getElementById('timerLabel');

        timerLabel.textContent = label;
        timerWidget.classList.add('active');

        const updateDisplay = () => {
            const mins = Math.floor(this.cookingTimerSeconds / 60).toString().padStart(2, '0');
            const secs = (this.cookingTimerSeconds % 60).toString().padStart(2, '0');
            timerTime.textContent = `${mins}:${secs}`;

            if (this.cookingTimerSeconds <= 30 && this.cookingTimerSeconds > 0) {
                timerTime.classList.add('urgent');
            } else {
                timerTime.classList.remove('urgent');
            }
        };

        updateDisplay();

        this.cookingTimerInterval = setInterval(() => {
            this.cookingTimerSeconds--;

            if (this.cookingTimerSeconds <= 0) {
                clearInterval(this.cookingTimerInterval);
                this.cookingTimerInterval = null;
                timerTime.textContent = '00:00';
                timerTime.classList.add('urgent');

                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200, 100, 200]);
                }

                this.addMessage('system', `⏱️ Timer done! (${label})`);
                setTimeout(() => this.dismissTimer(), 10000);
            } else {
                updateDisplay();
            }
        }, 1000);
    }

    dismissTimer() {
        if (this.cookingTimerInterval) {
            clearInterval(this.cookingTimerInterval);
            this.cookingTimerInterval = null;
        }
        const timerWidget = document.getElementById('timerWidget');
        timerWidget.classList.remove('active');
        const timerTime = document.getElementById('timerTime');
        timerTime.classList.remove('urgent');
    }

    // ── Observation Badge ───────────────────────────────────

    flashObservationBadge() {
        if (!this.observationBadge) return;
        this.observationBadge.classList.add('active');
        setTimeout(() => {
            this.observationBadge.classList.remove('active');
        }, 3000);
    }

    addStreamingMessage(role, text) {
        this.removeTypingIndicator();

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

    // ── Typing Indicator ────────────────────────────────────

    showTypingIndicator() {
        if (document.querySelector('.typing-indicator')) return;
        const div = document.createElement('div');
        div.className = 'message agent-message';
        div.innerHTML = `
            <div class="message-label">🔥 MISE</div>
            <div class="message-content typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        this.transcriptMessages.appendChild(div);
        this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight;
    }

    removeTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            const parent = indicator.closest('.message');
            if (parent) parent.remove();
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
        this.showTypingIndicator();
    }

    addMessage(role, text) {
        this.removeTypingIndicator();

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
