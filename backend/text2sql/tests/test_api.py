"""API del generatore SQL (spec 2026-11-20): coda personale, giudizio, revisione del superuser."""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from core.testing import grant_via_group, make_archie_user
from text2sql.models import Text2SqlRequest

pytestmark = pytest.mark.django_db

User = get_user_model()
URL = "/api/text2sql/"


@pytest.fixture(autouse=True)
def _ollama_configured(settings):
    settings.T2S_OLLAMA_URL = "http://ollama.test:11434"


def _tech():
    return grant_via_group(make_archie_user(username=f"t_{uuid.uuid4().hex[:6]}", password="pw"), "text2sql.use_text2sql")


def _su():
    return User.objects.create_superuser(username=f"su_{uuid.uuid4().hex[:6]}", password="pw", email="su@example.com")


def _c(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _done(user, **kw):
    return Text2SqlRequest.objects.create(user=user, question="Quanti studi CT ieri?", status="done", kind="read",
                                          sql="-- READ | x\nSELECT 1 FROM dual;", **kw)


def test_create_requires_permission():
    u = make_archie_user(username="noperm", password="pw")
    assert _c(u).post(URL, {"question": "Quanti studi?"}, format="json").status_code == 403


def test_create_queues_question():
    u = _tech()
    r = _c(u).post(URL, {"question": "  Quanti studi CT ieri?  "}, format="json")
    assert r.status_code == 201, r.json()
    obj = Text2SqlRequest.objects.get(pk=r.json()["id"])
    assert obj.status == "queued" and obj.user == u and obj.question == "Quanti studi CT ieri?"


def test_create_rejects_empty_and_too_long():
    c = _c(_tech())
    assert c.post(URL, {"question": "   "}, format="json").status_code == 400
    assert c.post(URL, {"question": "x" * 2001}, format="json").status_code == 400


def test_create_without_ollama_url_is_503(settings):
    settings.T2S_OLLAMA_URL = ""
    r = _c(_tech()).post(URL, {"question": "Quanti studi?"}, format="json")
    assert r.status_code == 503
    assert "non configurato" in r.json()["detail"]
    assert not Text2SqlRequest.objects.exists()


def test_list_only_own():
    me, other = _tech(), _tech()
    mine = _done(me)
    _done(other)
    body = _c(me).get(URL).json()
    rows = body["results"] if isinstance(body, dict) else body
    assert [r["id"] for r in rows] == [mine.pk]


def test_detail_of_other_user_is_404():
    me, other = _tech(), _tech()
    theirs = _done(other)
    assert _c(me).get(f"{URL}{theirs.pk}/").status_code == 404
    assert _c(me).patch(f"{URL}{theirs.pk}/feedback/", {"feedback": "ok"}, format="json").status_code == 404


def test_feedback_only_when_done():
    me = _tech()
    q = Text2SqlRequest.objects.create(user=me, question="Q", status="running")
    assert _c(me).patch(f"{URL}{q.pk}/feedback/", {"feedback": "ok"}, format="json").status_code == 400


def test_feedback_ko_saves_correction():
    me = _tech()
    q = _done(me)
    r = _c(me).patch(f"{URL}{q.pk}/feedback/", {"feedback": "ko", "corrected_sql": "SELECT 2 FROM dual;", "feedback_note": "Mancava il filtro"}, format="json")
    assert r.status_code == 200, r.json()
    q.refresh_from_db()
    assert (q.feedback, q.corrected_sql, q.feedback_note) == ("ko", "SELECT 2 FROM dual;", "Mancava il filtro")
    assert q.feedback_at is not None


def test_feedback_rejects_unknown_value():
    me = _tech()
    q = _done(me)
    assert _c(me).patch(f"{URL}{q.pk}/feedback/", {"feedback": "forse"}, format="json").status_code == 400


def test_review_superuser_only():
    assert _c(_tech()).get(f"{URL}review/").status_code == 403


def test_review_lists_judged_answers_of_everyone():
    a, b = _tech(), _tech()
    ja = _done(a, feedback="ko", corrected_sql="SELECT 2 FROM dual;")
    jb = _done(b, feedback="ok")
    _done(b)  # senza giudizio: non entra in revisione
    body = _c(_su()).get(f"{URL}review/").json()
    rows = body["results"] if isinstance(body, dict) else body
    assert {r["id"] for r in rows} == {ja.pk, jb.pk}
    ko = _c(_su()).get(f"{URL}review/", {"feedback": "ko"}).json()
    assert [r["id"] for r in (ko["results"] if isinstance(ko, dict) else ko)] == [ja.pk]


def test_mark_reviewed():
    q = _done(_tech(), feedback="ok")
    su = _su()
    assert _c(su).post(f"{URL}{q.pk}/reviewed/", {"reviewed": True}, format="json").status_code == 200
    q.refresh_from_db()
    assert q.reviewed_at is not None
    pend = _c(su).get(f"{URL}review/", {"reviewed": "false"}).json()
    assert q.pk not in {r["id"] for r in (pend["results"] if isinstance(pend, dict) else pend)}
    _c(su).post(f"{URL}{q.pk}/reviewed/", {"reviewed": False}, format="json")
    q.refresh_from_db()
    assert q.reviewed_at is None


def test_example_markdown_format():
    q = _done(_tech(), feedback="ko", corrected_sql="SELECT 2 FROM dual;")
    row = next(r for r in (lambda b: b["results"] if isinstance(b, dict) else b)(_c(_su()).get(f"{URL}review/").json()) if r["id"] == q.pk)
    assert row["example_markdown"] == "### Domanda: Quanti studi CT ieri?\n```sql\nSELECT 2 FROM dual;\n```\n"


def test_module_off_returns_404():
    from core.models import ModuleSwitch
    from core.modules import invalidate_cache

    ModuleSwitch.objects.update_or_create(key="text2sql", defaults={"enabled": False})
    invalidate_cache()
    try:
        assert _c(_tech()).get(URL).status_code == 404
    finally:
        ModuleSwitch.objects.filter(key="text2sql").delete()
        invalidate_cache()


def test_review_puts_unreviewed_first():
    from django.utils import timezone
    u = _tech()
    reviewed = _done(u, feedback="ok", reviewed_at=timezone.now())
    pending = _done(u, feedback="ok")
    body = _c(_su()).get(f"{URL}review/").json()
    ids = [r["id"] for r in (body["results"] if isinstance(body, dict) else body)]
    assert ids.index(pending.pk) < ids.index(reviewed.pk)
