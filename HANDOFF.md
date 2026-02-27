# MISE — Agent Handoff Document

> **Last updated:** 2026-02-26 18:45 PST  
> **Status:** Phase A complete (running locally), Phase B & C remaining  
> **Server:** Running at `http://localhost:8080` via uvicorn

---

## 1. What Is MISE?

MISE (Live Kitchen Intelligence) is a **hands-free dinner coordinator** built for the Gemini Live Agent Challenge. The user tells MISE what they're cooking and when they want to eat → MISE builds a timeline, walks them through each step via voice, watches the kitchen through the camera, and proactively interrupts when it sees something important.

**Core differentiator:** The agent is *proactive* — it observes the camera feed every 15-25 seconds and speaks up without being asked (timing cues, safety warnings, doneness checks).

---

## 2. Current State (What Works)

| Component | Status | Notes |
|---|---|---|
| FastAPI server | ✅ Running | `uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload` |
| WebSocket connection | ✅ Stable | 70+ seconds verified, no drops |
| Camera streaming | ✅ Working | 1fps JPEG frames via `getUserMedia` → WebSocket |
| Microphone capture | ✅ Working | PCM 16kHz mono via AudioWorklet |
| Agent audio response | ✅ Working | 24kHz PCM streaming, separate playback AudioContext |
| Text transcription | ✅ Working | `output_transcription` extracted, streams to single bubble |
| User speech transcription | ✅ Working | `input_transcription` extracted, displays in transcript |
| Observation loop | ✅ Firing | Every 15-25 seconds, rotates through 5 prompts |
| Dinner planner UI | ✅ Renders | Meal input + time input → sent as initial message |
| 3 grounding tools | ✅ Unit tested | Food safety, produce safety, nutrition |
| Google Search tool | ✅ Configured | For recipe lookup and grounding |
| README.md | ✅ Written | Hackathon-quality with architecture diagram |
| Dockerfile | ✅ Written | Untested — needs Docker build verification |

---

## 3. Known Issues (Must Fix)

### 🔴 P0: Agent says "I don't have access to a camera"
The agent responded with "I'm currently just a voice assistant. I don't have access to a camera" despite video frames being sent. **Root cause options:**
1. **Model doesn't process images via Live API** — `gemini-2.0-flash-exp-image-generation` might not handle image input through `bidiGenerateContent`. Try `gemini-2.0-flash-live-001` or `gemini-2.5-flash-preview-native-audio-dialog` if available.
2. **JPEG frames are being sent but not reaching the model** — The frames go through `send_realtime(types.Blob(...))` on `LiveRequestQueue`, but the ADK may not be forwarding them to the model.
3. **System prompt needs reinforcement** — The agent persona says it has camera access, but the model might default to denying it.

**How to debug:** Add logging in `upstream_task()` to confirm frames are being sent:
```python
print(f"[MISE] Sent video frame: {len(frame_data)} bytes")
```
Then check server logs while connected.

### 🟡 P1: Audio playback not verified
The agent streams 24kHz PCM audio back to the browser. The `pcm-player-processor.js` AudioWorklet queues and plays it. **Not verified** whether the audio is actually audible — the browser test agent couldn't hear it. The user should test manually with headphones.

### 🟡 P1: Model compatibility
`gemini-2.0-flash-exp-image-generation` does NOT support:
- `proactive_audio` (ProactivityConfig)
- `enable_affective_dialog` (emotion awareness)

These were removed from `RunConfig`. If a model that supports them becomes available, re-enable in `app/main.py` lines 87-91.

### 🟢 P2: Transcript text may not be cumulative
The current fix assumes `output_transcription.text` contains the full accumulated text (so we use `=` assignment). If it turns out the API sends incremental-only fragments, change back to `+=` in `app.js` line 265.

---

## 4. Architecture

```
Browser (Phone)
├── Camera → 1fps JPEG → WebSocket (binary/JSON)
├── Microphone → 16kHz PCM → WebSocket (binary)  
└── Audio Player → 24kHz PCM ← WebSocket (JSON)

FastAPI Server (app/main.py)
├── WebSocket endpoint: /ws/{user_id}/{session_id}
├── upstream_task() → receives user input → LiveRequestQueue
├── downstream_task() → ADK events → WebSocket to browser
│   ├── content.parts (inline_data) → audio chunks
│   ├── output_transcription → agent text → single streaming bubble
│   └── input_transcription → user speech text
├── observation_loop() → periodic proactive prompts to agent
└── Runner.run_live() → ADK bidi-streaming ↔ Gemini Live API

Agent (app/mise_agent/agent.py)
├── Model: gemini-2.0-flash-exp-image-generation
├── Tools: get_food_safety_data, get_produce_safety_data,
│          get_nutrition_estimate, google_search
└── System prompt: dinner coordinator persona (170 lines)
```

---

## 5. Key Files

| File | Purpose | Lines |
|---|---|---|
| `app/main.py` | FastAPI server, WebSocket, ADK lifecycle, observation loop | 311 |
| `app/mise_agent/agent.py` | Agent persona, system prompt, tool configuration | 179 |
| `app/mise_agent/tools.py` | 3 grounding tools (food safety, produce, nutrition) | ~185 |
| `app/static/js/app.js` | Browser: WebSocket, camera, mic, audio, transcript | ~426 |
| `app/static/index.html` | UI: dinner planner, camera view, transcript panel | 152 |
| `app/static/css/style.css` | Dark kitchen theme CSS | ~704 |
| `app/static/js/pcm-recorder-processor.js` | AudioWorklet: mic → PCM 16kHz | ~30 |
| `app/static/js/pcm-player-processor.js` | AudioWorklet: PCM 24kHz → speaker | ~30 |
| `app/data/food_safety.json` | USDA safe cooking temperatures | 220 |
| `app/data/produce_safety.json` | Produce washing methods, Dirty Dozen | 128 |
| `app/data/nutrition.json` | Calories, macros, healthy swaps | 230 |

---

## 6. Bugs Fixed in This Session (9 total)

| # | Bug | Fix | File |
|---|-----|-----|------|
| 1 | `ModuleNotFoundError: mise_agent` | `from mise_agent` → `from app.mise_agent` | `main.py:27` |
| 2 | `RunConfig` wrong import | `from google.adk.agents.run_config import RunConfig` | `main.py:19` |
| 3 | `await` on sync methods | Removed `await` from `send_realtime`/`send_content` | `main.py` |
| 4 | Model not found for bidi | `gemini-2.0-flash-live-001` → `gemini-2.0-flash-exp-image-generation` | `agent.py:175` |
| 5 | `proactive_audio` unsupported | Removed `ProactivityConfig` from `RunConfig` | `main.py:87` |
| 6 | `enable_affective_dialog` unsupported | Removed from `RunConfig` | `main.py:90` |
| 7 | No transcript showing | Extract `output_transcription`/`input_transcription` from events | `main.py:197-216` |
| 8 | Audio at wrong sample rate | Separate AudioContexts: 16kHz rec / 24kHz play | `app.js:155-190` |
| 9 | Text duplicating in transcript | Changed `+=` to `=` (API sends cumulative text) | `app.js:265` |

---

## 7. Remaining Work

### Phase B: Polish (Estimated 2-3 hours)
- [ ] **Fix camera vision** — Debug why agent says it has no camera access (P0)
- [ ] **Verify audio playback** — Test with headphones, confirm agent voice is audible
- [ ] Test mobile responsiveness (phone propped in kitchen is the demo use case)
- [ ] Test dinner plan → timeline generation flow end-to-end
- [ ] Tune observation loop intervals (currently 15-25 seconds)
- [ ] Add WebSocket reconnect on disconnect
- [ ] Handle camera/mic permission denied gracefully
- [ ] Test grounding tools: ask about food safety temps, produce washing, nutrition

### Phase C: Deploy & Demo (Estimated 2-3 hours)
- [ ] Docker build and test locally
- [ ] Deploy to Cloud Run (`gcloud run deploy mise --source .`)
- [ ] Verify WebSocket works over WSS (HTTPS)
- [ ] Record 4-minute demo video (cooking scenario)
- [ ] Write Devpost submission

---

## 8. Environment Setup

```bash
cd /Users/jinchoi/Code/Hackathon/mise
source .venv/bin/activate
# Python 3.14, pip packages in pyproject.toml

# API Key in .env (DO NOT COMMIT)
cat .env
# GOOGLE_API_KEY=AIzaSy...

# Start server
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# Open browser
open http://localhost:8080
```

---

## 9. Design Decisions & Context

### Why observation loop instead of native proactivity?
`ProactivityConfig(proactive_audio=True)` is not supported on `gemini-2.0-flash-exp-image-generation`. The observation loop in `main.py` (lines 246-298) sends periodic prompts that nudge the agent to evaluate the camera and speak proactively. This achieves similar behavior through prompt engineering.

### Why separate AudioContexts?
Mic recording needs 16kHz (what the Live API expects for input). Agent voice comes back at 24kHz. A single AudioContext can only have one sample rate, so we use two.

### Why `=` instead of `+=` for transcription?
Testing showed that `output_transcription.text` is cumulative — each event contains the FULL text so far, not just the new fragment. Using `+=` caused duplication. If a future model sends incremental-only, switch back to `+=`.

### Agent persona design
The system prompt (170 lines in `agent.py`) positions MISE as a "dinner coordinator" not a "safety watchdog." Key behaviors: concise, rhythm-aware, proactive-but-not-annoying, uses grounding tools for safety data. Inspired by Kenji López-Alt's food science approach.

---

## 10. Hackathon Scoring

| Criteria | Weight | Our Angle |
|---|---|---|
| Innovation & Multimodal UX | 40% | Voice + camera + proactive interruption — agent sees, hears, speaks, and initiates |
| Technical Implementation | 30% | ADK bidi-streaming, 4 grounding tools, real-time video analysis, dual AudioWorklet |
| Demo & Presentation | 30% | Actually cook something on camera with MISE guiding |
