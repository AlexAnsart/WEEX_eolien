FROM python:3.12-slim

WORKDIR /app

# Install Tectonic + biber for LaTeX report generation.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tectonic \
    biber \
    fonts-lmodern \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt backend/requirements.txt
RUN python -m pip install --no-cache-dir -r backend/requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV WEEX_LATEX_TIMEOUT_SECONDS=240

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
