from __future__ import annotations

import os
from types import ModuleType
from typing import Callable, Iterable

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

_magic: ModuleType | None
try:
    import magic as _magic
    _MAGIC_AVAILABLE = True
except Exception:  # pragma: no cover
    _magic = None
    _MAGIC_AVAILABLE = False


def fmt_upload_size(size: int) -> str:
    value = float(size)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024:
            return f"{value:.0f} {unit}"
        value /= 1024
    return f"{value:.1f} TB"


def _normalized(values: Iterable[str] | None) -> set[str]:
    return {str(v).lower() for v in (values or []) if str(v).strip()}


def _safe_seek(uploaded_file, position: int = 0) -> None:
    try:
        uploaded_file.seek(position)
    except Exception:
        pass


def sniff_mime(uploaded_file) -> str:
    if not _MAGIC_AVAILABLE or _magic is None or uploaded_file is None:
        return ""
    try:
        header = uploaded_file.read(4096)
        _safe_seek(uploaded_file, 0)
        return (_magic.from_buffer(header, mime=True) or "").lower()
    except Exception:
        _safe_seek(uploaded_file, 0)
        return ""


def _extension_of(uploaded_file) -> str:
    name = getattr(uploaded_file, "name", "") or ""
    _root, ext = os.path.splitext(name)
    return ext.lower().lstrip(".")


BLOCKED_UPLOAD_EXTENSIONS = {
    "exe", "bat", "cmd", "com", "msi", "ps1", "sh", "php", "py", "pl", "rb", "jar"
}

BLOCKED_UPLOAD_MIME_TYPES = {
    "application/x-sh",
    "application/x-shellscript",
    "text/x-shellscript",
    "application/x-php",
    "application/x-httpd-php",
    "text/x-php",
    "application/x-python",
    "text/x-python",
    "application/x-ruby",
    "application/x-perl",
    "application/x-msdos-program",
    "application/x-msdownload",
    "application/x-dosexec",
    "application/java-archive",
    "application/x-java-archive",
}


def validate_upload(
    uploaded_file,
    *,
    label: str,
    max_bytes: int,
    allowed_extensions: Iterable[str],
    allowed_content_types: Iterable[str] | None = None,
    strict_real_mime: bool = False,
    blocked_extensions: Iterable[str] | None = None,
    blocked_real_mime_types: Iterable[str] | None = None,
    content_validator: Callable[[object], None] | None = None,
):
    if uploaded_file is None:
        return uploaded_file

    try:
        size = int(getattr(uploaded_file, "size", 0) or 0)
    except Exception:
        size = 0

    if max_bytes and size and size > int(max_bytes):
        max_human = fmt_upload_size(int(max_bytes))
        current_human = fmt_upload_size(size)
        raise serializers.ValidationError(
            f"Il {label} è troppo grande ({current_human}). Dimensione massima consentita: {max_human}."
        )

    allowed_ext = _normalized(allowed_extensions)
    ext = _extension_of(uploaded_file)
    if allowed_ext and ext not in allowed_ext:
        allowed_str = ", ".join(f".{value}" for value in sorted(allowed_ext))
        raise serializers.ValidationError(
            f"Estensione non supportata per il {label}. Formati consentiti: {allowed_str}."
        )

    blocked_ext = _normalized(blocked_extensions) or set(BLOCKED_UPLOAD_EXTENSIONS)
    if ext and ext in blocked_ext:
        raise serializers.ValidationError(
            f"Il tipo di file '.{ext}' non è consentito per motivi di sicurezza."
        )

    allowed_ct = _normalized(allowed_content_types)
    content_type = (getattr(uploaded_file, "content_type", "") or "").lower()
    if allowed_ct and content_type and content_type not in allowed_ct:
        raise serializers.ValidationError(
            f"Content-Type non valido per il {label}: {content_type}."
        )

    real_mime = sniff_mime(uploaded_file)
    blocked_mimes = _normalized(blocked_real_mime_types) or set(BLOCKED_UPLOAD_MIME_TYPES)
    if real_mime and real_mime in blocked_mimes:
        raise serializers.ValidationError(
            f"Il contenuto del {label} è di un tipo non consentito ({real_mime})."
        )

    if strict_real_mime and allowed_ct and real_mime and real_mime not in allowed_ct:
        raise serializers.ValidationError(
            f"Il contenuto del {label} non corrisponde a un formato consentito ({real_mime})."
        )

    if content_validator is not None:
        try:
            content_validator(uploaded_file)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    _safe_seek(uploaded_file, 0)
    return uploaded_file
