"""wiki/api/helpers.py — funzioni condivise tra i moduli wiki.

Contiene: _sanitize_html, _is_html, _markdown_to_html, _markdown_to_plain_text,
_attachment_accel_response, _label_for_wiki_link, _path_for_wiki_link,
_slug_is_available, _suggest_available_slug.
"""
# mypy: disable-error-code=annotation-unchecked
from __future__ import annotations

import io
import re
import logging
import mimetypes
from pathlib import PurePosixPath
from html import escape, unescape
from typing import ClassVar

from django.conf import settings
from django.db import models as django_models
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status as drf_status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin
from core.soft_delete import apply_soft_delete_filters
from audit.utils import log_event, to_change_value_for_field
from wiki.models import WikiCategory, WikiPage, WikiAttachment, WikiLink, WikiPageRevision, WikiPageRating, WikiQuery, WikiQueryLanguage


logger = logging.getLogger(__name__)


def _sanitize_html(html: str) -> str:
    """Sanitize HTML to prevent XSS.

    - Strips disallowed tags/attributes.
    - Adds rel/target to links.

    Requires `bleach` (added to requirements).
    """

    import bleach

    allowed_tags = [
        "a",
        "p",
        "br",
        "strong",
        "em",
        "ul",
        "ol",
        "li",
        "pre",
        "code",
        "blockquote",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "img",
    ]

    allowed_attrs = {
        "a": ["href", "title", "rel", "target"],
        "img": ["src", "alt", "title"],
        "code": ["class"],
        "pre": ["class"],
        "th": ["colspan", "rowspan"],
        "td": ["colspan", "rowspan"],
    }

    cleaned = bleach.clean(
        html or "",
        tags=allowed_tags,
        attributes=allowed_attrs,
        protocols=["http", "https", "mailto"],
        strip=True,
    )

    # Linkify plain URLs and make links safer
    cleaned = bleach.linkify(
        cleaned,
        callbacks=[bleach.callbacks.nofollow, bleach.callbacks.target_blank],
        skip_tags=["pre", "code"],
    )

    return cleaned


def _is_html(text: str) -> bool:
    """Heuristic: se inizia con un tag HTML, è già HTML (da Tiptap)."""
    t = (text or "").lstrip()
    return t.startswith("<") and not t.startswith("```")


def _markdown_to_html(md: str) -> str:
    """Render markdown to *sanitized* HTML.
    Se il contenuto è già HTML (es. da editor Tiptap), lo sanitizza direttamente.
    """
    md = md or ""
    if _is_html(md):
        try:
            return _sanitize_html(md)
        except Exception:
            return f"<pre>{escape(md)}</pre>"
    try:
        import markdown as mdlib

        html = mdlib.markdown(
            md,
            extensions=[
                "fenced_code",
                "tables",
            ],
        )
        try:
            return _sanitize_html(html)
        except Exception:
            return f"<pre>{escape(md)}</pre>"
    except Exception:
        return f"<pre>{escape(md)}</pre>"


def _markdown_to_plain_text(md: str) -> str:
    """Best-effort conversion to a readable plain text for PDF."""

    md = md or ""

    # Drop fenced code blocks entirely (keeps PDF compact)
    md = re.sub(r"```[\s\S]*?```", "", md)

    # Inline code
    md = re.sub(r"`([^`]*)`", r"\1", md)

    # Bold/italic markers
    md = re.sub(r"\*\*(.*?)\*\*", r"\1", md)
    md = re.sub(r"__(.*?)__", r"\1", md)
    md = re.sub(r"\*(.*?)\*", r"\1", md)
    md = re.sub(r"_(.*?)_", r"\1", md)

    # Links: [text](url) -> text (url)
    md = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", md)

    # Headings: strip leading #'s
    md = re.sub(r"^\s{0,3}#{1,6}\s+", "", md, flags=re.MULTILINE)

    # List markers
    md = re.sub(r"^\s*[-*+]\s+", "• ", md, flags=re.MULTILINE)
    md = re.sub(r"^\s*\d+\.\s+", "• ", md, flags=re.MULTILINE)

    return md.strip()


def _attachment_accel_response(*, file_field, filename: str, mime_type: str | None = None, disposition: str = "inline") -> HttpResponse:
    if not file_field:
        return HttpResponse(status=404)

    rel_name = (file_field.name or "").lstrip("/")
    p = PurePosixPath(rel_name)
    if not rel_name or ".." in p.parts:
        return HttpResponse(status=400)

    resolved_mime = mime_type or mimetypes.guess_type(rel_name)[0] or "application/octet-stream"
    resp = HttpResponse(b"", content_type=resolved_mime)
    resp["X-Accel-Redirect"] = f"/protected_media/{rel_name}"
    resp["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    resp.headers.pop("Content-Length", None)
    return resp


def _label_for_wiki_link(entity_type: str, entity_id: int) -> str | None:
    if entity_type == "customer":
        from crm.models import Customer

        return Customer.objects.filter(pk=entity_id).values_list("name", flat=True).first()
    if entity_type == "site":
        from crm.models import Site

        return Site.objects.filter(pk=entity_id).values_list("name", flat=True).first()
    if entity_type == "inventory":
        from inventory.models import Inventory

        return Inventory.objects.filter(pk=entity_id).values_list("name", flat=True).first()
    return None


def _path_for_wiki_link(entity_type: str, entity_id: int) -> str | None:
    if entity_type == "customer":
        return f"/customers?open={entity_id}"
    if entity_type == "site":
        return f"/sites?open={entity_id}"
    if entity_type == "inventory":
        return f"/inventory?open={entity_id}"
    return None


def _slug_is_available(*, slug: str, exclude_id: int | None = None) -> bool:
    qs = WikiPage.objects.filter(slug=slug, deleted_at__isnull=True)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return not qs.exists()


def _suggest_available_slug(base_slug: str, *, exclude_id: int | None = None) -> str:
    base = (base_slug or "").strip("-") or "wiki-page"
    if _slug_is_available(slug=base, exclude_id=exclude_id):
        return base
    for suffix in range(2, 1000):
        candidate = f"{base}-{suffix}"
        if _slug_is_available(slug=candidate, exclude_id=exclude_id):
            return candidate
    return f"{base}-{timezone.now().strftime('%Y%m%d%H%M%S')}"


