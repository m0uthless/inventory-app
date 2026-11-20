"""Motore del generatore SQL, portato dal prototipo /home/fede/text2sql-test."""
from __future__ import annotations

import io
import json
import urllib.error
from unittest import mock

import pytest

from text2sql import engine

# load_examples legge anche le Query della Wiki dal database.
pytestmark = pytest.mark.django_db


def test_extract_select_is_read():
    sql, kind, warns = engine.extract_sql("```sql\n-- READ | x\nSELECT 1 FROM dual;\n```")
    assert sql.startswith("-- READ") and kind == "read" and warns == []


def test_extract_delete_with_preview_is_write():
    text = "```sql\n-- WRITE | x\nSELECT id FROM t WHERE a = 1;\nDELETE FROM t WHERE a = 1;\n-- COMMIT;\n```"
    _, kind, warns = engine.extract_sql(text)
    assert kind == "write"
    assert any("MODIFICA" in w for w in warns)
    assert not any("senza WHERE" in w for w in warns)


def test_extract_delete_without_where_warns():
    _, kind, warns = engine.extract_sql("```sql\nSELECT 1 FROM t;\nDELETE FROM t;\n```")
    assert kind == "write" and any("senza WHERE" in w for w in warns)


def test_extract_impossible():
    sql, kind, warns = engine.extract_sql("```sql\n-- IMPOSSIBILE: manca la tabella\n```")
    assert kind == "impossible" and "IMPOSSIBILE" in sql and warns


def test_extract_ddl_and_active_commit_warn():
    _, _, warns = engine.extract_sql("```sql\nSELECT 1 FROM t;\nDROP TABLE t;\nCOMMIT;\n```")
    assert any("DDL" in w for w in warns) and any("COMMIT attivo" in w for w in warns)


def test_load_examples_reads_blocks():
    ex = engine.load_examples()
    assert len(ex) > 10
    assert all(e.startswith("### ") and "```" in e for e in ex)


def test_build_prompt_puts_similar_examples_in_user_message():
    system, user, _sel, n = engine.build_prompt("quanti esami sono stati archiviati oggi?")
    assert "SCHEMA DEL DATABASE" in system
    assert n > 0 and "archiviati oggi" in user and user.rstrip().endswith("archiviati oggi?")


def _resp(content):
    return io.BytesIO(json.dumps({"message": {"content": content}}).encode())


def test_generate_returns_result(settings):
    settings.T2S_OLLAMA_URL = "http://ollama.test:11434"
    with mock.patch("urllib.request.urlopen", return_value=_resp("```sql\n-- READ | x\nSELECT 1 FROM dual;\n```")) as m:
        r = engine.generate("quanti esami oggi?")
    assert r["kind"] == "read" and r["sql"].startswith("-- READ") and r["warnings"] == [] and r["seconds"] >= 0
    assert m.call_args[0][0].full_url == "http://ollama.test:11434/api/chat"


def test_generate_unreachable(settings):
    settings.T2S_OLLAMA_URL = "http://ollama.test:11434"
    with mock.patch("urllib.request.urlopen", side_effect=urllib.error.URLError("refused")):
        with pytest.raises(engine.EngineError, match="Ollama non raggiungibile"):
            engine.generate("quanti esami oggi?")


def test_generate_model_missing(settings):
    settings.T2S_OLLAMA_URL = "http://ollama.test:11434"
    err = urllib.error.HTTPError("http://x", 404, "Not Found", {}, io.BytesIO(b'{"error": "model not found"}'))
    with mock.patch("urllib.request.urlopen", side_effect=err):
        with pytest.raises(engine.EngineError, match="Modello .* non trovato"):
            engine.generate("quanti esami oggi?")


def test_generate_not_configured(settings):
    settings.T2S_OLLAMA_URL = ""
    with pytest.raises(engine.EngineError, match="non configurato"):
        engine.generate("quanti esami oggi?")


def test_generate_connection_dropped(settings):
    import http.client
    settings.T2S_OLLAMA_URL = "http://ollama.test:11434"
    with mock.patch("urllib.request.urlopen", side_effect=http.client.RemoteDisconnected("closed")):
        with pytest.raises(engine.EngineError, match="chiuso la connessione"):
            engine.generate("quanti esami oggi?")


# ── Query della Wiki come esempi (20/11: tutte quelle in SQL Oracle) ──

def _lang(key, label):
    from wiki.models import WikiQueryLanguage
    return WikiQueryLanguage.objects.get_or_create(key=key, defaults={"label": label})[0]


def test_load_examples_includes_wiki_sql_queries():
    from wiki.models import WikiQuery
    WikiQuery.objects.create(title="Studi bloccati in coda di inoltro", language=_lang("sql", "SQL Oracle"),
                             description="Coda dell'autorouter", body="SELECT * FROM medilink.queue WHERE state = 'E';")
    ex = engine.load_examples()
    wiki = [e for e in ex if "Studi bloccati in coda di inoltro" in e]
    assert len(wiki) == 1
    assert wiki[0].startswith("### Domanda: Studi bloccati in coda di inoltro")
    assert "Coda dell'autorouter" in wiki[0]
    assert "```sql\nSELECT * FROM medilink.queue WHERE state = 'E';\n```" in wiki[0]
    assert engine.split_examples(wiki[0]) == wiki  # stesso formato del file


def test_load_examples_skips_other_languages_deleted_and_empty():
    from django.utils import timezone
    from wiki.models import WikiQuery
    sql = _lang("sql", "SQL Oracle")
    WikiQuery.objects.create(title="Spazio dischi", language=_lang("sh", "Bash"), body="df -h")
    WikiQuery.objects.create(title="Query cestinata", language=sql, body="SELECT 1 FROM dual;", deleted_at=timezone.now())
    WikiQuery.objects.create(title="Query vuota", language=sql, body="   ")
    ex = "\n".join(engine.load_examples())
    assert "Spazio dischi" not in ex and "Query cestinata" not in ex and "Query vuota" not in ex


def test_wiki_examples_are_picked_for_similar_questions():
    from wiki.models import WikiQuery
    WikiQuery.objects.create(title="Studi bloccati in coda di inoltro", language=_lang("sql", "SQL Oracle"),
                             body="SELECT * FROM medilink.queue WHERE state = 'E';")
    picked = engine.pick_examples(engine.load_examples(), "quali studi sono bloccati in coda?", 3)
    assert any("Studi bloccati in coda" in e for e in picked)
