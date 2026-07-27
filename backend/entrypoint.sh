#!/bin/sh
set -eu

# NOTE: In production you usually want controlled deploy steps.
# Set RUN_MIGRATIONS=0 to disable automatic migrations at container start.
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] Running migrations..."
  python manage.py migrate --noinput
else
  echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS!=1)."
  # Fix 2.11 (audit 2026-07): con le migrazioni disattivate nulla garantiva
  # che lo schema fosse aggiornato prima dell'avvio (rischio: backend contro
  # schema vecchio, errori 500 durante un rilascio). `migrate --check` esce
  # con codice diverso da zero se esistono migrazioni non applicate, senza
  # applicarle. Di default logga solo un warning (non blocca l'avvio, per
  # non rompere il flusso manuale esistente); impostare
  # FAIL_ON_PENDING_MIGRATIONS=1 per bloccare l'avvio in ambienti che
  # vogliono un rilascio atomico più severo.
  if ! python manage.py migrate --check >/dev/null 2>&1; then
    echo "[entrypoint] ATTENZIONE: risultano migrazioni Django non applicate."
    echo "[entrypoint] Esegui manualmente 'python manage.py migrate' prima di considerare il rilascio completo."
    if [ "${FAIL_ON_PENDING_MIGRATIONS:-0}" = "1" ]; then
      echo "[entrypoint] FAIL_ON_PENDING_MIGRATIONS=1: interrompo l'avvio."
      exit 1
    fi
  fi
fi

# Collect static files into STATIC_ROOT (shared with nginx)
# Set RUN_COLLECTSTATIC=0 to disable (e.g. if you bake static into an image).
if [ "${RUN_COLLECTSTATIC:-1}" = "1" ]; then
  echo "[entrypoint] Collecting static files..."
  python manage.py collectstatic --noinput --clear
else
  echo "[entrypoint] Skipping collectstatic (RUN_COLLECTSTATIC!=1)."
fi

# Production deploy checks (security/settings sanity)
if [ "${DJANGO_RUN_DEPLOY_CHECK:-0}" = "1" ]; then
  echo "[entrypoint] Running django deploy checks..."
  python manage.py check --deploy --fail-level WARNING
else
  echo "[entrypoint] Skipping deploy checks (DJANGO_RUN_DEPLOY_CHECK!=1)."
fi

# Start app server
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-4}" --timeout "${GUNICORN_TIMEOUT:-120}"
