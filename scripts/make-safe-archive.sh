#!/usr/bin/env bash
set -euo pipefail

# 0.9.1 (WP-04, archie-secretartifacts — audit 2026-08-19, SEC-009).
#
# Causa radice del leak citato in .env.example (fix 2.7, audit 2026-07):
# .env.dev/.env.prod sono in .gitignore, quindi Git non li includerebbe
# mai — ma un archivio "manuale" del progetto creato con `zip -r` o `tar`
# sulla working directory IGNORA .gitignore, e finisce per includere
# esattamente i file che dovrebbero restare fuori (.env.dev/.env.prod con
# segreti reali, file temporanei, ecc.). Lo stesso vale per
# backend/import_files/inventory.xlsx (rimosso in Fase 0 di questa
# roadmap: conteneva credenziali VNC/OS reali, non era in .gitignore
# perché pensato come fixture di esempio).
#
# Questo script sostituisce "zip -r inventory-app project.zip" con
# `git archive`, che per costruzione include SOLO i file tracciati da Git
# (rispetta .gitignore automaticamente, niente bisogno di mantenere una
# blocklist parallela) — più un controllo di sicurezza post-hoc che
# scansiona il contenuto dell'archivio prodotto per pattern sospetti,
# come rete di sicurezza in caso qualcosa di sensibile sia stato
# accidentalmente committato.
#
# Uso:
#   scripts/make-safe-archive.sh [output.zip]
#
# Output di default: inventory-app-<branch>-<short-sha>.zip nella
# directory corrente.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "ERRORE: git non trovato nel PATH." >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "nogit")"
DEFAULT_OUTPUT="inventory-app-${BRANCH}-${SHORT_SHA}.zip"
OUTPUT="${1:-$DEFAULT_OUTPUT}"

if [[ -e "$OUTPUT" ]]; then
  echo "ERRORE: $OUTPUT esiste già. Rimuovilo o specifica un altro nome." >&2
  exit 1
fi

echo "[make-safe-archive] Verifica modifiche non committate..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ATTENZIONE: ci sono modifiche non committate/non tracciate."
  echo "git archive include SOLO l'ultimo commit — le modifiche locali non committate NON finiranno nell'archivio."
  read -r -p "Continuare comunque? (si/no): " confirm
  if [[ "$confirm" != "si" && "$confirm" != "sì" && "$confirm" != "yes" && "$confirm" != "y" ]]; then
    echo "Operazione annullata."
    exit 0
  fi
fi

echo "[make-safe-archive] Creo $OUTPUT da HEAD ($BRANCH @ $SHORT_SHA) con git archive..."
git archive --format=zip --prefix="inventory-app/" -o "$OUTPUT" HEAD

echo "[make-safe-archive] Controllo di sicurezza post-hoc sul contenuto dell'archivio..."
TMP_LIST="$(mktemp)"
trap 'rm -f "$TMP_LIST"' EXIT
unzip -l "$OUTPUT" | awk '{print $4}' > "$TMP_LIST"

FOUND_ISSUES=0

# Pattern di nomi file che non dovrebbero MAI comparire in un archivio
# condiviso, qualunque sia la fonte (git archive non dovrebbe già
# includerli se .gitignore è rispettato — questo è un controllo di
# ridondanza, non l'unica difesa).
FORBIDDEN_NAME_PATTERNS=(
  '\.env\.dev$' '\.env\.prod$' '\.env$'
  '\.pem$' '\.key$' '\.p12$' '\.pfx$'
  'id_rsa' 'id_ed25519'
)
for pattern in "${FORBIDDEN_NAME_PATTERNS[@]}"; do
  if grep -qE "$pattern" "$TMP_LIST"; then
    echo "  ❌ TROVATO file vietato nell'archivio: pattern '$pattern'"
    grep -E "$pattern" "$TMP_LIST" | sed 's/^/     /'
    FOUND_ISSUES=1
  fi
done

if [[ "$FOUND_ISSUES" -eq 1 ]]; then
  echo ""
  echo "❌ CONTROLLO FALLITO: l'archivio $OUTPUT contiene file che non dovrebbero essere condivisi."
  echo "   Rimuovo $OUTPUT (non deve restare su disco un archivio con segreti) e interrompo."
  echo "   Correggi .gitignore/il commit di origine e riprova."
  rm -f "$OUTPUT"
  exit 1
fi

echo "[make-safe-archive] OK — nessun file vietato trovato. Archivio pronto: $OUTPUT"
