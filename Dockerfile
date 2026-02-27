FROM python:3.11-slim

WORKDIR /app

# Copy project files
COPY pyproject.toml .
COPY app/ app/
COPY README.md .

# Install dependencies
RUN pip install --no-cache-dir -e .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
