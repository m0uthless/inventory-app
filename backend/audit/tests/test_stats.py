"""Restyle Audit: azione `stats` e filtri `actions` / `actor_null`."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from audit.models import AuditEvent


def _ev(action, actor=None, minutes_ago=0, **kw):
    e = AuditEvent.objects.create(action=action, actor=actor, **kw)
    if minutes_ago:
        AuditEvent.objects.filter(pk=e.pk).update(created_at=timezone.now() - timedelta(minutes=minutes_ago))
    return e


@pytest.mark.django_db
def test_stats_counts(api_client, superuser):
    User = get_user_model()
    nic = User.objects.create_user(username="nic", password="x", first_name="Nicole", last_name="Spazzoli")
    _ev("update", nic)
    _ev("create", nic)
    _ev("login", nic)
    _ev("delete", superuser, minutes_ago=60 * 24 * 3)
    _ev("delete", superuser, minutes_ago=60 * 24 * 9)  # fuori dai 7 giorni
    _ev("create", None, object_repr="CS001")  # sistema
    for _ in range(3):
        _ev("login_failed", None, object_repr="root", ip_address="10.0.0.7", metadata={"username": "root"})
    _ev("login_failed", None, object_repr="fede", ip_address="10.0.0.9", metadata={"username": "fede"}, minutes_ago=60 * 30)  # oltre 24 ore

    api_client.force_authenticate(user=superuser)
    d = api_client.get("/api/audit-events/stats/").data

    assert d["today"]["changes"] == 3  # update, create (nic) + create sistema
    assert d["today"]["total"] >= 7
    assert len(d["days"]) == 14 and d["days"][-1]["date"] == timezone.localdate().isoformat()
    assert d["failed_24h"]["count"] == 3
    assert d["failed_24h"]["top"] == {"username": "root", "ip": "10.0.0.7", "count": 3}
    assert d["deleted_7d"] == 1
    assert d["top_modifiers_7d"][0] == {"id": nic.id, "name": "Nicole Spazzoli", "count": 2}
    assert d["system_7d"] == 1


@pytest.mark.django_db
def test_filters_actions_and_actor_null(api_client, superuser):
    _ev("update", superuser)
    _ev("delete", superuser)
    _ev("login", superuser)
    _ev("create", None)
    api_client.force_authenticate(user=superuser)

    res = api_client.get("/api/audit-events/", {"actions": "update,delete"}).data
    rows = res["results"] if isinstance(res, dict) else res
    assert sorted(r["action"] for r in rows) == ["delete", "update"]
    assert rows[0]["actor_name"]

    res = api_client.get("/api/audit-events/", {"actor_null": "true"}).data
    rows = res["results"] if isinstance(res, dict) else res
    assert [r["action"] for r in rows] == ["create"]
    assert rows[0]["actor_name"] is None


@pytest.mark.django_db
def test_filter_ip(api_client, superuser):
    _ev("login_failed", None, ip_address="10.0.0.7")
    _ev("login_failed", None, ip_address="10.0.0.8")
    api_client.force_authenticate(user=superuser)
    res = api_client.get("/api/audit-events/", {"ip": "10.0.0.7"}).data
    rows = res["results"] if isinstance(res, dict) else res
    assert [r["ip_address"] for r in rows] == ["10.0.0.7"]
