"""
Test suite: wiki audit coverage + WikiPageRevision restore permission.

Copre:
1. WikiAttachmentViewSet.upload → deve emettere AuditEvent (era assente prima di v0.4.0)
2. WikiPageRevisionViewSet.restore → richiede CanRestoreModelPermission (bug fix v0.4.0)
"""
from __future__ import annotations

import io
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditEvent
from wiki.models import WikiPage, WikiPageRevision

pytestmark = pytest.mark.django_db


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(*, superuser: bool = False):
    User = get_user_model()
    suffix = uuid.uuid4().hex[:6]
    u = User.objects.create_user(username=f"u_{suffix}", password="pw")
    if superuser:
        u.is_staff = True
        u.is_superuser = True
        u.save(update_fields=["is_staff", "is_superuser"])
    return u


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _make_page(user) -> WikiPage:
    slug = f"test-page-{uuid.uuid4().hex[:6]}"
    return WikiPage.objects.create(
        title="Test Page",
        slug=slug,
        content_markdown="# Hello",
        created_by=user,
        updated_by=user,
    )


def _make_revision(page, user) -> WikiPageRevision:
    # revision_number is NOT NULL with no default — must be set explicitly
    last = WikiPageRevision.objects.filter(page=page).order_by("-revision_number").first()
    next_num = (last.revision_number + 1) if last else 1
    return WikiPageRevision.objects.create(
        page=page,
        revision_number=next_num,
        title=page.title,
        content_markdown=page.content_markdown,
        saved_by=user,
    )


# ── WikiAttachment upload audit ────────────────────────────────────────────────

class TestWikiAttachmentUploadAudit:
    def test_upload_emits_audit_event(self):
        """WikiAttachmentViewSet.upload deve creare un AuditEvent action='create'."""
        user = _make_user(superuser=True)
        page = _make_page(user)
        c = _auth_client(user)

        before = AuditEvent.objects.count()

        fake_file = io.BytesIO(b"fake pdf content")
        fake_file.name = "test.pdf"

        r = c.post(
            "/api/wiki-attachments/upload/",
            {"page": page.id, "file": fake_file},
            format="multipart",
        )

        assert r.status_code == 201, r.data
        assert AuditEvent.objects.count() == before + 1

        ev = AuditEvent.objects.order_by("-id").first()
        assert ev.action == "create"


# ── WikiPageRevision restore permission ───────────────────────────────────────

class TestWikiRevisionRestorePermission:
    def test_restore_denied_without_permission(self):
        """Utente senza CanRestoreModelPermission deve ricevere 403."""
        owner = _make_user(superuser=True)
        page = _make_page(owner)
        revision = _make_revision(page, owner)

        no_perm = _make_user(superuser=False)
        c = _auth_client(no_perm)

        r = c.post(f"/api/wiki-revisions/{revision.id}/restore/")
        assert r.status_code == 403, r.data

    def test_restore_allowed_with_change_permission(self):
        """Utente con change_wikipagerevision deve poter fare restore."""
        owner = _make_user(superuser=True)
        page = _make_page(owner)
        revision = _make_revision(page, owner)

        has_perm = _make_user(superuser=False)
        perm = Permission.objects.get(codename="change_wikipagerevision")
        has_perm.user_permissions.add(perm)
        # Django fa caching dei permessi sull'istanza: svuotare esplicitamente
        # _perm_cache e _user_perm_cache per forzare il reload dal DB.
        for attr in ("_perm_cache", "_user_perm_cache"):
            if hasattr(has_perm, attr):
                delattr(has_perm, attr)

        c = _auth_client(has_perm)
        r = c.post(f"/api/wiki-revisions/{revision.id}/restore/")

        # 200 o 404 (se la pagina non è deleted) — in ogni caso non 403
        assert r.status_code != 403, r.data

    def test_restore_allowed_as_superuser(self):
        """Superuser deve sempre poter fare restore."""
        owner = _make_user(superuser=True)
        page = _make_page(owner)
        revision = _make_revision(page, owner)

        c = _auth_client(owner)
        r = c.post(f"/api/wiki-revisions/{revision.id}/restore/")

        assert r.status_code != 403, r.data
