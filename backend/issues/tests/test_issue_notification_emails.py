"""Test suite: email inviate da IssueViewSet su creazione/riassegnazione.

Copre:
- Nuova issue → broadcast a tutti i tecnici assegnabili (is_servicenow_technician
  e non Philips), non ad altri utenti.
- Nuova issue già assegnata → anche email dedicata al nuovo assegnatario.
- Riassegnazione tra due utenti → email a entrambi.
- Primo assegnamento (da vuoto) → solo al nuovo.
- Disassegnazione (a vuoto) → nessuna email.
- Tecnico senza email → skippato silenziosamente (nessun errore).
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.test import APIClient

from core.models import CustomerStatus, UserProfile
from crm.models import Customer

pytestmark = pytest.mark.django_db

User = get_user_model()


def _make_user(*, email="user@example.com", is_technician=False, is_philips=False, is_author=False):
    user = User.objects.create_user(
        username=f"u_{uuid.uuid4().hex[:6]}", password="pw", email=email,
    )
    if is_author:
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.is_servicenow_technician = is_technician
    profile.is_philips = is_philips
    profile.save(update_fields=["is_servicenow_technician", "is_philips"])
    return user


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _customer():
    status = CustomerStatus.objects.get_or_create(
        key=f"active_issue_email_{uuid.uuid4().hex[:6]}", defaults={"label": "Active"}
    )[0]
    return Customer.objects.create(name="Cliente Test", status=status)


def test_new_issue_emails_all_assignable_technicians_only():
    author = _make_user(email="author@example.com", is_author=True)
    tech1 = _make_user(email="tech1@example.com", is_technician=True)
    tech2 = _make_user(email="tech2@example.com", is_technician=True)
    _make_user(email="nontech@example.com", is_technician=False)
    _make_user(email="philips@example.com", is_technician=True, is_philips=True)
    customer = _customer()

    client = _auth_client(author)
    resp = client.post("/api/issues/", {
        "title": "Server giù",
        "customer": customer.id,
    }, format="json")
    assert resp.status_code == 201, resp.data

    recipients = {msg.to[0] for msg in mail.outbox}
    assert recipients == {"tech1@example.com", "tech2@example.com"}


def test_new_issue_created_already_assigned_sends_assignment_email_too():
    author = _make_user(email="author@example.com", is_author=True)
    tech = _make_user(email="tech1@example.com", is_technician=True)
    customer = _customer()

    client = _auth_client(author)
    resp = client.post("/api/issues/", {
        "title": "Server giù",
        "customer": customer.id,
        "assigned_to": tech.id,
    }, format="json")
    assert resp.status_code == 201, resp.data

    # broadcast "nuova issue" + email dedicata di assegnazione, entrambe a tech
    to_tech = [m for m in mail.outbox if m.to == ["tech1@example.com"]]
    assert len(to_tech) == 2
    subjects = {m.subject for m in to_tech}
    assert any("Nuova issue" in s for s in subjects)
    assert any("assegnata a te" in s for s in subjects)


def test_reassignment_between_two_users_emails_both():
    author = _make_user(email="author@example.com", is_author=True)
    tech_a = _make_user(email="a@example.com", is_technician=True)
    tech_b = _make_user(email="b@example.com", is_technician=True)
    customer = _customer()

    from issues.models import Issue
    issue = Issue.objects.create(title="Issue", customer=customer, created_by=author, assigned_to=tech_a)

    mail.outbox.clear()
    client = _auth_client(author)
    resp = client.patch(f"/api/issues/{issue.id}/", {"assigned_to": tech_b.id}, format="json")
    assert resp.status_code == 200, resp.data

    recipients = {msg.to[0]: msg for msg in mail.outbox}
    assert set(recipients.keys()) == {"a@example.com", "b@example.com"}
    assert "assegnata a te" in recipients["b@example.com"].subject
    assert "riassegnata" in recipients["a@example.com"].subject


def test_first_assignment_from_empty_emails_only_new_owner():
    author = _make_user(email="author@example.com", is_author=True)
    tech = _make_user(email="tech1@example.com", is_technician=True)
    customer = _customer()

    from issues.models import Issue
    issue = Issue.objects.create(title="Issue", customer=customer, created_by=author)

    mail.outbox.clear()
    client = _auth_client(author)
    resp = client.patch(f"/api/issues/{issue.id}/", {"assigned_to": tech.id}, format="json")
    assert resp.status_code == 200, resp.data

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["tech1@example.com"]


def test_unassignment_to_empty_sends_no_email():
    author = _make_user(email="author@example.com", is_author=True)
    tech = _make_user(email="tech1@example.com", is_technician=True)
    customer = _customer()

    from issues.models import Issue
    issue = Issue.objects.create(title="Issue", customer=customer, created_by=author, assigned_to=tech)

    mail.outbox.clear()
    client = _auth_client(author)
    resp = client.patch(f"/api/issues/{issue.id}/", {"assigned_to": None}, format="json")
    assert resp.status_code == 200, resp.data

    assert len(mail.outbox) == 0


def test_technician_without_email_is_silently_skipped():
    author = _make_user(email="author@example.com", is_author=True)
    _make_user(email="", is_technician=True)
    tech = _make_user(email="tech1@example.com", is_technician=True)
    customer = _customer()

    client = _auth_client(author)
    resp = client.post("/api/issues/", {
        "title": "Server giù",
        "customer": customer.id,
    }, format="json")
    assert resp.status_code == 201, resp.data

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["tech1@example.com"]
