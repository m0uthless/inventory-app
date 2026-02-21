#!/bin/sh
set -eu

# Ensure DB schema is up to date
python manage.py migrate --noinput

# Collect static files into STATIC_ROOT (shared with nginx)
python manage.py collectstatic --noinput --clear

# Start app server
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-4}" --timeout "${GUNICORN_TIMEOUT:-120}"
