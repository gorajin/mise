# MISE — Comprehensive Agent Handoff

> **Last updated:** 2026-02-27 18:30 PST  
> **Status:** All features complete. Phase E (demo video + submit) remaining.  
> **Live URL:** https://mise-965205106736.us-central1.run.app  
> **GitHub:** https://github.com/gorajin/mise  
> **Cloud Run:** Project `gen-lang-client-0991814371`, region `us-central1`

---

## 1. What Is MISE?

MISE (Live Kitchen Intelligence) is a **hands-free dinner coordinator** built for the **Gemini Live Agent Challenge** ($25K prize). The user tells MISE what they're cooking and when they want to eat → MISE builds a timeline, walks them through each step via voice, watches the kitchen through the camera, and proactively interrupts when it sees something important.

**Core differentiator:** The agent is *proactive* — it observes the camera feed every 15-25 seconds and speaks up without being asked. This is not a chatbot — it's a live kitchen co-pilot.

---

## 2. Development Timeline

### Session 1 — Feb 26 18:48 PST — Phase A: Foundation
**Commit:** `c71f97d` — `feat: MISE Live Kitchen Intelligence — Phase A complete`

- Created entire project structure from scratch
- FastAPI server with WebSocket bidirectional streaming
- ADK integration with Gemini Live API (`bidiGenerateContent`)
- Camera streaming (1fps JPEG via getUserMedia)
- Microphone capture (PCM 16kHz mono via AudioWorklet)
- Agent audio playback (24kHz PCM streaming)
- 3 grounding tools: `get_food_safety_data` (USDA), `get_produce_safety_data` (EWG), `get_nutrition_estimate` (USDA)
- Google Search grounding tool
- Agent persona + system prompt (food science expert, Kenji-inspired)
- Proactive observation loop (15-25 second intervals)
- Docker + Cloud Run configuration

### Session 2 — Feb 26 19:28 PST — Phase B+C: UX Overhaul
**Commit:** `6c0bb85` — `Phase B+C: UX overhaul + voice-first experience`

- Voice-first auto-connect on page load (no manual button press)
- Barge-in interruption (mic level detection → flush audio buffer)
- Mobile-responsive bottom-sheet transcript
- Timer widget with countdown + vibration
- Mute toggle for microphone
- PWA manifest for installability
- Dual AudioContext fix (16kHz mic / 24kHz playback)
- Text duplication fix (cumulative API text handling)
- Camera denied no longer kills the app

### Session 3 — Feb 26 21:43 PST — Phase D: Deploy & Ship
**Commit:** `a9d0a22` — `Phase D: Cloud Run deploy, tests, permission handling, submission materials`

- Deployed to Google Cloud Run (live URL working)
- 25 `pytest` tests for all grounding tools + helpers
- Graceful permission handling (camera/mic/WS are independent)
- Created `DEVPOST.md` with full submission content
- Updated README with live URL
- Created `.gcloudignore`, `.dockerignore`
- Health check endpoint verified

### Session 4 — Feb 26 21:57 PST — Agentic Timeline UI
**Commit:** `28a1a20` — `feat: agentic timeline UI, tool HUD overlays, demo script, and handover docs`

- Added Dinner Timeline UI widget (visual proof of agentic workflows)
- Created `update_timeline_step` grounding tool
- Tool HUD overlays displaying grounding data on camera feed
- Authored 4-minute demo script (`demo_script.md`)
- Enhanced Devpost content with "Smart Glasses Future" pitch

### Session 5 — Feb 26 23:29 PST — Visual HUD + Model Fix
**Commits:** `9d9ed65`, `8565a06`

- AI Status Indicator ring (idle/listening/speaking/thinking)
- Rich Tool Data Cards with actual temperatures and nutrition data
- Live Caption Bar (auto-fading subtitles on camera feed)
- Backend `function_response` forwarding to frontend
- Fixed deprecated model: `gemini-2.0-flash-live-001` → `gemini-2.5-flash-native-audio-preview-12-2025`
- Redeployed to Cloud Run

### Session 6 — Feb 27 17:00 PST — Visual & UX Overhaul
**Commit:** `e600572` — Visual & UX overhaul

Complete frontend visual redesign to make the app look production-grade for hackathon judges:

- **Splash Screen:** Animated SVG flame with particle effects, premium typography (Playfair Display + Inter)
- **AI Status Orb:** Replaced 48px ring with 72px glassmorphic orb — animated gradient fill, conic rotation, state-specific glow (idle/listening/speaking/thinking), dynamic label
- **Camera Viewfinder Corners:** 4 animated bracket corners that glow copper when the observation loop fires
- **Cooking Phase Bar:** PREP → COOK → PLATE → SERVE with animated connectors, auto-detected from agent text keywords
- **Multiple Concurrent Timers:** Replaced single timer with Map-based system supporting up to 4 concurrent timers with individual dismiss buttons
- **SVG Tool Data Cards:** Replaced emoji icons with proper SVGs — thermometer for safety (with animated temperature gauge), leaf for produce, bar chart for nutrition (with animated macro bars). Color-coded top borders per tool type.
- **Timeline Widget:** Added collapse/expand toggle, smooth animations
- **Auto-start to Camera:** Skips dinner planner on load, goes straight to camera + voice
- **Agent Prompt:** Enhanced to use `update_timeline_step` aggressively and announce timers explicitly ("set a timer for X minutes")
- **All 25 tests pass** — no backend changes beyond minor prompt tweaks

### Session 7 — Feb 27 18:30 PST — Final Polish & Submission Prep
**Files modified:** `app.js`, `index.html`, `style.css`, `DEVPOST.md`, `README.md`, `HANDOFF.md`

- **Timer Completion Chime:** 3-note ascending chord (C5→E5→G5) via Web Audio API oscillator. No external audio files needed. Uses existing `playbackContext`.
- **Agent Activity Log:** Glassmorphic collapsible panel on camera view showing real-time agent actions — tool calls, tool results, observation scans, timeline updates, connection events. Proves agentic behavior to judges.
- **DEVPOST.md fixes:** Corrected model name to Gemini 2.5 Flash, updated architecture to show all 5 tools, fixed GitHub URL, removed stale "What's Next" items, enhanced feature descriptions.
- **README.md fixes:** Same corrections — model, tools, GitHub URL, project structure comments, feature list.
- **Cache bust:** `app.js?v=5` → `app.js?v=7`
- **All 25 tests pass** — zero backend changes

---

## 3. Current Feature Matrix

| Component | Status | Details |
|-----------|--------|---------|
| FastAPI server | ✅ | Cloud Run deployed |
| WebSocket connection | ✅ | Auto-reconnect (exponential backoff, 10 attempts) |
| Camera streaming | ✅ | 1fps JPEG via getUserMedia → WebSocket |
| Microphone capture | ✅ | PCM 16kHz mono via AudioWorklet |
| Agent audio response | ✅ | 24kHz PCM streaming, separate playback AudioContext |
| Barge-in interruption | ✅ | Mic level → flush player buffer |
| Voice-first auto-connect | ✅ | Camera, mic, WS connect on page load |
| Text transcription | ✅ | Both input and output transcription streaming |
| Observation loop | ✅ | Every 15-25 seconds, rotates 3 prompts |
| 4 grounding tools | ✅ | USDA safety + nutrition, EWG produce, Google Search |
| Dinner Timeline Widget | ✅ | Collapsible, step indicators, animations |
| AI Status Orb | ✅ | Glassmorphic, 4 animated states |
| Tool Data Cards | ✅ | SVG icons, temp gauge, macro bars |
| Live Caption Bar | ✅ | Auto-fading subtitles on camera feed |
| Cooking Phase Bar | ✅ | PREP → COOK → PLATE → SERVE auto-detection |
| Multiple Concurrent Timers | ✅ | Up to 4 with individual dismiss |
| Camera Viewfinder | ✅ | Animated corners, glow on observation |
| Timer completion chime | ✅ | 3-note Web Audio API chord (C5-E5-G5) |
| Agent Activity Log | ✅ | Collapsible glassmorphic panel, logs tool calls/scans |
| Mobile bottom-sheet | ✅ | Draggable transcript |
| Mute toggle | ✅ | Disables mic tracks |
| PWA manifest | ✅ | Installable |
| Splash screen | ✅ | Animated SVG flame + particles |
| Permission denial handling | ✅ | Camera/mic/WS independent |
| pytest suite | ✅ | 25/25 passing |
| Cloud Run deployment | ✅ | Live URL working |
| Devpost content | ✅ | Ready to paste |

---

## 4. Known Issues

| Priority | Issue | Details |
|----------|-------|---------|
| P2 | Barge-in threshold tuning | `BARGE_IN_THRESHOLD` (default 15) may need tuning for noisy kitchens |

---

## 5. Remaining Work

### Phase E: Demo & Submit
- [ ] **Test on phone** with real kitchen scenario
- [ ] **Record 4-minute demo video** (script ready in `demo_script.md`)
- [ ] **Submit on Devpost** (content ready in `DEVPOST.md`)
- [ ] **Push to public GitHub** (repo: https://github.com/gorajin/mise)
- [ ] **Redeploy latest changes** to Cloud Run

### Nice-to-Have
- [ ] Smart glasses integration (architecture supports it)
- [ ] Recipe import from URLs with automatic timeline generation

---

## 6. Hackathon Judging Criteria

| Criteria | Score | Evidence |
|----------|-------|----------|
| Quality Application | 9/10 | 25 tests, graceful error handling, premium UI, clean architecture |
| Leveraging Gemini/ADK | 9/10 | bidiGenerateContent, 5 tools, Live API, observation loop |
| Real-World Impact | 8/10 | Every cook needs this — fully hands-free |
| Novelty | 9/10 | Proactive observation loop + visible agent activity log |
| Multimodal | 9/10 | Camera + mic + voice + barge-in |
| Agentic Workflows | 10/10 | Dinner timeline, phase tracking, multiple timers, tool cards, activity log |
| Google Cloud | 8/10 | Cloud Run deployment, live URL |
| Demo | 0/10 | ⚠️ **No demo video yet** |

---

## 7. Architecture

```
Browser (Phone) ──WebSocket──▶ FastAPI Server ──ADK bidi──▶ Gemini 2.5 Flash Live API
  ├── Camera (1fps JPEG)              │
  ├── Mic (PCM 16kHz)                 ├── Observation Loop (proactive, 15-25s)
  ├── Audio Player (24kHz)            ├── get_food_safety_data (USDA)
  ├── Barge-in (buffer flush)         ├── get_produce_safety_data (EWG)
  ├── AI Status Orb (glassmorphic)    ├── get_nutrition_estimate (USDA)
  ├── Tool Data Cards (SVG)           ├── update_timeline_step
  ├── Viewfinder Corners              └── google_search (grounding)
  ├── Cooking Phase Bar
  ├── Multiple Timers (Map)
  ├── Caption Bar
  └── Dinner Timeline
```

---

## 8. Project Structure

```
mise/
├── app/
│   ├── main.py                  # FastAPI + WebSocket + observation loop
│   ├── mise_agent/
│   │   ├── agent.py             # Agent persona + system prompt
│   │   ├── tools.py             # 4 grounding tools + update_timeline_step
│   │   └── __init__.py
│   ├── data/
│   │   ├── food_safety.json     # USDA safe cooking temps
│   │   ├── produce_safety.json  # Washing methods + Dirty Dozen
│   │   └── nutrition.json       # Calories, macros, healthy swaps
│   └── static/
│       ├── index.html           # Main UI (orb, viewfinder, activity log)
│       ├── css/style.css        # Premium dark kitchen theme
│       ├── manifest.json        # PWA
│       └── js/
│           ├── app.js           # WebSocket + camera + audio + UI logic
│           ├── pcm-recorder-processor.js
│           └── pcm-player-processor.js
├── tests/
│   └── test_tools.py            # 25 pytest tests
├── Dockerfile
├── pyproject.toml
├── demo_script.md               # 4-minute demo video script
├── DEVPOST.md                   # Submission content
├── HANDOFF.md                   # This file
└── README.md                    # Public-facing docs
```

---

## 9. Environment Setup

```bash
cd /path/to/mise
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

## 10. All Bugs Fixed (All Sessions)

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
