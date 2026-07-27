#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# reset-db-from-zero.sh — Reset completo del database ARCHIE in produzione
# ============================================================================
# Operazione DISTRUTTIVA e IRREVERSIBILE (a parte il backup automatico
# preso da questo script prima di procedere).
#
# Cosa fa, in ordine:
#   1. Backup completo del DB corrente (sempre, prima di tutto)
#   2. Ferma i container backend/cron (evita connessioni attive durante il drop)
#   3. DROP + CREATE del database (schema completamente vuoto, ID che
#      ripartono da 1 su ogni tabella — comportamento standard Postgres:
#      le sequence SERIAL/BIGSERIAL partono da 1, non da 0. Se serve
#      davvero l'ID 0 sulla prima riga di qualche tabella specifica va
#      gestito con un ALTER SEQUENCE dedicato dopo la migrate, dimmelo)
#   4. Rimuove anche tutti i file in /media (altrimenti restano orfani sul
#      disco, non collegati a nessuna riga nel DB nuovo) — se invece vuoi
#      tenerli, commenta il blocco "rm -rf" più sotto prima di eseguire
#   5. Rieseguo tutte le migrazioni Django (schema pulito da zero)
#   6. Eseguo seed_defaults (stati/tipi core + LeaveArea + IssueCategory +
#      anagrafiche device + ServiceNowCaseType, tutti concordati insieme)
#   7. Ti guida al comando per ricreare l'utente superuser (interattivo,
#      NON eseguito automaticamente da questo script: l'utente root
#      attuale va perso col drop del DB, va ricreato da zero)
#
# Legge POSTGRES_DB / POSTGRES_USER da .env.prod nella root del repo.
#
# Uso:
#   ./reset-db-from-zero.sh [percorso-repo-prod]
#   (default: $HOME/inventory-app)
# ============================================================================

REPO_DIR="${1:-$HOME/inventory-app}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/.env.prod"

cd "$REPO_DIR"

if [ ! -f docker-compose.prod.yml ]; then
  echo "Errore: docker-compose.prod.yml non trovato in $REPO_DIR."
  echo "Uso: $0 [percorso-repo-prod]"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Errore: $ENV_FILE non trovato."
  exit 1
fi

POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"

if [ -z "$POSTGRES_DB" ] || [ -z "$POSTGRES_USER" ]; then
  echo "Errore: impossibile leggere POSTGRES_DB/POSTGRES_USER da $ENV_FILE."
  exit 1
fi

echo "======================================================================"
echo " RESET COMPLETO DATABASE — ARCHIE PRODUZIONE"
echo "======================================================================"
echo "Repo: $(pwd)"
echo "Database: $POSTGRES_DB (utente: $POSTGRES_USER)"
echo
echo "ATTENZIONE: questo cancella LETTERALMENTE TUTTO, inclusi utenti,"
echo "gruppi/permessi e l'utente root attuale. Non e' la purge mirata:"
echo "qui si droppa e ricrea il database da zero, poi si rieseguono"
echo "migrazioni + seed_defaults. Il root va ricreato a mano dopo (comando"
echo "mostrato alla fine)."
echo
echo "Vengono anche cancellati tutti i file in /media (allegati, PDF,"
echo "ricevute, loghi, screenshot): con un DB vuoto non sarebbero comunque"
echo "collegati a nessuna riga."
echo
read -r -p "Hai letto e vuoi procedere? [y/N] " CONFIRM1
case "$CONFIRM1" in
  y|Y|yes|YES) ;;
  *) echo "Annullato."; exit 0 ;;
esac

# ---------------------------------------------------------------------------
# 1. Backup completo del DB — sempre, senza eccezioni
# ---------------------------------------------------------------------------
BACKUP_DIR="$REPO_DIR/backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/pre-reset-${STAMP}.sql.gz"

echo
echo "── Backup del database in corso -> $BACKUP_FILE"
$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "Errore: il backup risulta vuoto. Interrompo senza toccare il DB."
  rm -f "$BACKUP_FILE"
  exit 1
fi
echo "Backup completato ($(du -h "$BACKUP_FILE" | cut -f1))."

echo
read -r -p "Confermi il reset definitivo? Scrivi ESATTAMENTE 'RESET TOTALE': " CONFIRM2
if [ "$CONFIRM2" != "RESET TOTALE" ]; then
  echo "Annullato. Backup comunque salvato in $BACKUP_FILE."
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Ferma i container che usano il DB
# ---------------------------------------------------------------------------
echo
echo "── Arresto backend/cron..."
$COMPOSE stop backend cron

# ---------------------------------------------------------------------------
# 3. Drop + create del database
# ---------------------------------------------------------------------------
echo
echo "── Chiusura connessioni attive e drop del database..."
$COMPOSE exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();"
$COMPOSE exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";"

echo "── Ricreazione database..."
$COMPOSE exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"

# ---------------------------------------------------------------------------
# 4. Pulizia file /media orfani
# ---------------------------------------------------------------------------
echo
echo "── Pulizia file /media..."
$COMPOSE exec -T backend sh -c 'rm -rf /app/media/* 2>/dev/null || true'

# ---------------------------------------------------------------------------
# 5. Riavvio backend + migrazioni + seed
# ---------------------------------------------------------------------------
echo
echo "── Riavvio backend..."
$COMPOSE up -d backend

echo "── Attendo che il backend risponda..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T backend python -c \
    "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=3).getcode()==200 else 1)" \
    >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "── Migrazioni..."
$COMPOSE exec -T backend python manage.py migrate

echo "── Seed dati di riferimento..."
$COMPOSE exec -T backend python manage.py seed_defaults

# ---------------------------------------------------------------------------
# 6. Riavvio cron (fermato al punto 2)
# ---------------------------------------------------------------------------
echo
echo "── Riavvio cron..."
$COMPOSE up -d cron

echo
echo "======================================================================"
echo " Reset completato. Database vuoto, schema fresco, dati di riferimento"
echo " seedati. Backup pre-reset salvato in: $BACKUP_FILE"
echo
echo " Ultimo passo (manuale, interattivo) — ricrea il tuo utente root:"
echo "   $COMPOSE exec backend python manage.py createsuperuser"
echo "======================================================================"
