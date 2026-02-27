# MISE: The 4-Minute Hackathon Demo Script

This script is designed specifically to hit every rubric in the Gemini Live Agent Challenge judging criteria, maximizing points for Innovation, Agentic Architecture, and Multimodal Capabilities.

---

### Setup Requirements
- Print out the Architecture Diagram.
- Have a real kitchen setting (or a realistic counter setup).
- Ingredients ready: A piece of raw chicken, an onion, fresh strawberries.
- Have a loud pan sizzle sound ready to play (or actually cook).
- Use a phone stand or tripod so the camera faces the cutting board.

---

## 🎬 Act 1: Breaking the Text Box (0:00 - 0:45)
**Goal: Define the problem and prove "voice-first" innovation.**

**[Video opens]** Presenter is mixing raw chicken in a bowl. Hands are covered in marinade.

**Presenter (to camera):** 
>"This is why text-based AI doesn't work in the kitchen. When you actually need help, your hands look like this. I built MISE so I never have to touch my phone while cooking again."

**[Action]** Presenter uses an elbow/knuckle to tap "Start" on the phone (or the phone is already running MISE).

**MISE (Voice):** 
>"Hey chef! I can see your kitchen — what are we making tonight?"

**Presenter:** 
>"I'm making seared chicken, roasted potatoes, and a strawberry salad. I want to eat in 45 minutes."

**[Visual Hook]** The camera zooms in on the phone screen. The new **Dinner Timeline UI** pops into view, showing steps being generated dynamically.

**MISE (Voice):** 
>"Got it. Let's start with the potatoes since they take the longest. Preheat the oven to 400..."


## 🎬 Act 2: Multimodal Grounding (0:45 - 1:45)
**Goal: Prove the agent uses the camera and grounding tools effectively without hallucinations.**

**[Action]** Presenter puts the chicken in a hot pan (or plays sizzle). Then moves to the cutting board and puts the pint of strawberries right in front of the phone camera.

**Presenter:** 
>"MISE, can you see these?"

**[Visual Hook]** The **"EWG Produce" HUD Overlay** flashes on screen (`🥬 Checking wash method...`).

**MISE (Voice):** 
>"I see the strawberries. Those are on the Dirty Dozen list — pesticide residue is high. Give them a 5-minute vinegar bath, one part vinegar to three parts water."

**[Action]** Presenter nods, starts chopping an onion. The pan sizzles loudly in the background.


## 🎬 Act 3: Barge-In & Proactivity (1:45 - 2:45)
**Goal: Show low latency interruption and the proactive observation loop.**

**MISE (Voice):** 
>"While the chicken sears, make sure you don't crowd the pan, because..."

**[Action]** Presenter interrupts MISE mid-sentence.

**Presenter:** 
>"Wait MISE, what temperature does the chicken need to be?"

**[Visual Hook]** MISE stops instantly. The **"USDA Safety" HUD Overlay** flashes on screen (`🌡️ Checking temp...`).

**MISE (Voice):** 
>"Chicken needs to hit 165°F internally."

**[Action]** Presenter waits in silence for about 15 seconds, just staring at the pan. This triggers the observation loop.

**MISE (Voice - Unprompted):** 
>"I can see a lot of smoke coming off that pan. You might be past the oil's smoke point — lower the heat a bit."


## 🎬 Act 4: Architecture & Proof of Cloud Run (2:45 - 4:00)
**Goal: Satisfy the technical implementation and GCP requirements.**

**[Action]** Presenter wipes hands, picks up the printed Architecture Diagram.

**Presenter (to camera):** 
>"To build this, we had to move beyond turn-based chat. MISE uses the Google Agent Development Kit with the Gemini 2.0 Flash Live API for bidirectional streaming over WebSockets."

**[Visual Hook]** Screen recording of the Google Cloud console showing the active Cloud Run deployment (`mise-xxx.run.app`).

**Presenter:** 
>"The backend runs entirely on Google Cloud Run. We process 16kHz PCM audio straight from the microphone alongside 1 frame-per-second video. Because the Gemini Live API expects 24kHz audio back, we built a custom dual-AudioContext architecture in the browser to handle the sample rate conversion."

**[Visual Hook]** Show the pytest terminal running the Grounding Tool tests (`25 passed in 0.1s`).

**Presenter:** 
>"To completely eliminate food safety hallucinations, we give the agent three strict grounding tools that pull data from local USDA and EWG databases. And because our UI is just HTML/JS over a WebSocket, this exact codebase is ready to be deployed to tomorrow's AR Smart Glasses."

**Presenter (to phone):** 
>"Thanks MISE."

**MISE (Voice):** 
>"Anytime, chef. Dinner's going to be great."
