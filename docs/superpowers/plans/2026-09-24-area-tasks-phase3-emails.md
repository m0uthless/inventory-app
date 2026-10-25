# Task di area, fase 3 (email di assegnazione e commento): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inviare email quando un task di area viene assegnato o riassegnato e quando riceve un commento, con lo stesso pattern già usato per le issue e per Bug/Feature.

**Architecture:** Due metodi helper in `AreaTaskViewSet` (`backend/core/api.py`) chiamati dai punti di scrittura esistenti (`perform_create`, `perform_update`, azione `comments`), che usano `core.emails.send_templated_email` con due nuovi template HTML. Invio sincrono nella request, mai bloccante (la funzione non solleva eccezioni). Le email di scadenza (`refresh_notifications`, `send_deadline_digest`) non cambiano.

**Tech Stack:** Django 5, DRF, pytest (backend email: `django.core.mail.outbox`).

**Spec:** `docs/superpowers/specs/2026-09-24-area-tasks-issue-parity-design.md` (fase 3). Stato: fasi 1 e 2a già in `develop` (`f82103f8`, `3562704c`).

## Global Constraints

- Container backend sempre `backend`, sempre `docker compose -f docker-compose.yml -f docker-compose.dev.yml`. Il container NON monta il codice: copiare i file con `docker compose cp` per i test; per il traffico HTTP reale servono `up -d --build backend cron` (gunicorn non ricarica).
- `send_templated_email` rileva il brand dal modulo Python del chiamante diretto: va chiamata **direttamente** da metodi in `core/api.py` (modulo `core.api` → brand Archie), mai tramite un helper intermedio in un altro modulo.
- L'invio email non deve mai far fallire la richiesta API: `send_templated_email` ritorna `(False, errore)` invece di sollevare; il codice chiamante non deve trasformare un errore in una risposta di errore.
- Destinatari: solo utenti attivi con `email` valorizzata. L'utente che compie l'azione (`request.user`) non riceve mai l'email della propria azione. Niente link cliccabili nel testo (decisione già presa per le email dell'app: solo testo).
- Non cambiare `AreaTask.due_date/status/area` né `refresh_notifications`/`send_deadline_digest`; i test in `notifications/tests/` e `issues/tests/test_issue_notification_emails.py` devono continuare a passare.
- `permission_classes` di `AreaTaskViewSet` invariata.
- Nessun commit, push o rilascio se Fede non lo chiede esplicitamente; ogni task termina con un Checkpoint (`git status`).
- Changelog solo sotto `## [Unreleased]`, intestazioni inglesi.

## Dev loop

Dalla root del repo:

```bash
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
sync() { for f in "$@"; do $DC cp "backend/$f" "backend:/app/$f" || return 1; done; }
```

I percorsi passati a `sync` sono relativi a `backend/`.

## File Structure

| File | Ruolo |
|---|---|
| `backend/core/api.py` | Modifica: helper `_notify_assignment_change` e `_notify_comment`, chiamati da `perform_create`, `perform_update` e dall'azione `comments` |
| `backend/core/templates/emails/area_task_assigned.html` | Nuovo: email di assegnazione/riassegnazione |
| `backend/core/templates/emails/area_task_comment.html` | Nuovo: email di nuovo commento |
| `backend/core/tests/test_area_task_notification_emails.py` | Nuovo: test delle email |
| `CHANGELOG.md` | Modifica |

---

### Task 1: Email di assegnazione e riassegnazione

**Files:**
- Modify: `backend/core/api.py` (`AreaTaskViewSet.perform_create`, `perform_update`, nuovo `_notify_assignment_change`; import di `send_templated_email`)
- Create: `backend/core/templates/emails/area_task_assigned.html`
- Test: `backend/core/tests/test_area_task_notification_emails.py`

**Interfaces:**
- Produces: `AreaTaskViewSet._notify_assignment_change(self, *, old_assigned_to_id, task)`. Regole: nessuna email se il nuovo assegnatario è vuoto o invariato; destinatari = nuovo assegnatario (oggetto "Task assegnato a te: …", `is_new_owner=True`) e, se c'era, il vecchio (oggetto "Task riassegnato: …", `is_new_owner=False`); l'utente che agisce è escluso; solo utenti attivi con email. Contesto del template: `nome_utente`, `task_title`, `area_label`, `priority_label`, `due_date` (data o `None`), `assegnatore` (nome di chi ha agito), `is_new_owner`.

- [ ] **Step 1: Scrivere i test (falliscono)**

Creare `backend/core/tests/test_area_task_notification_emails.py`:

```python
"""Email dei task di area: assegnazione/riassegnazione e nuovo commento.

Assegnazione: email al nuovo assegnatario e (se c'era) al vecchio; nessuna su
disassegnazione o assegnatario invariato; chi agisce non riceve mai l'email
della propria azione; utenti senza email saltati; l'invio non blocca l'API.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import AreaTask, AreaTaskComment, UserProfile

pytestmark = pytest.mark.django_db

User = get_user_model()
URL = "/api/area-tasks/"


def _area(label="Ufficio"):
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label=label)


def _user(area, *, email=None, first_name="", superuser=False):
    username = f"u_{uuid.uuid4().hex[:6]}"
    email = f"{username}@example.com" if email is None else email
    if superuser:
        user = User.objects.create_superuser(username=username, password="pw", email=email, first_name=first_name)
    else:
        user = User.objects.create_user(username=username, password="pw", email=email, first_name=first_name)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return User.objects.get(pk=user.pk)


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _html(msg):
    return msg.alternatives[0][0]


def _to(addr):
    return [m for m in mail.outbox if m.to == [addr]]


# ── assegnazione ──────────────────────────────────────────────────────────────

def test_create_with_assignee_emails_the_assignee_only():
    area = _area("Ufficio Tecnico")
    creator = _user(area, first_name="Fede")
    assignee = _user(area, first_name="Anna")
    resp = _client(creator).post(
        URL, {"title": "Ordine toner", "assigned_to": assignee.id, "priority": "high", "due_date": "2026-10-01"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    assert msg.to == [assignee.email]
    assert msg.subject == "ARCHIE — Task assegnato a te: Ordine toner"
    html = _html(msg)
    assert "Ordine toner" in html and "Ufficio Tecnico" in html
    assert "Alta" in html and "01/10/2026" in html
    assert "Anna" in html


def test_create_assigned_to_self_sends_nothing():
    area = _area()
    me = _user(area)
    _client(me).post(URL, {"title": "Mio", "assigned_to": me.id}, format="json")
    assert mail.outbox == []


def test_first_assignment_emails_only_the_new_assignee():
    area = _area()
    actor, new = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T")
    _client(actor).patch(f"{URL}{task.id}/", {"assigned_to": new.id}, format="json")
    assert [m.to for m in mail.outbox] == [[new.email]]


def test_reassignment_emails_new_and_old_assignee_with_different_subjects():
    area = _area()
    actor, old, new = _user(area), _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="Rapporto", assigned_to=old)
    _client(actor).patch(f"{URL}{task.id}/", {"assigned_to": new.id}, format="json")
    assert len(mail.outbox) == 2
    assert _to(new.email)[0].subject == "ARCHIE — Task assegnato a te: Rapporto"
    assert _to(old.email)[0].subject == "ARCHIE — Task riassegnato: Rapporto"
    assert "Non sei più" in _html(_to(old.email)[0])


def test_actor_who_is_the_old_assignee_is_not_emailed():
    area = _area()
    old, new = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", assigned_to=old)
    _client(old).patch(f"{URL}{task.id}/", {"assigned_to": new.id}, format="json")
    assert [m.to for m in mail.outbox] == [[new.email]]


def test_unassign_sends_nothing():
    area = _area()
    actor, old = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", assigned_to=old)
    _client(actor).patch(f"{URL}{task.id}/", {"assigned_to": None}, format="json")
    assert mail.outbox == []


def test_update_without_assignee_change_sends_nothing():
    area = _area()
    actor, assignee = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", assigned_to=assignee)
    _client(actor).patch(f"{URL}{task.id}/", {"title": "Nuovo titolo"}, format="json")
    _client(actor).patch(f"{URL}{task.id}/", {"assigned_to": assignee.id}, format="json")
    assert mail.outbox == []


def test_assignee_without_email_is_skipped_silently():
    area = _area()
    actor = _user(area)
    silent = _user(area, email="")
    resp = _client(actor).post(URL, {"title": "T", "assigned_to": silent.id}, format="json")
    assert resp.status_code == 201
    assert mail.outbox == []


def test_email_failure_does_not_break_the_request(monkeypatch):
    area = _area()
    actor, assignee = _user(area), _user(area)
    monkeypatch.setattr("core.api.send_templated_email", lambda **kw: (False, "smtp down"))
    resp = _client(actor).post(URL, {"title": "T", "assigned_to": assignee.id}, format="json")
    assert resp.status_code == 201


def test_task_title_is_html_escaped_in_the_email():
    area = _area()
    actor, assignee = _user(area), _user(area)
    _client(actor).post(URL, {"title": "<b>x</b>", "assigned_to": assignee.id}, format="json")
    html = _html(mail.outbox[0])
    assert "&lt;b&gt;x&lt;/b&gt;" in html
    assert "<b>x</b>" not in html


def test_superuser_assigning_in_another_area_emails_the_assignee():
    a1 = _area("Area 1")
    assignee = _user(a1)
    admin = _user(None, superuser=True)
    resp = _client(admin).post(URL, {"title": "T", "area": a1.id, "assigned_to": assignee.id}, format="json")
    assert resp.status_code == 201, resp.data
    assert [m.to for m in mail.outbox] == [[assignee.email]]
```

- [ ] **Step 2: Verificare che falliscano**

```bash
cd /home/fede/inventory-app
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
sync() { for f in "$@"; do $DC cp "backend/$f" "backend:/app/$f" || return 1; done; }
sync core/tests/test_area_task_notification_emails.py
$DC exec backend pytest core/tests/test_area_task_notification_emails.py -q
```

Atteso: i test che si aspettano email falliscono (`assert 0 == 1` sull'outbox); quelli "nessuna email" passano già.

- [ ] **Step 3: Creare il template**

Creare `backend/core/templates/emails/area_task_assigned.html`:

```html
{% extends base_template %}
{% block content %}
<p style="margin:0 0 10px;color:#60736d;font-size:10px;line-height:16px;font-weight:bold;letter-spacing:1.7px;">TASK DI AREA</p>
<h1 class="headline" style="margin:0 0 26px;font-size:29px;line-height:36px;letter-spacing:-0.6px;color:#203734;font-weight:bold;">Aggiornamento assegnazione</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:24px;">Ciao {{ nome_utente }},</p>
{% if is_new_owner %}
<p style="margin:0 0 18px;font-size:15px;line-height:24px;"><strong>{{ assegnatore }}</strong> ti ha assegnato questo task:</p>
{% else %}
<p style="margin:0 0 18px;font-size:15px;line-height:24px;">Non sei più assegnatario di questo task (riassegnato da <strong>{{ assegnatore }}</strong> a un altro collega):</p>
{% endif %}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;margin:8px 0 24px;"><tr><td style="padding:22px;background-color:#f3f7f5;border:1px solid #dce6e1;border-left:3px solid #93aaa0;word-wrap:break-word;overflow-wrap:anywhere;"><strong style="font-size:18px;line-height:26px;color:#203734;">{{ task_title }}</strong><br><span style="font-size:12px;line-height:20px;color:#526760;">Area: {{ area_label }} · Priorità: {{ priority_label }}{% if due_date %} · Scadenza: {{ due_date|date:"d/m/Y" }}{% endif %}</span></td></tr></table>
<p style="margin:0 0 18px;font-size:15px;line-height:24px;">Accedi ad ARCHIE per maggiori dettagli.</p>
{% endblock %}
```

- [ ] **Step 4: Implementare l'helper e i hook**

In `backend/core/api.py` aggiungere l'import (accanto agli altri import `core.*`):

```python
from core.emails import send_templated_email
```

Nella `AreaTaskViewSet`, aggiungere (ad esempio subito prima di `_visible_file_ids`):

```python
    def _notify_assignment_change(self, *, old_assigned_to_id, task):
        """Email solo tra utenti reali: nessuna email su disassegnazione o
        assegnatario invariato; chi compie l'azione non riceve l'email della
        propria azione."""
        new_assigned_to_id = task.assigned_to_id
        if new_assigned_to_id is None or new_assigned_to_id == old_assigned_to_id:
            return

        recipient_ids = {new_assigned_to_id}
        if old_assigned_to_id is not None:
            recipient_ids.add(old_assigned_to_id)
        recipient_ids.discard(self.request.user.id)

        assegnatore = AreaTaskSerializer._display_name(self.request.user)
        for user in User.objects.filter(id__in=recipient_ids, is_active=True).exclude(email=""):
            is_new_owner = user.id == new_assigned_to_id
            send_templated_email(
                template_name="emails/area_task_assigned.html",
                context={
                    "nome_utente": user.first_name or user.username,
                    "task_title": task.title,
                    "area_label": task.area.label,
                    "priority_label": task.get_priority_display(),
                    "due_date": task.due_date,
                    "assegnatore": assegnatore,
                    "is_new_owner": is_new_owner,
                },
                subject=(
                    f"ARCHIE — Task assegnato a te: {task.title}"
                    if is_new_owner
                    else f"ARCHIE — Task riassegnato: {task.title}"
                ),
                recipient_list=[user.email],
            )
```

In `perform_create`, dopo il `log_event(...)` finale (ultima istruzione del metodo) aggiungere:

```python
        self._notify_assignment_change(old_assigned_to_id=None, task=instance)
```

In `perform_update`: subito dopo `instance = serializer.instance` aggiungere

```python
        old_assigned_to_id = instance.assigned_to_id
```

(deve essere letto PRIMA di `serializer.save(...)`, che modifica `serializer.instance`), e dopo il `log_event(...)` finale del metodo aggiungere:

```python
        self._notify_assignment_change(old_assigned_to_id=old_assigned_to_id, task=saved)
```

- [ ] **Step 5: Verificare che passino**

```bash
sync core/api.py core/templates/emails/area_task_assigned.html core/tests/test_area_task_notification_emails.py
$DC exec backend pytest core/tests/test_area_task_notification_emails.py core/tests/test_area_tasks_api.py -q
$DC exec backend pytest notifications/tests issues/tests -q
```

Atteso: tutto PASS. Nota: la funzione `sync` copia anche il template nella cartella `core/templates/emails/` del container.

- [ ] **Step 6: Checkpoint**

```bash
git status --short && git diff --stat
```

---

### Task 2: Email di nuovo commento

**Files:**
- Modify: `backend/core/api.py` (nuovo `_notify_comment`, chiamato dall'azione `comments`)
- Create: `backend/core/templates/emails/area_task_comment.html`
- Test: `backend/core/tests/test_area_task_notification_emails.py` (aggiunte)

**Interfaces:**
- Consumes: `send_templated_email` importata nel Task 1.
- Produces: `AreaTaskViewSet._notify_comment(self, *, task, comment)`. Destinatari = assegnatario e creatore del task, senza duplicati, escluso l'autore del commento, solo utenti attivi con email. Oggetto: "ARCHIE — Nuovo commento sul task: <titolo>". Contesto: `nome_utente`, `task_title`, `area_label`, `autore`, `commento` (testo troncato a 300 caratteri con "…"), `is_assignee`.

- [ ] **Step 1: Scrivere i test (falliscono)**

Aggiungere in fondo a `backend/core/tests/test_area_task_notification_emails.py`:

```python
# ── nuovo commento ────────────────────────────────────────────────────────────

def _comment(client, task, body="Fatto il primo passo"):
    return client.post(f"{URL}{task.id}/comments/", {"body": body}, format="json")


def test_comment_by_assignee_emails_the_creator():
    area = _area("Ufficio")
    creator, assignee = _user(area), _user(area, first_name="Anna")
    task = AreaTask.objects.create(area=area, title="Rapporto", created_by=creator, assigned_to=assignee)
    resp = _comment(_client(assignee), task)
    assert resp.status_code == 201, resp.data
    assert [m.to for m in mail.outbox] == [[creator.email]]
    msg = mail.outbox[0]
    assert msg.subject == "ARCHIE — Nuovo commento sul task: Rapporto"
    assert "Fatto il primo passo" in _html(msg) and "Ufficio" in _html(msg)


def test_comment_by_colleague_emails_assignee_and_creator():
    area = _area()
    creator, assignee, colleague = _user(area), _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=creator, assigned_to=assignee)
    _comment(_client(colleague), task)
    assert {m.to[0] for m in mail.outbox} == {creator.email, assignee.email}
    assert len(mail.outbox) == 2


def test_comment_when_assignee_is_also_creator_sends_a_single_email():
    area = _area()
    owner, colleague = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=owner, assigned_to=owner)
    _comment(_client(colleague), task)
    assert [m.to for m in mail.outbox] == [[owner.email]]


def test_comment_by_creator_without_assignee_sends_nothing():
    area = _area()
    creator = _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=creator)
    _comment(_client(creator), task)
    assert mail.outbox == []


def test_comment_skips_recipients_without_email_and_never_the_author():
    area = _area()
    creator = _user(area, email="")
    assignee = _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=creator, assigned_to=assignee)
    _comment(_client(assignee), task)
    assert mail.outbox == []


def test_comment_body_is_escaped_and_truncated():
    area = _area()
    creator, colleague = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=creator)
    _comment(_client(colleague), task, body="<script>x</script> " + "a" * 400)
    html = _html(mail.outbox[0])
    assert "&lt;script&gt;" in html and "<script>" not in html
    assert "a" * 301 not in html
    assert "…" in html


def test_comment_email_failure_does_not_break_the_request(monkeypatch):
    area = _area()
    creator, colleague = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=creator)
    monkeypatch.setattr("core.api.send_templated_email", lambda **kw: (False, "smtp down"))
    assert _comment(_client(colleague), task).status_code == 201
    assert AreaTaskComment.objects.filter(task=task).count() == 1


def test_other_area_user_cannot_comment_and_no_email_is_sent():
    a1, a2 = _area(), _area()
    creator, outsider = _user(a1), _user(a2)
    task = AreaTask.objects.create(area=a1, title="T", created_by=creator)
    assert _comment(_client(outsider), task).status_code == 403
    assert mail.outbox == []
```

- [ ] **Step 2: Verificare che falliscano**

```bash
sync core/tests/test_area_task_notification_emails.py
$DC exec backend pytest core/tests/test_area_task_notification_emails.py -q -k comment
```

Atteso: i test che si aspettano email falliscono.

- [ ] **Step 3: Creare il template**

Creare `backend/core/templates/emails/area_task_comment.html`:

```html
{% extends base_template %}
{% block content %}
<p style="margin:0 0 10px;color:#60736d;font-size:10px;line-height:16px;font-weight:bold;letter-spacing:1.7px;">TASK DI AREA</p>
<h1 class="headline" style="margin:0 0 26px;font-size:29px;line-height:36px;letter-spacing:-0.6px;color:#203734;font-weight:bold;">Nuovo commento</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:24px;">Ciao {{ nome_utente }},</p>
<p style="margin:0 0 18px;font-size:15px;line-height:24px;"><strong>{{ autore }}</strong> ha commentato il task «{{ task_title }}»{% if is_assignee %}, che è assegnato a te{% endif %}:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;margin:8px 0 24px;"><tr><td style="padding:22px;background-color:#f3f7f5;border:1px solid #dce6e1;border-left:3px solid #93aaa0;word-wrap:break-word;overflow-wrap:anywhere;"><span style="font-size:12px;line-height:20px;color:#526760;">Area: {{ area_label }}</span><p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#203734;">{{ commento|linebreaksbr }}</p></td></tr></table>
<p style="margin:0 0 18px;font-size:15px;line-height:24px;">Accedi ad ARCHIE per leggere la conversazione e rispondere.</p>
{% endblock %}
```

- [ ] **Step 4: Implementare l'helper e il hook**

In `AreaTaskViewSet` (accanto a `_notify_assignment_change`) aggiungere:

```python
    _COMMENT_EXCERPT_CHARS = 300

    def _notify_comment(self, *, task, comment):
        """Email all'assegnatario e al creatore del task (senza duplicati),
        mai all'autore del commento."""
        recipient_ids = {task.assigned_to_id, task.created_by_id} - {None, comment.author_id}
        if not recipient_ids:
            return

        body = comment.body
        limit = self._COMMENT_EXCERPT_CHARS
        excerpt = body if len(body) <= limit else body[: limit - 1].rstrip() + "…"
        autore = AreaTaskSerializer._display_name(comment.author)

        for user in User.objects.filter(id__in=recipient_ids, is_active=True).exclude(email=""):
            send_templated_email(
                template_name="emails/area_task_comment.html",
                context={
                    "nome_utente": user.first_name or user.username,
                    "task_title": task.title,
                    "area_label": task.area.label,
                    "autore": autore,
                    "commento": excerpt,
                    "is_assignee": user.id == task.assigned_to_id,
                },
                subject=f"ARCHIE — Nuovo commento sul task: {task.title}",
                recipient_list=[user.email],
            )
```

Nell'azione `comments`, subito dopo il `log_event(...)` che registra `comment_added` e prima di `return Response(...)`, aggiungere:

```python
        self._notify_comment(task=task, comment=comment)
```

- [ ] **Step 5: Verificare**

```bash
sync core/api.py core/templates/emails/area_task_comment.html core/tests/test_area_task_notification_emails.py
$DC exec backend pytest core/tests/test_area_task_notification_emails.py core/tests/test_area_tasks_api.py -q
$DC exec backend pytest notifications/tests issues/tests -q
```

Atteso: tutto PASS.

- [ ] **Step 6: Checkpoint**

```bash
git status --short && git diff --stat
```

---

### Task 3: Changelog e verifica finale

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Changelog**

Sotto `## [Unreleased]` / `### Added` aggiungere:

```markdown
- I task di area inviano ora email: all'assegnazione o riassegnazione a chi diventa assegnatario e a chi non lo è più, e a ogni nuovo commento all'assegnatario e a chi ha creato il task (mai a chi ha scritto il commento o compiuto l'azione).
```

- [ ] **Step 2: Verifica backend**

```bash
cd /home/fede/inventory-app
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
$DC exec backend pytest -q
$DC exec backend python manage.py check
$DC exec backend python manage.py makemigrations --check --dry-run
```

Atteso: suite completa verde, `no issues`, `No changes detected`.

- [ ] **Step 3: Rebuild e prova sul codice reale**

Le email partono dal traffico HTTP reale solo con il codice nell'immagine (gunicorn non ricarica). Ricostruire:

```bash
$DC up -d --build backend cron
$DC ps --format '{{.Service}} {{.State}} {{.Health}}' | grep -E "^(backend|cron) "
```

Poi, senza inviare email vere (in dev l'SMTP punta a un relay interno), verificare con la shell Django e il backend email in memoria che l'API produca l'email:

```bash
$DC exec -T backend python manage.py shell -c "
from django.test.utils import override_settings
from django.core import mail
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from attendance.models import LeaveArea
from core.models import AreaTask, UserProfile
U = get_user_model()
with override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
    area = LeaveArea.objects.create(key='tmp_mail_check', label='Area prova')
    a = U.objects.create_user('tmp_mail_a', 'a@example.com', 'x'); b = U.objects.create_user('tmp_mail_b', 'b@example.com', 'x')
    for u in (a, b):
        p, _ = UserProfile.objects.get_or_create(user=u); p.leave_area = area; p.save()
    c = APIClient(); c.force_authenticate(U.objects.get(pk=a.pk))
    r = c.post('/api/area-tasks/', {'title': 'Prova email', 'assigned_to': b.id}, format='json')
    print(r.status_code, [(m.to, m.subject) for m in mail.outbox])
    AreaTask.objects.filter(title='Prova email').delete(); U.objects.filter(username__startswith='tmp_mail_').delete(); area.delete()
"
```

Atteso: `201 [(['b@example.com'], 'ARCHIE — Task assegnato a te: Prova email')]`; le righe temporanee vengono eliminate a fine script (verificare che non ne restino).

- [ ] **Step 4: Checkpoint finale**

```bash
git status --short && git diff --stat
```

Atteso: modificati `CHANGELOG.md` e `backend/core/api.py`; nuovi i due template e il file di test. Riferire i risultati a Fede.

---

## Self-Review (spec → task)

| Requisito della spec (fase 3) | Task |
|---|---|
| Email di assegnazione/riassegnazione ai due utenti coinvolti, con lo stesso comportamento di `_notify_assignment_change` | 1 (più esclusione di chi agisce, come in Bug/Feature) |
| Nessuna email su disassegnazione né se chi agisce coincide col destinatario | 1 |
| Email di nuovo commento a assegnatario e creatore, esclusi autore e duplicati | 2 |
| Scadenze invariate; `in_attesa` conta come aperto | Nessuna modifica: già verificato in fase 1 (entrambi i comandi escludono solo `completato`) |
| Ricostruire `backend` e `cron` al deploy | 3 (step 3) |
| Template con mascotte | Fuori: come per i template Bug/Feature e Piano Ferie, la mascotte la aggiunge Fede da Canva (convenzione `cid:` esistente) |

Nomi coerenti tra i task: `_notify_assignment_change(old_assigned_to_id=, task=)` (Task 1, usato da `perform_create` e `perform_update`), `_notify_comment(task=, comment=)` (Task 2), template `emails/area_task_assigned.html` e `emails/area_task_comment.html`, `AreaTaskSerializer._display_name` (già esistente dalla fase 1).
