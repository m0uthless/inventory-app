"""servicenow/notifications.py — Notifica Microsoft Teams alla creazione di un
nuovo ServiceNow Case.

Usa il webhook "Workflows" di Teams (Power Automate) — l'erede ufficiale dei
vecchi Office 365 Connectors, ritirati da Microsoft il 18-22 maggio 2026.
Nessun account bot da mantenere, nessuna sessione: è un semplice HTTP POST a
un URL configurato lato Teams.

Il fallimento della notifica NON deve mai bloccare la creazione del case: la
richiesta ha un timeout breve ed è avvolta in un try/except con logging.
"""
from __future__ import annotations

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

TEAMS_REQUEST_TIMEOUT_S = 5


def notify_teams_new_case(case) -> None:
    """Invia al webhook Teams configurato un Adaptive Card con i dati
    essenziali del nuovo case. No-op silenzioso se il webhook non è
    configurato (SERVICENOW_TEAMS_WEBHOOK_URL vuoto).
    """
    webhook_url = getattr(settings, "SERVICENOW_TEAMS_WEBHOOK_URL", "")
    if not webhook_url:
        return

    type_value = f"{case.get_category_display()} · {case.case_type.name}" if case.case_type_id else "—"
    facts = [
        {"title": "Account",  "value": case.account or "—"},
        {"title": "Type",     "value": type_value},
    ]

    # Se il case ha un URL esterno associato, il numero nel titolo diventa un
    # link cliccabile (sintassi markdown, supportata nei TextBlock delle
    # Adaptive Card). Altrimenti resta testo semplice.
    case_number_text = f"[{case.number}]({case.external_url})" if case.external_url else case.number

    body = [
        {
            "type": "TextBlock",
            "text": f"Nuovo Caso ServiceNow - {case_number_text}",
            "weight": "Bolder",
            "size": "Medium",
            "wrap": True,
        },
        {
            "type": "TextBlock",
            "text": case.short_description or "(nessuna descrizione)",
            "wrap": True,
            "isSubtle": True,
        },
        {
            "type": "FactSet",
            "facts": facts,
        },
    ]

    # Mention Teams dell'assegnatario, come ultima voce della card. Attivo solo
    # se presente e con email valorizzata (l'email deve coincidere con lo UPN
    # dell'account Microsoft 365 della persona affinché Teams risolva
    # correttamente il mention). Se l'utente non ha email, il blocco viene
    # semplicemente omesso senza errori.
    mention_entities = []
    assignee = getattr(case, "assigned_to", None)
    if assignee is not None and getattr(assignee, "email", ""):
        assignee_name = assignee.get_full_name() or assignee.email
        mention_tag = f"<at>{assignee_name}</at>"
        body.append({
            "type": "TextBlock",
            "text": f"Assegnato a: {mention_tag}",
            "wrap": True,
        })
        mention_entities.append({
            "type": "mention",
            "text": mention_tag,
            "mentioned": {"id": assignee.email, "name": assignee_name},
        })

    card_content = {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.4",
        "body": body,
    }
    if mention_entities:
        card_content["msteams"] = {"entities": mention_entities}

    payload = {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": card_content,
            }
        ],
    }

    try:
        resp = requests.post(webhook_url, json=payload, timeout=TEAMS_REQUEST_TIMEOUT_S)
        if resp.status_code >= 300:
            logger.warning(
                "Notifica Teams per ServiceNowCase #%s fallita: HTTP %s — %s",
                case.pk, resp.status_code, resp.text[:300],
            )
    except requests.RequestException as exc:
        logger.warning("Notifica Teams per ServiceNowCase #%s fallita: %s", case.pk, exc)
