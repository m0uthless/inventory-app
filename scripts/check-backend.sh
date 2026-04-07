#!/usr/bin/env bash
set -euo pipefail

# Backend quality gate executed via Docker Compose (dev stack).
# Runs: pytest + mypy

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "[backend] ERROR: docker not found in PATH" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[backend] ERROR: 'docker compose' not available" >&2
  exit 1
fi

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.dev.yml)


echo "[backend] pytest"
docker compose "${COMPOSE_FILES[@]}" exec -T backend pytest -q

echo "[backend] mypy"
# The backend image is built from ./backend, so inside the container the project root is /app
# and the config file is available as /app/mypy.ini (not /app/backend/mypy.ini).
docker compose "${COMPOSE_FILES[@]}" exec -T backend python -m mypy --config-file mypy.ini .

echo "[backend] OK"
