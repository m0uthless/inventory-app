"""core/emails.py — Helper condiviso per l'invio di email HTML brandizzate.

Vedi docs/superpowers/specs/2026-08-25-email-templates-design.md per il
design completo. Il brand (Archie vs Portal) viene rilevato
automaticamente in base al modulo Python da cui viene chiamato
`send_templated_email`, così i moduli applicativi non devono passare
nessun parametro di branding esplicito.
"""
from __future__ import annotations

import html
import inspect
import logging
import re
from email.mime.image import MIMEImage
from email.utils import formataddr
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

# I template email referenziano le immagini come
# `<img src="cid:archie-<nome>@biotron.email">` (oggi solo il logo nell'header di
# base_archie.html): vanno allegate all'email come parti MIME inline con quel
# Content-ID, altrimenti il client mostra un'immagine rotta. Inline, e non un
# link remoto, così il logo si vede anche dove le immagini esterne sono bloccate.
# Convenzione: cid `archie-logo@biotron.email` → file `core/templates/assets/archie_logo.png`.
_ASSETS_DIR = Path(__file__).resolve().parent / "templates" / "assets"
_CID_RE = re.compile(r"cid:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)")


def _inline_images_for(html_body: str) -> list[tuple[str, Path]]:
    """(content_id, path) per ogni riferimento `cid:` nell'HTML che trova un
    file corrispondente in `templates/assets/`. Un asset mancante viene
    loggato e saltato: l'email parte comunque (senza quell'immagine)."""
    found: list[tuple[str, Path]] = []
    for cid in dict.fromkeys(_CID_RE.findall(html_body)):
        local_part = cid.split("@", 1)[0]
        path = _ASSETS_DIR / f"{local_part.replace('-', '_')}.png"
        if path.is_file():
            found.append((cid, path))
        else:
            logger.warning("Immagine inline non trovata per cid=%s (atteso: %s)", cid, path)
    return found

# Categoria di ogni email (linguetta sotto l'header, anteprima design-previews/em-base.html):
# il colore tenue del modulo, lo stesso della proposta «Colore per modulo».
_CATEGORY_COLORS = {
    "issue": ("Issue", "#e3eefa", "#1f4f86"),
    "servicenow": ("ServiceNow", "#e8e8f7", "#3b3a8a"),
    "area_task": ("Task di area", "#ece9f8", "#4b3f9a"),
    "leave": ("Piano ferie", "#fbece3", "#86441f"),
    "feedback": ("Bug e feature", "#fbe5e2", "#8f2a21"),
    "deadlines": ("Scadenze", "#e2f2eb", "#175a4c"),
    "account": ("Account", "#edf1f0", "#4a5956"),
    "contracts": ("Contratti", "#efe9f7", "#5b3f8c"),
}
_TEMPLATE_CATEGORY = {
    "issue_created": "issue",
    "issue_assigned": "issue",
    "servicenow_case_assigned": "servicenow",
    "area_task_assigned": "area_task",
    "area_task_comment": "area_task",
    "leave_request_submitted": "leave",
    "leave_request_resolved": "leave",
    "report_request_created": "feedback",
    "report_request_resolved": "feedback",
    "deadline_digest": "deadlines",
    "notifications_digest": "deadlines",
    "password_reset": "account",
    "contract_reminder": "contracts",
    "contract_reminder_test": "contracts",
}


_HEAD_RE = re.compile(r"<head\b.*?</head>", re.S | re.I)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
_BLANK_LINES_RE = re.compile(r"\n\s*\n+")
_LINK_RE = re.compile(r'<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.S | re.I)
_BLOCK_END_RE = re.compile(r"</(?:p|td|h1|h2|div)>|<br\s*/?>", re.I)


def _plain_text(html_body: str) -> str:
    """Versione solo testo dell'email: senza <head> (CSS) né commenti
    condizionali di Outlook, un a capo dopo ogni blocco, l'indirizzo dei
    pulsanti tra parentesi e le righe vuote compattate."""
    body = _COMMENT_RE.sub("", _HEAD_RE.sub("", html_body))
    # Pulsanti e link: nel testo semplice resta l'indirizzo, tra parentesi.
    body = _LINK_RE.sub(lambda m: m.group(2) if m.group(2).strip() in m.group(1) else f"{m.group(2)} ({m.group(1)})", body)
    body = _BLOCK_END_RE.sub("\n", body)
    text = strip_tags(body)
    lines = (line.strip() for line in html.unescape(text).replace("\xa0", " ").splitlines())
    return _BLANK_LINES_RE.sub("\n\n", "\n".join(lines)).strip()


def _email_category(template_name: str) -> dict | None:
    stem = Path(template_name).stem
    key = _TEMPLATE_CATEGORY.get(stem)
    if key is None:
        return None
    label, bg, ink = _CATEGORY_COLORS[key]
    return {"label": label, "bg": bg, "ink": ink}


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
        # Comuni a tutti i template: indirizzo di Archie per i pulsanti,
        # data di oggi (header e riquadro del giorno), categoria (linguetta).
        "app_url": settings.ARCHIE_PUBLIC_URL.rstrip("/"),
        "oggi": timezone.localdate(),
        "categoria": _email_category(template_name),
    }

    try:
        html_body = render_to_string(template_name, render_context)
        plain_body = _plain_text(html_body)
        from_email = formataddr((_BRAND_DISPLAY_NAME[brand], settings.DEFAULT_FROM_EMAIL))

        message = EmailMultiAlternatives(
            subject=subject,
            body=plain_body,
            from_email=from_email,
            to=recipient_list,
        )
        message.attach_alternative(html_body, "text/html")

        inline_images = _inline_images_for(html_body)
        for cid, path in inline_images:
            img = MIMEImage(path.read_bytes())
            img.add_header("Content-ID", f"<{cid}>")
            img.add_header("Content-Disposition", "inline", filename=path.name)
            message.attach(img)
        if inline_images:
            # multipart/related: lega i cid: dell'HTML alle immagini allegate.
            message.mixed_subtype = "related"

        message.send()
    except Exception as exc:
        logger.warning("Invio email template=%s a %s fallito: %s", template_name, recipient_list, exc)
        return False, str(exc)

    return True, None
