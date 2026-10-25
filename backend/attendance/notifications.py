"""attendance/notifications.py — Email per il workflow di approvazione del
Piano Ferie (`Absence`, stati proposta → validata/rifiutata).

Una "richiesta" è un gruppo di righe `Absence` che condividono lo stesso
`request_group` (una selezione = un click nel pannello coordinatore): le
email sono per richiesta, non per riga/mezza giornata.

Riusa `core.emails.send_templated_email` (brand Archie): invio sincrono,
nessuna eccezione propagata.
"""
from __future__ import annotations

from collections import defaultdict

from django.contrib.auth import get_user_model
from django.db.models import Q

from core.emails import send_templated_email

User = get_user_model()

_COORDINATORS = Q(profile__is_leave_coordinator=True) | Q(is_superuser=True)


def _display_name(user) -> str:
    if not user:
        return "—"
    return user.first_name or user.get_full_name() or user.username


def _groups_by_request(absences):
    """{request_group: [righe ordinate per data/fascia]}. Una riga senza
    request_group finisce nel proprio gruppo (chiave = pk)."""
    groups: dict = defaultdict(list)
    for a in absences:
        groups[a.request_group or f"_row_{a.pk}"].append(a)
    for rows in groups.values():
        rows.sort(key=lambda a: (a.date, a.day_part))
    return groups


def notify_leave_request_submitted(absences) -> int:
    """Nuova richiesta ferie (righe in stato PROPOSTA) → email ai coordinatori
    (`profile.is_leave_coordinator`) e ai superuser con email valorizzata.
    Una email per `request_group`. Ritorna il numero di email inviate."""
    proposte = [a for a in absences if a.status == "proposta"]
    if not proposte:
        return 0

    recipients = list(
        User.objects.filter(_COORDINATORS, is_active=True).exclude(email="").distinct()
    )
    if not recipients:
        return 0

    sent = 0
    for rows in _groups_by_request(proposte).values():
        richiedente = rows[0].user
        for coord in recipients:
            if coord.id == rows[0].user_id:
                continue
            ok, _ = send_templated_email(
                template_name="emails/leave_request_submitted.html",
                context={
                    "nome_utente": _display_name(coord),
                    "richiedente": _display_name(richiedente),
                    "giorni": rows,
                    "motivo": rows[0].get_reason_display(),
                },
                subject=f"ARCHIE — Nuova richiesta ferie: {_display_name(richiedente)}",
                recipient_list=[coord.email],
            )
            if ok:
                sent += 1
    return sent


def notify_leave_request_resolved(absences, actor) -> int:
    """Righe validate/rifiutate → email al richiedente, una per `request_group`.
    Se l'attore coincide col richiedente, skip."""
    resolved = [a for a in absences if a.status in ("validata", "rifiutata")]
    if not resolved:
        return 0

    sent = 0
    for rows in _groups_by_request(resolved).values():
        richiedente = rows[0].user
        if not richiedente or not richiedente.email:
            continue
        if actor is not None and actor.id == richiedente.id:
            continue
        esito = "validata" if rows[0].status == "validata" else "rifiutata"
        ok, _ = send_templated_email(
            template_name="emails/leave_request_resolved.html",
            context={
                "nome_utente": _display_name(richiedente),
                "esito": esito,
                "giorni": rows,
            },
            subject=f"ARCHIE — Richiesta ferie {esito}",
            recipient_list=[richiedente.email],
        )
        if ok:
            sent += 1
    return sent
