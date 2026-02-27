# MISE — Agent Handoff Document

> **Last updated:** 2026-02-26 22:35 PST  
> **Status:** Phase A-F complete. Phase E (demo video) remaining.  
> **Live URL:** https://mise-965205106736.us-central1.run.app  
> **Cloud Run:** Project `gen-lang-client-0991814371`, region `us-central1`

---

## 1. What Is MISE?

MISE (Live Kitchen Intelligence) is a **hands-free dinner coordinator** built for the Gemini Live Agent Challenge ($25K prize). The user tells MISE what they're cooking and when they want to eat → MISE builds a timeline, walks them through each step via voice, watches the kitchen through the camera, and proactively interrupts when it sees something important.

**Core differentiator:** The agent is *proactive* — it observes the camera feed every 15-25 seconds and speaks up without being asked.

---

## 2. What Was Done This Session

### Phase F: Visual HUD + Model Fix ✅

| Task | Status | Details |
|------|--------|---------|
| AI Status Indicator | ✅ Done | Animated ring (idle/listening/speaking/thinking) via CSS |
| Rich Tool Data Cards | ✅ Done | Shows actual temps, nutrition, safety data from grounding tools |
| Live Caption Bar | ✅ Done | Subtitles on camera feed, auto-fades after 4s |
| Backend function_response forwarding | ✅ Done | Tool results now sent to browser for rich cards |
| Fix deprecated model | ✅ Done | `gemini-2.0-flash-live-001` → `gemini-2.5-flash-native-audio-preview-12-2025` |
| Git push | ✅ Done | Commit `9d9ed65`, pushed to `origin/main` |
| Cloud Run redeploy | ✅ Done | Redeployed with new model and HUD |

### Previous: Phase D: Deploy & Ship ✅

| Task | Status | Details |
|------|--------|---------|
| Cloud Run deployment | ✅ Done | Enabled APIs (Cloud Run, Cloud Build, Artifact Registry), deployed via `gcloud run deploy --source .` |
| Health check verification | ✅ Done | `/health` → `{"status":"healthy","agent":"mise"}` |
| Browser UI verification | ✅ Done | Screenshot confirms dark theme, WebSocket "Connected", all components render |
| pytest for grounding tools | ✅ Done | 25/25 tests pass covering all 3 tools + helpers (`_stem`, `_food_match`) |
| Graceful permission handling | ✅ Done | Camera/mic/WS are now independent — deny one, others still work |
| DEVPOST.md | ✅ Done | Full submission content ready to paste into Devpost |
| README update | ✅ Done | Added live Cloud Run URL |

### Files Created
| File | Purpose |
|------|---------|
| `.gcloudignore` | Cloud Build context filter (excludes .venv, .git, tests) |
| `.dockerignore` | Docker build context filter |
| `app/__init__.py` | Python package marker |
| `tests/__init__.py` | Test package |
| `tests/test_tools.py` | 25 pytest tests for grounding tools |
| `DEVPOST.md` | Pre-written Devpost submission content |

### Files Modified
| File | Change |
|------|--------|
| `app/static/js/app.js` | `autoStart()`, `startCamera()`, `startAudio()` — each now has independent try/catch. Camera denial → voice-only mode. Mic denial → text + agent voice still work. |
| `README.md` | Added live Cloud Run URL section |

---

## 3. Current State (Everything That Works)

| Component | Status |
|---|---|
| FastAPI server | ✅ Running on Cloud Run |
| WebSocket connection | ✅ Stable with auto-reconnect (exponential backoff, 10 attempts) |
| Camera streaming | ✅ 1fps JPEG via getUserMedia → WebSocket |
| Microphone capture | ✅ PCM 16kHz mono via AudioWorklet |
| Agent audio response | ✅ 24kHz PCM streaming, separate playback AudioContext |
| Barge-in interruption | ✅ Mic level → flush player buffer |
| Voice-first auto-connect | ✅ Camera, mic, WS connect on page load |
| Text transcription | ✅ Both input and output transcription streaming |
| Observation loop | ✅ Every 15-25 seconds, rotates 3 prompts |
| Dinner planner UI | ✅ Optional overlay |
| 3 grounding tools | ✅ Unit tested (25/25 pass) |
| Google Search tool | ✅ Configured |
| Mobile bottom-sheet | ✅ Draggable transcript |
| Timer widget | ✅ Parses "X minutes", countdown + vibrate |
| Mute toggle | ✅ Disables mic tracks |
| PWA manifest | ✅ Installable |
| Splash screen | ✅ Animated, auto-dismiss |
| Permission denied handling | ✅ Camera/mic/WS independent |
| AI Status Indicator | ✅ CSS ring with 4 states (idle, listening, speaking, thinking) |
| Rich Tool Data Cards | ✅ Live grounding data overlay (temps, nutrition, safety badges) |
| Live Caption Bar | ✅ Auto-fading subtitles on camera feed |
| Cloud Run deployment | ✅ Live at https://mise-965205106736.us-central1.run.app |
| Devpost content | ✅ Ready to paste |

---

## 4. Known Issues

### 🟢 P2: Barge-in threshold tuning
`BARGE_IN_THRESHOLD` (default 15) may need tuning for noisy kitchens.

---

## 5. Remaining Work

### Phase E: Demo & Submit
- [ ] **Test on phone** with real kitchen scenario
- [ ] **Record 4-minute demo video** showing: auto-connect, camera vision, proactive observation, barge-in, timer, tool use
- [ ] **Submit on Devpost** (content ready in `DEVPOST.md`)
- [ ] **Push to public GitHub** (update repo URL in README and DEVPOST.md)

### Nice-to-Have (Post-Submission)
- [x] Temperature cards from grounding tools — **Done (Rich Tool Data Cards)**
- [x] Step progress indicator for dinner timeline — **Exists (Timeline Widget)**
- [ ] Multiple concurrent timers
- [ ] Smart glasses pitch

---

## 6. Hackathon Judging Criteria

| Criteria | Our Score | Evidence |
|----------|-----------|----------|
| Quality Application | 8/10 | 25 tests, graceful error handling, clean architecture |
| Leveraging Gemini/ADK | 9/10 | bidiGenerateContent, 4 tools, Live API, observation loop |
| Real-World Impact | 8/10 | Every cook needs this — fully hands-free |
| Novelty | 8/10 | Proactive observation loop is unique |
| Multimodal | 9/10 | Camera + mic + voice + barge-in |
| Agentic Workflows | 7/10 | Dinner timeline planning, tool use |
| Google Cloud | 8/10 | Cloud Run deployment, live URL |
| Demo | 0/10 | ⚠️ No demo video yet |

---

## 7. Key Architecture

```
Browser (Phone) ──WebSocket──▶ FastAPI Server ──ADK bidi──▶ Gemini 2.5 Flash Live API
  ├── Camera (1fps JPEG)              │
  ├── Mic (PCM 16kHz)                 ├── Observation Loop (proactive)
  ├── Audio Player (24kHz)            ├── get_food_safety_data (USDA)
  ├── Barge-in (buffer flush)         ├── get_produce_safety_data (EWG)
  ├── AI Status Ring (CSS)            ├── get_nutrition_estimate (USDA)
  ├── Tool Data Cards                 └── google_search (grounding)
  └── Caption Bar
```

---

## 8. Environment Setup

```bash
cd /Users/jinchoi/Code/Hackathon/mise
source .venv/bin/activate
# Python 3.14, pip packages in pyproject.toml

# API Key in .env (DO NOT COMMIT)
# GOOGLE_API_KEY=AIzaSy...

# Start server locally
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# Run tests
pytest tests/ -v

# Deploy to Cloud Run
gcloud run deploy mise --source . --region us-central1 --allow-unauthenticated \
  --set-env-vars GOOGLE_API_KEY=your-key --port 8080 --memory 512Mi --quiet
```

---

## 9. All Bugs Fixed (All Sessions)

| # | Bug | Fix | File |
|---|-----|-----|------|
| 1 | `ModuleNotFoundError: mise_agent` | `from mise_agent` → `from app.mise_agent` | `main.py` |
| 2 | `RunConfig` wrong import | `from google.adk.agents.run_config import RunConfig` | `main.py` |
| 3 | `await` on sync methods | Removed `await` from `send_realtime`/`send_content` | `main.py` |
| 4 | Model not found for bidi | Changed to `gemini-2.0-flash-live-001` | `agent.py` |
| 5 | `proactive_audio` unsupported | Removed `ProactivityConfig` | `main.py` |
| 6 | `enable_affective_dialog` unsupported | Removed from `RunConfig` | `main.py` |
| 7 | No transcript showing | Extract transcription from events | `main.py` |
| 8 | Audio at wrong sample rate | Separate AudioContexts: 16kHz/24kHz | `app.js` |
| 9 | Text duplicating | `+=` → `=` (API sends cumulative) | `app.js` |
| 10 | Agent says "no camera" | Model switch + prompt reinforcement | `agent.py` |
| 11 | Agent keeps talking on interrupt | Barge-in: mic level → flush buffer | `app.js` |
| 12 | Camera denied kills entire app | Independent try/catch per component | `app.js` |
| 13 | `gemini-2.0-flash-live-001` deprecated | Switched to `gemini-2.5-flash-native-audio-preview-12-2025` | `agent.py` |
