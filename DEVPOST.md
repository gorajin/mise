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
- 📋 **Visual Dinner Timeline** — Dynamically updating step-by-step progress tracker with PREP → COOK → PLATE → SERVE phase bar
- ⏱️ **Multiple Concurrent Timers** — Up to 4 timers with audible chimes on completion

## How It's Built

### Architecture
```
Browser (Phone) ──WebSocket──▶ FastAPI Server ──ADK bidi──▶ Gemini 2.5 Flash Live API
  ├── Camera (1fps JPEG)              │
  ├── Mic (PCM 16kHz)                 ├── Observation Loop (proactive, 15-25s)
  ├── Audio Player (24kHz)            ├── get_food_safety_data (USDA)
  ├── Barge-in (buffer flush)         ├── get_produce_safety_data (EWG)
  ├── AI Status Orb                   ├── get_nutrition_estimate (USDA)
  ├── Agent Activity Log              ├── update_timeline_step (agentic)
  └── Dinner Timeline                 └── google_search (grounding)
```

### Key Technologies
| Component | Technology |
|---|---|
| **AI Framework** | Google ADK (Agent Development Kit) |
| **Model** | Gemini 2.5 Flash (`bidiGenerateContent` via native audio preview) |
| **Backend** | FastAPI + WebSocket |
| **Frontend** | Vanilla HTML/CSS/JS + AudioWorklet |
| **Camera** | `getUserMedia` → 1fps JPEG frames |
| **Audio** | PCM 16kHz mono recording + 24kHz playback (dual AudioContext) |
| **Deployment** | Docker + Google Cloud Run |
| **Testing** | pytest (25 tests for grounding tools) |

### What Makes It Special
1. **Agentic Workflows (Built-in)** — MISE isn't just a chatbot; it's a coordinator. When you tell it what you're making, it generates a **Dinner Timeline** that dynamically updates on-screen as you progress through PREP → COOK → PLATE → SERVE phases. An **Agent Activity Log** shows every tool call and observation in real-time, giving transparent proof of agentic behavior.
2. **Proactive Observation Loop** — Most voice assistants wait for you to ask. MISE watches the camera every 15-25 seconds and speaks up when it sees something: "I see smoke — lower the heat" or "Those strawberries are Dirty Dozen — vinegar bath."
3. **Barge-In Interruption** — You can interrupt MISE mid-sentence. The AudioWorklet player flushes its buffer immediately, so there's no awkward overlap.
4. **Visual Content Grounding** — Food safety temps, produce safety, and nutrition are grounded in USDA/EWG local databases. When the agent uses these tools, a **HUD-style overlay card** pops up on the video feed to confirm exactly what data is being referenced.
5. **Multiple Concurrent Timers with Chimes** — Up to 4 timers running simultaneously with audible completion chimes and vibration — essential for hands-free multi-dish coordination.

## Challenges
- **Model selection**: `gemini-2.0-flash-exp-image-generation` doesn't support image input via `bidiGenerateContent`. Switching to `gemini-2.0-flash-live-001` was the fix, later upgraded to `gemini-2.5-flash-native-audio-preview`.
- **ProactivityConfig**: `proactive_audio=True` isn't supported on the Live model. We solved this with the observation loop pattern — periodic prompt injections that nudge the agent to evaluate the camera.
- **Audio pipeline**: Getting dual sample rates right (16kHz in, 24kHz out) required separate AudioContexts and careful AudioWorklet design.
- **Barge-in**: The Live API handles server-side interruption, but the client-side player keeps playing buffered audio. We had to add a `flush` command to the AudioWorklet processor.

## The "Smart Glasses" Future (What's Next)
MISE was intentionally built as a stateless HTML/JS frontend communicating over WebSockets to a Cloud Run backend. 
**This architecture makes it instantly compatible with emerging AR smart glasses.** You won't even need your phone on the counter. The glasses will send the video frames and audio, and MISE will project the Dinner Timeline and Tool Overlays directly into your field of view while you cook.

For immediate software roadmap:
- Saving successful dinnertime playbooks to user profiles
- Multi-user support for collaborative cooking sessions
- Recipe import from URLs with automatic timeline generation

## Built With
`google-adk` · `gemini-2.5-flash` · `fastapi` · `websocket` · `audioworklet` · `google-cloud-run` · `python` · `javascript`

## Live Demo
**https://mise-965205106736.us-central1.run.app**

## Source Code
[GitHub Repository](https://github.com/gorajin/mise)
