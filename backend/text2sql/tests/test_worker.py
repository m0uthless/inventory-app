"""Lavoratore in coda del generatore SQL e notifica a risposta pronta."""
from __future__ import annotations

import uuid
from unittest import mock

import pytest
from django.contrib.auth import get_user_model

from notifications.models import Notification
from text2sql import worker
from text2sql.engine import EngineError
from text2sql.models import Text2SqlRequest

pytestmark = pytest.mark.django_db

User = get_user_model()
RESULT = {"sql": "-- READ | x\nSELECT 1 FROM dual;", "kind": "read", "warnings": ["avviso"], "seconds": 52.0}


def _user():
    return User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")


def _q(user, **kw):
    return Text2SqlRequest.objects.create(user=user, question="Quanti studi CT sono stati archiviati ieri?", **kw)


def test_process_next_done_creates_notification():
    u = _user()
    q = _q(u)
    with mock.patch("text2sql.engine.generate", return_value=RESULT):
        assert worker.process_next() is True
    q.refresh_from_db()
    assert (q.status, q.kind, q.sql, q.warnings, q.seconds) == ("done", "read", RESULT["sql"], ["avviso"], 52.0)
    assert q.started_at and q.finished_at
    n = Notification.objects.get(recipient=u, notification_type="text2sql_ready")
    assert n.title.startswith("Query SQL pronta")
    assert n.link == f"/knowledge/sql?apri={q.pk}" and n.source_key == str(q.pk)
    assert "Quanti studi CT" in n.subtitle


def test_process_next_takes_oldest_first():
    u = _user()
    first, second = _q(u), _q(u)
    with mock.patch("text2sql.engine.generate", return_value=RESULT):
        worker.process_next()
    first.refresh_from_db(); second.refresh_from_db()
    assert first.status == "done" and second.status == "queued"


def test_process_next_error_marks_error_and_notifies():
    u = _user()
    q = _q(u)
    with mock.patch("text2sql.engine.generate", side_effect=EngineError("Ollama non raggiungibile (http://x): refused")):
        worker.process_next()
    q.refresh_from_db()
    assert q.status == "error" and "Ollama non raggiungibile" in q.error
    assert Notification.objects.get(recipient=u, notification_type="text2sql_ready").title.startswith("Query SQL non riuscita")


def test_unexpected_exception_is_an_error_not_a_crash():
    q = _q(_user())
    with mock.patch("text2sql.engine.generate", side_effect=ValueError("boom")):
        assert worker.process_next() is True
    q.refresh_from_db()
    assert q.status == "error" and q.error


def test_requeue_interrupted():
    u = _user()
    q = _q(u, status="running")
    done = _q(u, status="done")
    assert worker.requeue_interrupted() == 1
    q.refresh_from_db(); done.refresh_from_db()
    assert q.status == "queued" and q.started_at is None and done.status == "done"


def test_process_next_empty_returns_false():
    assert worker.process_next() is False


def test_module_off_does_nothing():
    from core.models import ModuleSwitch
    from core.modules import invalidate_cache

    q = _q(_user())
    ModuleSwitch.objects.update_or_create(key="text2sql", defaults={"enabled": False})
    invalidate_cache()
    try:
        with mock.patch("text2sql.engine.generate", return_value=RESULT) as gen:
            assert worker.process_next() is False
        gen.assert_not_called()
        q.refresh_from_db()
        assert q.status == "queued"
    finally:
        ModuleSwitch.objects.filter(key="text2sql").delete()
        invalidate_cache()


def test_refresh_notifications_keeps_text2sql_notifications():
    from django.core.management import call_command

    q = _q(_user())
    with mock.patch("text2sql.engine.generate", return_value=RESULT):
        worker.process_next()
    call_command("refresh_notifications")
    assert Notification.objects.filter(notification_type="text2sql_ready", source_key=str(q.pk)).exists()
