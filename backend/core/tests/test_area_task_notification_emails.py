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
    resp = _client(me).post(URL, {"title": "Mio", "assigned_to": me.id}, format="json")
    assert resp.status_code == 201
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


def test_email_failure_return_value_ignored(monkeypatch):
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


def test_comment_email_failure_return_value_ignored(monkeypatch):
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


# ── isolamento errori, oggetto, casi limite ───────────────────────────────────

def _boom(**kw):
    raise RuntimeError("boom")


def test_send_raising_does_not_break_create(monkeypatch):
    area = _area()
    actor, assignee = _user(area), _user(area)
    monkeypatch.setattr("core.api.send_templated_email", _boom)
    resp = _client(actor).post(URL, {"title": "Persist", "assigned_to": assignee.id}, format="json")
    assert resp.status_code == 201
    assert AreaTask.objects.filter(title="Persist").exists()


def test_send_raising_does_not_break_patch(monkeypatch):
    area = _area()
    actor, new = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T")
    monkeypatch.setattr("core.api.send_templated_email", _boom)
    resp = _client(actor).patch(f"{URL}{task.id}/", {"assigned_to": new.id}, format="json")
    assert resp.status_code == 200
    task.refresh_from_db()
    assert task.assigned_to_id == new.id


def test_send_raising_does_not_break_comment(monkeypatch):
    area = _area()
    creator, colleague = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=creator)
    monkeypatch.setattr("core.api.send_templated_email", _boom)
    assert _comment(_client(colleague), task).status_code == 201
    assert AreaTaskComment.objects.filter(task=task).count() == 1


@pytest.mark.parametrize("name", ["_notify_comment", "_notify_assignment_change"])
def test_helper_raising_is_logged_and_isolated(monkeypatch, caplog, name):
    from core.api import AreaTaskViewSet
    area = _area()
    actor, other = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=other)
    monkeypatch.setattr(AreaTaskViewSet, name, _boom_method)
    with caplog.at_level("ERROR"):
        if name == "_notify_comment":
            resp = _comment(_client(actor), task)
            assert resp.status_code == 201
        else:
            resp = _client(actor).patch(f"{URL}{task.id}/", {"assigned_to": other.id}, format="json")
            assert resp.status_code == 200
    assert any(r.levelname == "ERROR" and r.exc_info for r in caplog.records)


def _boom_method(self, **kw):
    raise RuntimeError("boom")


def test_subject_is_single_line_when_title_has_newlines():
    area = _area()
    actor, assignee = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="Riga uno\nRiga  due\r\nfine")
    _client(actor).patch(f"{URL}{task.id}/", {"assigned_to": assignee.id}, format="json")
    assert len(mail.outbox) == 1
    subject = mail.outbox[0].subject
    assert "\n" not in subject and "\r" not in subject
    assert subject == "ARCHIE — Task assegnato a te: Riga uno Riga due fine"


def test_comment_with_null_creator_emails_only_the_assignee():
    area = _area()
    assignee, colleague = _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=None, assigned_to=assignee)
    _comment(_client(colleague), task)
    assert [m.to for m in mail.outbox] == [[assignee.email]]


def test_inactive_assignee_and_creator_get_no_email():
    area = _area()
    creator, assignee, colleague = _user(area), _user(area), _user(area)
    task = AreaTask.objects.create(area=area, title="T", created_by=creator, assigned_to=assignee)
    User.objects.filter(pk__in=[creator.pk, assignee.pk]).update(is_active=False)
    _comment(_client(colleague), task)
    assert mail.outbox == []
