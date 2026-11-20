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


def test_command_startup_waits_for_migrations():
    """Con le migrazioni non ancora applicate (deploy: migrate si lancia a mano dopo
    l'avvio) il lavoratore non cade: riprova finché la tabella esiste."""
    from django.db.utils import ProgrammingError
    from text2sql.management.commands import text2sql_worker as cmd

    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise ProgrammingError('relation "text2sql_text2sqlrequest" does not exist')
        return 0

    with mock.patch.object(cmd.worker, "requeue_interrupted", side_effect=flaky), mock.patch.object(cmd.time, "sleep") as sleep:
        assert cmd.requeue_when_ready() == 0
    assert calls["n"] == 3 and sleep.call_count == 2


def test_request_deleted_while_running_does_not_come_back():
    u = _user()
    q = _q(u)

    def gen(_question):
        Text2SqlRequest.objects.filter(pk=q.pk).delete()  # il tecnico la cancella durante l'elaborazione
        return RESULT

    with mock.patch("text2sql.engine.generate", side_effect=gen):
        worker.process_next()
    assert not Text2SqlRequest.objects.filter(pk=q.pk).exists()
    assert not Notification.objects.filter(source_key=str(q.pk), notification_type="text2sql_ready").exists()


def test_failed_final_save_still_closes_the_request():
    q = _q(_user())
    real_update = Text2SqlRequest.objects.filter(pk=q.pk).update
    calls = {"n": 0}

    class FlakyQS:
        def __init__(self, qs):
            self.qs = qs

        def update(self, **kw):
            calls["n"] += 1
            if calls["n"] == 1:
                from django.db import OperationalError
                raise OperationalError("server closed the connection")
            return self.qs.update(**kw)

    orig_filter = Text2SqlRequest.objects.filter

    def filt(*a, **kw):
        qs = orig_filter(*a, **kw)
        return FlakyQS(qs) if kw.get("status") == "running" else qs

    with mock.patch("text2sql.engine.generate", return_value=RESULT), mock.patch.object(Text2SqlRequest.objects, "filter", side_effect=filt):
        worker.process_next()
    q.refresh_from_db()
    assert q.status == "error"
    assert real_update  # usato solo per chiarezza


def test_audit_does_not_store_the_question_text():
    q = _q(_user())
    assert "Quanti studi" not in str(q)
