"""Lettura della password VPN registrata nell'Audit (lista del 21/11, punto 1).

La password decifrata arriva solo chiedendola (`?reveal=1`, «Mostra» o «Copia»)
e ogni lettura lascia un evento `view_secret` sul record VPN. Il GET normale
dice solo se c'è (`has_password`); senza permesso niente password né evento.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from audit.models import AuditEvent
from core.models import CustomerStatus
from core.testing import make_archie_user
from crm.models import Customer, CustomerVpnAccess

pytestmark = pytest.mark.django_db


def _client(*codenames):
    u = make_archie_user(username=f"vpn_{uuid.uuid4().hex[:6]}", password="pw")
    u.user_permissions.add(*Permission.objects.filter(codename__in=["view_customer", "view_customervpnaccess", *codenames]))
    c = APIClient(); c.force_authenticate(user=u)
    return c, u


def _vpn(password="s3greta"):
    st = CustomerStatus.objects.get_or_create(key="vpn_cs", defaults={"label": "Active"})[0]
    cu = Customer.objects.create(name=f"Vpn_{uuid.uuid4().hex[:6]}", status=st)
    return CustomerVpnAccess.objects.create(customer=cu, utenza="tech", password=password)


def _events(vpn):
    return AuditEvent.objects.filter(action="view_secret", object_id=str(vpn.pk))


def test_reading_the_password_is_audited():
    vpn = _vpn()
    c, u = _client("view_vpn_secrets")
    r = c.get(f"/api/customers/{vpn.customer_id}/vpn/", {"reveal": "1"})
    assert r.status_code == 200 and r.json()["password"] == "s3greta"
    ev = _events(vpn).get()
    assert ev.actor_id == u.id
    assert "s3greta" not in str(ev.changes) + str(ev.metadata)
    assert ev.metadata.get("field") == "password"


def test_no_event_without_permission_or_without_password():
    vpn = _vpn()
    c, _ = _client()
    body = c.get(f"/api/customers/{vpn.customer_id}/vpn/", {"reveal": "1"}).json()
    assert "password" not in body and "has_password" not in body
    empty = _vpn(password="")
    c2, _ = _client("view_vpn_secrets")
    c2.get(f"/api/customers/{empty.customer_id}/vpn/", {"reveal": "1"})
    assert not _events(vpn).exists() and not _events(empty).exists()


def test_plain_get_says_only_whether_there_is_a_password():
    vpn = _vpn()
    c, _ = _client("view_vpn_secrets")
    body = c.get(f"/api/customers/{vpn.customer_id}/vpn/").json()
    assert body["password"] is None and body["has_password"] is True
    assert not _events(vpn).exists()
