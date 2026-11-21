"""Promemoria di rinnovo dei contratti (spec 2026-11-20).

Per un contratto attivo il calendario parte dalla data dell'avviso di rinnovo
(`Contract.reminder_date`) e prosegue ogni N giorni (impostazione
«contracts.reminder_every_days») fino alla data di fine compresa. Ogni giorno alle
8 (`manage.py send_contract_reminders`) si manda, per ogni contratto, l'ultima
data del calendario già arrivata se non è ancora stata inviata: un fermo del cron
produce un solo invio di recupero. Un'email per contratto: A il venditore, Cc
gli indirizzi dell'ufficio; senza venditore utile, tutto l'ufficio in A. Niente
importi: l'email va anche a indirizzi esterni.

Rinnovare (spostare in avanti la fine) o chiudere il contratto ferma i promemoria.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

from django.db import IntegrityError, transaction

from contracts.models import Contract, ContractReminder, ContractStatus
from core.app_settings import get_setting, office_emails
from core.emails import send_templated_email
from notifications.models import Notification, NotificationType

logger = logging.getLogger(__name__)

NO_RECIPIENTS = "Nessun destinatario"


def schedule(contract: Contract, every: int) -> list[date]:
    """Date dei promemoria: dall'avviso, ogni `every` giorni, fino alla fine compresa."""
    if contract.status != ContractStatus.ATTIVO or every < 1:
        return []
    start = contract.reminder_date
    if start == date.min:
        start = contract.start_date
    out: list[date] = []
    d = start
    while d <= contract.end_date:
        out.append(d)
        d += timedelta(days=every)
    return out


def due_today(contract: Contract, every: int, today: date) -> date | None:
    """Ultima data del calendario già arrivata (None prima dell'avviso o dopo la fine)."""
    if today > contract.end_date:
        return None
    past = [d for d in schedule(contract, every) if d <= today]
    return past[-1] if past else None


def seller_email(contract: Contract) -> str | None:
    """Email del venditore per i promemoria: quella dell'utente Archie se c'è,
    altrimenti quella inserita a mano. None se il venditore non è utilizzabile."""
    s = contract.seller
    if s is None or not s.is_active or s.deleted_at is not None:
        return None
    if s.user_id and s.user.is_active and s.user.email:
        return s.user.email.strip().lower()
    return s.email.strip().lower() or None


def recipients(contract: Contract, office: list[str]) -> tuple[list[str], list[str]]:
    """(A, Cc). Senza venditore utile tutto l'ufficio va in A."""
    email = seller_email(contract)
    if not email:
        return list(office), []
    return [email], [o for o in office if o != email]


def eligible_contracts(today: date) -> list[Contract]:
    """Contratti attivi, non nel cestino, di clienti non nel cestino, dentro la finestra
    dell'avviso di rinnovo (dalla data dell'avviso alla fine compresa)."""
    qs = (
        Contract.objects.filter(
            status=ContractStatus.ATTIVO, deleted_at__isnull=True,
            customer__deleted_at__isnull=True, end_date__gte=today,
        )
        .select_related("customer", "seller", "seller__user", "company")
        .order_by("end_date", "id")
    )
    return [c for c in qs if c.reminder_date <= today]


def _greeting_name(contract: Contract, to: list[str]) -> str | None:
    """Nome per il saluto se l'email va al venditore, altrimenti None («Buongiorno»)."""
    if seller_email(contract) not in to:
        return None
    s = contract.seller
    if s.user_id and s.user.first_name:
        return s.user.first_name
    return (s.name or "").split(" ")[0] or None


def _send(contract: Contract, due: date, to: list[str], cc: list[str], every: int, today: date) -> tuple[bool, str | None]:
    dates = schedule(contract, every)
    position = dates.index(due) + 1 if due in dates else len(dates)
    following = [d for d in dates if d > due]
    customer = contract.customer.display_name or contract.customer.name
    context = {
        "contract_id": contract.id,
        "code": contract.code,
        "title": contract.title,
        "type_label": contract.get_contract_type_display(),
        "company_label": contract.company.label if contract.company_id else "",
        "customer_name": customer,
        "start_date": contract.start_date,
        "end_date": contract.end_date,
        "seller_name": contract.seller.name if contract.seller_id else "",
        "devices_count": contract.devices.filter(deleted_at__isnull=True).count(),
        "days_left": (contract.end_date - today).days,
        "position": position,
        "total": len(dates),
        "next_date": following[0] if following else None,
        "greeting_name": _greeting_name(contract, to),
    }
    return send_templated_email(
        template_name="emails/contract_reminder.html",
        context=context,
        subject=f"Rinnovo contratto {contract.code} · {customer} · scade il {contract.end_date:%d/%m/%Y}",
        recipient_list=to,
        cc=cc,
    )


def _ring_bell(contract: Contract) -> None:
    """Campanella del venditore utente Archie: rimessa non letta a ogni promemoria.
    Nessuna email di riepilogo (last_emailed_event_date già allineata)."""
    s = contract.seller
    if s is None or not s.user_id or not s.user.is_active or not s.is_active or s.deleted_at is not None:
        return
    customer = contract.customer.display_name or contract.customer.name
    Notification.objects.update_or_create(
        recipient_id=s.user_id,
        notification_type=NotificationType.CONTRACT_RENEWAL,
        source_key=str(contract.id),
        defaults={
            "title": f"{contract.code} · {customer}",
            "subtitle": f"Scade il {contract.end_date:%d/%m/%Y}",
            "link": f"/contracts?open={contract.id}",
            "event_date": contract.end_date,
            "last_emailed_event_date": contract.end_date,
            "is_read": False,
            "read_at": None,
        },
    )


def send_due(today: date) -> int:
    """Manda i promemoria dovuti oggi; ritorna quante email sono partite."""
    every = int(get_setting("contracts.reminder_every_days"))
    office = office_emails()
    sent = 0
    eligible = eligible_contracts(today)
    for contract in eligible:
        due = due_today(contract, every, today)
        if due is None or ContractReminder.objects.filter(contract=contract, due_on=due).exists():
            continue
        to, cc = recipients(contract, office)
        if to:
            ok, err = _send(contract, due, to, cc, every, today)
        else:
            ok, err = False, NO_RECIPIENTS
        try:
            with transaction.atomic():
                ContractReminder.objects.create(
                    contract=contract, due_on=due, to="; ".join(to), cc="; ".join(cc), ok=ok, error=err or "",
                )
        except IntegrityError:  # un altro giro ha già registrato la stessa data
            continue
        if not ok:
            logger.warning("Promemoria del contratto %s del %s non inviato: %s", contract.code, due, err)
        else:
            sent += 1
        _ring_bell(contract)
    # Le notifiche non lette dei contratti non più da rinnovare spariscono.
    Notification.objects.filter(notification_type=NotificationType.CONTRACT_RENEWAL, is_read=False).exclude(
        source_key__in=[str(c.id) for c in eligible],
    ).delete()
    return sent
