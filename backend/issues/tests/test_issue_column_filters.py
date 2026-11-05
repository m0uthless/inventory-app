"""Ricerca per singola colonna su /api/issues/ (riga sotto le intestazioni)."""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CustomerStatus
from crm.models import Customer
from issues.models import Issue

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def ctx():
    admin = User.objects.create_user(username=f"a_{uuid.uuid4().hex[:6]}", password="pw", is_staff=True, is_superuser=True)
    tech = User.objects.create_user(username="lromano", first_name="Luca", last_name="Romano", password="pw")
    st = CustomerStatus.objects.get_or_create(key=f"s_{uuid.uuid4().hex[:6]}", defaults={"label": "Active"})[0]
    bo = Customer.objects.create(name="AUSL Bologna", status=st)
    im = Customer.objects.create(name="AUSL Imola", status=st)
    a = Issue.objects.create(title="Worklist vuota CT 2", customer=bo, created_by=admin, servicenow_id="CS0630988", assigned_to=tech)
    b = Issue.objects.create(title="PACS non raggiungibile", customer=im, created_by=admin, due_date="2026-11-10")
    c = Issue.objects.create(title="Altro", customer=bo, created_by=admin, customer_placeholder="Clinica Esterna")
    client = APIClient()
    client.force_authenticate(admin)
    return client, a, b, c


def ids(client, **params):
    r = client.get("/api/issues/", params)
    assert r.status_code == 200, r.content
    data = r.json()
    return {row["id"] for row in data.get("results", data)}


def test_id_title_servicenow(ctx):
    client, a, b, c = ctx
    assert ids(client, id_q=f"#{a.id}") == {a.id}
    assert ids(client, id_q="abc") == set()
    assert ids(client, title_q="pacs") == {b.id}
    assert ids(client, servicenow_q="0630") == {a.id}


def test_customer_and_assigned(ctx):
    client, a, b, c = ctx
    assert ids(client, customer_q="imola") == {b.id}
    assert ids(client, customer_q="esterna") == {c.id}
    assert ids(client, assigned_q="roman") == {a.id}


def test_has_due(ctx):
    client, a, b, c = ctx
    assert ids(client, has_due="true") == {b.id}
    assert ids(client, has_due="false") == {a.id, c.id}
