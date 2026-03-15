#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"

TMP_DIR="$(mktemp -d)"
AUDIT_JSON="${TMP_DIR}/npm_audit.json"
AUDIT_ERR="${TMP_DIR}/npm_audit.err"

cleanup() { rm -rf "${TMP_DIR}"; }
trap cleanup EXIT

echo "[audit] frontend: npm audit (json)"

if [ ! -d "${FRONTEND_DIR}" ]; then
  echo "[audit] ERROR: frontend/ not found"
  exit 2
fi

pushd "${FRONTEND_DIR}" >/dev/null

# Keep stdout as JSON, send noise to stderr file
export NPM_CONFIG_LOGLEVEL=silent
set +e
npm audit --json >"${AUDIT_JSON}" 2>"${AUDIT_ERR}"
AUDIT_RC=$?
set -e

popd >/dev/null

# Validate JSON quickly
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "${AUDIT_JSON}" 2>/dev/null || {
  echo "[audit] WARN: npm audit did not return valid JSON (rc=${AUDIT_RC})."
  echo "[audit] stderr (first 50 lines):"
  sed -n '1,50p' "${AUDIT_ERR}" || true
  exit 0
}

# Parse + print summary/details; exit 10 if critical>0
set +e
node "${ROOT_DIR}/scripts/_parse_npm_audit.mjs" "${AUDIT_JSON}"
PARSE_RC=$?
set -e

if [ "${PARSE_RC}" -eq 10 ]; then
  echo "[audit] ❌ CRITICAL vulnerabilities detected."
  exit 1
fi

# non-critical (including HIGH) should not fail the build
exit 0
