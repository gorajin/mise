/**
 * MISE — Main Application Logic
 * Voice-first, hands-free cooking assistant.
 * Auto-connects camera + mic on load. Supports barge-in interruption.
 */

class MiseApp {
    constructor() {
        this.ws = null;
        this.userId = this.generateId();
        this.sessionId = this.generateId();
        this.isConnected = false;
        this.isRecording = false;
        this.isCameraActive = false;
        this.isMuted = false;
        this.isCooking = false;
        this.frameInterval = null;
        this.sessionStartTime = null;
        this.mealPlan = null;
        this.currentAgentMessage = '';
        this.currentAgentElement = null;
        this.currentUserMessage = '';
        this.currentUserElement = null;

        // Barge-in
        this.isAgentSpeaking = false;
        this.speakingTimeout = null;
        this.bargeInCooldown = false;
        this.BARGE_IN_THRESHOLD = 15;
        this.bargeInFrames = 0;
        this.SUSTAINED_FRAMES_REQUIRED = 6;

        // Wake Lock
        this.wakeLock = null;

        // Playback gain (for smooth ducking)
        this.playbackGainNode = null;

        // Reconnect
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectTimeout = null;
        this.wasConnected = false;

        // Multiple timers
        this.timers = new Map();
        this.timerIdCounter = 0;

        // Cooking phase
        this.currentPhase = null;
        this.phaseKeywords = {
            prep: ['chop', 'dice', 'mince', 'slice', 'peel', 'wash', 'prep', 'cut', 'measure', 'mix', 'marinate', 'season', 'preheat'],
            cook: ['sear', 'sauté', 'saute', 'roast', 'bake', 'boil', 'simmer', 'fry', 'grill', 'broil', 'cook', 'heat', 'brown', 'caramelize', 'reduce', 'steam', 'stir', 'flip'],
            plate: ['plate', 'arrange', 'garnish', 'drizzle', 'sprinkle', 'serve', 'presentation'],
            serve: ['enjoy', 'dinner is', 'ready to eat', 'bon appetit', 'dig in', 'everything.s ready']
        };

        // HUD state
        this.aiRingState = 'idle';
        this.captionTimeout = null;
        this.pendingToolCalls = {};

        // Activity log
        this.activityCount = 0;
        this.observationCount = 0;

        // Multiagent state
        this.activeAgent = 'mise_agent';
        this.agentDisplayNames = {
            mise_agent: { name: 'MISE', emoji: '🎯', color: '#c9a96e' },
            dinner_coordinator: { name: 'Coordinator', emoji: '🍳', color: '#e85d3a' },
            food_scientist: { name: 'Scientist', emoji: '🔬', color: '#5ab87a' },
            safety_nutrition: { name: 'Safety', emoji: '🛡️', color: '#4a9eff' },
            recipe_explorer: { name: 'Explorer', emoji: '📺', color: '#c77dba' },
        };

        // Audio
        this.recordingContext = null;
        this.playbackContext = null;
        this.playerNode = null;
        this.micStream = null;
        this.micSource = null;
        this.recorderNode = null;
        this.analyserNode = null;
        this.micLevelAnimFrame = null;

        // DOM
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
        this.aiStatusRing = document.getElementById('aiStatusRing');
        this.captionBar = document.getElementById('captionBar');
        this.captionText = document.getElementById('captionText');
        this.toolCardsContainer = document.getElementById('toolCardsContainer');
        this.viewfinder = document.getElementById('viewfinder');
        this.timersContainer = document.getElementById('timersContainer');
        this.cookingPhaseBar = document.getElementById('cookingPhaseBar');
        this.activityEntries = document.getElementById('activityEntries');
        this.activityCountEl = document.getElementById('activityCount');

        this.init();
    }

    generateId() {
        return crypto.randomUUID ? crypto.randomUUID() :
            'xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
    }

    init() {
        document.getElementById('startButton').addEventListener('click', () => {
            const meal = document.getElementById('mealInput').value.trim();
            const time = document.getElementById('timeInput').value;
            if (meal) this.mealPlan = { meal, dinnerTime: time || '19:00' };
            if (this.isConnected) {
                this.cameraPlaceholder.classList.add('hidden');
                this.sendMealPlan();
            } else {
                this.start();
            }
        });

        document.getElementById('startFreeButton').addEventListener('click', () => {
            this.mealPlan = null;
            if (this.isConnected) this.cameraPlaceholder.classList.add('hidden');
            else this.start();
        });

        document.getElementById('sendButton').addEventListener('click', () => this.sendText());
        this.textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendText(); });

        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => this.sendTextMessage(btn.dataset.text));
        });

        const fabNext = document.getElementById('fabNext');
        if (fabNext) fabNext.addEventListener('click', () => this.sendTextMessage(fabNext.dataset.text));

        document.getElementById('clearTranscript').addEventListener('click', () => {
            this.transcriptMessages.innerHTML = '';
        });

        const muteBtn = document.getElementById('muteButton');
        if (muteBtn) muteBtn.addEventListener('click', () => this.toggleMute());

        const timelineToggle = document.getElementById('timelineToggle');
        if (timelineToggle) {
            timelineToggle.addEventListener('click', () => {
                document.getElementById('timelineWidget').classList.toggle('collapsed');
            });
        }

        this.initBottomSheet();

        const activityToggle = document.getElementById('activityToggle');
        if (activityToggle) {
            activityToggle.addEventListener('click', () => {
                document.getElementById('activityLog').classList.toggle('collapsed');
            });
        }

        document.getElementById('mealInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('startButton').click();
        });

        this.autoStart();
    }

    // ── Bottom Sheet ──
    initBottomSheet() {
        const handle = document.getElementById('sheetHandle');
        const header = document.querySelector('.transcript-header');
        if (!handle) return;
        let isDragging = false, startY = 0, startHeight = 0;

        const onStart = (clientY) => { isDragging = true; startY = clientY; startHeight = this.transcriptPanel.offsetHeight; this.transcriptPanel.style.transition = 'none'; };
        const onMove = (clientY) => { if (!isDragging) return; const newH = Math.max(56, Math.min(window.innerHeight * 0.65, startHeight + (startY - clientY))); this.transcriptPanel.style.height = newH + 'px'; };
        const onEnd = () => {
            if (!isDragging) return; isDragging = false;
            this.transcriptPanel.style.transition = 'height 0.3s ease';
            const h = this.transcriptPanel.offsetHeight;
            if (h < 100) { this.transcriptPanel.classList.add('collapsed'); this.transcriptPanel.classList.remove('expanded'); }
            else if (h > window.innerHeight * 0.5) { this.transcriptPanel.classList.add('expanded'); this.transcriptPanel.classList.remove('collapsed'); this.transcriptPanel.style.height = ''; }
            else { this.transcriptPanel.classList.remove('collapsed', 'expanded'); this.transcriptPanel.style.height = ''; }
        };

        handle.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY), { passive: true });
        document.addEventListener('touchmove', (e) => onMove(e.touches[0].clientY), { passive: true });
        document.addEventListener('touchend', onEnd);
        header.addEventListener('click', () => {
            if (window.innerWidth >= 768) return;
            this.transcriptPanel.classList.toggle('collapsed');
        });
    }

    // ── Wake Lock ──
    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('[MISE] Wake Lock active: Screen will not sleep.');
                document.addEventListener('visibilitychange', async () => {
                    if (this.wakeLock !== null && document.visibilityState === 'visible') {
                        try {
                            this.wakeLock = await navigator.wakeLock.request('screen');
                            console.log('[MISE] Wake Lock re-acquired.');
                        } catch (e) { console.warn('[MISE] Wake Lock re-acquire failed:', e.message); }
                    }
                });
            }
        } catch (err) {
            console.warn(`[MISE] Wake Lock failed: ${err.message}`);
        }
    }

    // ── Auto-Start ──
    async autoStart() {
        await this.requestWakeLock();
        this.updateSplash('Starting camera...');
        await this.startCamera();
        this.updateSplash('Connecting to MISE...');
        try { await this.connectWebSocket(); } catch (error) {
            console.error('[MISE] WebSocket failed:', error);
            this.addMessage('system', '❌ Could not connect to MISE. Please refresh the page.');
            this.splashScreen.classList.add('hidden');
            return;
        }
        this.updateSplash('Starting microphone...');
        await this.startAudio();
        this.startSessionTimer();
        this.isCooking = true;
        // Skip dinner planner — go straight to camera view
        this.cameraPlaceholder.classList.add('hidden');
        const fab = document.getElementById('fabNext');
        if (fab && window.innerWidth < 768) fab.classList.add('visible');
        this.splashScreen.classList.add('hidden');
    }

    async start() {
        this.updateSplash('Requesting camera access...');
        this.splashScreen.classList.remove('hidden');
        try {
            await this.startCamera();
            this.updateSplash('Connecting to MISE...');
            await this.connectWebSocket();
            this.updateSplash('Initializing audio...');
            await this.startAudio();
            this.startSessionTimer();
            this.cameraPlaceholder.classList.add('hidden');
            this.isCooking = true;
            const fab = document.getElementById('fabNext');
            if (fab && window.innerWidth < 768) fab.classList.add('visible');
            setTimeout(() => this.splashScreen.classList.add('hidden'), 500);
            if (this.mealPlan) this.sendMealPlan();
        } catch (error) {
            console.error('[MISE] Start error:', error);
            this.updateSplash(`Error: ${error.message}`);
            this.addMessage('system', `Error: ${error.message}. Please check permissions.`);
            setTimeout(() => this.splashScreen.classList.add('hidden'), 2000);
        }
    }

    sendMealPlan() {
        if (!this.mealPlan) return;
        const now = new Date();
        const [hours, mins] = this.mealPlan.dinnerTime.split(':');
        const dinnerDate = new Date(); dinnerDate.setHours(parseInt(hours), parseInt(mins), 0);
        const minutesUntil = Math.round((dinnerDate - now) / 60000);
        const planMessage = `I'm making ${this.mealPlan.meal}. I want to eat at ${this.mealPlan.dinnerTime}. That's about ${minutesUntil} minutes from now. Please build me a cooking timeline and walk me through it step by step.`;
        setTimeout(() => this.sendTextMessage(planMessage), 500);
        // Show phase bar
        if (this.cookingPhaseBar) { this.cookingPhaseBar.classList.add('active'); this.setCookingPhase('prep'); }
    }

    updateSplash(text) { if (this.splashStatus) this.splashStatus.textContent = text; }

    // ── Camera ──
    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false
            });
            this.cameraFeed.srcObject = stream;
            this.isCameraActive = true;
            this.captureCanvas.width = 640;
            this.captureCanvas.height = 480;
            this.frameInterval = setInterval(() => this.captureAndSendFrame(), 1000);
        } catch (err) {
            console.warn('[MISE] Camera error:', err.name, err.message);
            this.isCameraActive = false;
            this.addMessage('system', err.name === 'NotAllowedError'
                ? '📷 Camera access denied. MISE can still help via voice — just talk!'
                : '📷 Camera not available. Voice-only mode active.');
        }
    }

    captureAndSendFrame() {
        if (!this.isCameraActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const ctx = this.captureCanvas.getContext('2d');
        ctx.drawImage(this.cameraFeed, 0, 0, 640, 480);
        const dataUrl = this.captureCanvas.toDataURL('image/jpeg', 0.6);
        this.ws.send(JSON.stringify({ type: 'video_frame', data: dataUrl.split(',')[1] }));
    }

    // ── Audio ──
    async startAudio() {
        try {
            this.recordingContext = new AudioContext({ sampleRate: 16000 });
            this.playbackContext = new AudioContext({ sampleRate: 24000 });
            await this.recordingContext.resume();
            await this.playbackContext.resume();
            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            await this.recordingContext.audioWorklet.addModule('/static/js/pcm-recorder-processor.js');
            this.micSource = this.recordingContext.createMediaStreamSource(this.micStream);
            this.recorderNode = new AudioWorkletNode(this.recordingContext, 'pcm-recorder-processor');
            this.analyserNode = this.recordingContext.createAnalyser();
            this.analyserNode.fftSize = 256;
            this.micSource.connect(this.analyserNode);
            this.recorderNode.port.onmessage = (event) => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isMuted) this.ws.send(event.data.buffer);
            };
            this.micSource.connect(this.recorderNode);
            this.recorderNode.connect(this.recordingContext.destination);
            this.isRecording = true;
            await this.playbackContext.audioWorklet.addModule('/static/js/pcm-player-processor.js');
            this.playerNode = new AudioWorkletNode(this.playbackContext, 'pcm-player-processor');
            this.playbackGainNode = this.playbackContext.createGain();
            this.playerNode.connect(this.playbackGainNode);
            this.playbackGainNode.connect(this.playbackContext.destination);
            document.getElementById('micLabel').textContent = 'Listening...';
            this.startMicLevel();
        } catch (err) {
            console.warn('[MISE] Audio error:', err.name, err.message);
            this.isRecording = false;
            try {
                if (!this.playbackContext) this.playbackContext = new AudioContext({ sampleRate: 24000 });
                await this.playbackContext.resume();
                await this.playbackContext.audioWorklet.addModule('/static/js/pcm-player-processor.js');
                this.playerNode = new AudioWorkletNode(this.playbackContext, 'pcm-player-processor');
                this.playbackGainNode = this.playbackContext.createGain();
                this.playerNode.connect(this.playbackGainNode);
                this.playbackGainNode.connect(this.playbackContext.destination);
            } catch (e) { console.warn('[MISE] Playback failed:', e); }
            this.addMessage('system', err.name === 'NotAllowedError'
                ? '🎙️ Mic access denied. Use text input — you can still hear MISE.'
                : '🎙️ Mic not available. Text input mode active.');
            document.getElementById('micLabel').textContent = 'Mic unavailable';
        }
    }

    startMicLevel() {
        const levelBar = document.getElementById('micLevelBar');
        if (!levelBar || !this.analyserNode) return;
        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        const update = () => {
            this.analyserNode.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            const pct = Math.min(100, (avg / 128) * 100);
            if (this.isMuted) { levelBar.style.width = '0%'; }
            else {
                levelBar.style.width = pct + '%';
                if (!this.isAgentSpeaking && avg > 5) this.updateAIStatus('listening');
                else if (!this.isAgentSpeaking && avg <= 5 && this.aiRingState === 'listening') this.updateAIStatus('idle');
                if (avg > this.BARGE_IN_THRESHOLD && this.isAgentSpeaking && !this.bargeInCooldown) {
                    this.bargeInFrames++;
                    if (this.bargeInFrames > this.SUSTAINED_FRAMES_REQUIRED) {
                        this.handleSeamlessBargeIn();
                        this.bargeInFrames = 0;
                    }
                } else if (!this.isAgentSpeaking || avg <= this.BARGE_IN_THRESHOLD) {
                    this.bargeInFrames = 0;
                }
            }
            this.micLevelAnimFrame = requestAnimationFrame(update);
        };
        update();
    }

    bargeIn() {
        console.log('[MISE] Barge-in detected');
        if (this.playerNode) this.playerNode.port.postMessage({ type: 'flush' });
        this.isAgentSpeaking = false;
        this.showAgentSpeaking(false);
        if (this.speakingTimeout) { clearTimeout(this.speakingTimeout); this.speakingTimeout = null; }
        this.bargeInCooldown = true;
        setTimeout(() => { this.bargeInCooldown = false; }, 2000);
    }

    handleSeamlessBargeIn() {
        if (!this.playbackContext || !this.playbackGainNode) return;
        console.log('[MISE] Seamless barge-in triggered');
        const now = this.playbackContext.currentTime;
        this.playbackGainNode.gain.cancelScheduledValues(now);
        this.playbackGainNode.gain.setValueAtTime(this.playbackGainNode.gain.value, now);
        this.playbackGainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        setTimeout(() => {
            if (this.playerNode) this.playerNode.port.postMessage({ type: 'flush' });
            this.isAgentSpeaking = false;
            this.showAgentSpeaking(false);
            if (this.speakingTimeout) { clearTimeout(this.speakingTimeout); this.speakingTimeout = null; }
            this.playbackGainNode.gain.setValueAtTime(1, this.playbackContext.currentTime);
            console.log('[MISE] Audio gracefully ducked for seamless interruption.');
        }, 60);
        this.bargeInCooldown = true;
        setTimeout(() => { this.bargeInCooldown = false; }, 2000);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const btn = document.getElementById('muteButton');
        const label = document.getElementById('micLabel');
        if (this.isMuted) {
            btn.classList.add('muted');
            label.textContent = 'Muted';
            if (this.micStream) this.micStream.getAudioTracks().forEach(t => t.enabled = false);
        } else {
            btn.classList.remove('muted');
            label.textContent = 'Listening...';
            if (this.micStream) this.micStream.getAudioTracks().forEach(t => t.enabled = true);
        }
    }

    playAudio(base64Data) {
        if (!this.playerNode) return;
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) bytes[i] = binaryData.charCodeAt(i);
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
        this.playerNode.port.postMessage(float32);
        this.isAgentSpeaking = true;
        this.showAgentSpeaking(true);
        this.updateAIStatus('speaking');
        const durationMs = (float32.length / 24000) * 1000;
        if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
        this.speakingTimeout = setTimeout(() => {
            this.isAgentSpeaking = false;
            this.showAgentSpeaking(false);
            this.updateAIStatus('idle');
        }, durationMs + 200);
    }

    // ── WebSocket ──
    async connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws/${this.userId}/${this.sessionId}`;
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);
            this.ws.onopen = () => {
                this.isConnected = true; this.wasConnected = true; this.reconnectAttempts = 0;
                this.updateConnectionStatus(true); this.hideReconnectBanner();
                this.addMessage('system', '🔥 Connected — just start talking! Or type a meal plan above.');
                this.logActivity('🔗', 'Connected to MISE agent');
                resolve();
            };
            this.ws.onmessage = (event) => this.handleMessage(event);
            this.ws.onclose = () => {
                this.isConnected = false; this.updateConnectionStatus(false);
                if (this.wasConnected && this.reconnectAttempts < this.maxReconnectAttempts) this.attemptReconnect();
                else this.addMessage('system', '📡 Disconnected. Refresh to reconnect.');
            };
            this.ws.onerror = (error) => {
                console.error('[MISE] WebSocket error:', error);
                if (!this.wasConnected) reject(new Error('WebSocket connection failed'));
            };
        });
    }

    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
        this.showReconnectBanner(this.reconnectAttempts);
        this.reconnectTimeout = setTimeout(async () => {
            try {
                this.sessionId = this.generateId();
                await this.connectWebSocket();
                if (this.isCameraActive && !this.frameInterval) this.frameInterval = setInterval(() => this.captureAndSendFrame(), 1000);
            } catch (e) { console.error('[MISE] Reconnect failed:', e); }
        }, delay);
    }

    showReconnectBanner(attempt) {
        let banner = document.querySelector('.reconnect-banner');
        if (!banner) { banner = document.createElement('div'); banner.className = 'reconnect-banner'; document.querySelector('.app-header').after(banner); }
        banner.innerHTML = `<div class="reconnect-spinner"></div> Reconnecting... (attempt ${attempt})`;
        banner.classList.add('active');
    }
    hideReconnectBanner() { const b = document.querySelector('.reconnect-banner'); if (b) b.classList.remove('active'); }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            if (data.parts) {
                for (const part of data.parts) {
                    if (part.type === 'text' && part.text) {
                        this.currentAgentMessage = part.text;
                        if (!this.currentAgentElement) this.currentAgentElement = this.addStreamingMessage('agent', this.currentAgentMessage);
                        else this.updateStreamingMessage(this.currentAgentElement, this.currentAgentMessage);
                        this.updateCaptionBar(this.currentAgentMessage);
                        this.detectSafetyAlert(this.currentAgentMessage);
                        this.parseTimerTriggers(this.currentAgentMessage);
                        this.detectCookingPhase(this.currentAgentMessage);
                    }
                    if (part.type === 'input_transcription' && part.text) {
                        this.currentUserMessage = part.text;
                        if (!this.currentUserElement) this.currentUserElement = this.addStreamingMessage('user', this.currentUserMessage);
                        else this.updateStreamingMessage(this.currentUserElement, this.currentUserMessage);
                    }
                    if (part.type === 'audio' && part.data) this.playAudio(part.data);
                    if (part.type === 'function_call' && part.name) this.handleFunctionCall(part);
                    if (part.type === 'function_response' && part.name) this.handleFunctionResponse(part);
                    if (part.type === 'agent_transfer' && part.target_agent) this.updateActiveAgent(part.target_agent);
                }
            }
            if (data.author === 'agent' && data.parts && data.parts.length > 0) this.flashObservationBadge();
            if (data.turn_complete) {
                this.currentAgentMessage = ''; this.currentAgentElement = null;
                this.currentUserMessage = ''; this.currentUserElement = null;
            }
        } catch (e) { console.error('[MISE] Message parse error:', e); }
    }

    handleFunctionCall(call) {
        if (call.name === 'update_timeline_step') {
            this.updateTimelineUI(call.args);
        } else if (call.name === 'set_observation_interval') {
            const newIntervalSeconds = call.args.seconds || 15;
            console.log(`[MISE] Agent updated visual polling to ${newIntervalSeconds}s.`);
            if (this.frameInterval) {
                clearInterval(this.frameInterval);
                this.frameInterval = setInterval(() => this.captureAndSendFrame(), newIntervalSeconds * 1000);
            }
            this.logActivity('📷', `Camera interval → ${newIntervalSeconds}s: ${call.args.reason || ''}`);
        } else if (call.name === 'analyze_and_recreate_recipe') {
            this.updateAIStatus('thinking');
            this.pendingToolCalls[call.name] = call.args;
            const dishName = call.args.dish_name || 'Recipe';
            this.logActivity('👨‍🍳', `Reverse-engineering: "${dishName}"`);
        } else if (['get_food_safety_data', 'get_produce_safety_data', 'get_nutrition_estimate'].includes(call.name)) {
            this.updateAIStatus('thinking');
            this.pendingToolCalls[call.name] = call.args;
            this.showToolCard(call.name, call.args, null);
            const icons = { get_food_safety_data: '🌡️', get_produce_safety_data: '🥬', get_nutrition_estimate: '📊' };
            const argVal = call.args.food_item || call.args.produce_item || '';
            this.logActivity(icons[call.name] || '🔧', `Tool: ${call.name.replace('get_', '').replace('_data', '').replace('_estimate', '')}("${argVal}")`);
        }
    }

    handleFunctionResponse(response) {
        const name = response.name;
        const data = response.response || {};
        const args = this.pendingToolCalls[name] || {};
        delete this.pendingToolCalls[name];
        if (Object.keys(this.pendingToolCalls).length === 0 && this.aiRingState === 'thinking')
            this.updateAIStatus(this.isAgentSpeaking ? 'speaking' : 'idle');
        // Handle recipe reverse-engineering result
        if (name === 'analyze_and_recreate_recipe') {
            const dish = data.dish || args.dish_name || 'Recipe';
            const groceryList = data.grocery_list || [];
            const steps = data.reconstructed_steps || [];
            this.logActivity('🍳', `Recipe: ${dish} — ${groceryList.length} ingredients, ${steps.length} steps`);
            if (groceryList.length > 0) this.logActivity('🛒', `Grocery: ${groceryList.slice(0, 5).join(', ')}${groceryList.length > 5 ? '...' : ''}`);
            return;
        }
        this.showToolCard(name, args, data);
        // Log tool result
        if (data.safe_internal_temp_f) this.logActivity('✓', `Result: ${args.food_item || 'food'} → ${data.safe_internal_temp_f}°F`);
        else if (data.wash_method) this.logActivity('✓', `Result: ${data.is_dirty_dozen ? '⚠ Dirty Dozen' : 'wash method returned'}`);
        else if (data.calories_per_serving || data.calories) this.logActivity('✓', `Result: ${data.calories_per_serving || data.calories} cal`);
    }

    updateTimelineUI(args) {
        const widget = document.getElementById('timelineWidget');
        const list = document.getElementById('timelineSteps');
        if (!widget || !list) return;
        widget.classList.remove('hidden');
        this.logActivity('📋', `Timeline: "${args.step_name || 'step'}" → ${args.status || 'pending'}`);
        const cleanName = (args.step_name || 'step').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const stepId = `step-${cleanName}`;
        let stepEl = document.getElementById(stepId);
        if (!stepEl) {
            stepEl = document.createElement('li');
            stepEl.id = stepId;
            stepEl.className = 'timeline-step';
            stepEl.innerHTML = `<div class="step-indicator"></div><div class="step-content"><h4>${this.escapeHtml(args.step_name || '')}</h4><p>${this.escapeHtml(args.step_description || '')}</p></div>`;
            list.appendChild(stepEl);
        }
        const status = args.status || 'pending';
        stepEl.dataset.status = status;
        if (status === 'active') {
            document.querySelectorAll('.timeline-step').forEach(el => el.classList.remove('active'));
            stepEl.classList.remove('completed'); stepEl.classList.add('active');
            stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (status === 'completed') {
            stepEl.classList.remove('active'); stepEl.classList.add('completed');
        } else {
            stepEl.classList.remove('active', 'completed');
        }
    }

    // ── Tool Cards with SVG Icons ──
    showToolCard(toolName, args, resultData) {
        if (!this.toolCardsContainer) return;
        const cardId = `tool-card-${toolName}`;
        let card = document.getElementById(cardId);
        let icon, source, title, detail, badge, cardClass;

        if (toolName === 'get_food_safety_data') {
            icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e85d3a" stroke-width="2"><path d="M14 4v10.54a4 4 0 11-4 0V4a2 2 0 014 0z"/></svg>';
            source = 'USDA FOOD SAFETY'; cardClass = 'card-safety';
            const item = args.food_item || 'Food';
            if (resultData && resultData.safe_internal_temp_f) {
                title = `${item} → ${resultData.safe_internal_temp_f}°F`;
                detail = resultData.notes || resultData.tip || 'Safe internal temperature';
                const pct = Math.min(100, (resultData.safe_internal_temp_f / 212) * 100);
                badge = `<div class="temp-gauge"><div class="temp-bar-track"><div class="temp-bar-fill" style="width:${pct}%"></div></div><div class="temp-value">${resultData.safe_internal_temp_f}°F</div></div>`;
            } else if (resultData) {
                title = item; detail = resultData.danger_zone || resultData.note || 'Follow food safety guidelines';
                badge = '<span class="tool-card-badge badge-safe">✓ GUIDELINES</span>';
            } else { title = `Checking ${item}...`; detail = 'Retrieving safe temperature data'; badge = ''; }
        } else if (toolName === 'get_produce_safety_data') {
            icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5ab87a" stroke-width="2"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66L12 14l5-3-2-3z"/><path d="M20.59 3.41A2 2 0 0117.17 3L12 8.17"/></svg>';
            source = 'EWG PRODUCE SAFETY'; cardClass = 'card-produce';
            const item = args.produce_item || 'Produce';
            if (resultData) {
                title = item; detail = resultData.wash_method || 'Rinse thoroughly';
                if (resultData.is_dirty_dozen) badge = '<span class="tool-card-badge badge-danger">⚠ DIRTY DOZEN</span>';
                else if (resultData.is_clean_fifteen) badge = '<span class="tool-card-badge badge-safe">✓ CLEAN FIFTEEN</span>';
                else badge = '';
            } else { title = `Checking ${item}...`; detail = 'Looking up wash method'; badge = ''; }
        } else if (toolName === 'get_nutrition_estimate') {
            icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>';
            source = 'USDA NUTRITION'; cardClass = 'card-nutrition';
            const item = args.food_item || 'Food';
            if (resultData && (resultData.calories_per_serving || resultData.calories)) {
                const cal = resultData.calories_per_serving || resultData.calories;
                const protein = resultData.protein_g || 0, carbs = resultData.carbs_g || 0, fat = resultData.fat_g || 0;
                title = `${item} — ${cal} cal`;
                const serving = resultData.serving_size || '';
                detail = serving ? `Per ${serving}` : '';
                badge = `<div class="macro-bars">
                    <div class="macro-bar macro-protein"><div class="macro-bar-fill" style="width:${Math.min(100, protein * 2)}%"></div><div class="macro-bar-label">${protein}g P</div></div>
                    <div class="macro-bar macro-carbs"><div class="macro-bar-fill" style="width:${Math.min(100, carbs)}%"></div><div class="macro-bar-label">${carbs}g C</div></div>
                    <div class="macro-bar macro-fat"><div class="macro-bar-fill" style="width:${Math.min(100, fat * 2)}%"></div><div class="macro-bar-label">${fat}g F</div></div>
                </div>`;
            } else if (resultData) { title = item; detail = resultData.note || resultData.tip || 'Estimated nutrition'; badge = ''; }
            else { title = `Checking ${item}...`; detail = 'Looking up nutrition data'; badge = ''; }
        } else { icon = ''; source = 'DATA'; cardClass = ''; title = ''; detail = ''; badge = ''; }

        if (!card) {
            card = document.createElement('div');
            card.id = cardId;
            card.className = `tool-data-card ${cardClass}`;
            this.toolCardsContainer.appendChild(card);
            while (this.toolCardsContainer.children.length > 3) this.toolCardsContainer.removeChild(this.toolCardsContainer.firstChild);
        }
        card.innerHTML = `<div class="tool-card-header"><span class="tool-card-icon">${icon}</span><span class="tool-card-source">${source}</span></div><div class="tool-card-title">${this.escapeHtml(title)}</div>${detail ? `<div class="tool-card-detail">${this.escapeHtml(detail)}</div>` : ''}${badge}`;

        if (card._dismissTimer) clearTimeout(card._dismissTimer);
        card._dismissTimer = setTimeout(() => {
            card.classList.add('dismissing');
            setTimeout(() => card.remove(), 400);
        }, resultData ? 8000 : 15000);
    }

    // ── Cooking Phase Detection ──
    detectCookingPhase(text) {
        const lower = text.toLowerCase();
        for (const [phase, keywords] of Object.entries(this.phaseKeywords)) {
            for (const kw of keywords) {
                if (lower.includes(kw)) { this.setCookingPhase(phase); return; }
            }
        }
    }

    setCookingPhase(phase) {
        if (phase === this.currentPhase) return;
        const phases = ['prep', 'cook', 'plate', 'serve'];
        const newIdx = phases.indexOf(phase);
        const oldIdx = this.currentPhase ? phases.indexOf(this.currentPhase) : -1;
        if (newIdx < oldIdx) return; // Don't go backwards
        this.currentPhase = phase;
        if (this.cookingPhaseBar) this.cookingPhaseBar.classList.add('active');

        document.querySelectorAll('.phase-item').forEach(el => {
            const p = el.dataset.phase;
            const pIdx = phases.indexOf(p);
            el.classList.remove('active', 'completed');
            if (pIdx < newIdx) el.classList.add('completed');
            else if (pIdx === newIdx) el.classList.add('active');
        });
        // Fill connectors
        document.querySelectorAll('.phase-connector').forEach((el, i) => {
            el.classList.toggle('filled', i < newIdx);
        });
    }

    // ── AI Status ──
    updateAIStatus(state) {
        if (!this.aiStatusRing || state === this.aiRingState) return;
        this.aiStatusRing.classList.remove('idle', 'listening', 'speaking', 'thinking');
        this.aiStatusRing.classList.add(state);
        this.aiRingState = state;
        const label = document.getElementById('orbLabel');
        if (label) {
            const agentInfo = this.agentDisplayNames[this.activeAgent] || this.agentDisplayNames.mise_agent;
            const labels = { idle: agentInfo.name.toUpperCase(), listening: 'LISTENING', speaking: 'SPEAKING', thinking: 'THINKING' };
            label.textContent = labels[state] || agentInfo.name.toUpperCase();
        }
    }

    // ── Active Agent Indicator ──
    updateActiveAgent(agentName) {
        if (agentName === this.activeAgent) return;
        this.activeAgent = agentName;
        const info = this.agentDisplayNames[agentName] || { name: agentName, emoji: '🤖', color: '#c9a96e' };
        console.log(`[MISE] Active agent: ${info.emoji} ${info.name}`);

        // Update orb badge
        let badge = document.getElementById('agentBadge');
        if (!badge && this.aiStatusRing) {
            badge = document.createElement('div');
            badge.id = 'agentBadge';
            badge.className = 'agent-badge';
            this.aiStatusRing.appendChild(badge);
        }
        if (badge) {
            badge.textContent = `${info.emoji} ${info.name}`;
            badge.style.setProperty('--agent-color', info.color);
            badge.classList.add('active');
            // Hide badge for orchestrator (default state)
            if (agentName === 'mise_agent') {
                setTimeout(() => badge.classList.remove('active'), 2000);
            }
        }

        // Update orb label
        const orbLabel = document.getElementById('orbLabel');
        if (orbLabel && this.aiRingState === 'idle') {
            orbLabel.textContent = info.name.toUpperCase();
        }

        this.logActivity('🔀', `Agent: ${info.emoji} ${info.name}`);
    }

    // ── Caption Bar ──
    updateCaptionBar(text) {
        if (!this.captionBar || !this.captionText) return;
        const maxLen = 120;
        this.captionText.textContent = text.length > maxLen ? '...' + text.slice(-maxLen) : text;
        this.captionBar.classList.add('active');
        if (this.captionTimeout) clearTimeout(this.captionTimeout);
        this.captionTimeout = setTimeout(() => this.captionBar.classList.remove('active'), 4000);
    }

    // ── Viewfinder + Observation ──
    flashObservationBadge() {
        if (this.observationBadge) {
            this.observationBadge.classList.add('active');
            setTimeout(() => this.observationBadge.classList.remove('active'), 3000);
        }
        if (this.viewfinder) {
            this.viewfinder.classList.add('scanning');
            setTimeout(() => this.viewfinder.classList.remove('scanning'), 2000);
        }
        this.observationCount++;
        this.logActivity('👁️', `Observation scan #${this.observationCount}`);
    }

    // ── Multiple Concurrent Timers ──
    parseTimerTriggers(text) {
        const patterns = [/(\d+)\s*minutes?\b/gi, /timer\s*(?:for\s*)?(\d+)/gi, /(\d+)\s*min\b/gi];
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
        const id = ++this.timerIdCounter;
        const seconds = minutes * 60;

        // Check for duplicate label — update existing instead
        for (const [existingId, t] of this.timers) {
            if (t.label === label) { this.removeCookingTimer(existingId); break; }
        }

        const widget = document.createElement('div');
        widget.className = 'timer-widget';
        widget.id = `timer-${id}`;
        widget.innerHTML = `
            <div class="timer-display">
                <span class="timer-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                <span class="timer-time" id="timer-time-${id}">${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}</span>
                <span class="timer-label">${this.escapeHtml(label)}</span>
            </div>
            <button class="timer-dismiss" onclick="window.miseApp.removeCookingTimer(${id})">✕</button>
        `;
        this.timersContainer.appendChild(widget);

        let remaining = seconds;
        const interval = setInterval(() => {
            remaining--;
            const timeEl = document.getElementById(`timer-time-${id}`);
            if (!timeEl) { clearInterval(interval); return; }
            const m = String(Math.floor(remaining / 60)).padStart(2, '0');
            const s = String(remaining % 60).padStart(2, '0');
            timeEl.textContent = `${m}:${s}`;
            if (remaining <= 30 && remaining > 0) timeEl.classList.add('urgent');
            if (remaining <= 0) {
                clearInterval(interval);
                timeEl.textContent = '00:00';
                timeEl.classList.add('urgent');
                this.playTimerChime();
                if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
                this.addMessage('system', `⏱️ Timer done! (${label})`);
                this.logActivity('⏱️', `Timer complete: ${label}`);
                setTimeout(() => this.removeCookingTimer(id), 10000);
            }
        }, 1000);

        this.timers.set(id, { interval, label, widget });

        // Limit to 4 timers max
        if (this.timers.size > 4) {
            const oldest = this.timers.keys().next().value;
            this.removeCookingTimer(oldest);
        }
    }

    removeCookingTimer(id) {
        const timer = this.timers.get(id);
        if (!timer) return;
        clearInterval(timer.interval);
        timer.widget.remove();
        this.timers.delete(id);
    }

    // ── Safety Detection ──
    detectSafetyAlert(text) {
        const keywords = ['wash', 'rinse', 'pesticide', 'dirty dozen', 'cross-contamination', 'bacteria', 'danger zone', 'watch out', 'careful', 'burning'];
        const lower = text.toLowerCase();
        if (keywords.some(kw => lower.includes(kw))) this.showSafetyAlert(text);
    }

    // ── UI Methods ──
    addStreamingMessage(role, text) {
        this.removeTypingIndicator();
        const div = document.createElement('div');
        div.className = `message ${role}-message`;
        const label = role === 'agent' ? '🔥 MISE' : role === 'user' ? '👤 You' : '📌 System';
        div.innerHTML = `<div class="message-label">${label}</div><div class="message-content"><p>${this.escapeHtml(text)}</p></div>`;
        this.transcriptMessages.appendChild(div);
        this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight;
        return div;
    }

    updateStreamingMessage(element, text) {
        const p = element.querySelector('.message-content p');
        if (p) { p.textContent = text; this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight; }
    }

    showTypingIndicator() {
        if (document.querySelector('.typing-indicator')) return;
        const div = document.createElement('div');
        div.className = 'message agent-message';
        div.innerHTML = `<div class="message-label">🔥 MISE</div><div class="message-content typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
        this.transcriptMessages.appendChild(div);
        this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight;
    }

    removeTypingIndicator() {
        const ind = document.querySelector('.typing-indicator');
        if (ind) { const p = ind.closest('.message'); if (p) p.remove(); }
    }

    sendText() { const text = this.textInput.value.trim(); if (!text) return; this.sendTextMessage(text); this.textInput.value = ''; }

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
        div.innerHTML = `<div class="message-label">${label}</div><div class="message-content"><p>${this.escapeHtml(text)}</p></div>`;
        this.transcriptMessages.appendChild(div);
        this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight;
    }

    escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

    showSafetyAlert(message) {
        const short = message.length > 120 ? message.substring(0, 120) + '...' : message;
        this.safetyMessage.textContent = short;
        this.safetyOverlay.classList.add('active');
        setTimeout(() => this.safetyOverlay.classList.remove('active'), 5000);
    }

    showAgentSpeaking(active) {
        if (active) this.agentSpeaking.classList.add('active');
        else this.agentSpeaking.classList.remove('active');
    }

    updateConnectionStatus(connected) {
        const textEl = this.connectionStatus.querySelector('.status-text');
        if (connected) { this.connectionStatus.classList.add('connected'); textEl.textContent = 'Connected'; }
        else { this.connectionStatus.classList.remove('connected'); textEl.textContent = 'Disconnected'; }
    }

    startSessionTimer() {
        this.sessionStartTime = Date.now();
        setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
            this.sessionTimer.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
        }, 1000);
    }
    // ── Timer Chime (Web Audio API) ──
    playTimerChime() {
        try {
            const ctx = this.playbackContext || new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            // Note 1: C5 (523Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523, now);
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.3);
            // Note 2: E5 (659Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659, now + 0.15);
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.setValueAtTime(0.3, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.15);
            osc2.stop(now + 0.5);
            // Note 3: G5 (784Hz) — resolution
            const osc3 = ctx.createOscillator();
            const gain3 = ctx.createGain();
            osc3.type = 'sine';
            osc3.frequency.setValueAtTime(784, now + 0.3);
            gain3.gain.setValueAtTime(0, now);
            gain3.gain.setValueAtTime(0.25, now + 0.3);
            gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
            osc3.connect(gain3);
            gain3.connect(ctx.destination);
            osc3.start(now + 0.3);
            osc3.stop(now + 0.7);
        } catch (e) { console.warn('[MISE] Chime error:', e); }
    }

    // ── Agent Activity Log ──
    logActivity(icon, text) {
        if (!this.activityEntries) return;
        this.activityCount++;
        if (this.activityCountEl) this.activityCountEl.textContent = this.activityCount;
        const now = new Date();
        const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const li = document.createElement('li');
        li.className = 'activity-entry';
        li.innerHTML = `<span class="activity-time">${ts}</span><span class="activity-icon">${icon}</span><span class="activity-text">${this.escapeHtml(text)}</span>`;
        // Prepend (newest first)
        this.activityEntries.insertBefore(li, this.activityEntries.firstChild);
        // Limit to 30 entries
        while (this.activityEntries.children.length > 30) this.activityEntries.removeChild(this.activityEntries.lastChild);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.miseApp = new MiseApp(); });
