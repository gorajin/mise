"""MISE — Google Cloud Platform Integrations.

Provides:
  - Firestore-backed session persistence (replaces InMemorySessionService)
  - Secret Manager for API key retrieval
  - Cloud Logging for structured observability
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv()

# ── Cloud Logging ──────────────────────────────────────

_cloud_logger = None


def setup_cloud_logging():
    """Set up Google Cloud Logging if running on GCP.

    Falls back to standard Python logging locally.
    Returns a structured logger for MISE events.
    """
    global _cloud_logger
    logger = logging.getLogger("mise")

    # Try Cloud Logging (available on Cloud Run)
    if os.getenv("K_SERVICE"):  # Cloud Run sets this automatically
        try:
            import google.cloud.logging

            client = google.cloud.logging.Client()
            client.setup_logging()
            logger.setLevel(logging.INFO)
            _cloud_logger = logger
            logger.info("MISE Cloud Logging initialized on Cloud Run")
            return logger
        except Exception as e:
            print(f"[MISE] Cloud Logging setup failed, using stdout: {e}")

    # Local fallback: structured console logging
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("[MISE] %(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    )
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    _cloud_logger = logger
    return logger


def get_logger():
    """Get the MISE logger (initializes on first call)."""
    global _cloud_logger
    if _cloud_logger is None:
        setup_cloud_logging()
    return _cloud_logger


def log_agent_event(event_type: str, **kwargs):
    """Log a structured agent event for observability.

    Args:
        event_type: Type of event (e.g., "tool_call", "agent_transfer",
            "observation", "session_start", "session_end").
        **kwargs: Additional structured data for the log entry.
    """
    logger = get_logger()
    extra = {"event_type": event_type, **kwargs}
    logger.info(f"{event_type}: {extra}")


# ── Secret Manager ─────────────────────────────────────


def get_secret(secret_id: str, project_id: str = None) -> str:
    """Retrieve a secret from Google Cloud Secret Manager.

    Falls back to environment variables if not on GCP or if Secret Manager
    is unavailable.

    Args:
        secret_id: The secret name (e.g., "GOOGLE_API_KEY").
        project_id: GCP project ID. Auto-detected on Cloud Run.

    Returns:
        The secret value as a string.
    """
    # Try Secret Manager first (on GCP)
    if os.getenv("K_SERVICE"):
        try:
            from google.cloud import secretmanager

            client = secretmanager.SecretManagerServiceClient()
            project = project_id or os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT")
            if project:
                name = f"projects/{project}/secrets/{secret_id}/versions/latest"
                response = client.access_secret_version(request={"name": name})
                get_logger().info(f"Secret '{secret_id}' loaded from Secret Manager")
                return response.payload.data.decode("UTF-8")
        except Exception as e:
            get_logger().warning(f"Secret Manager failed for '{secret_id}': {e}")

    # Fallback to environment variable
    value = os.getenv(secret_id, "")
    if value:
        get_logger().info(f"Secret '{secret_id}' loaded from environment variable")
    else:
        get_logger().warning(f"Secret '{secret_id}' not found in Secret Manager or environment")
    return value


# ── Firestore Session Persistence ──────────────────────


def get_session_service():
    """Get the best available session service.

    On Cloud Run: tries DatabaseSessionService with SQLite (persists across
    requests within a single container instance). Falls back to InMemory.
    Locally: always uses InMemory.
    """
    from google.adk.sessions import InMemorySessionService

    # Try persistent sessions on Cloud Run
    if os.getenv("K_SERVICE") or os.getenv("USE_DATABASE_SESSIONS"):
        try:
            from google.adk.sessions import DatabaseSessionService

            # Use SQLite for persistent sessions within the container
            # (survives across requests, lost on cold start — acceptable for cooking sessions)
            db_path = os.getenv("SESSION_DB_PATH", "/tmp/mise_sessions.db")
            service = DatabaseSessionService(
                db_url=f"sqlite:///{db_path}"
            )
            get_logger().info(f"DatabaseSessionService initialized (sqlite:///{db_path})")
            return service
        except ImportError:
            get_logger().info("DatabaseSessionService not available in this ADK version")
        except Exception as e:
            get_logger().warning(f"DatabaseSessionService setup failed: {e}")

    get_logger().info("Using InMemorySessionService (local development)")
    return InMemorySessionService()
