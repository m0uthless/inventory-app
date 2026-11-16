from __future__ import annotations

import mimetypes
import os
from pathlib import PurePosixPath
from urllib.parse import quote

from django.http import HttpResponse


def build_action_url(*, request, relative_path: str) -> str:
    return request.build_absolute_uri(relative_path) if request else relative_path


# B-14 (QA 2026-11-15): tipi che il browser può aprire "inline" senza
# eseguire codice. Tutto il resto (html, svg, xml, js, ...) viene scaricato.
INLINE_SAFE_MIME_TYPES = frozenset({
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "text/plain",
})


def safe_served_type(rel_name: str, disposition: str, mime_type: str | None = None) -> tuple[str, str]:
    """Content-Type e disposizione con cui servire un file caricato.

    Il tipo si ricava dall'estensione del file salvato, mai dal
    Content-Type dichiarato dal client all'upload: un file "inline" con tipo
    fuori whitelist (es. ``.html``) viene forzato a download
    ``application/octet-stream``, così non può eseguire script
    dall'origine dell'app. ``mime_type`` passato dal chiamante vale solo se
    è in whitelist (es. ``application/pdf`` dei rapportini, fissato dal
    server); i tipi ``text/*`` sono sempre ``text/plain; charset=utf-8``.
    """
    guessed = (mimetypes.guess_type(rel_name)[0] or "").lower()
    if disposition != "inline":
        return (guessed or "application/octet-stream"), disposition
    candidate = (mime_type or "").split(";")[0].strip().lower()
    if candidate not in INLINE_SAFE_MIME_TYPES:
        candidate = guessed
    if candidate not in INLINE_SAFE_MIME_TYPES:
        return "application/octet-stream", "attachment"
    if candidate.startswith("text/"):
        return "text/plain; charset=utf-8", "inline"
    return candidate, "inline"


def protected_media_response(*, file_field, disposition: str = "attachment", filename: str | None = None, mime_type: str | None = None) -> HttpResponse:
    if not file_field:
        return HttpResponse(status=404)

    rel_name = (file_field.name or "").lstrip("/")
    p = PurePosixPath(rel_name)
    if not rel_name or ".." in p.parts:
        return HttpResponse(status=400)

    resolved_name = filename or os.path.basename(rel_name) or "file"
    resolved_mime, disposition = safe_served_type(rel_name, disposition, mime_type)

    resp = HttpResponse(b"", content_type=resolved_mime)
    resp["X-Content-Type-Options"] = "nosniff"
    resp["X-Accel-Redirect"] = f"/protected_media/{rel_name}"

    ascii_name = resolved_name.encode("ascii", errors="replace").decode("ascii")
    utf8_name = quote(resolved_name, safe="")
    resp["Content-Disposition"] = (
        f'{disposition}; filename="{ascii_name}"; filename*=UTF-8\'\'{utf8_name}'
    )
    resp.headers.pop("Content-Length", None)
    return resp
