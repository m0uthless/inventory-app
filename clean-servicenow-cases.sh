#!/usr/bin/env bash
#
# clean-servicenow-cases.sh
# ─────────────────────────────────────────────────────────────────────────
# Script one-shot per svuotare COMPLETAMENTE lo storico dei ServiceNow Case
# in Archie, per ripartire da zero con l'import/OCR (nessuna esclusione,
# vengono cancellati anche i case importati oggi).
#
# Cancellazione DEFINITIVA (hard delete):
#   - elimina fisicamente le righe ServiceNowCase (non solo soft-delete)
#   - elimina anche i file screenshot associati su disco/volume
#   - libera i "number" dei case (potranno essere reimportati senza conflitto
#     con il constraint di unicità)
#   - i ServiceNowCaseType NON vengono toccati
#   - gli AuditLog restano (referenziano l'oggetto via GenericForeignKey,
#     non c'è FK bloccante: dopo la cancellazione mostreranno lo storico
#     ma non saranno più cliccabili verso il case)
#
# Uso:
#   ./clean-servicenow-cases.sh dev            # dry-run (mostra cosa verrebbe cancellato)
#   ./clean-servicenow-cases.sh dev --yes       # esegue davvero la cancellazione
#   ./clean-servicenow-cases.sh prod --yes      # come sopra, ambiente prod
#
# Va lanciato dalla root del repo (/opt/inventory-app), dove si trovano
# docker-compose.yml, docker-compose.dev.yml, docker-compose.prod.yml.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENVIRONMENT="${1:-dev}"
CONFIRM="${2:-}"

case "$ENVIRONMENT" in
  dev)
    COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.dev.yml)
    ;;
  prod)
    COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
    ;;
  *)
    echo "Uso: $0 [dev|prod] [--yes]"
    exit 1
    ;;
esac

DRY_RUN=1
if [[ "$CONFIRM" == "--yes" ]]; then
  DRY_RUN=0
fi

read -r -d '' PY_SCRIPT <<'PYEOF' || true
import sys
from servicenow.models import ServiceNowCase

dry_run = "__DRY_RUN__" == "1"

qs = ServiceNowCase.objects.all().order_by("created_at")

count = qs.count()

print(f"Case totali nel DB: {count}")
print(f"Case che verranno CANCELLATI definitivamente: {count} (tutti, nessuna esclusione)")

if count == 0:
    print("Niente da cancellare.")
    sys.exit(0)

if dry_run:
    print("\n--- DRY RUN: nessuna modifica applicata. Elenco dei primi 20 case che verrebbero cancellati: ---")
    for c in qs[:20]:
        print(f"  #{c.id} {c.number} · {c.account} · creato il {c.created_at:%Y-%m-%d %H:%M}")
    if count > 20:
        print(f"  ... e altri {count - 20}")
    print("\nRilanciare con --yes per eseguire la cancellazione reale.")
    sys.exit(0)

deleted_ids = []
for c in list(qs):
    # rimuove anche il file screenshot associato, se presente
    if c.screenshot:
        try:
            c.screenshot.delete(save=False)
        except Exception as e:
            print(f"  ! impossibile cancellare screenshot per case #{c.id} ({c.number}): {e}")
    deleted_ids.append(c.id)

deleted_count, _ = qs.delete()
print(f"\nCancellati definitivamente {deleted_count} record (ids: {deleted_ids[:20]}{'...' if len(deleted_ids) > 20 else ''}).")
print(f"Rimasti in DB: {ServiceNowCase.objects.count()} case.")
PYEOF

if [[ $DRY_RUN -eq 1 ]]; then
  PY_SCRIPT="${PY_SCRIPT/__DRY_RUN__/1}"
  echo ">>> Modalità DRY RUN (ambiente: $ENVIRONMENT) — nessuna modifica verrà applicata."
else
  PY_SCRIPT="${PY_SCRIPT/__DRY_RUN__/0}"
  echo ">>> Modalità ESECUZIONE REALE (ambiente: $ENVIRONMENT) — i case verranno cancellati definitivamente."
  read -r -p "Confermi? Digita 'si' per procedere: " ans
  if [[ "$ans" != "si" ]]; then
    echo "Annullato."
    exit 1
  fi
fi

docker compose "${COMPOSE_FILES[@]}" run --rm --entrypoint "" backend \
  python manage.py shell -c "$PY_SCRIPT"
