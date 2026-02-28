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

    // ── Auto-Start ──
    async autoStart() {
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
            this.playerNode.connect(this.playbackContext.destination);
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
                this.playerNode.connect(this.playbackContext.destination);
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
                if (avg > this.BARGE_IN_THRESHOLD && this.isAgentSpeaking && !this.bargeInCooldown) this.bargeIn();
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
        } else if (['get_food_safety_data', 'get_produce_safety_data', 'get_nutrition_estimate'].includes(call.name)) {
            this.updateAIStatus('thinking');
            this.pendingToolCalls[call.name] = call.args;
            this.showToolCard(call.name, call.args, null);
        }
    }

    handleFunctionResponse(response) {
        const name = response.name;
        const data = response.response || {};
        const args = this.pendingToolCalls[name] || {};
        delete this.pendingToolCalls[name];
        if (Object.keys(this.pendingToolCalls).length === 0 && this.aiRingState === 'thinking')
            this.updateAIStatus(this.isAgentSpeaking ? 'speaking' : 'idle');
        this.showToolCard(name, args, data);
    }

    updateTimelineUI(args) {
        const widget = document.getElementById('timelineWidget');
        const list = document.getElementById('timelineSteps');
        if (!widget || !list) return;
        widget.classList.remove('hidden');
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
            const labels = { idle: 'MISE', listening: 'LISTENING', speaking: 'SPEAKING', thinking: 'THINKING' };
            label.textContent = labels[state] || 'MISE';
        }
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
                if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
                this.addMessage('system', `⏱️ Timer done! (${label})`);
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
}

document.addEventListener('DOMContentLoaded', () => { window.miseApp = new MiseApp(); });
