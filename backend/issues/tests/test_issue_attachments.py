"""Allegati delle issue (spec 2026-11-20): caricamento diretto, download solo via API,
stessi permessi della issue (visibilità e sola lettura per area), Audit."""
from __future__ import annotations

import os
import uuid
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from audit.models import AuditEvent
from core.models import CustomerStatus, UserProfile
from core.testing import make_archie_user
from crm.models import Customer
from issues.models import Issue, IssueAttachment

pytestmark = pytest.mark.django_db
User = get_user_model()

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89" + b"\x00" * 40
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def _area():
    return LeaveArea.objects.create(key=f"a_{uuid.uuid4().hex[:6]}", label="Area")


def _user(area=None, codenames=None):
    u = make_archie_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")
    perms = Permission.objects.filter(content_type__app_label="issues")
    if codenames is not None:
        perms = perms.filter(codename__in=codenames)
    u.user_permissions.add(*perms.exclude(codename="view_all_areas"))
    profile, _ = UserProfile.objects.get_or_create(user=u)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return User.objects.get(pk=u.pk)


def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _issue(area=None, status="open"):
    st = CustomerStatus.objects.get_or_create(key="att_cs", defaults={"label": "Attivo"})[0]
    author = User.objects.create_superuser(username=f"su_{uuid.uuid4().hex[:6]}", password="pw", email="s@x.it")
    return Issue.objects.create(title="Worklist vuota", customer=Customer.objects.create(name="Cliente", status=st), created_by=author, area=area, status=status)


def _png(name="schermata.png"):
    return SimpleUploadedFile(name, PNG, content_type="image/png")


def _url(issue, suffix=""):
    return f"/api/issues/{issue.pk}/attachments/{suffix}"


def test_upload_and_list():
    issue = _issue(); c = _client(_user())
    resp = c.post(_url(issue), {"file": _png()}, format="multipart")
    assert resp.status_code == 201, resp.data
    rows = c.get(_url(issue)).json()
    assert len(rows) == 1
    r = rows[0]
    assert r["name"] == "schermata.png" and r["from_task"] is False and r["size"] == len(PNG)
    assert r["url"] == f"/api/issues/{issue.pk}/attachments/{r['id']}/download/"
    assert r["uploaded_by_name"]


def test_upload_multiple_files():
    issue = _issue(); c = _client(_user())
    resp = c.post(_url(issue), {"file": [_png("a.png"), SimpleUploadedFile("b.pdf", PDF, content_type="application/pdf")]}, format="multipart")
    assert resp.status_code == 201, resp.data
    assert sorted(a.name for a in IssueAttachment.objects.filter(issue=issue)) == ["a.png", "b.pdf"]


def test_download_serves_via_accel_redirect():
    issue = _issue(); c = _client(_user())
    att_id = c.post(_url(issue), {"file": _png()}, format="multipart").json()[0]["id"]
    resp = c.get(_url(issue, f"{att_id}/download/"))
    assert resp.status_code == 200
    assert resp["X-Accel-Redirect"].startswith(f"/protected_media/issue_attachments/{issue.pk}/")


def test_delete_removes_file_from_disk():
    issue = _issue(); c = _client(_user())
    att_id = c.post(_url(issue), {"file": _png()}, format="multipart").json()[0]["id"]
    path = IssueAttachment.objects.get(pk=att_id).file.path
    assert os.path.exists(path)
    assert c.delete(_url(issue, f"{att_id}/")).status_code == 204
    assert not IssueAttachment.objects.filter(pk=att_id).exists()
    assert not os.path.exists(path)


def test_rejects_bad_extension():
    issue = _issue()
    resp = _client(_user()).post(_url(issue), {"file": SimpleUploadedFile("virus.exe", b"MZ\x90\x00", content_type="application/octet-stream")}, format="multipart")
    assert resp.status_code == 400


def test_rejects_fake_png():
    issue = _issue()
    resp = _client(_user()).post(_url(issue), {"file": SimpleUploadedFile("foto.png", b"MZ\x90\x00" + b"\x00" * 64, content_type="image/png")}, format="multipart")
    assert resp.status_code == 400


def test_rejects_over_limit():
    issue = _issue()
    with mock.patch("issues.api.ATTACHMENT_MAX_BYTES", 10):
        resp = _client(_user()).post(_url(issue), {"file": _png()}, format="multipart")
    assert resp.status_code == 400


def test_other_area_is_404_for_list_download_upload():
    a, b = _area(), _area()
    issue = _issue(area=b)
    owner = _client(_user(b))
    att_id = owner.post(_url(issue), {"file": _png()}, format="multipart").json()[0]["id"]
    other = _client(_user(a))
    assert other.get(_url(issue)).status_code == 404
    assert other.get(_url(issue, f"{att_id}/download/")).status_code == 404
    assert other.post(_url(issue), {"file": _png()}, format="multipart").status_code == 404


def test_read_only_user_cannot_upload_or_delete():
    issue = _issue()
    att_id = _client(_user()).post(_url(issue), {"file": _png()}, format="multipart").json()[0]["id"]
    ro = _client(_user(codenames=["view_issue"]))
    assert ro.get(_url(issue)).status_code == 200
    assert ro.post(_url(issue), {"file": _png()}, format="multipart").status_code == 403
    assert ro.delete(_url(issue, f"{att_id}/")).status_code == 403


def test_closed_issue_is_read_only():
    issue = _issue(status="closed")
    resp = _client(_user()).post(_url(issue), {"file": _png()}, format="multipart")
    assert resp.status_code == 400
    assert "chiusa" in str(resp.data).lower()


def test_audit_on_upload_and_delete():
    issue = _issue(); c = _client(_user())
    att_id = c.post(_url(issue), {"file": _png()}, format="multipart").json()[0]["id"]
    c.delete(_url(issue, f"{att_id}/"))
    evs = list(AuditEvent.objects.filter(object_id=str(issue.pk), changes__has_key="allegati").order_by("id"))
    assert [e.changes["allegati"] for e in evs] == [{"from": None, "to": "schermata.png"}, {"from": "schermata.png", "to": None}]


def test_attachments_count_in_detail():
    issue = _issue(); c = _client(_user())
    c.post(_url(issue), {"file": [_png("a.png"), _png("b.png")]}, format="multipart")
    assert c.get(f"/api/issues/{issue.pk}/").json()["attachments_count"] == 2
