from __future__ import annotations

import os
import time

from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

# Tempo di avvio del processo Django (calcolato al primo import del modulo)
_PROCESS_START = time.time()
_DEFAULT_APP_VERSION = os.getenv("APP_VERSION", "0.5.0")


def _format_uptime(seconds: float) -> str:
    """Converte secondi in stringa leggibile: '3d 4h', '12h 30m', '45m'."""
    seconds = int(seconds)
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)

    if days > 0:
        return f"{days}d {hours}h"
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


class SystemStatsView(APIView):
    """
    Statistiche di sistema pubbliche — usate nella pagina di Login
    prima dell'autenticazione.

    GET /api/system-stats/
    Response:
    {
        "inventory_count": 142,
        "uptime": "3d 4h",
        "version": "0.5.0"
    }
    """

    permission_classes = [AllowAny]

    def get(self, request):
        from inventory.models import Inventory

        inventory_count = Inventory.objects.filter(deleted_at__isnull=True).count()
        uptime_seconds = time.time() - _PROCESS_START

        return Response(
            {
                "inventory_count": inventory_count,
                "uptime": _format_uptime(uptime_seconds),
                "version": _DEFAULT_APP_VERSION,
            }
        )


class HealthAPIView(APIView):
    """Health endpoint pubblico per liveness/readiness check di base."""

    permission_classes = [AllowAny]

    def get(self, request):
        db_ok = True
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            db_ok = False

        payload = {
            "status": "ok" if db_ok else "degraded",
            "database": "ok" if db_ok else "error",
            "version": _DEFAULT_APP_VERSION,
        }
        return Response(payload, status=200 if db_ok else 503)
