#!/usr/bin/env bash
set -euo pipefail

# Backend quality gate executed via Docker Compose.
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

echo "[backend] pytest"
docker compose exec -T backend pytest -q

echo "[backend] mypy"
docker compose exec -T backend mypy core crm inventory audit issues wiki drive maintenance --ignore-missing-imports

echo "[backend] OK"
