"""Email della Manutenzione all'ufficio (lista del 21/11, punto 8).

Decisioni di Fede: destinatari gli indirizzi dell'ufficio nelle Impostazioni di Archie,
eventi «in scadenza» (30 giorni) e «scaduto», nel riepilogo delle 8:00. Gli utenti non
ricevono più le scadenze di manutenzione per email (resta la notifica in-app).
Parte solo se c'è qualcosa di nuovo rispetto all'ultimo invio.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from django.core import mail

from core.app_settings import set_settings
from notifications import maintenance_office as mo

pytestmark = pytest.mark.django_db
TODAY = date(2026, 11, 21)


def _row(plan, inv, due, name="PACS Vergato", customer="AUSL Bologna"):
    return {"plan_id": plan, "inventory_id": inv, "next_due_date": due.isoformat(), "inventory_name": name,
            "customer_name": customer, "type_label": "Server", "knumber": "103000170", "plan_title": "Verifica storage"}


@pytest.fixture
def rows(monkeypatch):
    data: list[dict] = []
    monkeypatch.setattr(mo, "_todo_rows", lambda today, until: list(data))
    set_settings({"maintenance.office_emails": "manutenzione@biotron.it; ufficio@biotron.it"})
    return data


def test_sends_one_digest_with_overdue_and_due_soon(rows):
    rows += [_row(1, 10, TODAY - timedelta(days=3)), _row(2, 20, TODAY + timedelta(days=12), name="Storage")]
    assert mo.send_maintenance_office_digest(TODAY) == 1
    assert len(mail.outbox) == 1
    m = mail.outbox[0]
    assert sorted(m.to) == ["manutenzione@biotron.it", "ufficio@biotron.it"]
    assert "1 scadut" in m.subject and "1 in scadenza" in m.subject
    body = m.alternatives[0][0] if m.alternatives else m.body
    assert "PACS Vergato" in body and "Storage" in body and "Scadute" in body


def test_nothing_new_nothing_sent_then_overdue_is_new_again(rows):
    rows += [_row(1, 10, TODAY + timedelta(days=5))]
    assert mo.send_maintenance_office_digest(TODAY) == 1
    assert mo.send_maintenance_office_digest(TODAY + timedelta(days=1)) == 0     # stessa scadenza, niente di nuovo
    assert mo.send_maintenance_office_digest(TODAY + timedelta(days=6)) == 1     # ora è scaduta: novità
    assert len(mail.outbox) == 2


def test_no_office_address_or_module_off_sends_nothing(rows, monkeypatch):
    rows += [_row(1, 10, TODAY)]
    set_settings({"maintenance.office_emails": ""})
    assert mo.send_maintenance_office_digest(TODAY) == 0
    set_settings({"maintenance.office_emails": "manutenzione@biotron.it"})
    monkeypatch.setattr(mo, "is_module_enabled", lambda key: key != "maintenance")
    assert mo.send_maintenance_office_digest(TODAY) == 0
    assert mail.outbox == []


def test_a_plan_that_leaves_and_comes_back_is_new_again(rows):
    rows += [_row(1, 10, TODAY + timedelta(days=5))]
    mo.send_maintenance_office_digest(TODAY)
    rows.clear()
    assert mo.send_maintenance_office_digest(TODAY + timedelta(days=1)) == 0
    rows += [_row(1, 10, TODAY + timedelta(days=40))]                            # riprogrammata, rientra più avanti
    assert mo.send_maintenance_office_digest(TODAY + timedelta(days=15)) == 1
