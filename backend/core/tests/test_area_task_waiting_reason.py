"""Motivo dell'attesa sui Task di area, come sulle Issue (todo del restyle).

Obbligatorio quando si mette un task «In attesa»; uscendo dall'attesa si svuota.
I task già in attesa senza motivo restano modificabili negli altri campi.
"""
from __future__ import annotations

import pytest

from core.models import AreaTask
from core.tests.test_area_tasks_api import URL, _area, _client, _user

pytestmark = pytest.mark.django_db


def test_putting_on_hold_requires_a_reason():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    c = _client(_user(area))
    r = c.patch(f"{URL}{task.id}/", {"status": "in_attesa"}, format="json")
    assert r.status_code == 400 and "waiting_reason" in r.data
    r = c.patch(f"{URL}{task.id}/", {"status": "in_attesa", "waiting_reason": "cliente"}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["waiting_reason"] == "cliente" and r.data["waiting_reason_label"] == "Cliente"


def test_leaving_hold_clears_the_reason():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T", status="in_attesa", waiting_reason="philips")
    r = _client(_user(area)).patch(f"{URL}{task.id}/", {"status": "in_corso"}, format="json")
    assert r.status_code == 200
    task.refresh_from_db()
    assert task.waiting_reason == ""


def test_old_task_on_hold_without_reason_can_still_be_edited():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T", status="in_attesa")
    r = _client(_user(area)).patch(f"{URL}{task.id}/", {"title": "Nuovo titolo"}, format="json")
    assert r.status_code == 200, r.data
