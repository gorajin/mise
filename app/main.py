"""MISE — FastAPI Application with WebSocket Streaming.

Implements the ADK bidirectional streaming lifecycle for real-time
camera + audio cooking assistance.
"""

import asyncio
import base64
import json
import os
import traceback
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from google.adk.runners import Runner
from google.adk.agents.run_config import RunConfig
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.genai import types

load_dotenv()

# Import the MISE agent and GCP integrations
from app.mise_agent.agent import agent
from app.gcp import get_session_service, get_secret, get_logger, log_agent_event

# Initialize Cloud Logging
logger = get_logger()

# Load API key from Secret Manager (falls back to env var)
api_key = get_secret("GOOGLE_API_KEY")
if api_key:
    os.environ["GOOGLE_API_KEY"] = api_key

# Application setup
app = FastAPI(title="MISE — Live Kitchen Intelligence")
session_service = get_session_service()
runner = Runner(
    app_name="mise",
    agent=agent,
    session_service=session_service,
)

# Serve static files
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def root():
    """Serve the main UI."""
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/health")
async def health():
    """Health check endpoint for Cloud Run."""
    return {"status": "healthy", "agent": "mise"}


@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, session_id: str):
    """WebSocket endpoint for bidirectional streaming.

    Handles the full ADK bidi lifecycle:
    1. Accept connection
    2. Configure session and RunConfig
    3. Initialize LiveRequestQueue
    4. Run concurrent upstream/downstream tasks
    5. Graceful cleanup
    """
    await websocket.accept()
    log_agent_event("session_start", user_id=user_id, session_id=session_id)
    logger.info(f"Client connected: user={user_id}, session={session_id}")

    # Create or resume session
    session = await session_service.create_session(
        app_name="mise",
        user_id=user_id,
        session_id=session_id,
    )

    # Configure the live streaming run
    run_config = RunConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Kore",  # Warm, confident voice
                )
            )
        ),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        # Note: proactive_audio and enable_affective_dialog may not be supported
        # on all models. Proactive behavior is
        # handled by the observation_loop task below.
    )

    # Initialize the live request queue
    live_request_queue = LiveRequestQueue()

    frame_count = 0
    audio_chunk_count = 0
    significant_change_pending = False

    async def upstream_task():
        """Receive WebSocket messages and forward to LiveRequestQueue."""
        nonlocal frame_count, audio_chunk_count, significant_change_pending
        try:
            while True:
                message = await websocket.receive()

                if message.get("type") == "websocket.disconnect":
                    break

                # Handle binary audio data
                if "bytes" in message and message["bytes"]:
                    audio_data = message["bytes"]
                    live_request_queue.send_realtime(
                        types.Blob(data=audio_data, mime_type="audio/pcm;rate=16000")
                    )
                    audio_chunk_count += 1
                    if audio_chunk_count % 50 == 0:
                        print(f"[MISE] Audio chunks sent: {audio_chunk_count}")

                # Handle text/JSON messages (including video frames)
                elif "text" in message and message["text"]:
                    try:
                        data = json.loads(message["text"])
                        msg_type = data.get("type", "text")

                        if msg_type == "video_frame":
                            # Camera frame sent as base64 JPEG
                            raw = data.get("data")
                            if not raw:
                                continue
                            frame_data = base64.b64decode(raw)
                            live_request_queue.send_realtime(
                                types.Blob(
                                    data=frame_data,
                                    mime_type="image/jpeg",
                                )
                            )
                            frame_count += 1
                            # Track significant visual changes for smart observations
                            if data.get("significant_change"):
                                significant_change_pending = True
                                print(f"[MISE] Video frame #{frame_count}: SIGNIFICANT CHANGE detected")
                            elif frame_count % 30 == 0:
                                print(f"[MISE] Video frame #{frame_count}: {len(frame_data)} bytes")

                        elif msg_type == "text":
                            # Text message from user
                            text_content = data.get("text", "")
                            if not text_content:
                                continue
                            content = types.Content(
                                role="user",
                                parts=[types.Part(text=text_content)],
                            )
                            live_request_queue.send_content(content)

                        elif msg_type == "audio":
                            # Audio sent as base64
                            raw = data.get("data")
                            if not raw:
                                continue
                            audio_bytes = base64.b64decode(raw)
                            live_request_queue.send_realtime(
                                types.Blob(
                                    data=audio_bytes,
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )

                    except json.JSONDecodeError:
                        # Plain text message
                        content = types.Content(
                            role="user",
                            parts=[types.Part(text=message["text"])],
                        )
                        live_request_queue.send_content(content)

        except WebSocketDisconnect:
            print(f"[MISE] Client disconnected: user={user_id}")
        except Exception as e:
            print(f"[MISE] Upstream error: {e}")
            traceback.print_exc()

    async def downstream_task():
        """Process run_live() events and send to WebSocket client."""
        try:
            logger.info("Starting downstream run_live...")
            async for event in runner.run_live(
                session=session,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                # Build the event dict to send to the browser
                author = getattr(event, "author", "agent")
                event_dict = {
                    "type": "event",
                    "author": author,
                }

                parts_data = []

                # Extract audio from content.parts (inline_data)
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, "text") and part.text:
                            parts_data.append({
                                "type": "text",
                                "text": part.text,
                            })
                        elif hasattr(part, "inline_data") and part.inline_data:
                            audio_b64 = base64.b64encode(
                                part.inline_data.data
                            ).decode("utf-8")
                            parts_data.append({
                                "type": "audio",
                                "data": audio_b64,
                                "mime_type": part.inline_data.mime_type,
                            })
                        elif hasattr(part, "function_call") and part.function_call:
                            args_dict = dict(part.function_call.args) if part.function_call.args else {}
                            # Check for agent transfer first (before generic function_call)
                            if part.function_call.name == "transfer_to_agent":
                                target_agent = args_dict.get("agent_name", "")
                                parts_data.append({
                                    "type": "agent_transfer",
                                    "target_agent": target_agent,
                                })
                                log_agent_event("agent_transfer", target=target_agent)
                                logger.info(f"Agent transfer: → {target_agent}")
                            else:
                                # Forward function calls to the browser for UI overlays
                                parts_data.append({
                                    "type": "function_call",
                                    "name": part.function_call.name,
                                    "args": args_dict
                                })
                                log_agent_event("tool_call", tool=part.function_call.name, args=args_dict)
                                logger.info(f"Tool called: {part.function_call.name} {args_dict}")
                        elif hasattr(part, "function_response") and part.function_response:
                            # Forward tool results to browser for rich data cards
                            try:
                                response_data = part.function_response.response if part.function_response.response else {}
                                # Convert to plain dict if needed
                                if hasattr(response_data, 'items'):
                                    response_data = dict(response_data)
                                parts_data.append({
                                    "type": "function_response",
                                    "name": part.function_response.name,
                                    "response": response_data,
                                })
                                print(f"[MISE] Tool result: {part.function_response.name}")
                            except Exception:
                                pass  # Don't break streaming for UI-only feature

                # Extract output transcription (what the agent is saying)
                output_tx = getattr(event, "output_transcription", None)
                if output_tx and getattr(output_tx, "text", None):
                    text = output_tx.text
                    parts_data.append({
                        "type": "text",
                        "text": text,
                    })
                    print(f"[MISE] Agent says: {text[:100]}...")

                # Extract input transcription (what the user said)
                input_tx = getattr(event, "input_transcription", None)
                if input_tx and getattr(input_tx, "text", None):
                    text = input_tx.text
                    parts_data.append({
                        "type": "input_transcription",
                        "text": text,
                    })
                    print(f"[MISE] User said: {text[:100]}...")

                if parts_data:
                    event_dict["parts"] = parts_data

                # Partial flag
                if getattr(event, "partial", False):
                    event_dict["partial"] = True

                # Turn complete
                if getattr(event, "turn_complete", False):
                    event_dict["turn_complete"] = True

                try:
                    await websocket.send_json(event_dict)
                except Exception:
                    break

        except Exception as e:
            log_agent_event("downstream_error", error=str(e))
            logger.error(f"Downstream error: {e}")
            traceback.print_exc()
            # Send error notification to client for graceful recovery
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "Agent stream interrupted. Attempting recovery...",
                    "recoverable": True,
                })
            except Exception:
                pass

    # ── Proactive Observation Loop ──────────────────────────
    # This is the KEY differentiator: the agent evaluates the camera
    # periodically and speaks up when it sees something noteworthy,
    # even when the user hasn't said anything.

    OBSERVATION_PROMPTS = [
        (
            "[SYSTEM — PROACTIVE CHECK] Look at the current camera view. "
            "If you see something noteworthy: "
            "1) ALWAYS call add_visual_annotation to highlight it on screen, "
            "2) Route to the right specialist: "
            "produce on counter → safety_nutrition, "
            "active cooking technique → food_scientist, "
            "timer/step transition → dinner_coordinator, "
            "TV/cooking show → recipe_explorer. "
            "If nothing noteworthy, say nothing at all. "
            "Do NOT repeat anything you've already said."
        ),
        (
            "[SYSTEM — OBSERVATION] Scan the kitchen scene. "
            "Needs flip/stir/status check? → annotate + dinner_coordinator. "
            "Produce needs washing? → annotate + safety_nutrition. "
            "Technique issue? → annotate + food_scientist. "
            "IMPORTANT: If you spot something, call add_visual_annotation FIRST, "
            "then speak about it. Only speak if genuinely useful."
        ),
        (
            "[SYSTEM — KITCHEN SCAN] Quick visual check: "
            "Any color changes, smoke, steam, or items needing attention? "
            "If yes: call add_visual_annotation to mark it on screen, "
            "then route to the right specialist. "
            "Speak only if you have something helpful. Don't repeat yourself."
        ),
    ]

    observation_index = 0

    async def observation_loop():
        """Smart observation loop — reacts to visual changes, not just timers."""
        nonlocal observation_index, significant_change_pending

        # Wait for initial setup to complete
        await asyncio.sleep(10)

        try:
            while True:
                # Smart interval: shorter when visual changes detected, longer when idle
                if significant_change_pending:
                    # React quickly to visual changes (3-5s delay)
                    interval = 3 + (observation_index % 3)
                    significant_change_pending = False
                    print("[MISE] Fast observation triggered by visual change")
                else:
                    # Normal pace (15-25 seconds)
                    interval = 15 + (observation_index % 3) * 5

                await asyncio.sleep(interval)

                # Rotate through observation prompts to avoid repetition
                prompt = OBSERVATION_PROMPTS[observation_index % len(OBSERVATION_PROMPTS)]
                observation_index += 1

                # Send as a system-level content injection
                observation_content = types.Content(
                    role="user",
                    parts=[types.Part(text=prompt)],
                )

                try:
                    live_request_queue.send_content(observation_content)
                    print(f"[MISE] Observation check #{observation_index} sent (interval={interval}s)")
                except Exception:
                    break  # Queue closed, session ending

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[MISE] Observation loop error: {e}")

    # Run upstream, downstream, and observation loop concurrently
    upstream = asyncio.create_task(upstream_task())
    downstream = asyncio.create_task(downstream_task())
    observer = asyncio.create_task(observation_loop())

    try:
        await asyncio.gather(upstream, downstream, return_exceptions=True)
    finally:
        observer.cancel()
        live_request_queue.close()
        log_agent_event("session_end", user_id=user_id, session_id=session_id)
        logger.info(f"Session ended: user={user_id}, session={session_id}")

