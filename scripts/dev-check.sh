#!/usr/bin/env bash
set -euo pipefail

# Quick sanity check: build + run core tests inside Docker.

COMPOSE=${COMPOSE:-"docker compose"}

echo "[dev-check] Rebuilding containers..."
$COMPOSE up -d --build --force-recreate

echo "[dev-check] Running backend smoke tests..."
$COMPOSE exec backend python manage.py test core

echo "[dev-check] OK"
