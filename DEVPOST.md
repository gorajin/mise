# MISE — Devpost Submission

## Project Name
MISE — Live Kitchen Intelligence

## Tagline
Your hands-free dinner coordinator. Tell MISE what you're cooking and when you want to eat — it builds a timeline, walks you through each step, watches your kitchen through the camera, and speaks up when something needs your attention.

## Inspiration
Every home cook knows the stress of multi-dish dinners: you're searing a steak, the asparagus needs to go in, the sauce is reducing too fast, and you can't touch your phone because your hands are covered in oil. We built MISE to be the sous chef that sees everything, says something when it matters, and keeps its hands to itself.

The name comes from "mise en place" — the French culinary principle of having everything in its place before you cook.

## What It Does
MISE is a **fully hands-free, voice-first kitchen agent** that:

- 🕐 **Coordinates Multi-Dish Dinners** — Enter your dishes + target time → MISE builds a backwards timeline so everything is ready at once
- 🔬 **Teaches Food Science** — Kenji López-Alt-style explanations: "Pat the chicken dry — moisture blocks browning. Maillard reaction needs 300°F+ on a dry surface."
- 🥬 **Catches Produce Safety** — Sees strawberries on camera → "Those are Dirty Dozen — vinegar bath, 1:3 ratio, 5 minutes"
- 📊 **Tracks Nutrition** — "How many calories?" → Grounded estimates with healthy swap suggestions
- 👁️ **Proactively Watches** — Observation loop scans the camera every 15-25 seconds and speaks up when it sees something the cook needs to know
- 🎤 **Supports Barge-In** — Interrupt the agent mid-sentence and it stops immediately

## How It's Built

### Architecture
```
Browser (Phone) ──WebSocket──▶ FastAPI Server ──ADK bidi──▶ Gemini 2.0 Flash Live API
  ├── Camera (1fps JPEG)              │
  ├── Mic (PCM 16kHz)                 ├── Observation Loop (proactive)
  ├── Audio Player (24kHz)            ├── get_food_safety_data (USDA)
  └── Barge-in (buffer flush)         ├── get_produce_safety_data (EWG)
                                      ├── get_nutrition_estimate (USDA)
                                      └── google_search (grounding)
```

### Key Technologies
| Component | Technology |
|---|---|
| **AI Framework** | Google ADK (Agent Development Kit) |
| **Model** | Gemini 2.0 Flash Live (`bidiGenerateContent`) |
| **Backend** | FastAPI + WebSocket |
| **Frontend** | Vanilla HTML/CSS/JS + AudioWorklet |
| **Camera** | `getUserMedia` → 1fps JPEG frames |
| **Audio** | PCM 16kHz mono recording + 24kHz playback (dual AudioContext) |
| **Deployment** | Docker + Google Cloud Run |
| **Testing** | pytest (25 tests for grounding tools) |

### What Makes It Special
1. **Proactive Observation Loop** — Most voice assistants wait for you to ask. MISE watches the camera every 15-25 seconds and speaks up when it sees something: "I see smoke — lower the heat" or "Those strawberries are Dirty Dozen — vinegar bath."
2. **Barge-In Interruption** — You can interrupt MISE mid-sentence. The AudioWorklet player flushes its buffer immediately, so there's no awkward overlap.
3. **Dual AudioContext** — Mic recording at 16kHz (what the Live API expects) and agent playback at 24kHz (what the API sends). A single AudioContext can only have one sample rate, so we use two.
4. **Grounding Tools** — Food safety temps come from USDA data, not hallucinated. Produce safety uses EWG's Dirty Dozen/Clean Fifteen lists. Nutrition is grounded in USDA FoodData Central.

## Challenges
- **Model selection**: `gemini-2.0-flash-exp-image-generation` doesn't support image input via `bidiGenerateContent`. Switching to `gemini-2.0-flash-live-001` was the fix.
- **ProactivityConfig**: `proactive_audio=True` isn't supported on the Live model. We solved this with the observation loop pattern — periodic prompt injections that nudge the agent to evaluate the camera.
- **Audio pipeline**: Getting dual sample rates right (16kHz in, 24kHz out) required separate AudioContexts and careful AudioWorklet design.
- **Barge-in**: The Live API handles server-side interruption, but the client-side player keeps playing buffered audio. We had to add a `flush` command to the AudioWorklet processor.

## What's Next
- Smart glasses integration (architecture already supports it — WebSocket is hardware-agnostic)
- Multiple concurrent timers for complex multi-dish coordination
- Temperature card overlays when the agent calls safety tools
- Step progress visualization for dinner timeline

## Built With
`google-adk` · `gemini-2.0-flash` · `fastapi` · `websocket` · `audioworklet` · `google-cloud-run` · `python` · `javascript`

## Live Demo
**https://mise-965205106736.us-central1.run.app**

## Source Code
[GitHub Repository](https://github.com/your-repo/mise)
