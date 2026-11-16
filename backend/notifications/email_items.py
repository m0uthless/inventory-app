"""Voci delle email di riepilogo scadenze, raggruppate per giorno.

Il template «Bollettino» (core/templates/emails/) mostra una riga per scadenza
con il riquadro del giorno a sinistra solo sulla prima voce di ogni data.
"""
from __future__ import annotations

from itertools import groupby


def group_by_day(items: list[dict]) -> list[dict]:
    """[{date, kind, where, title, url}] → [{date, items: [...]}] in ordine di data."""
    ordered = sorted(items, key=lambda it: (it["date"], it["title"]))
    return [{"date": day, "items": list(rows)} for day, rows in groupby(ordered, key=lambda it: it["date"])]


def area_task_item(task) -> dict:
    return {
        "date": task.due_date,
        "kind": "Task di area",
        "where": f"Area {task.area.label}" if task.area_id else "",
        "title": task.title,
        "url": f"/tasks?open={task.id}",
    }


def issue_item(issue) -> dict:
    customer = issue.customer_placeholder or (issue.customer.name if issue.customer_id else "")
    return {
        "date": issue.due_date,
        "kind": f"Issue #{issue.id}",
        "where": customer,
        "title": issue.title,
        "url": f"/issues?open={issue.id}",
    }


def notification_item(notif) -> dict:
    is_task = notif.notification_type == "area_task_due"
    return {
        "date": notif.event_date,
        "kind": "Task di area" if is_task else "Manutenzione",
        "where": notif.subtitle,
        "title": notif.title,
        "url": f"/tasks?open={notif.source_key}" if is_task else (notif.link or "/maintenance"),
    }
