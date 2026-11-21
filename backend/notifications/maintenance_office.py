"""Riepilogo della Manutenzione all'ufficio (decisioni di Fede, 2026-11-21).

Agli indirizzi di «Impostazioni di Archie › Manutenzione» parte, con il riepilogo delle
8:00, un'email con le scadenze scadute e quelle dei prossimi 30 giorni — solo se c'è
qualcosa di nuovo rispetto all'ultimo invio (vedi `OfficeDigestMark`). Gli utenti non
ricevono più queste scadenze per email: resta la notifica in-app.
"""
from __future__ import annotations

from datetime import date, timedelta

from django.utils import timezone

from core.app_settings import maintenance_office_emails
from core.emails import send_templated_email
from core.modules import is_module_enabled
from notifications.email_items import group_by_day
from notifications.models import OfficeDigestMark

WINDOW_DAYS = 30


def _todo_rows(today: date, until: date) -> list[dict]:
    """Righe piano×inventario da fare con scadenza entro `until` (anche quelle già scadute)."""
    from maintenance.api.plans import todo_rows_for_jobs

    until_iso = until.isoformat()
    return [r for r in todo_rows_for_jobs() if r.get("next_due_date") and r["next_due_date"] <= until_iso]


def _item(row: dict, state: str, new: bool) -> dict:
    title = row.get("inventory_name") or row.get("hostname") or f"Inventario #{row.get('inventory_id')}"
    where = " · ".join(p for p in [row.get("customer_name"), row.get("type_label"), row.get("knumber") or row.get("hostname")] if p)
    return {
        "date": date.fromisoformat(row["next_due_date"]),
        "kind": "Scaduta" if state == "overdue" else "In scadenza",
        "where": where,
        "title": title,
        "url": "/maintenance",
        "new": new,
    }


def send_maintenance_office_digest(today: date | None = None) -> int:
    """Invia il riepilogo all'ufficio se c'è qualcosa di nuovo; restituisce le email inviate (0 o 1)."""
    today = today or timezone.localdate()
    if not is_module_enabled("maintenance"):
        return 0
    recipients = maintenance_office_emails()
    if not recipients:
        return 0

    current: dict[str, tuple[str, date, dict]] = {}
    for row in _todo_rows(today, today + timedelta(days=WINDOW_DAYS)):
        due = row.get("next_due_date")
        if not due:
            continue
        due_d = date.fromisoformat(due)
        state = "overdue" if due_d < today else "due"
        current[f"{row['plan_id']}:{row['inventory_id']}"] = (state, due_d, row)

    marks = {m.source_key: m for m in OfficeDigestMark.objects.all()}
    # Uscite dall'elenco: via il segno, così se rientrano sono di nuovo una novità.
    OfficeDigestMark.objects.exclude(source_key__in=current.keys()).delete()
    new_keys = {k for k, (state, due_d, _) in current.items() if k not in marks or marks[k].state != state or marks[k].due_date != due_d}
    if not new_keys:
        return 0

    overdue = [_item(row, s, k in new_keys) for k, (s, _, row) in current.items() if s == "overdue"]
    due_soon = [_item(row, s, k in new_keys) for k, (s, _, row) in current.items() if s == "due"]
    ok, _error = send_templated_email(
        template_name="emails/maintenance_office_digest.html",
        context={
            "scadute": group_by_day(overdue),
            "in_scadenza": group_by_day(due_soon),
            "n_scadute": len(overdue),
            "n_in_scadenza": len(due_soon),
            "n_nuove": len(new_keys),
            "giorni": WINDOW_DAYS,
        },
        subject=f"ARCHIE — Manutenzione: {len(overdue)} scadut{'a' if len(overdue) == 1 else 'e'}, {len(due_soon)} in scadenza",
        recipient_list=recipients,
    )
    if not ok:
        return 0
    for k, (state, due_d, _) in current.items():
        OfficeDigestMark.objects.update_or_create(source_key=k, defaults={"state": state, "due_date": due_d})
    return 1
