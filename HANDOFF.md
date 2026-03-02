# MISE — Comprehensive Agent Handoff

> **Last updated:** 2026-03-01 20:29 PST  
> **Status:** Phase G complete (multiagent architecture). Demo video + submit remaining.  
> **Live URL:** https://mise-965205106736.us-central1.run.app  
> **GitHub:** https://github.com/gorajin/mise  
> **Cloud Run:** Project `gen-lang-client-0991814371`, region `us-central1`

---

## 1. What Is MISE?

MISE (Live Kitchen Intelligence) is a **hands-free dinner coordinator** built for the **Gemini Live Agent Challenge** ($25K prize). The user tells MISE what they're cooking and when they want to eat → MISE builds a timeline, walks them through each step via voice, watches the kitchen through the camera, and proactively interrupts when it sees something important.

**Core differentiator:** The system uses a **multiagent architecture** — an Orchestrator routes to 4 specialist sub-agents (Coordinator, Scientist, Safety/Nutrition, Recipe Explorer) for focused, expert responses. The agents observe the camera feed every 15-25 seconds and speak up without being asked. This is not a chatbot — it's a live kitchen co-pilot.

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

### Session 8 — Feb 27 22:23 PST — Phase E: Context-Aware Culinary AI
**Files modified:** `app.js`, `tools.py`, `agent.py`, `test_tools.py`, `index.html`

Implemented the full Phase E spec from the director's handoff — surgical injection of UX improvements, 2 new backend tools, and an enhanced system prompt. No rewrites of core WebSocket, AudioWorklet, or UI architecture.

- **Screen Wake Lock:** `navigator.wakeLock` API keeps the screen alive during long cooks. Auto re-acquires on `visibilitychange` (e.g., user minimizes and returns). Graceful fallback on unsupported browsers.
- **Sustained Barge-In:** Replaced instant mic-threshold trigger with a 6-frame sustained noise counter (~150ms). Transient kitchen sounds (dropped pans, clanking pots) no longer kill the agent mid-sentence.
- **Seamless Audio Ducking:** Playback audio now routes through a `GainNode`. On barge-in, the agent's voice fades out over 50ms via `exponentialRampToValueAtTime(0.001)` instead of an abrupt buffer flush. Gain resets to 1.0 for the next response.
- **Dynamic Camera Polling:** New `set_observation_interval` tool lets the agent control its own camera capture rate. Frontend intercepts the tool call and adjusts the `setInterval` dynamically (e.g., 5s for searing, 60s for baking).
- **Recipe Reverse-Engineering Tool:** New `analyze_and_recreate_recipe` tool for TV co-watching mode. Agent can extract dish name, full grocery list, and chronological steps. Results logged to the Activity Log with ingredient counts and grocery preview.
- **Advanced System Prompt:** Appended the full "ADVANCED CULINARY SCIENTIST & PROACTIVE CO-PILOT PROTOCOLS" block — 6 protocols covering seamless interruption handling, acoustic awareness, kitchen physics (Food Lab method), proactive dietary coaching, TV co-watching (Culinary Class Wars mode), and autonomous gaze control.
- **7 tools total** registered in Agent config (was 5): `google_search`, `get_food_safety_data`, `get_produce_safety_data`, `get_nutrition_estimate`, `update_timeline_step`, `set_observation_interval`, `analyze_and_recreate_recipe`
- **Cache bust:** `app.js?v=7` → `app.js?v=8`
- **34/34 tests pass** — 25 original + 9 new (4 for observation interval, 5 for recipe tool)

### Session 9 — Mar 1 20:29 PST — Phase G: Multiagent Architecture
**Files modified:** `agent.py`, `main.py`, `app.js`, `style.css`, `test_tools.py`, `HANDOFF.md`

Complete decomposition of the monolithic single-agent into a **multiagent hierarchy** using ADK's native `sub_agents` with LLM-driven `transfer_to_agent()` delegation. This fundamentally improves UX by giving each specialist a focused ≤60-line prompt with full LLM attention — no more context pollution from a 230-line monolith.

- **Orchestrator (`mise_agent`):** Root agent. Greets the user, listens for intent, routes to the right specialist. Controls autonomous gaze via `set_observation_interval`. ~40-line prompt.
- **Dinner Coordinator (`dinner_coordinator`):** Timeline management, step-by-step pacing, timer announcements, parallel task coordination. Tools: `update_timeline_step`, `set_observation_interval`. ~45-line prompt.
- **Food Scientist (`food_scientist`):** Kenji-style food science — Maillard, emulsions, viscosity, yeast, visual verification from camera. Tools: `google_search`. ~50-line prompt.
- **Safety & Nutrition (`safety_nutrition`):** USDA temps, produce washing, macros, dietary coaching. Tools: `get_food_safety_data`, `get_produce_safety_data`, `get_nutrition_estimate`. ~40-line prompt.
- **Recipe Explorer (`recipe_explorer`):** TV co-watching, recipe reverse-engineering, grocery list generation. Tools: `analyze_and_recreate_recipe`, `google_search`. ~35-line prompt.
- **Observation Loop Updated:** Prompts now instruct the Orchestrator to route camera observations to the appropriate specialist (e.g., produce on counter → `safety_nutrition`, technique issue → `food_scientist`).
- **Agent Transfer Events:** Backend forwards `transfer_to_agent` function calls to the frontend as `agent_transfer` events.
- **Active Agent Indicator:** Glassmorphic badge below the AI Status Orb shows which specialist is currently active (emoji + name, color-coded). Badge auto-hides when returning to Orchestrator.
- **Activity Log:** Transfer events logged with 🔀 icon showing the active specialist.
- **39/39 tests pass** — 34 original + 5 new agent construction tests (sub-agent count, names, descriptions, tool assignments, model)

---

## 3. Current Feature Matrix

| Component | Status | Details |
|-----------|--------|---------|
| **Multiagent Architecture** | ✅ | **Orchestrator + 4 specialist sub-agents via ADK `sub_agents`** |
| Active Agent Indicator | ✅ | Glassmorphic badge on orb showing active specialist |
| FastAPI server | ✅ | Cloud Run deployed |
| WebSocket connection | ✅ | Auto-reconnect (exponential backoff, 10 attempts) |
| Camera streaming | ✅ | 1fps JPEG via getUserMedia → WebSocket |
| Microphone capture | ✅ | PCM 16kHz mono via AudioWorklet |
| Agent audio response | ✅ | 24kHz PCM streaming, separate playback AudioContext |
| Barge-in interruption | ✅ | Sustained 6-frame threshold + GainNode ducking (50ms fade) |
| Voice-first auto-connect | ✅ | Camera, mic, WS connect on page load |
| Screen Wake Lock | ✅ | `navigator.wakeLock` with `visibilitychange` re-acquisition |
| Text transcription | ✅ | Both input and output transcription streaming |
| Observation loop | ✅ | Every 15-25 seconds, rotates 3 prompts, routes to specialists |
| Dynamic camera polling | ✅ | Agent-controlled via `set_observation_interval` tool |
| 7 grounding tools | ✅ | Partitioned across Orchestrator + 4 sub-agents |
| Dinner Timeline Widget | ✅ | Collapsible, step indicators, animations |
| AI Status Orb | ✅ | Glassmorphic, 4 animated states + agent badge |
| Tool Data Cards | ✅ | SVG icons, temp gauge, macro bars |
| Live Caption Bar | ✅ | Auto-fading subtitles on camera feed |
| Cooking Phase Bar | ✅ | PREP → COOK → PLATE → SERVE auto-detection |
| Multiple Concurrent Timers | ✅ | Up to 4 with individual dismiss |
| Camera Viewfinder | ✅ | Animated corners, glow on observation |
| Timer completion chime | ✅ | 3-note Web Audio API chord (C5-E5-G5) |
| Agent Activity Log | ✅ | Logs tool calls, scans, and agent transfers |
| Mobile bottom-sheet | ✅ | Draggable transcript |
| Mute toggle | ✅ | Disables mic tracks |
| PWA manifest | ✅ | Installable |
| Splash screen | ✅ | Animated SVG flame + particles |
| Permission denial handling | ✅ | Camera/mic/WS independent |
| pytest suite | ✅ | **39/39 passing** |
| Cloud Run deployment | ✅ | Live URL working |
| Devpost content | ✅ | Ready to paste |

---

## 4. Known Issues

| Priority | Issue | Details |
|----------|-------|---------|
| P2 | Barge-in threshold tuning | `BARGE_IN_THRESHOLD` (default 15) and `SUSTAINED_FRAMES_REQUIRED` (default 6) may need tuning per environment |
| P2 | Multiagent transfer latency | LLM-driven `transfer_to_agent()` adds a small latency spike on first routing — subsequent transfers are faster |
| P3 | Recipe card UI | `analyze_and_recreate_recipe` results go to Activity Log only — no dedicated SVG card yet |

---

## 5. Remaining Work

### Phase F: Demo & Submit
- [ ] **Test on phone** with real kitchen scenario (verify multiagent routing, Wake Lock, barge-in, dynamic camera interval)
- [ ] **Record 4-minute demo video** (script ready in `demo_script.md` — update to showcase multiagent transfers)
- [ ] **Submit on Devpost** (content ready in `DEVPOST.md` — update to mention multiagent architecture)
- [ ] **Push to public GitHub** (repo: https://github.com/gorajin/mise)
- [ ] **Redeploy latest changes** to Cloud Run

### Nice-to-Have
- [ ] Smart glasses integration (architecture supports it)
- [ ] Dedicated recipe card UI with SVG icon for `analyze_and_recreate_recipe`
- [ ] Backend observation loop interval also made dynamic via `set_observation_interval`
- [ ] Agent handoff animations (visual transition when switching specialists)
- [ ] Per-agent conversation memory (specialist remembers dietary goals across transfers)

---

## 6. Hackathon Judging Criteria

| Criteria | Score | Evidence |
|----------|-------|----------|
| Quality Application | 9/10 | 39 tests, graceful error handling, premium UI, multiagent architecture |
| Leveraging Gemini/ADK | 10/10 | bidiGenerateContent, 7 tools, Live API, **ADK `sub_agents` multiagent**, observation loop, autonomous gaze control |
| Real-World Impact | 8/10 | Every cook needs this — fully hands-free |
| Novelty | 10/10 | **Multiagent with LLM-driven routing** + proactive observation loop + visible agent activity log |
| Multimodal | 9/10 | Camera + mic + voice + barge-in |
| Agentic Workflows | 10/10 | **Orchestrator + 4 specialist sub-agents**, dinner timeline, phase tracking, multiple timers, tool cards, activity log |
| Google Cloud | 8/10 | Cloud Run deployment, live URL |
| Demo | 0/10 | ⚠️ **No demo video yet** |

---

## 7. Architecture

```
Browser (Phone) ──WebSocket──▶ FastAPI Server ──ADK bidi──▶ Gemini 2.5 Flash Live API
  ├── Camera (1fps JPEG)              │
  ├── Mic (PCM 16kHz)                 ├── 🎯 Orchestrator (mise_agent)
  ├── Audio Player (24kHz + GainNode) │     ├── 🍳 dinner_coordinator
  ├── Barge-in (sustained + ducking)  │     │     Tools: update_timeline_step, set_observation_interval
  ├── Wake Lock (screen alive)        │     ├── 🔬 food_scientist
  ├── AI Status Orb + Agent Badge     │     │     Tools: google_search
  ├── Tool Data Cards (SVG)           │     ├── 🛡️ safety_nutrition
  ├── Viewfinder Corners              │     │     Tools: get_food_safety_data, get_produce_safety_data, get_nutrition_estimate
  ├── Cooking Phase Bar               │     └── 📺 recipe_explorer
  ├── Multiple Timers (Map)           │           Tools: analyze_and_recreate_recipe, google_search
  ├── Caption Bar                     └── Observation Loop (proactive, 15-25s, routes to specialists)
  └── Dinner Timeline
```

---

## 8. Project Structure

```
mise/
├── app/
│   ├── main.py                  # FastAPI + WebSocket + observation loop
│   ├── mise_agent/
│   │   ├── agent.py             # Orchestrator + 4 specialist sub-agents (multiagent)
│   │   ├── tools.py             # 7 grounding tools (partitioned across sub-agents)
│   │   └── __init__.py
│   ├── data/
│   │   ├── food_safety.json     # USDA safe cooking temps
│   │   ├── produce_safety.json  # Washing methods + Dirty Dozen
│   │   └── nutrition.json       # Calories, macros, healthy swaps
│   └── static/
│       ├── index.html           # Main UI (orb, viewfinder, activity log)
│       ├── css/style.css        # Premium dark kitchen theme + agent badge
│       ├── manifest.json        # PWA
│       └── js/
│           ├── app.js           # WebSocket + camera + audio + UI + multiagent tracking
│           ├── pcm-recorder-processor.js
│           └── pcm-player-processor.js
├── tests/
│   └── test_tools.py            # 39 pytest tests (tools + agent construction)
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
| 14 | Barge-in triggers on transient noise | Added sustained 6-frame counter + GainNode ducking | `app.js` |
