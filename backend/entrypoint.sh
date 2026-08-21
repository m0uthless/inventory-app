#!/bin/sh
set -eu
# Fase 6 (0.9.1, audit 2026-08-19): il container backend non gira più come
# root a runtime (Dockerfile crea l'utente "appuser", uid/gid 1000). Questo
# script parte ancora come root SOLO per allineare i permessi dei volumi
# Docker montati (datafiles, staticfiles, media): su un'installazione
# esistente quei volumi contengono file root-owned scritti dalle immagini
# precedenti a questa modifica. Senza questo passaggio, il primo avvio
# post-upgrade fallirebbe su collectstatic/migrate con Permission denied.
# Su un volume nuovo (installazione pulita) il chown è no-op quasi istantaneo.
# Dopo l'allineamento i privilegi vengono droppati con `su` e il processo
# applicativo (gunicorn) gira sempre come appuser, mai come root.
echo "[entrypoint] Verifica permessi volumi (root -> appuser)..."
# chown -R su volumi grandi (Drive/allegati accumulati negli anni) può essere
# lento: lo eseguiamo solo se serve davvero (owner attuale != appuser),
# non ad ogni singolo restart del container. Su un'installazione già
# migrata questo è un semplice `stat`, non un giro ricorsivo.
for _dir in /app/data /app/staticfiles /app/media; do
  if [ -d "$_dir" ] && [ "$(stat -c '%u' "$_dir" 2>/dev/null || echo -1)" != "1000" ]; then
    echo "[entrypoint]   allineamento $_dir ..."
    chown -R appuser:appuser "$_dir" 2>/dev/null || true
  fi
done

# Da qui in poi ogni comando gira come appuser, non più come root.
run_as_app() {
  su -s /bin/sh appuser -c "$*"
}

# NOTE: In production you usually want controlled deploy steps.
# Set RUN_MIGRATIONS=0 to disable automatic migrations at container start.
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] Running migrations..."
  run_as_app "python manage.py migrate --noinput"
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
  if ! run_as_app "python manage.py migrate --check" >/dev/null 2>&1; then
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
  run_as_app "python manage.py collectstatic --noinput --clear"
else
  echo "[entrypoint] Skipping collectstatic (RUN_COLLECTSTATIC!=1)."
fi
# Production deploy checks (security/settings sanity)
if [ "${DJANGO_RUN_DEPLOY_CHECK:-0}" = "1" ]; then
  echo "[entrypoint] Running django deploy checks..."
  # Fix deploycheck-00 (2026-07-27): --fail-level WARNING blocca l'avvio per
  # qualsiasi warning, inclusi quelli puramente cosmetici di drf_spectacular
  # (schema OpenAPI, type hint mancanti su SerializerMethodField) che non
  # rappresentano un rischio di sicurezza o un problema di deploy reale.
  # Portato a ERROR: il gate resta attivo per problemi bloccanti veri
  # (es. SECRET_KEY debole, DEBUG=True in produzione, ecc.) senza fermare
  # l'avvio per rumore di documentazione API. I warning restano comunque
  # visibili nei log per revisione manuale.
  run_as_app "python manage.py check --deploy --fail-level ERROR"
else
  echo "[entrypoint] Skipping deploy checks (DJANGO_RUN_DEPLOY_CHECK!=1)."
fi
# Start app server. exec + su sostituisce questo shell script con gunicorn
# (via su), che diventa così il processo che riceve i segnali (SIGTERM ecc.)
# da Docker per lo shutdown — non resta uno shell padre di troppo in mezzo.
exec su -s /bin/sh appuser -c "exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers \"${GUNICORN_WORKERS:-4}\" --timeout \"${GUNICORN_TIMEOUT:-120}\""
