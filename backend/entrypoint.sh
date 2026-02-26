#!/bin/sh
set -eu

# NOTE: In production you usually want controlled deploy steps.
# Set RUN_MIGRATIONS=0 to disable automatic migrations at container start.
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] Running migrations..."
  python manage.py migrate --noinput
else
  echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS!=1)."
fi

# Collect static files into STATIC_ROOT (shared with nginx)
# Set RUN_COLLECTSTATIC=0 to disable (e.g. if you bake static into an image).
if [ "${RUN_COLLECTSTATIC:-1}" = "1" ]; then
  echo "[entrypoint] Collecting static files..."
  python manage.py collectstatic --noinput --clear
else
  echo "[entrypoint] Skipping collectstatic (RUN_COLLECTSTATIC!=1)."
fi

# Start app server
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-4}" --timeout "${GUNICORN_TIMEOUT:-120}"
