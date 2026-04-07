#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_frontend_checks() {
  local dir="$1"
  local label="$2"

  echo "[$label] install dependencies"
  cd "$dir"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi

  if npm run -s format:check >/dev/null 2>&1; then
    echo "[$label] prettier (check)"
    npm run format:check
  fi

  echo "[$label] eslint"
  npm run lint

  echo "[$label] tsc --noEmit"
  npx tsc --noEmit

  echo "[$label] vitest"
  npm run test:run

  echo "[$label] vite build"
  npm run build
}

run_frontend_checks "$ROOT_DIR/frontend" "frontend"
run_frontend_checks "$ROOT_DIR/frontend-auslbo" "frontend-auslbo"
