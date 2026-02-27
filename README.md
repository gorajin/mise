# 🔥 MISE — Live Kitchen Intelligence

> **Your hands-free dinner coordinator.** Tell MISE what you're cooking and when you want to eat — it builds a timeline, walks you through each step, watches your kitchen through the camera, and speaks up when something needs your attention.

Built for the [Gemini Live Agent Challenge](https://devpost.com/) using [Google ADK](https://google.github.io/adk-docs/) + Gemini 2.0 Live API.

---

## ✨ What MISE Does

| Feature | How It Works |
|---|---|
| **🕐 Dinner Coordination** | Enter your dishes + target time → MISE builds a backwards timeline so everything is ready at once |
| **🔬 Food Science** | Kenji-style explanations: "Pat the chicken dry — moisture blocks browning. Maillard reaction needs 300°F+ on a dry surface." |
| **🥬 Produce Safety** | Sees strawberries on camera → "Those are Dirty Dozen — vinegar bath, 1:3 ratio, 5 minutes" |
| **📊 Nutrition Tracking** | "How many calories?" → Grounded estimates with healthy swap suggestions |
| **👁️ Visual Verification** | Camera-based doneness checks, bread proofing assessment, consistency guidance |
| **🎤 Hands-Free Voice** | Fully voice-operated — no touching the screen while cooking |
| **⚡ Proactive Alerts** | Observation loop scans the camera every 15-25 seconds and speaks up when it sees something |

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Browser (Phone)                     │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │  Camera   │  │   Mic    │  │   Audio Player      │ │
│  │  1fps     │  │  PCM     │  │   (Agent Voice)     │ │
│  │  JPEG     │  │  16kHz   │  │   24kHz PCM         │ │
│  └─────┬─────┘  └─────┬────┘  └──────────▲──────────┘ │
│        │              │                   │            │
│        └──────────────┼───────────────────┘            │
│                       │ WebSocket                      │
└───────────────────────┼────────────────────────────────┘
                        │
┌───────────────────────┼────────────────────────────────┐
│               FastAPI Server                           │
│  ┌────────────────────┼─────────────────────────────┐  │
│  │              ADK Bidi-Streaming                   │  │
│  │                                                   │  │
│  │  upstream_task     downstream_task   obs_loop     │  │
│  │  (user → agent)   (agent → user)   (proactive)   │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │            MISE Agent (Gemini 2.0)          │  │  │
│  │  │                                             │  │  │
│  │  │  Tools:                                     │  │  │
│  │  │  ├── 🌡️ get_food_safety_data (USDA)        │  │  │
│  │  │  ├── 🥬 get_produce_safety_data (EWG)      │  │  │
│  │  │  ├── 📊 get_nutrition_estimate (USDA)      │  │  │
│  │  │  └── 🔍 google_search (grounding)          │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- [Gemini API Key](https://aistudio.google.com/apikey)

### Local Development
```bash
git clone https://github.com/your-repo/mise.git
cd mise

# Set up environment
python -m venv .venv
source .venv/bin/activate
pip install -e .

# Configure API key
echo "GOOGLE_API_KEY=your-key-here" > .env

# Run
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Open **http://localhost:8080** on your phone or laptop. Grant camera + mic permissions.

### Docker
```bash
docker build -t mise .
docker run -p 8080:8080 -e GOOGLE_API_KEY=your-key-here mise
```

### Cloud Run
```bash
gcloud run deploy mise \
  --source . \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_API_KEY=your-key-here \
  --port 8080 \
  --memory 512Mi
```

## 📂 Project Structure

```
mise/
├── app/
│   ├── main.py                  # FastAPI + WebSocket + observation loop
│   ├── mise_agent/
│   │   ├── agent.py             # Agent persona + system prompt
│   │   ├── tools.py             # 3 grounding tools
│   │   └── __init__.py
│   ├── data/
│   │   ├── food_safety.json     # USDA safe cooking temps
│   │   ├── produce_safety.json  # Washing methods + Dirty Dozen
│   │   └── nutrition.json       # Calories, macros, healthy swaps
│   └── static/
│       ├── index.html           # Dinner planner UI
│       ├── css/style.css        # Premium dark kitchen theme
│       └── js/
│           ├── app.js           # WebSocket + camera + audio logic
│           ├── pcm-recorder-processor.js
│           └── pcm-player-processor.js
├── Dockerfile
├── pyproject.toml
└── terraform/                   # Cloud Run infrastructure
```

## 🧪 Tech Stack

| Component | Technology |
|---|---|
| AI Framework | Google ADK (Agent Development Kit) |
| Model | Gemini 2.0 Flash (bidiGenerateContent) |
| Backend | FastAPI + WebSocket |
| Frontend | Vanilla HTML/CSS/JS + AudioWorklet |
| Camera | getUserMedia → 1fps JPEG frames |
| Audio | PCM 16kHz mono recording + 24kHz playback |
| Deployment | Docker + Cloud Run |

## 🏆 Hackathon

Built for the **Gemini Live Agent Challenge**. MISE demonstrates:
- **Bidirectional streaming** — Real-time video + audio → real-time voice responses
- **Tool use** — 4 grounding tools prevent hallucination on safety-critical data
- **Proactive behavior** — Observation loop enables agent-initiated interruptions
- **Multi-modal** — Camera + microphone + voice output, fully hands-free

## 📄 License

MIT
