#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "[frontend] npm ci"
cd "$FRONTEND_DIR"
npm ci

# Prettier check: prefer npm script if present, otherwise run via npx
echo "[frontend] prettier (check)"
if npm run -s format:check >/dev/null 2>&1; then
  npm run format:check
else
  npx prettier . --check
fi

echo "[frontend] eslint"
npm run lint

echo "[frontend] tsc --noEmit"
npx tsc --noEmit

echo "[frontend] vitest"
npm run test:run

echo "[frontend] vite build"
npm run build
