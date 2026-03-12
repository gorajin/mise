# MISE — Devpost Submission

## Project Name
MISE — Live Kitchen Intelligence

## Tagline
A multiagent kitchen AI that sees, speaks, and visually guides you through dinner — hands-free. Four specialist agents watch your kitchen through the camera, draw annotations on your video feed, and proactively speak up when something needs attention.

## Inspiration
Every home cook knows the stress of multi-dish dinners: you're searing a steak, the asparagus needs to go in, the sauce is reducing too fast, and you can't touch your phone because your hands are covered in oil. We built MISE to be the sous chef that sees everything, visually marks what it's looking at, and keeps its hands to itself.

The name comes from "mise en place" — the French culinary principle of having everything in its place before you cook.

## What It Does
MISE is a **multiagent, voice-first kitchen intelligence system** with real-time visual feedback:

- **4 Specialist AI Agents** — An Orchestrator routes to Dinner Coordinator, Food Scientist, Safety & Nutrition, and Recipe Explorer based on intent
- **Visual Annotations on Camera** — When the agent sees something, it draws labeled annotations directly on your video feed (targeting reticles, color-coded by urgency)
- **Smart Proactive Observation** — Frame differencing detects visual changes in the kitchen and triggers faster agent observations automatically
- **Backwards Dinner Timeline** — Enter dishes + target time and MISE builds a coordinated timeline so everything hits the plate hot
- **Food Science Explanations** — Kenji Lopez-Alt-style answers: "Pat it dry — moisture blocks browning. Maillard needs 300F+"
- **Produce Safety Alerts** — Sees strawberries on camera, annotates "Dirty Dozen", recommends vinegar bath
- **Nutrition Grounding** — USDA-backed calorie/macro estimates with healthy swap suggestions
- **TV Co-Watching** — Point camera at cooking show and the Recipe Explorer reverse-engineers the recipe
- **Barge-In Interruption** — Interrupt mid-sentence with seamless audio ducking (not abrupt cutoff)
- **Multiple Concurrent Timers** — Up to 4 with audible chimes and vibration

## How It's Built

### Multiagent Architecture
```
                    ┌─────────────────────┐
                    │    Orchestrator      │
                    │   (mise_agent)       │
                    │  Routes by intent    │
                    └──┬──┬──┬──┬─────────┘
                       │  │  │  │
        ┌──────────────┘  │  │  └──────────────┐
        ▼                 ▼  ▼                  ▼
  ┌───────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐
  │ Dinner    │  │  Food    │  │ Safety &  │  │  Recipe   │
  │Coordinator│  │Scientist │  │ Nutrition │  │ Explorer  │
  │           │  │          │  │           │  │           │
  │ Timeline  │  │ Maillard │  │ USDA Temp │  │ TV Co-    │
  │ Timers    │  │ Emulsion │  │ Produce   │  │ watching  │
  │ Pacing    │  │ Browning │  │ Macros    │  │ Grocery   │
  └───────────┘  └──────────┘  └───────────┘  └───────────┘

  All agents share: add_visual_annotation (camera overlay tool)
```

### System Architecture
```
Browser (Phone) ──WebSocket──▶ FastAPI (Cloud Run)
  ├── Camera (1fps JPEG)              │
  │   ├── Frame differencing          ├── ADK bidiGenerateContent
  │   └── Annotation overlay          │   ├── Orchestrator + 4 sub-agents
  ├── Mic (PCM 16kHz)                 │   └── 8 grounding tools
  ├── Audio Player (24kHz)            ├── Smart Observation Loop
  │   └── Seamless barge-in ducking   │   └── Reacts to visual changes
  ├── AI Status Orb                   ├── Firestore (sessions)
  ├── Agent Activity Log              ├── Secret Manager (API keys)
  └── Dinner Timeline                 └── Cloud Logging (observability)
```

### Key Technologies
| Component | Technology |
|---|---|
| **AI Framework** | Google ADK (Agent Development Kit) with multiagent sub_agents |
| **Model** | Gemini 2.5 Flash (`bidiGenerateContent` via native audio preview) |
| **Backend** | FastAPI + WebSocket bidirectional streaming |
| **Frontend** | Vanilla HTML/CSS/JS + AudioWorklet + Canvas overlay |
| **Camera** | `getUserMedia` + frame differencing for smart observations |
| **Audio** | Dual AudioContext (16kHz mic / 24kHz playback) + seamless ducking |
| **Sessions** | Firestore (Cloud Run) / InMemory (local dev) |
| **Secrets** | Google Secret Manager (Cloud Run) / .env (local dev) |
| **Logging** | Google Cloud Logging (structured agent events) |
| **Deployment** | Docker + Google Cloud Run |
| **Testing** | pytest (50 tests for tools + multiagent hierarchy) |

### What Makes It Special

1. **Visual Annotations on Camera Feed** — When the agent observes something, it doesn't just talk about it — it draws a targeting reticle with a labeled pill directly on the video feed. Color-coded by urgency: blue (info), green (good), amber (attention), red (act now), purple (identifying). This is the key innovation that breaks the text-box paradigm.

2. **Smart Observation with Frame Differencing** — Instead of blind periodic checks, the frontend computes pixel-level frame differences and signals the backend when something visually changes. The observation loop reacts in 3-5 seconds to visual changes vs. 15-25 seconds when idle.

3. **True Multiagent Architecture** — Not a monolith prompt — four focused specialist agents with distinct tool sets, routed by the Orchestrator via ADK's native `transfer_to_agent()`. Each specialist has tight, focused prompts (< 60 lines each), eliminating context pollution.

4. **Proactive Observation Loop** — MISE watches the camera and speaks up unprompted. See smoke? "Lower the heat." See unwashed produce? "Dirty Dozen — vinegar bath." This is fundamentally different from a reactive chatbot.

5. **Seamless Audio Ducking** — Barge-in doesn't just flush audio. GainNode exponentially ramps down over 50ms, then flushes — creating a smooth fade instead of jarring silence.

6. **Deep Google Cloud Integration** — Cloud Run deployment + Firestore session persistence + Secret Manager for API keys + Cloud Logging for structured observability. Every tool call, agent transfer, and observation is logged.

## Challenges
- **Model selection**: Multiple model iterations before landing on `gemini-2.5-flash-native-audio-preview` which supports both bidiGenerateContent and image input.
- **ProactivityConfig**: `proactive_audio=True` isn't supported on the Live model. We solved this with the smart observation loop — frame differencing + periodic prompt injections.
- **Audio pipeline**: Dual sample rates (16kHz in, 24kHz out) required separate AudioContexts and AudioWorklet processors.
- **Barge-in smoothness**: Client-side player keeps playing buffered audio after server interruption. We built seamless gain-based ducking instead of abrupt buffer flushing.
- **Canvas annotation rendering**: Synchronizing annotation lifecycle (fade in/out, pulse, expiry) with the 60fps render loop while the camera feed updates at 1fps.

## The "Smart Glasses" Future
MISE was intentionally built as a stateless HTML/JS frontend over WebSockets. This architecture is instantly compatible with emerging AR smart glasses — the glasses send video frames and audio, MISE projects the timeline, annotations, and tool overlays directly into your field of view.

For immediate roadmap:
- Gesture recognition (thumbs up to advance steps, wave to pause)
- Saving dinner playbooks to user profiles
- Multi-user collaborative cooking sessions
- Recipe import from URLs with automatic timeline generation

## Built With
`google-adk` `gemini-2.5-flash` `fastapi` `websocket` `audioworklet` `canvas-api` `google-cloud-run` `google-cloud-firestore` `google-secret-manager` `google-cloud-logging` `python` `javascript`

## Live Demo
**https://mise-965205106736.us-central1.run.app**

## Source Code
[GitHub Repository](https://github.com/gorajin/mise)
