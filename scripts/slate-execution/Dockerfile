FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends bash git curl ffmpeg nodejs npm build-essential fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir matplotlib numpy pandas pillow requests scipy
RUN useradd --create-home --uid 1000 slate && mkdir /workspace && chown slate:slate /workspace
WORKDIR /app
COPY scripts/slate-execution/server.py /app/server.py
USER slate
ENV SLATE_WORKSPACE=/workspace
CMD ["python", "-u", "/app/server.py"]
