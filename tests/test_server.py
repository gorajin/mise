"""Tests for MISE FastAPI server endpoints.

These tests verify that the server responds correctly to HTTP requests
without requiring a full Google ADK/Gemini connection.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    """Create a test client for the FastAPI app."""
    from app.main import app
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_json(self, client):
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "healthy"
        assert data["agent"] == "mise"


class TestRootEndpoint:
    def test_root_returns_200(self, client):
        response = client.get("/")
        assert response.status_code == 200

    def test_root_returns_html(self, client):
        response = client.get("/")
        assert "text/html" in response.headers["content-type"]

    def test_root_contains_mise(self, client):
        response = client.get("/")
        assert "MISE" in response.text


class TestStaticFiles:
    def test_css_accessible(self, client):
        response = client.get("/static/css/style.css")
        assert response.status_code == 200
        assert "text/css" in response.headers["content-type"]

    def test_js_accessible(self, client):
        response = client.get("/static/js/app.js")
        assert response.status_code == 200

    def test_manifest_accessible(self, client):
        response = client.get("/static/manifest.json")
        assert response.status_code == 200

    def test_nonexistent_static_404(self, client):
        response = client.get("/static/nonexistent.js")
        assert response.status_code == 404


class TestArchitectureDiagram:
    def test_architecture_accessible(self, client):
        response = client.get("/static/architecture.html")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
