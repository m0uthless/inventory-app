"""core/emails.py — Helper condiviso per l'invio di email HTML brandizzate.

Vedi docs/superpowers/specs/2026-08-25-email-templates-design.md per il
design completo. Il brand (Archie vs Portal) viene rilevato
automaticamente in base al modulo Python da cui viene chiamato
`send_templated_email`, così i moduli applicativi non devono passare
nessun parametro di branding esplicito.
"""
from __future__ import annotations

import inspect
import logging
from email.utils import formataddr

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

_BRAND_DISPLAY_NAME = {
    "archie": "ARCHIE",
    "portal": "Portal Biotron",
}
_BRAND_BASE_TEMPLATE = {
    "archie": "emails/base_archie.html",
    "portal": "emails/base_portal.html",
}


def _brand_for_module(module_name: str) -> str:
    """Ritorna "portal" se `module_name` appartiene al package `portal`
    (cioè è "portal" o inizia per "portal."), altrimenti "archie"
    (default per tutti gli altri moduli applicativi).
    """
    if module_name == "portal" or module_name.startswith("portal."):
        return "portal"
    return "archie"


def send_templated_email(
    template_name: str,
    context: dict,
    subject: str,
    recipient_list: list[str],
    fail_silently: bool = False,
) -> tuple[bool, str | None]:
    """Renderizza `template_name` (un template che fa
    `{% extends base_template %}` + `{% block content %}`) e invia
    un'email HTML con fallback plain-text auto-generato.

    Il brand (Archie vs Portal) è rilevato automaticamente dal modulo
    Python del chiamante diretto: se appartiene al package `portal`
    (nome modulo `"portal"` o che inizia per `"portal."`) usa il layout
    e il display name Portal, altrimenti Archie (default). Non passare
    mai il brand esplicitamente: è per questo che questa funzione va
    sempre chiamata direttamente dal modulo applicativo, non da un altro
    helper intermedio (altrimenti il rilevamento vedrebbe il modulo
    sbagliato).

    Non solleva mai eccezioni: ritorna (True, None) se l'invio riesce,
    (False, "<messaggio errore>") altrimenti. Il chiamante decide come
    reagire (es. mostrarlo in una response API), ma l'invio email non
    blocca mai l'operazione che lo genera.
    """
    caller_frame = inspect.stack()[1].frame
    caller_module = caller_frame.f_globals.get("__name__", "")
    brand = _brand_for_module(caller_module)

    render_context = {
        **context,
        "base_template": _BRAND_BASE_TEMPLATE[brand],
    }

    try:
        html_body = render_to_string(template_name, render_context)
        plain_body = strip_tags(html_body)
        from_email = formataddr((_BRAND_DISPLAY_NAME[brand], settings.DEFAULT_FROM_EMAIL))

        message = EmailMultiAlternatives(
            subject=subject,
            body=plain_body,
            from_email=from_email,
            to=recipient_list,
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=fail_silently)
    except Exception as exc:
        logger.warning("Invio email template=%s a %s fallito: %s", template_name, recipient_list, exc)
        return False, str(exc)

    return True, None
