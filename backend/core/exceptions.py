"""Exception handler DRF del progetto."""
from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.views import set_rollback

logger = logging.getLogger(__name__)


def exception_handler(exc, context):
    """Come quello di DRF, più gli errori di storage (B-16, QA 2026-11-15).

    Un ``OSError`` (es. ``PermissionError`` su una cartella di ``media/``
    non scrivibile) diventava una pagina 500 generica: ora è registrato nel
    log con lo stack e il client riceve un messaggio leggibile.
    """
    response = drf_exception_handler(exc, context)
    if response is None and isinstance(exc, OSError):
        view = context.get("view")
        logger.exception("Errore di storage in %s", type(view).__name__ if view else "?", exc_info=exc)
        set_rollback()
        return Response(
            {"detail": "Impossibile salvare o leggere il file sul server. Riprova; se succede ancora avvisa l'amministratore."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    return response
