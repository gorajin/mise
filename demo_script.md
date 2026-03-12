# MISE: The 4-Minute Hackathon Demo Script

Optimized for the Gemini Live Agent Challenge judging rubric:
- Innovation & Multimodal UX (40%)
- Technical Implementation (30%)
- Demo & Presentation (30%)

---

### Setup Requirements
- Real kitchen setting (or realistic counter setup)
- Ingredients ready: Raw chicken, onion, fresh strawberries, a lemon
- Phone on stand/tripod facing cutting board
- Cooking show playing on a laptop nearby (for Act 4)
- Have the Cloud Run console open in a browser tab
- Observation interval pre-set to 5s for demo responsiveness

---

## Act 1: Breaking the Text Box (0:00 - 0:50)
**Goal: Prove voice-first innovation + multiagent routing + visual annotations**

**[Video opens]** Presenter has hands in marinade bowl.

**Presenter (to camera):**
> "When you're cooking, your hands look like this. Text-based AI is useless. I built MISE — a multiagent kitchen intelligence system — so I never touch my phone while cooking."

**[Action]** Phone shows the MISE Dinner Planner screen — dark, premium UI with flame animation.

**Presenter:**
> "MISE starts with a dinner planner. I type in what I'm making and when I want to eat."

**[Action]** Type "Seared chicken, roasted potatoes, strawberry salad" into the meal field. Set time to 7:00 PM. Tap "Start Cooking".

**[Visual Hook]** Splash animation plays briefly, camera activates, MISE orb begins pulsing.

**MISE (Voice):**
> "Hey chef! I can see your kitchen. Let me build your dinner timeline."

**[Visual Hook]** The Dinner Timeline dynamically populates steps. Phase bar activates at PREP. The orb shows agent badge: "Coordinator".

**Narrate (over footage):**
> "MISE immediately routes to the Dinner Coordinator — one of four specialist AI agents — which builds a backwards timeline. Watch the agent badge change."

---

## Act 2: Visual Intelligence + Safety Agent (0:50 - 1:50)
**Goal: Show camera annotations, proactive observation, and Safety agent**

**[Action]** Place strawberries in front of camera.

**Presenter:**
> "MISE, what about these strawberries?"

**[Visual Hook]** The agent badge changes to "Safety". A **visual annotation** appears on the camera feed: pulsing purple reticle labeled "Strawberries" with a red "Dirty Dozen" badge.

**MISE (Voice):**
> "I see the strawberries. Those are Dirty Dozen — high pesticide residue. Vinegar bath, one part vinegar to three parts water, five minutes."

**[Visual Hook]** The EWG Produce Safety tool card slides in with the data.

**Narrate:**
> "Two things just happened. First, the Safety & Nutrition agent took over — you can see the agent transfer in the activity log. Second, MISE drew a visual annotation directly on the camera feed. It's not just talking about what it sees — it's pointing to it."

**[Action]** Wait 5 seconds in silence. The observation loop fires.

**MISE (Voice — Unprompted):**
> "I notice you still have the chicken out. Room temp is fine for searing, but don't leave it out longer than 20 minutes."

**[Visual Hook]** Annotation appears: amber "warning" reticle labeled "Chicken - 20 min max".

---

## Act 3: Barge-In + Food Science Agent (1:50 - 2:40)
**Goal: Show interruption handling + Science agent + all 4 agents used**

**MISE (Voice):**
> "While we prep, let me tell you about the potatoes—"

**[Action]** Presenter interrupts mid-sentence.

**Presenter:**
> "Wait — why do I need to pat the chicken dry before searing?"

**[Visual Hook]** MISE stops instantly. Agent badge changes to "Scientist". Orb pulses green.

**MISE (Voice):**
> "Surface moisture is the enemy. Water boils at 212 degrees, but browning — the Maillard reaction — needs 300 plus. Pat it dry, and you get a crust instead of steam."

**[Visual Hook]** Annotation on camera: green "success" reticle labeled "Maillard 300F+".

**Narrate:**
> "That's three specialist agents shown so far. Let me trigger the fourth."

**[Action]** Point camera at laptop showing cooking show.

**Presenter:**
> "MISE, what are they making on that show?"

**[Visual Hook]** Agent badge changes to "Explorer". Purple annotation: "Risotto" label appears.

**MISE (Voice):**
> "Looks like a mushroom risotto. I can see them adding stock gradually — that's the key. Want me to reverse-engineer the recipe and build a grocery list?"

---

## Act 4: Architecture + GCP Stack (2:40 - 4:00)
**Goal: Satisfy Technical Implementation (30%) — show depth**

**[Action]** Switch to screen recording.

**Presenter (to camera):**
> "Let me show you how this works under the hood."

**[Screen: Architecture diagram]** Show the animated HTML architecture page.

**Presenter:**
> "MISE uses a multiagent architecture built on the Google Agent Development Kit. There are four specialist agents — Coordinator, Scientist, Safety, and Explorer — orchestrated by a root agent that routes using Gemini's native function calling."

**[Screen: Cloud Run console]** Show active deployment.

**Presenter:**
> "The backend runs on Cloud Run with Firestore for session persistence, Secret Manager for API keys, and Cloud Logging for observability. Every tool call, agent transfer, and observation is structured-logged."

**[Screen: Terminal running tests]**

**Presenter:**
> "We have 97 tests covering all 8 grounding tools, edge cases, data integrity, server endpoints, and the multiagent hierarchy."

**[Screen: Show the visual annotation on camera]**

**Presenter:**
> "What makes MISE different is visual intelligence. The agent doesn't just see through the camera — it draws annotations directly on the feed. When it identifies produce, it highlights it. When food needs attention, it marks it. Frame differencing detects visual changes and triggers faster observations automatically."

**Presenter (to phone):**
> "Thanks MISE."

**MISE (Voice):**
> "Anytime, chef."

---

## Key Demo Beats Checklist

| Criterion | Shown In | Proof |
|-----------|----------|-------|
| Multimodal input (camera + voice) | Acts 1-3 | Camera active throughout |
| Multimodal output (voice + visual annotations) | Acts 2-3 | Annotations drawn on camera feed |
| Proactive behavior | Act 2 | Agent speaks unprompted |
| Barge-in interruption | Act 3 | Stops mid-sentence |
| Multiagent routing (all 4) | Acts 1-3 | Agent badge changes visible |
| Tool use (grounding) | Act 2 | Safety card appears |
| Visual annotations | Acts 2-3 | Reticle overlays on camera |
| Frame differencing | Act 4 | Explained + demo'd |
| Cloud Run deployment | Act 4 | Console screenshot |
| Firestore + Secret Manager | Act 4 | Architecture diagram |
| Cloud Logging | Act 4 | Mentioned in stack |
| Test suite | Act 4 | Terminal output |
| Innovation pitch | Act 1 | "Hands in marinade" opening |
