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


def _days_summary(rows) -> tuple[list[dict], str]:
    """Righe a mezza giornata → una voce per giorno (mattina/pomeriggio) e il
    totale leggibile ("2,5 giorni"), per il riquadro dei giorni nelle email."""
    by_date: dict = {}
    for a in rows:
        day = by_date.setdefault(a.date, {"date": a.date, "mattina": False, "pomeriggio": False})
        day[a.day_part] = True
    days = []
    for day in sorted(by_date.values(), key=lambda d: d["date"]):
        day["label"] = (
            "Giornata intera" if day["mattina"] and day["pomeriggio"]
            else "Mattina" if day["mattina"] else "Pomeriggio"
        )
        days.append(day)
    halves = sum(int(d["mattina"]) + int(d["pomeriggio"]) for d in days)
    whole, half = divmod(halves, 2)
    number = f"{whole},5" if half else str(whole)
    totale = f"{number} {'giorno' if halves == 2 else 'giorni'}" if halves != 1 else "mezza giornata"
    return days, totale


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
        days, totale = _days_summary(rows)
        for coord in recipients:
            if coord.id == rows[0].user_id:
                continue
            ok, _ = send_templated_email(
                template_name="emails/leave_request_submitted.html",
                context={
                    "nome_utente": _display_name(coord),
                    "richiedente": richiedente.get_full_name() or _display_name(richiedente),
                    "giorni": rows,
                    "giorni_raggruppati": days,
                    "totale": totale,
                    "motivo": rows[0].get_reason_display(),
                    "nota": next((a.note for a in rows if a.note), ""),
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
                "giorni_raggruppati": _days_summary(rows)[0],
            },
            subject=f"ARCHIE — Richiesta ferie {esito}",
            recipient_list=[richiedente.email],
        )
        if ok:
            sent += 1
    return sent
