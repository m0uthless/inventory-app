"""Email sul workflow delle segnalazioni (ReportRequest / Bug-Feature).

Copre: nuova segnalazione → email a chi può gestirla (non al segnalatore);
cambio stato → email al segnalatore, con motivazione se rifiutata; skip se
è il segnalatore stesso a cambiare lo stato.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.test import APIClient

from feedback.models import ReportRequest, ReportStatus

pytestmark = pytest.mark.django_db

User = get_user_model()


def _make_user(*, admin=False, email="user@example.com"):
    u = User.objects.create_user(username=f"fb-{uuid.uuid4().hex[:8]}", password="pw", email=email)
    if admin:
        u.is_staff = True
        u.is_superuser = True
        u.save(update_fields=["is_staff", "is_superuser"])
    return u


def _client(u):
    c = APIClient()
    c.force_authenticate(user=u)
    return c


def test_new_report_emails_admins_not_creator(api_client):
    admin = _make_user(admin=True, email="admin@example.com")
    author = _make_user(email="author@example.com")

    resp = _client(author).post("/api/feedback-items/", {
        "kind": "bug", "section": "issues", "description": "Non si salva",
    }, format="json")
    assert resp.status_code == 201, resp.data

    assert [m.to for m in mail.outbox] == [["admin@example.com"]]


def test_status_change_emails_creator(api_client):
    admin = _make_user(admin=True, email="admin@example.com")
    author = _make_user(email="author@example.com")
    item = ReportRequest.objects.create(kind="bug", section="issues", description="X", created_by=author)
    mail.outbox.clear()

    resp = _client(admin).patch(f"/api/feedback-items/{item.id}/", {"status": "resolved"}, format="json")
    assert resp.status_code == 200, resp.data

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["author@example.com"]
    assert "resolved" in mail.outbox[0].subject.lower()


def test_rejection_email_includes_reason(api_client):
    admin = _make_user(admin=True, email="admin@example.com")
    author = _make_user(email="author@example.com")
    item = ReportRequest.objects.create(kind="feature", section="wiki", description="Y", created_by=author)
    mail.outbox.clear()

    resp = _client(admin).patch(f"/api/feedback-items/{item.id}/", {
        "status": "rejected", "rejection_reason": "Fuori scope",
    }, format="json")
    assert resp.status_code == 200, resp.data

    assert len(mail.outbox) == 1
    assert "Fuori scope" in mail.outbox[0].alternatives[0][0]


def test_creator_changing_own_report_status_sends_no_self_email(api_client):
    author = _make_user(admin=True, email="author@example.com")  # admin così può cambiare stato
    item = ReportRequest.objects.create(kind="bug", section="issues", description="Z", created_by=author)
    mail.outbox.clear()

    resp = _client(author).patch(f"/api/feedback-items/{item.id}/", {"status": "resolved"}, format="json")
    assert resp.status_code == 200, resp.data

    assert mail.outbox == []
