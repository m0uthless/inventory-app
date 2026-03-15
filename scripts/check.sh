#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "== inventory-app: local checks =="
echo

"$ROOT_DIR/check-backend.sh"
echo
"$ROOT_DIR/check-frontend.sh"
echo

# Optional audit (skip with SKIP_AUDIT=1)
if [[ "${SKIP_AUDIT:-0}" != "1" ]]; then
  echo
  "$ROOT_DIR/audit.sh" || true
fi

echo
echo "All checks passed ✅"
