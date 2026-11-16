"""B-14 (QA 2026-11-15): un file caricato non deve poter eseguire script
quando viene aperto in anteprima dall'origine dell'app."""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from core.media import safe_served_type
from wiki.models import WikiAttachment, WikiPage

pytestmark = pytest.mark.django_db

EVIL_HTML = b"<!DOCTYPE html><html><body><script>alert(document.cookie)</script></body></html>"


def _superuser():
    user = get_user_model().objects.create_user(username=f"wiki_b14_{uuid.uuid4().hex[:6]}", password="pw")
    user.is_staff = True
    user.is_superuser = True
    user.save(update_fields=["is_staff", "is_superuser"])
    return user


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _page(user) -> WikiPage:
    return WikiPage.objects.create(
        title="B14", slug=f"b14-{uuid.uuid4().hex[:6]}", content_markdown="x", created_by=user, updated_by=user
    )


@pytest.mark.parametrize("name", ["qa-evil.html", "evil.htm", "logo.svg", "feed.xml"])
def test_upload_of_executable_markup_is_refused(name):
    user = _superuser()
    page = _page(user)

    resp = _client(user).post(
        "/api/wiki-attachments/upload/",
        {"page": page.pk, "file": SimpleUploadedFile(name, EVIL_HTML, content_type="text/html")},
        format="multipart",
    )

    assert resp.status_code == 400
    assert not WikiAttachment.objects.filter(page=page).exists()


def test_upload_stores_sniffed_mime_not_client_declared():
    user = _superuser()
    page = _page(user)

    resp = _client(user).post(
        "/api/wiki-attachments/upload/",
        {"page": page.pk, "file": SimpleUploadedFile("note.txt", b"solo testo", content_type="text/html")},
        format="multipart",
    )

    assert resp.status_code == 201, resp.data
    assert WikiAttachment.objects.get(page=page).mime_type == "text/plain"


def test_legacy_html_attachment_is_not_served_inline():
    """Allegato già presente nel DB con mime_type text/html (come quello del QA)."""
    user = _superuser()
    attachment = WikiAttachment.objects.create(
        page=_page(user),
        filename="qa-evil.html",
        mime_type="text/html",
        size_bytes=len(EVIL_HTML),
        file=SimpleUploadedFile("qa-evil.html", EVIL_HTML, content_type="text/html"),
    )

    resp = _client(user).get(f"/api/wiki-attachments/{attachment.id}/preview/")

    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/octet-stream"
    assert resp["Content-Disposition"].startswith("attachment;")
    assert resp["X-Content-Type-Options"] == "nosniff"


def test_text_file_declared_as_html_is_served_as_plain_text():
    user = _superuser()
    attachment = WikiAttachment.objects.create(
        page=_page(user),
        filename="note.txt",
        mime_type="text/html",
        size_bytes=len(EVIL_HTML),
        file=SimpleUploadedFile("note.txt", EVIL_HTML, content_type="text/html"),
    )

    resp = _client(user).get(f"/api/wiki-attachments/{attachment.id}/preview/")

    assert resp["Content-Type"] == "text/plain; charset=utf-8"
    assert resp["Content-Disposition"].startswith("inline;")


@pytest.mark.parametrize(
    "name,expected",
    [("rapporto.pdf", "application/pdf"), ("foto.png", "image/png"), ("foto.JPG", "image/jpeg")],
)
def test_pdf_and_images_stay_inline(name, expected):
    assert safe_served_type(f"x/{name}", "inline") == (expected, "inline")


def test_inline_ignores_unsafe_caller_mime_and_svg():
    assert safe_served_type("x/a.png", "inline", "text/html") == ("image/png", "inline")
    assert safe_served_type("x/a.svg", "inline") == ("application/octet-stream", "attachment")
    assert safe_served_type("x/a.html", "attachment") == ("text/html", "attachment")
