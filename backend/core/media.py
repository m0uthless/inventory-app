from __future__ import annotations

import mimetypes
import os
from pathlib import PurePosixPath
from urllib.parse import quote

from django.http import HttpResponse


def build_action_url(*, request, relative_path: str) -> str:
    return request.build_absolute_uri(relative_path) if request else relative_path


def protected_media_response(*, file_field, disposition: str = "attachment", filename: str | None = None, mime_type: str | None = None) -> HttpResponse:
    if not file_field:
        return HttpResponse(status=404)

    rel_name = (file_field.name or "").lstrip("/")
    p = PurePosixPath(rel_name)
    if not rel_name or ".." in p.parts:
        return HttpResponse(status=400)

    resolved_name = filename or os.path.basename(rel_name) or "file"
    resolved_mime = mime_type or mimetypes.guess_type(rel_name)[0] or "application/octet-stream"

    resp = HttpResponse(b"", content_type=resolved_mime)
    resp["X-Accel-Redirect"] = f"/protected_media/{rel_name}"

    ascii_name = resolved_name.encode("ascii", errors="replace").decode("ascii")
    utf8_name = quote(resolved_name, safe="")
    resp["Content-Disposition"] = (
        f'{disposition}; filename="{ascii_name}"; filename*=UTF-8\'\'{utf8_name}'
    )
    resp.headers.pop("Content-Length", None)
    return resp
