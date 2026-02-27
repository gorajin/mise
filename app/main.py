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
from google.adk.sessions import InMemorySessionService
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.genai import types

load_dotenv()

# Import the MISE agent
from app.mise_agent.agent import agent

# Application setup
app = FastAPI(title="MISE — Live Kitchen Intelligence")
session_service = InMemorySessionService()
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
    print(f"[MISE] Client connected: user={user_id}, session={session_id}")

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
        # Note: proactive_audio and enable_affective_dialog are not supported
        # on gemini-2.0-flash-exp-image-generation. Proactive behavior is
        # handled by the observation_loop task below.
    )

    # Initialize the live request queue
    live_request_queue = LiveRequestQueue()

    async def upstream_task():
        """Receive WebSocket messages and forward to LiveRequestQueue."""
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

                # Handle text/JSON messages (including video frames)
                elif "text" in message and message["text"]:
                    try:
                        data = json.loads(message["text"])
                        msg_type = data.get("type", "text")

                        if msg_type == "video_frame":
                            # Camera frame sent as base64 JPEG
                            frame_data = base64.b64decode(data["data"])
                            live_request_queue.send_realtime(
                                types.Blob(
                                    data=frame_data,
                                    mime_type="image/jpeg",
                                )
                            )

                        elif msg_type == "text":
                            # Text message from user
                            content = types.Content(
                                role="user",
                                parts=[types.Part(text=data.get("text", ""))],
                            )
                            live_request_queue.send_content(content)

                        elif msg_type == "audio":
                            # Audio sent as base64
                            audio_bytes = base64.b64decode(data["data"])
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
            print("[MISE] Starting downstream run_live...")
            async for event in runner.run_live(
                session=session,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                # Build the event dict to send to the browser
                event_dict = {
                    "type": "event",
                    "author": getattr(event, "author", "agent"),
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

                # Extract output transcription (what the agent is saying)
                if event.output_transcription and event.output_transcription.text:
                    text = event.output_transcription.text
                    parts_data.append({
                        "type": "text",
                        "text": text,
                    })
                    print(f"[MISE] Agent says: {text[:100]}...")

                # Extract input transcription (what the user said)
                if event.input_transcription and event.input_transcription.text:
                    text = event.input_transcription.text
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
            print(f"[MISE] Downstream error: {e}")
            traceback.print_exc()

    # ── Proactive Observation Loop ──────────────────────────
    # This is the KEY differentiator: the agent evaluates the camera
    # periodically and speaks up when it sees something noteworthy,
    # even when the user hasn't said anything.

    OBSERVATION_PROMPTS = [
        (
            "[SYSTEM — PROACTIVE CHECK] Look at the current camera view. "
            "If you see anything the cook should know about RIGHT NOW — "
            "food that needs attention, produce that should be washed, "
            "a timing issue, a technique correction, or a safety concern — "
            "speak up briefly. If nothing noteworthy, say nothing at all. "
            "Do NOT repeat anything you've already said."
        ),
        (
            "[SYSTEM — OBSERVATION] Scan the kitchen scene. "
            "Is anything cooking that needs a flip, stir, or status check? "
            "Any produce out that hasn't been washed? "
            "Any timing transitions coming up? "
            "Only speak if there's something genuinely useful to say."
        ),
        (
            "[SYSTEM — KITCHEN SCAN] Quick check: "
            "Is the food looking right? Any color changes, smoke, or steam "
            "that suggest action is needed? Any ingredients on the counter "
            "that the cook might need guidance on? "
            "Speak only if you have something helpful. Don't repeat yourself."
        ),
    ]

    observation_index = 0

    async def observation_loop():
        """Periodically nudge the agent to evaluate camera and speak proactively."""
        nonlocal observation_index

        # Wait for initial setup to complete
        await asyncio.sleep(10)

        try:
            while True:
                # Wait between observations (15-25 seconds, varies to feel natural)
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
                    print(f"[MISE] Observation check #{observation_index} sent")
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
        print(f"[MISE] Session ended: user={user_id}, session={session_id}")

