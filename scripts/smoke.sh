#!/usr/bin/env bash
set -euo pipefail

COMPOSE=${COMPOSE:-"docker compose"}
MODE=${1:-full}

quick_tests=(
  "config/tests/test_auth_session_contracts.py"
  "config/tests/test_search_contracts.py"
  "inventory/tests/test_secrets_contracts.py"
  "core/tests/test_restore_response_contracts.py"
  "config/tests/test_public_status_contracts.py"
)

full_tests=(
  "config/tests/test_auth_session_contracts.py"
  "config/tests/test_search_contracts.py"
  "wiki/tests/test_render_and_revision_contracts.py"
  "core/tests/test_restore_response_contracts.py"
  "inventory/tests/test_secrets_contracts.py"
  "maintenance/tests/test_plan_list_contract.py"
  "audit/tests/test_metadata_masking.py"
  "config/tests/test_public_status_contracts.py"
)

case "$MODE" in
  quick)
    tests=("${quick_tests[@]}")
    ;;
  full)
    tests=("${full_tests[@]}")
    ;;
  *)
    echo "Usage: scripts/smoke.sh [quick|full]" >&2
    exit 2
    ;;
esac

echo "[smoke] Ensuring backend container is up..."
$COMPOSE up -d backend >/dev/null

echo "[smoke] Running ${MODE} backend smoke suite..."
$COMPOSE exec backend pytest "${tests[@]}"

echo
echo "[smoke] Automated suite passed."
echo "[smoke] Recommended manual checks:"
echo "  - login/logout"
echo "  - search deep-links"
echo "  - wiki render + revision restore"
echo "  - trash restore with blocked parents"
echo "  - inventory secrets visibility/edit rules"
echo "  - audit detail metadata drawer"
