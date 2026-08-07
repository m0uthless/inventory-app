#!/usr/bin/env bash
#
# clean-attendance-absences.sh
# ─────────────────────────────────────────────────────────────────────────
# Script one-shot per svuotare COMPLETAMENTE il Piano Ferie in Archie
# (modello attendance.Absence): ferie, malattia, permesso 104, training,
# trasferta, altro — TUTTE le righe, nessuna esclusione per data.
#
# Cancellazione DEFINITIVA (hard delete):
#   - elimina fisicamente tutte le righe Absence (non solo soft-delete)
#   - nessun file associato da ripulire (Absence non ha campi file/immagine)
#   - LeaveArea (aree organizzative) NON viene toccata, solo le righe Absence
#
# Uso:
#   ./clean-attendance-absences.sh dev            # dry-run (mostra cosa verrebbe cancellato)
#   ./clean-attendance-absences.sh dev --yes       # esegue davvero la cancellazione
#   ./clean-attendance-absences.sh prod --yes      # come sopra, ambiente prod
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
from collections import Counter
from attendance.models import Absence, AbsenceReason

dry_run = "__DRY_RUN__" == "1"

qs = Absence.objects.all().order_by("date")
count = qs.count()

print(f"Righe Absence totali nel DB: {count}")

if count == 0:
    print("Niente da cancellare.")
    sys.exit(0)

by_reason = Counter(qs.values_list("reason", flat=True))
reason_labels = dict(AbsenceReason.choices)
print("Ripartizione per motivo:")
for reason, n in by_reason.most_common():
    print(f"  - {reason_labels.get(reason, reason)}: {n}")

if dry_run:
    print("\n--- DRY RUN: nessuna modifica applicata. Prime 20 righe che verrebbero cancellate: ---")
    for a in qs[:20]:
        print(f"  #{a.id} {a.date} {a.day_part} · {reason_labels.get(a.reason, a.reason)} · {a.status} · {a.user}")
    if count > 20:
        print(f"  ... e altre {count - 20}")
    print("\nRilanciare con --yes per eseguire la cancellazione reale.")
    sys.exit(0)

deleted_count, _ = qs.delete()
print(f"\nCancellate definitivamente {deleted_count} righe.")
print(f"Rimaste in DB: {Absence.objects.count()} righe.")
PYEOF

if [[ $DRY_RUN -eq 1 ]]; then
  PY_SCRIPT="${PY_SCRIPT/__DRY_RUN__/1}"
  echo ">>> Modalità DRY RUN (ambiente: $ENVIRONMENT) — nessuna modifica verrà applicata."
else
  PY_SCRIPT="${PY_SCRIPT/__DRY_RUN__/0}"
  echo ">>> Modalità ESECUZIONE REALE (ambiente: $ENVIRONMENT) — TUTTE le assenze/attività verranno cancellate definitivamente."
  read -r -p "Confermi? Digita 'si' per procedere: " ans
  if [[ "$ans" != "si" ]]; then
    echo "Annullato."
    exit 1
  fi
fi

docker compose "${COMPOSE_FILES[@]}" run --rm --entrypoint "" backend \
  python manage.py shell -c "$PY_SCRIPT"
