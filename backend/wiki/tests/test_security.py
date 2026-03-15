from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from wiki.models import WikiAttachment, WikiPage, WikiPageRevision

pytestmark = pytest.mark.django_db


def _make_superuser():
    User = get_user_model()
    suffix = uuid.uuid4().hex[:6]
    user = User.objects.create_user(username=f"wiki_sec_{suffix}", password="pw")
    user.is_staff = True
    user.is_superuser = True
    user.save(update_fields=["is_staff", "is_superuser"])
    return user


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _make_page(user, *, content: str) -> WikiPage:
    return WikiPage.objects.create(
        title="Security Page",
        slug=f"security-page-{uuid.uuid4().hex[:6]}",
        content_markdown=content,
        created_by=user,
        updated_by=user,
    )


def test_page_render_sanitizes_raw_html_and_scripts():
    user = _make_superuser()
    page = _make_page(
        user,
        content='<p onclick="alert(1)">ciao</p><script>alert(2)</script><a href="javascript:alert(3)">x</a>',
    )
    client = _auth_client(user)

    response = client.get(f"/api/wiki-pages/{page.id}/render/")

    assert response.status_code == 200
    html = response.data["html"]
    assert "<script" not in html
    assert "onclick=" not in html
    assert "javascript:alert" not in html
    assert "<p>ciao</p>" in html


def test_revision_render_sanitizes_raw_html():
    user = _make_superuser()
    page = _make_page(user, content="# Hello")
    rev = WikiPageRevision.objects.create(
        page=page,
        revision_number=1,
        title="Unsafe revision",
        content_markdown='<img src="https://example.com/a.png" onerror="alert(1)"><script>x</script>',
        saved_by=user,
    )
    client = _auth_client(user)

    response = client.get(f"/api/wiki-revisions/{rev.id}/render/")

    assert response.status_code == 200
    html = response.data["html"]
    assert "onerror=" not in html
    assert "<script" not in html
    assert "<img" in html


def test_attachment_serializer_uses_protected_api_urls_and_preview_download_work():
    user = _make_superuser()
    page = _make_page(user, content="safe")
    attachment = WikiAttachment.objects.create(
        page=page,
        filename="manuale.pdf",
        mime_type="application/pdf",
        size_bytes=12,
        file=SimpleUploadedFile("manuale.pdf", b"fake-pdf", content_type="application/pdf"),
    )
    client = _auth_client(user)

    detail = client.get(f"/api/wiki-attachments/{attachment.id}/")
    assert detail.status_code == 200, detail.data
    assert detail.data["file_url"].endswith(f"/api/wiki-attachments/{attachment.id}/preview/")
    assert detail.data["preview_url"].endswith(f"/api/wiki-attachments/{attachment.id}/preview/")
    assert detail.data["download_url"].endswith(f"/api/wiki-attachments/{attachment.id}/download/")
    assert "/api/media/wiki_attachments/" not in detail.data["file_url"]

    preview = client.get(f"/api/wiki-attachments/{attachment.id}/preview/")
    assert preview.status_code == 200
    assert preview["X-Accel-Redirect"].startswith("/protected_media/wiki_attachments/")
    assert preview["Content-Disposition"].startswith("inline;")

    download = client.get(f"/api/wiki-attachments/{attachment.id}/download/")
    assert download.status_code == 200
    assert download["X-Accel-Redirect"].startswith("/protected_media/wiki_attachments/")
    assert download["Content-Disposition"].startswith("attachment;")
