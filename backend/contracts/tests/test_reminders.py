"""Promemoria di rinnovo dei contratti (spec 2026-11-20): calendario ogni N giorni
dalla data dell'avviso fino alla fine, un'email per contratto (A venditore, Cc
ufficio, senza importi), invio idempotente con recupero di una sola data, campanella
per il venditore utente Archie."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from unittest.mock import patch

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

from contracts import reminders
from contracts.models import Contract, ContractReminder, ContractStatus, Seller
from core.app_settings import set_settings
from core.models import CustomerStatus
from core.testing import make_archie_user
from crm.models import Customer
from notifications.models import Notification, NotificationType

pytestmark = pytest.mark.django_db

D = date


def _customer(name="AUSL Imola"):
    st = CustomerStatus.objects.get_or_create(key="rem_cs", defaults={"label": "Attivo"})[0]
    return Customer.objects.create(name=name, display_name=name, status=st)


def _seller(user=None, email="", name="Luca Ferraresi", **kw):
    return Seller.objects.create(name=name, email=email, user=user, **kw)


def _contract(end=D(2026, 12, 31), days=60, seller=None, customer=None, status=ContractStatus.ATTIVO, **kw):
    return Contract.objects.create(
        customer=customer or _customer(), code=kw.pop("code", f"CT-{uuid.uuid4().hex[:5]}"), title="Assistenza PACS e RIS",
        status=status, start_date=D(2024, 1, 1), end_date=end, reminder_days=days, seller=seller,
        total_value="186000.00", **kw,
    )


@pytest.fixture(autouse=True)
def _office():
    set_settings({"contracts.reminder_emails": "contratti@biotron.it; amministrazione@biotron.it"})


# ── Calendario ─────────────────────────────────────────────────────

def test_schedule_every_10_until_end():
    c = _contract()
    assert reminders.schedule(c, 10) == [D(2026, 11, 1), D(2026, 11, 11), D(2026, 11, 21), D(2026, 12, 1),
                                         D(2026, 12, 11), D(2026, 12, 21), D(2026, 12, 31)]


@pytest.mark.parametrize("status", [ContractStatus.BOZZA, ContractStatus.CHIUSO])
def test_schedule_empty_when_not_active(status):
    assert reminders.schedule(_contract(status=status), 10) == []


def test_due_today_picks_latest_past_date():
    c = _contract()
    assert reminders.due_today(c, 10, D(2026, 10, 31)) is None
    assert reminders.due_today(c, 10, D(2026, 11, 25)) == D(2026, 11, 21)
    assert reminders.due_today(c, 10, D(2026, 12, 31)) == D(2026, 12, 31)
    assert reminders.due_today(c, 10, D(2027, 1, 1)) is None


# ── Destinatari ────────────────────────────────────────────────────

OFFICE = ["contratti@biotron.it", "amministrazione@biotron.it"]


def test_recipients_seller_user_to_office_cc():
    u = make_archie_user(username=f"l_{uuid.uuid4().hex[:5]}", password="pw", email="luca@biotron.it")
    c = _contract(seller=_seller(user=u, email="vecchia@biotron.it"))
    assert reminders.recipients(c, OFFICE) == (["luca@biotron.it"], OFFICE)


def test_recipients_manual_seller_email():
    c = _contract(seller=_seller(email="giulia@studioneri.it"))
    assert reminders.recipients(c, OFFICE) == (["giulia@studioneri.it"], OFFICE)


def test_recipients_without_seller_office_in_to():
    assert reminders.recipients(_contract(), OFFICE) == (OFFICE, [])


def test_recipients_seller_without_email_falls_back_to_office():
    u = make_archie_user(username=f"n_{uuid.uuid4().hex[:5]}", password="pw", email="")
    c = _contract(seller=_seller(user=u, email=""))
    assert reminders.recipients(c, OFFICE) == (OFFICE, [])


def test_inactive_or_trashed_seller_ignored():
    assert reminders.recipients(_contract(seller=_seller(email="x@y.it", is_active=False)), OFFICE) == (OFFICE, [])
    assert reminders.recipients(_contract(seller=_seller(email="x@y.it", deleted_at=timezone.now())), OFFICE) == (OFFICE, [])


def test_recipients_seller_also_in_office_not_duplicated():
    c = _contract(seller=_seller(email="contratti@biotron.it"))
    assert reminders.recipients(c, OFFICE) == (["contratti@biotron.it"], ["amministrazione@biotron.it"])


# ── Invio ──────────────────────────────────────────────────────────

def test_send_due_sends_one_email_per_contract():
    cu = _customer()
    a = _contract(customer=cu, code="CT-A", seller=_seller(email="g@x.it"))
    _contract(customer=cu, code="CT-B")
    assert reminders.send_due(D(2026, 11, 1)) == 2
    assert len(mail.outbox) == 2
    m = next(x for x in mail.outbox if "CT-A" in x.subject)
    assert m.subject == "Rinnovo contratto CT-A · AUSL Imola · scade il 31/12/2026"
    assert m.to == ["g@x.it"] and m.cc == OFFICE
    assert ContractReminder.objects.get(contract=a).due_on == D(2026, 11, 1)


def test_send_due_is_idempotent():
    _contract()
    assert reminders.send_due(D(2026, 11, 1)) == 1
    assert reminders.send_due(D(2026, 11, 1)) == 0
    assert reminders.send_due(D(2026, 11, 5)) == 0
    assert reminders.send_due(D(2026, 11, 11)) == 1
    assert len(mail.outbox) == 2


def test_send_due_catch_up_sends_only_latest():
    c = _contract()
    assert reminders.send_due(D(2026, 12, 5)) == 1
    assert list(ContractReminder.objects.filter(contract=c).values_list("due_on", flat=True)) == [D(2026, 12, 1)]


def test_renewed_contract_stops():
    u = make_archie_user(username=f"r_{uuid.uuid4().hex[:5]}", password="pw", email="r@biotron.it")
    c = _contract(seller=_seller(user=u))
    reminders.send_due(D(2026, 11, 1))
    assert Notification.objects.filter(recipient=u, notification_type=NotificationType.CONTRACT_RENEWAL, is_read=False).count() == 1
    c.end_date = D(2027, 12, 31)
    c.save(update_fields=["end_date"])
    assert reminders.send_due(D(2026, 11, 11)) == 0
    assert not Notification.objects.filter(recipient=u, notification_type=NotificationType.CONTRACT_RENEWAL, is_read=False).exists()


def test_closed_contract_stops():
    c = _contract()
    reminders.send_due(D(2026, 11, 1))
    c.status = ContractStatus.CHIUSO
    c.save(update_fields=["status"])
    assert reminders.send_due(D(2026, 11, 11)) == 0


def test_no_recipients_records_failure():
    set_settings({"contracts.reminder_emails": ""})
    c = _contract()
    assert reminders.send_due(D(2026, 11, 1)) == 0
    r = ContractReminder.objects.get(contract=c)
    assert (r.ok, r.error) == (False, "Nessun destinatario")
    assert len(mail.outbox) == 0
    # Non si ritenta la stessa data.
    assert reminders.send_due(D(2026, 11, 2)) == 0
    assert ContractReminder.objects.filter(contract=c).count() == 1


def test_smtp_failure_records_error():
    c = _contract()
    with patch("contracts.reminders.send_templated_email", return_value=(False, "SMTP giù")):
        assert reminders.send_due(D(2026, 11, 1)) == 0
    r = ContractReminder.objects.get(contract=c)
    assert (r.ok, r.error) == (False, "SMTP giù")


def test_skips_trashed_contract_and_trashed_customer():
    _contract(deleted_at=timezone.now())
    cu = _customer("Cliente cestinato")
    _contract(customer=cu)
    cu.deleted_at = timezone.now()
    cu.save(update_fields=["deleted_at"])
    assert reminders.send_due(D(2026, 11, 1)) == 0


def test_email_has_no_amounts_and_links_contract():
    c = _contract(seller=_seller(email="g@x.it", name="Giulia Neri"))
    reminders.send_due(D(2026, 11, 11))
    body = mail.outbox[0].body
    html = mail.outbox[0].alternatives[0][0]
    for text in (body, html):
        assert "186000" not in text and "186.000" not in text and "€" not in text
    assert f"/contracts?open={c.id}" in html
    assert "Ciao Giulia" in html
    assert "promemoria 2 di 7" in html.lower()
    assert "21/11/2026" in html  # prossimo promemoria
    assert "disdett" not in html.lower()


def test_email_to_office_greets_generically():
    _contract()
    reminders.send_due(D(2026, 12, 31))
    html = mail.outbox[0].alternatives[0][0]
    assert "Buongiorno" in html
    assert "È l'ultimo promemoria" in html or "È l&#x27;ultimo promemoria" in html


def test_bell_only_for_seller_user():
    u = make_archie_user(username=f"b_{uuid.uuid4().hex[:5]}", password="pw", email="b@biotron.it")
    a = _contract(seller=_seller(user=u))
    _contract(seller=_seller(email="manual@x.it", name="Manuale"))
    reminders.send_due(D(2026, 11, 1))
    notes = Notification.objects.filter(notification_type=NotificationType.CONTRACT_RENEWAL)
    assert notes.count() == 1
    n = notes.get()
    assert n.recipient_id == u.id and n.link == f"/contracts?open={a.id}" and n.event_date == D(2026, 12, 31)
    assert n.last_emailed_event_date == D(2026, 12, 31)


# ── Comando ────────────────────────────────────────────────────────

def _run_at(hour, *args):
    fake_now = timezone.make_aware(datetime(2026, 11, 1, hour, 0))
    with patch("contracts.management.commands.send_contract_reminders.timezone.localtime", return_value=fake_now):
        call_command("send_contract_reminders", *args)


def test_command_runs_only_at_8_unless_forced():
    _contract()
    _run_at(7)
    assert len(mail.outbox) == 0
    _run_at(8)
    assert len(mail.outbox) == 1
    ContractReminder.objects.all().delete()
    _run_at(15, "--force")
    assert len(mail.outbox) == 2


def test_command_skips_when_module_off():
    from core.models import ModuleSwitch
    from core.modules import invalidate_cache
    _contract()
    ModuleSwitch.objects.create(key="contracts", enabled=False)
    invalidate_cache()
    _run_at(8)
    assert len(mail.outbox) == 0
