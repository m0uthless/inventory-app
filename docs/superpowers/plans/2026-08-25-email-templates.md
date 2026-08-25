# Sistema di template email condiviso (Archie/Portal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introdurre un helper condiviso per email HTML brandizzate (Archie/Portal), e migrare il primo caso reale (reset password amministrativo) a usarlo.

**Architecture:** Nuovo modulo `core/emails.py` espone `send_templated_email(...)`, che rileva automaticamente il brand (Archie vs Portal) ispezionando il modulo Python chiamante, inietta il layout HTML corretto nel context di rendering Django, genera un fallback plain-text con `strip_tags()`, e invia con `EmailMultiAlternatives`. Due layout base (`core/templates/emails/base_archie.html`, `base_portal.html`) forniscono header/footer brandizzati; ogni app di dominio possiede i propri template evento in `<app>/templates/emails/`.

**Tech Stack:** Django template engine (già configurato con `APP_DIRS: True` in `backend/config/settings.py:112-126`), `django.core.mail.EmailMultiAlternatives`, `django.test` locmem email backend per i test (attivo automaticamente sotto pytest-django).

**Spec:** `docs/superpowers/specs/2026-08-25-email-templates-design.md`

## Global Constraints

- Mittente unico `noreply@biotron.it` per entrambi i brand, con display name diverso (`"ARCHIE"` / `"Portal Biotron"`).
- Rilevamento brand **automatico** in base al modulo chiamante — nessun parametro esplicito ai call site.
- Fallback plain-text **auto-generato** da `strip_tags()`, mai template `.txt` scritto a mano.
- Template email statici nel repo (file `.html`), nessun editor admin, nessuna tabella DB per i contenuti.
- L'invio email non deve mai bloccare l'operazione applicativa che lo genera (stesso principio del codice attuale in `core/admin_users_api.py:588-590`).
- Colori brand reali da riusare nei layout: Archie `#0f766e` (teal, `frontend/src/theme/tokens.ts:175`), Portal `#1A6BB5` (blu, `frontend-portal/src/theme.ts:11`).

---

### Task 1: Cambiare il mittente di default a `noreply@biotron.it`

**Files:**
- Modify: `backend/config/settings.py:34`
- Modify: `.env.dev` (variabile `DEFAULT_FROM_EMAIL`, aggiunta nella sessione precedente)
- Modify: `.env.example:` (riga `DEFAULT_FROM_EMAIL=`, se presente — altrimenti aggiungerla accanto a `MAINTENANCE_ALERT_EMAIL`)

**Interfaces:**
- Consumes: nessuna dipendenza da task precedenti.
- Produces: `settings.DEFAULT_FROM_EMAIL == "noreply@biotron.it"` (default), consumato da Task 3.

- [ ] **Step 1: Aggiorna il default in settings.py**

In `backend/config/settings.py:34`, cambia:
```python
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "archie@biotron.it")
```
in:
```python
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@biotron.it")
```

- [ ] **Step 2: Aggiorna `.env.dev`**

Cambia la riga (aggiunta nella sessione precedente, blocco `# Email / SMTP`):
```
DEFAULT_FROM_EMAIL=archie@biotron.it
```
in:
```
DEFAULT_FROM_EMAIL=noreply@biotron.it
```

- [ ] **Step 3: Aggiorna `.env.example`**

Apri `.env.example`, cerca la sezione email (vicino a `MAINTENANCE_ALERT_EMAIL=` riga 72). Se non esiste già una riga `DEFAULT_FROM_EMAIL=`, aggiungila subito sotto con valore vuoto (segue la convenzione del file: valori vuoti per credenziali/config sito-specifiche):
```
DEFAULT_FROM_EMAIL=
```

- [ ] **Step 4: Ricrea il container backend per applicare la nuova env**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate backend`

- [ ] **Step 5: Verifica la nuova variabile nel container**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend printenv | grep DEFAULT_FROM_EMAIL`
Expected: `DEFAULT_FROM_EMAIL=noreply@biotron.it`

- [ ] **Step 6: Commit**

```bash
git add backend/config/settings.py .env.dev .env.example
git commit -m "chore: cambia mittente email di default a noreply@biotron.it"
```

---

### Task 2: Rilevamento brand (Archie/Portal) — funzione pura testabile

**Files:**
- Create: `backend/core/emails.py`
- Test: `backend/core/tests/test_emails.py`

**Interfaces:**
- Consumes: nessuna dipendenza da task precedenti (indipendente da Task 1).
- Produces: `_brand_for_module(module_name: str) -> str` (ritorna `"portal"` o `"archie"`), consumata da Task 3.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `backend/core/tests/test_emails.py`:
```python
from __future__ import annotations

from core.emails import _brand_for_module


def test_brand_for_module_portal_package_root():
    assert _brand_for_module("portal") == "portal"


def test_brand_for_module_portal_submodule():
    assert _brand_for_module("portal.api") == "portal"
    assert _brand_for_module("portal.signals") == "portal"
    assert _brand_for_module("portal.tests.test_email_brand_detection") == "portal"


def test_brand_for_module_non_portal_defaults_to_archie():
    assert _brand_for_module("core.admin_users_api") == "archie"
    assert _brand_for_module("maintenance.api.plans") == "archie"
    assert _brand_for_module("notifications.management.commands.refresh_notifications") == "archie"


def test_brand_for_module_does_not_match_unrelated_prefix():
    # "portalx" non è il package "portal": non deve fare match per prefisso stringa.
    assert _brand_for_module("portalx.api") == "archie"
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest core/tests/test_emails.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'core.emails'`

- [ ] **Step 3: Implementazione minima**

Crea `backend/core/emails.py`:
```python
"""core/emails.py — Helper condiviso per l'invio di email HTML brandizzate.

Vedi docs/superpowers/specs/2026-08-25-email-templates-design.md per il
design completo. Il brand (Archie vs Portal) viene rilevato
automaticamente in base al modulo Python da cui viene chiamato
`send_templated_email`, così i moduli applicativi non devono passare
nessun parametro di branding esplicito.
"""
from __future__ import annotations


def _brand_for_module(module_name: str) -> str:
    """Ritorna "portal" se `module_name` appartiene al package `portal`
    (cioè è "portal" o inizia per "portal."), altrimenti "archie"
    (default per tutti gli altri moduli applicativi).
    """
    if module_name == "portal" or module_name.startswith("portal."):
        return "portal"
    return "archie"
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest core/tests/test_emails.py -v`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add backend/core/emails.py backend/core/tests/test_emails.py
git commit -m "feat: rilevamento brand Archie/Portal per email da modulo chiamante"
```

---

### Task 3: `send_templated_email` — rendering, fallback testo, invio

**Files:**
- Modify: `backend/core/emails.py`
- Modify: `backend/core/tests/test_emails.py`
- Create: `backend/core/templates/emails/base_archie.html`
- Create: `backend/core/templates/emails/base_portal.html`
- Create: `backend/core/templates/emails/_test_probe.html` (template minimo usato solo dai test di questo task)

**Interfaces:**
- Consumes: `_brand_for_module` (Task 2).
- Produces: `send_templated_email(template_name: str, context: dict, subject: str, recipient_list: list[str], fail_silently: bool = False) -> tuple[bool, str | None]` — ritorna `(True, None)` se inviata, `(False, "<messaggio errore>")` se fallita. Consumata da Task 5.

- [ ] **Step 1: Crea i due layout base**

Crea `backend/core/templates/emails/base_archie.html`:
```html
<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:#0f766e;padding:20px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">ARCHIE</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1a1a1a;font-size:14px;line-height:1.6;">
              {% block content %}{% endblock %}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#f4f6f5;color:#6b7280;font-size:12px;">
              Biotron S.p.A. — ARCHIE, piattaforma interna di gestione asset.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

Crea `backend/core/templates/emails/base_portal.html` (stessa struttura, colore e footer diversi):
```html
<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:#1A6BB5;padding:20px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">Portal Biotron</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1a1a1a;font-size:14px;line-height:1.6;">
              {% block content %}{% endblock %}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#f4f6f5;color:#6b7280;font-size:12px;">
              Biotron S.p.A. — Portal clienti.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

- [ ] **Step 2: Crea un template minimo per i test**

Crea `backend/core/templates/emails/_test_probe.html` (usato solo da `test_emails.py`, non da codice applicativo):
```html
{% extends base_template %}
{% block content %}
<p data-testid="probe">Ciao {{ nome }}, questo è un contenuto di prova.</p>
{% endblock %}
```

- [ ] **Step 3: Scrivi i test che falliscono**

Aggiungi in fondo a `backend/core/tests/test_emails.py`:
```python
from django.core import mail
from django.test import override_settings

from core.emails import send_templated_email


@override_settings(DEFAULT_FROM_EMAIL="noreply@biotron.it")
def test_send_templated_email_from_non_portal_module_uses_archie_brand():
    # Questo test file vive in core/tests/, quindi il modulo chiamante è
    # "core.tests.test_emails" → non inizia per "portal." → brand "archie".
    sent, error = send_templated_email(
        template_name="emails/_test_probe.html",
        context={"nome": "Mario"},
        subject="Test Archie",
        recipient_list=["mario@example.com"],
    )
    assert sent is True
    assert error is None
    assert len(mail.outbox) == 1

    msg = mail.outbox[0]
    assert msg.subject == "Test Archie"
    assert msg.to == ["mario@example.com"]
    assert msg.from_email == "ARCHIE <noreply@biotron.it>"

    html_body = msg.alternatives[0][0]
    assert msg.alternatives[0][1] == "text/html"
    assert "ARCHIE" in html_body
    assert "Ciao Mario, questo è un contenuto di prova." in html_body

    # Fallback plain-text auto-generato da strip_tags(): niente tag HTML,
    # ma il testo del contenuto è presente.
    assert "<p" not in msg.body
    assert "Ciao Mario, questo è un contenuto di prova." in msg.body


def test_send_templated_email_returns_false_and_message_on_failure(monkeypatch):
    def _raise_on_send(self, fail_silently=False):
        raise RuntimeError("SMTP non raggiungibile")

    monkeypatch.setattr(
        "django.core.mail.EmailMultiAlternatives.send", _raise_on_send
    )

    sent, error = send_templated_email(
        template_name="emails/_test_probe.html",
        context={"nome": "Mario"},
        subject="Test Archie",
        recipient_list=["mario@example.com"],
    )
    assert sent is False
    assert error == "SMTP non raggiungibile"
```

- [ ] **Step 4: Esegui i test per verificare che falliscano**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest core/tests/test_emails.py -v`
Expected: FAIL — `ImportError: cannot import name 'send_templated_email' from 'core.emails'`

- [ ] **Step 5: Implementazione**

Aggiungi gli import subito sotto `from __future__ import annotations` in cima a `backend/core/emails.py` (non in fondo al file):
```python
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
```

- [ ] **Step 6: Esegui i test per verificare che passino**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest core/tests/test_emails.py -v`
Expected: PASS (6 test)

- [ ] **Step 7: Commit**

```bash
git add backend/core/emails.py backend/core/tests/test_emails.py backend/core/templates/emails/
git commit -m "feat: send_templated_email con layout brandizzati Archie/Portal e fallback plain-text"
```

---

### Task 4: Test di integrazione brand Portal (chiamata reale da modulo `portal.*`)

**Files:**
- Create: `backend/portal/tests/test_email_brand_detection.py`

**Interfaces:**
- Consumes: `send_templated_email` (Task 3).
- Produces: nessuna nuova interfaccia — task di sola verifica che il rilevamento automatico funzioni davvero quando invocato da un modulo reale sotto `portal.`, non solo dalla funzione pura testata in Task 2.

- [ ] **Step 1: Verifica che la cartella test esista**

Run: `ls backend/portal/tests/` — se non esiste `__init__.py`, crealo vuoto (necessario perché pytest-django scopra i test come parte del package `portal`).

- [ ] **Step 2: Scrivi il test**

Crea `backend/portal/tests/test_email_brand_detection.py`:
```python
"""Verifica che send_templated_email rilevi il brand "portal" quando la
chiamata arriva da un modulo reale sotto il package `portal` (non solo
dalla funzione pura _brand_for_module, testata in core/tests/test_emails.py).
"""
from __future__ import annotations

from django.core import mail
from django.test import override_settings

from core.emails import send_templated_email


@override_settings(DEFAULT_FROM_EMAIL="noreply@biotron.it")
def test_send_templated_email_called_from_portal_package_uses_portal_brand():
    # Questo file vive in backend/portal/tests/, quindi il modulo chiamante
    # è "portal.tests.test_email_brand_detection" → brand "portal".
    sent, error = send_templated_email(
        template_name="emails/_test_probe.html",
        context={"nome": "Cliente"},
        subject="Test Portal",
        recipient_list=["cliente@example.com"],
    )
    assert sent is True
    assert error is None

    msg = mail.outbox[0]
    assert msg.from_email == "Portal Biotron <noreply@biotron.it>"
    html_body = msg.alternatives[0][0]
    assert "Portal Biotron" in html_body
    assert "Biotron S.p.A. — Portal clienti." in html_body
```

- [ ] **Step 3: Esegui il test per verificare che passi**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest backend/portal/tests/test_email_brand_detection.py -v`

Nota: se il comando va eseguito con path relativo al `WORKDIR` del container (es. `pytest portal/tests/test_email_brand_detection.py`), usa quello — verifica il working directory con `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pwd` se il primo tentativo dà "file not found".

Expected: PASS (1 test)

- [ ] **Step 4: Commit**

```bash
git add backend/portal/tests/test_email_brand_detection.py
git commit -m "test: verifica rilevamento brand Portal da modulo reale portal.*"
```

---

### Task 5: Migrare il reset password admin al nuovo helper

**Files:**
- Modify: `backend/core/admin_users_api.py:23-37` (import), `:560-608` (vista `reset_password`)
- Create: `backend/core/templates/emails/password_reset.html`
- Modify: `backend/core/tests/test_admin_users_api.py:141-154` (test esistente `test_reset_password_returns_plaintext_once`)

**Interfaces:**
- Consumes: `send_templated_email` (Task 3).
- Produces: nessuna nuova interfaccia pubblica — questo task chiude la spec (primo caso reale migrato).

- [ ] **Step 1: Crea il template del contenuto**

Crea `backend/core/templates/emails/password_reset.html`:
```html
{% extends base_template %}
{% block content %}
<p>Ciao {{ nome_utente }},</p>
<p>La tua password ARCHIE è stata reimpostata da un amministratore.</p>
<p style="margin:20px 0;padding:16px;background-color:#f4f6f5;border-radius:6px;font-size:16px;font-weight:bold;letter-spacing:0.5px;">
  {{ nuova_password }}
</p>
<p>Ti consigliamo di cambiarla al primo accesso.</p>
{% endblock %}
```

- [ ] **Step 2: Aggiorna il test esistente per verificare anche il contenuto email**

In `backend/core/tests/test_admin_users_api.py`, sostituisci `test_reset_password_returns_plaintext_once` (righe 141-154) con:
```python
def test_reset_password_returns_plaintext_once():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    old_hash = target.password

    resp = c.post(f"/api/admin-users/{target.id}/reset-password/")
    assert resp.status_code == 200
    body = resp.json()
    assert "password" in body and len(body["password"]) >= 10

    target.refresh_from_db()
    assert target.password != old_hash
    assert target.check_password(body["password"])


def test_reset_password_sends_branded_email_with_new_password():
    from django.core import mail

    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()

    resp = c.post(f"/api/admin-users/{target.id}/reset-password/")
    body = resp.json()

    assert body["email_sent"] is True
    assert body["email_error"] is None
    assert len(mail.outbox) == 1

    msg = mail.outbox[0]
    assert msg.to == [target.email]
    assert msg.from_email == "ARCHIE <noreply@biotron.it>"
    html_body = msg.alternatives[0][0]
    assert body["password"] in html_body
    assert body["password"] in msg.body  # fallback plain-text
```

Nota: `_make_user` (riga 27-34 dello stesso file) imposta già `email="test@example.com"` di default — nessuna modifica necessaria lì.

- [ ] **Step 3: Esegui i test per verificare che il secondo fallisca**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest core/tests/test_admin_users_api.py -k reset_password -v`
Expected: `test_reset_password_returns_plaintext_once` PASS (comportamento invariato), `test_reset_password_sends_branded_email_with_new_password` FAIL (l'email non è ancora brandizzata/HTML, `msg.alternatives` è vuoto)

- [ ] **Step 4: Migra la vista**

In `backend/core/admin_users_api.py`, sostituisci l'import a riga 37:
```python
from django.core.mail import send_mail
```
con:
```python
from core.emails import send_templated_email
```

Sostituisci il blocco `if user.email:` dentro `reset_password` (righe ~573-590):
```python
        email_sent = False
        email_error = None
        if user.email:
            try:
                send_mail(
                    subject="ARCHIE — Password reimpostata",
                    message=(
                        f"Ciao {user.first_name or user.username},\n\n"
                        f"La tua password ARCHIE è stata reimpostata da un amministratore.\n"
                        f"Nuova password temporanea: {new_password}\n\n"
                        f"Ti consigliamo di cambiarla al primo accesso."
                    ),
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None) or "archie@biotron.it",
                    recipient_list=[user.email],
                    fail_silently=False,
                )
                email_sent = True
            except Exception as exc:  # SMTP non ancora configurato: non bloccare il reset
                email_error = str(exc)
                logger.warning("Invio email reset password fallito per %s: %s", user.username, exc)
```
con:
```python
        email_sent = False
        email_error = None
        if user.email:
            email_sent, email_error = send_templated_email(
                template_name="emails/password_reset.html",
                context={
                    "nome_utente": user.first_name or user.username,
                    "nuova_password": new_password,
                },
                subject="ARCHIE — Password reimpostata",
                recipient_list=[user.email],
            )
```

Nota: `send_templated_email` logga già internamente il warning in caso di errore (Task 3, Step 5) — non serve ripetere `logger.warning` qui. Se dopo questa modifica `settings` non è più usato altrove nel file, lascia l'import invariato (è quasi certamente usato anche altrove nel file per altri scopi — verifica con `grep -n "settings\." backend/core/admin_users_api.py` prima di rimuoverlo).

- [ ] **Step 5: Esegui i test per verificare che passino**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest core/tests/test_admin_users_api.py -k reset_password -v`
Expected: PASS (2 test)

- [ ] **Step 6: Esegui l'intera suite core per verificare che nulla si sia rotto**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest core/ -q`
Expected: tutti i test PASS (nessuna regressione)

- [ ] **Step 7: Commit**

```bash
git add backend/core/admin_users_api.py backend/core/templates/emails/password_reset.html backend/core/tests/test_admin_users_api.py
git commit -m "feat: migra reset password admin a email HTML brandizzata via send_templated_email"
```

---

### Task 6: Verifica manuale end-to-end (invio reale via SMTP dev)

**Files:** nessuno (solo verifica manuale, nessun file da modificare).

**Interfaces:**
- Consumes: tutto quanto sopra.
- Produces: conferma che il sistema funziona end-to-end con l'SMTP dev reale già configurato in `.env.dev` (vsmtpdext.internal.ausl.bologna.it:465).

- [ ] **Step 1: Verifica lo stato delle migration in sospeso (non correlato a questo lavoro, ma bloccante per il container se non risolto — vedi nota)**

Nota: se durante una sessione precedente era emerso che `notifications.0001_initial` risultava non applicata nel DB dev, verificarne lo stato prima di procedere non è necessario per questo task (email/reset password non toccano quell'app), ma se vuoi allinearlo comunque: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python manage.py showmigrations notifications`.

- [ ] **Step 2: Invia un reset password reale a un utente di test con email valida**

Via Django shell, crea/aggiorna un utente di test con la tua email e chiama la vista direttamente per verificare l'intero flusso HTML:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python manage.py shell -c "
from core.emails import send_templated_email
sent, error = send_templated_email(
    template_name='emails/password_reset.html',
    context={'nome_utente': 'Federico', 'nuova_password': 'Test-Preview-Only'},
    subject='ARCHIE — Test template email reset password',
    recipient_list=['federico.mutuale@biotron.it', 'fede.mutuale@gmail.com'],
)
print('sent:', sent, 'error:', error)
"
```
Expected: `sent: True error: None`

- [ ] **Step 3: Controlla visivamente l'email ricevuta**

Apri le due caselle (federico.mutuale@biotron.it, fede.mutuale@gmail.com) e verifica: header teal "ARCHIE", corpo con nome e password evidenziata, footer Biotron, mittente visualizzato come "ARCHIE <noreply@biotron.it>".

- [ ] **Step 4: Nessun commit per questo task** (verifica manuale, nessuna modifica al repo).

---

## Note per chi esegue il piano

- Tutti i comandi `pytest` vanno lanciati dentro il container `backend` col pattern a doppio file compose descritto in `CLAUDE.md` — non esiste un venv locale.
- Il backend Django test runner (via pytest-django) sostituisce automaticamente `EMAIL_BACKEND` con il backend `locmem` durante i test: nessuna email reale parte durante `pytest`, e `django.core.mail.outbox` è sempre disponibile per le assertion.
- Dopo Task 1 e prima di Task 6, ricordarsi che il container `backend` deve essere stato ricreato (`--force-recreate`) per caricare `DEFAULT_FROM_EMAIL=noreply@biotron.it` — se il container non viene ricreato dopo Task 1, il test manuale di Task 6 mostrerà ancora `archie@biotron.it` come mittente pur avendo il codice corretto.
