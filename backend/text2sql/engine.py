"""Motore del generatore SQL: domanda in italiano → query Oracle per il PACS Philips Vue.

Portato dal prototipo `/home/fede/text2sql-test/app/text2sql.py` (2026-11-20) senza il
server HTTP: regole, scelta delle sezioni dello schema e degli esempi, chiamata a
Ollama e controlli sulla risposta restano gli stessi. La configurazione viene da
`settings.T2S_*` (variabili `OLLAMA_URL` e `T2S_*`).

Conoscenza: `knowledge/schema.md` e `knowledge/esempi_query.md`, mantenuti a mano.
Archie non esegue mai le query: le restituisce da copiare.
"""
from __future__ import annotations

import http.client
import json
import re
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

from django.conf import settings

KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge"
SCHEMA_FILE = KNOWLEDGE_DIR / "schema.md"
EXAMPLES_FILE = KNOWLEDGE_DIR / "esempi_query.md"

KIND_BY_TYPE = {"READ": "read", "WRITE": "write", "NESSUNA": "impossible"}


class EngineError(Exception):
    """Errore leggibile da un tecnico (finisce nel campo `error` della domanda)."""


def _rules() -> str:
    version = settings.T2S_ORACLE_VERSION
    limit = (
        "per limitare le righe usa ROWNUM su una sottoquery ordinata "
        "(SELECT * FROM (... ORDER BY ...) WHERE ROWNUM <= n); niente LIMIT, niente FETCH FIRST"
        if version == "11" else "per limitare le righe usa FETCH FIRST n ROWS ONLY; niente LIMIT"
    )
    return f"""Sei un esperto di database Oracle {version}. Trasformi una domanda in italiano
in SQL corretto per lo schema descritto più sotto.

FORMATO DELLA RISPOSTA
- Rispondi SOLO con un blocco ```sql ... ```, senza altro testo prima o dopo.
- Segui alla lettera le "Regole di generazione" contenute nello schema: valgono più di tutto il resto.
- Se la domanda non si può soddisfare con lo schema rispondi solo:
  ```sql
  -- IMPOSSIBILE: <motivo in breve>
  ```
- Prendi come modello gli esempi validati che ricevi insieme alla domanda (stile, join, filtri).

SINTASSI ORACLE {version}
- {limit};
- oggi: TRUNC(SYSDATE); ieri: TRUNC(SYSDATE) - 1; questo mese: TRUNC(SYSDATE, 'MM'); quest'anno: TRUNC(SYSDATE, 'YYYY');
- date letterali: DATE 'aaaa-mm-gg';
- niente tipo BOOLEAN, niente ILIKE; stringhe tra apici singoli;
- alias brevi; ogni istruzione termina con il punto e virgola.
"""


# ── File di conoscenza (riletti solo se cambiano) ──────────────────────────

_cache: dict = {"mtime": None, "schema": "", "examples": []}


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def split_examples(md: str) -> list[str]:
    """Ogni esempio inizia con una riga '### ' (es. '### Domanda: ...')."""
    examples, current = [], None
    for line in md.splitlines():
        if line.startswith("### "):
            if current:
                examples.append("\n".join(current).strip())
            current = [line]
        elif current is not None:
            current.append(line)
    if current:
        examples.append("\n".join(current).strip())
    return [e for e in examples if "```" in e]


def _knowledge() -> tuple[str, list[str]]:
    mtime = tuple(p.stat().st_mtime if p.exists() else 0 for p in (SCHEMA_FILE, EXAMPLES_FILE))
    if mtime != _cache["mtime"]:
        _cache.update(mtime=mtime, schema=_read(SCHEMA_FILE), examples=split_examples(_read(EXAMPLES_FILE)))
    return _cache["schema"], _cache["examples"]


def load_examples() -> list[str]:
    """Esempi validati: quelli del file più le Query della Wiki in SQL Oracle
    (linguaggio `settings.T2S_WIKI_LANGUAGE`, decisione di Fede del 20/11)."""
    return list(_knowledge()[1]) + wiki_examples()


def wiki_examples() -> list[str]:
    """Query della Wiki nel formato degli esempi del file (`### Domanda:` + blocco sql)."""
    from wiki.models import WikiQuery

    rows = (
        WikiQuery.objects.filter(language__key=settings.T2S_WIKI_LANGUAGE, deleted_at__isnull=True)
        .order_by("id").values_list("title", "description", "body")
    )
    examples = []
    for title, description, body in rows:
        body = (body or "").strip().replace("```", "")
        if not body:
            continue
        # Titolo e descrizione su una riga sola: un «### » o un ``` a capo
        # spezzerebbero l'esempio (vedi split_examples).
        head = " ".join(f"### Domanda: {title}".split()).replace("```", "")
        note = " ".join((description or "").split()).replace("```", "")
        examples.append(f"{head}\n{note}\n```sql\n{body}\n```" if note else f"{head}\n```sql\n{body}\n```")
    return examples


# ── Scelta di schema ed esempi ─────────────────────────────────────────────

def estimate_tokens(text: str) -> int:
    return int(len(text) / 3.5)


def split_sections(md: str) -> list[str]:
    sections, current = [], []
    for line in md.splitlines():
        if line.lstrip().startswith("#") and current:
            sections.append("\n".join(current))
            current = []
        current.append(line)
    if current:
        sections.append("\n".join(current))
    return [s for s in sections if s.strip()]


_WORDS_RE = re.compile(r"[a-zA-Z0-9_àèéìòù]{3,}")
_ALWAYS = ("regol", "general", "convenz", "glossar", "schemi", "ponti", "introduz")
_STOP = {"che", "per", "con", "del", "della", "delle", "dei", "degli", "nel", "nella", "nei", "sono",
         "stati", "state", "una", "uno", "gli", "alla", "alle", "dal", "dalla", "tra", "fra", "come",
         "cosa", "quanti", "quante", "quali", "quale", "domanda", "select", "from", "where", "and",
         "medistore", "medilink", "auditing", "autorouter", "cfg", "read", "write"}


def _words(t: str) -> set[str]:
    return {w.lower() for w in _WORDS_RE.findall(t)}


def _roots(t: str) -> set[str]:
    """Parole normalizzate alle prime 5 lettere: 'esami'/'esame', 'studi'/'studio' coincidono."""
    return {w[:5] for w in _words(t) if w not in _STOP}


def pick_examples(examples: list[str], question: str, k: int) -> list[str]:
    q = _roots(question)
    if not q or not examples:
        return []
    scored = []
    for i, e in enumerate(examples):
        title, _, body = e.partition("\n")
        score = 3 * len(q & _roots(title)) + len(q & _roots(body))
        if score:
            scored.append((-score, i, e))
    return [e for _, _, e in sorted(scored)[:k]]


def select_sections(md: str, question: str, budget: int) -> str:
    sections = split_sections(md)
    q = _words(question)
    scored = []
    for i, s in enumerate(sections):
        title = s.splitlines()[0].lower()
        always = any(k in title for k in _ALWAYS)
        score = len(q & _words(s)) + (3 * len(q & _words(title)))
        scored.append((always, score, i, s))
    chosen, used = set(), 0
    for always, score, i, s in sorted(scored, key=lambda x: (not x[0], -x[1], x[2])):
        t = estimate_tokens(s)
        if used + t > budget and not always:
            continue
        if not always and score == 0:
            continue
        chosen.add(i)
        used += t
    return "\n\n".join(s for i, s in enumerate(sections) if i in chosen)


def build_prompt(question: str) -> tuple[str, str, bool, int]:
    """(system, user, schema_ridotto, n_esempi). Il messaggio di sistema (regole + schema)
    è identico per ogni domanda, così Ollama lo tiene in cache; gli esempi vanno nell'utente."""
    schema, _ = _knowledge()
    if not schema.strip():
        raise EngineError(f"File dello schema non trovato o vuoto: {SCHEMA_FILE}")
    reduced = False
    if estimate_tokens(schema) > settings.T2S_MAX_SCHEMA_TOKENS:
        schema = select_sections(schema, question, settings.T2S_MAX_SCHEMA_TOKENS)
        reduced = True
    system = f"{_rules()}\n===== SCHEMA DEL DATABASE =====\n{schema}\n"
    examples = pick_examples(load_examples(), question, settings.T2S_NUM_ESEMPI)
    user = ""
    if examples:
        user += "Esempi validati simili alla domanda:\n\n" + "\n\n".join(examples) + "\n\n"
    user += f"(Data di oggi: {date.today().isoformat()})\nDomanda: {question.strip()}"
    return system, user, reduced, len(examples)


# ── Chiamata al modello ─────────────────────────────────────────────────────

def _call_ollama(system: str, user: str) -> str:
    base = settings.T2S_OLLAMA_URL
    if not base:
        raise EngineError("Generatore non configurato: manca l'indirizzo di Ollama (OLLAMA_URL).")
    options = {"temperature": 0, "num_ctx": settings.T2S_NUM_CTX, "num_predict": 800}
    if settings.T2S_NUM_THREAD > 0:
        options["num_thread"] = settings.T2S_NUM_THREAD
    body = json.dumps({
        "model": settings.T2S_MODEL, "stream": False, "keep_alive": -1, "options": options,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }).encode("utf-8")
    req = urllib.request.Request(f"{base}/api/chat", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=settings.T2S_TIMEOUT) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode("utf-8")).get("error", "")
        except Exception:  # noqa: BLE001
            detail = ""
        if e.code == 404:
            raise EngineError(f"Modello «{settings.T2S_MODEL}» non trovato in Ollama: scaricalo con «ollama pull {settings.T2S_MODEL}».") from e
        raise EngineError(f"Errore da Ollama (HTTP {e.code}): {detail or e.reason}") from e
    except urllib.error.URLError as e:
        raise EngineError(f"Ollama non raggiungibile ({base}): {e.reason}") from e
    except TimeoutError as e:
        raise EngineError(f"Il generatore non ha risposto entro {settings.T2S_TIMEOUT} secondi.") from e
    except (OSError, http.client.HTTPException) as e:
        raise EngineError(f"Ollama ha chiuso la connessione durante la generazione ({base}): riprova.") from e
    return data.get("message", {}).get("content", "")


_SQL_BLOCK = re.compile(r"```(?:sql|SQL)?\s*\n?(.*?)```", re.S)
_DML = re.compile(r"^\s*(INSERT|UPDATE|DELETE|MERGE)\b", re.I)
_DDL = re.compile(r"\b(DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\s+\w", re.I)


def extract_sql(text: str) -> tuple[str, str, list[str]]:
    """Estrae la query e prepara gli avvisi: (sql, kind, warnings)."""
    m = _SQL_BLOCK.search(text)
    sql = (m.group(1) if m else text).strip()
    warns: list[str] = []
    code_lines = [r for r in sql.splitlines() if r.strip() and not r.strip().startswith("--")]
    if not code_lines:
        if "IMPOSSIBILE" in sql.upper():
            warns.append("Il modello ritiene che la domanda non sia risolvibile con lo schema fornito.")
        return sql, KIND_BY_TYPE["NESSUNA"], warns
    raw = " ".join(code_lines)
    body = re.sub(r"'[^']*'", "''", raw)   # ignora il contenuto delle stringhe
    statements = [s.strip() for s in body.split(";") if s.strip()]
    dml = [s for s in statements if _DML.match(s)]
    kind = "WRITE" if dml else "READ"
    if dml:
        warns.append("Query di MODIFICA: esegui prima l'anteprima, poi la modifica, controlla le righe e dai COMMIT a mano.")
        for s in dml:
            if re.match(r"^\s*(UPDATE|DELETE)\b", s, re.I) and not re.search(r"\bWHERE\b", s, re.I):
                warns.append("ATTENZIONE: c'è un UPDATE/DELETE senza WHERE. Non eseguirlo.")
        if not any(re.match(r"^\s*(SELECT|WITH)\b", s, re.I) for s in statements):
            warns.append("Manca la SELECT di anteprima prima della modifica.")
    elif not re.match(r"^\s*(SELECT|WITH)\b", statements[0], re.I):
        warns.append("La risposta non inizia con SELECT/WITH: controllala con attenzione.")
    if _DDL.search(body):
        warns.append("La risposta contiene comandi DDL (DROP/ALTER/CREATE...): non eseguirla.")
    if any(re.match(r"^\s*COMMIT\b", s, re.I) for s in statements):
        warns.append("La risposta contiene un COMMIT attivo: toglilo e dai il commit a mano dopo il controllo.")
    if re.search(r"\bLIMIT\s+\d", body, re.I):
        warns.append("LIMIT non esiste in Oracle.")
    if settings.T2S_ORACLE_VERSION == "11" and re.search(r"\bFETCH\s+FIRST\b", body, re.I):
        warns.append("FETCH FIRST non esiste in Oracle 11: usa ROWNUM.")
    if re.search(r"ESCAPE\s+'\\'", raw, re.I):
        warns.append("ESCAPE '\\' con i separatori \\ provoca ORA-01424: togli la clausola ESCAPE.")
    return sql, KIND_BY_TYPE[kind], warns


def generate(question: str) -> dict:
    """Genera la query per `question`. Solleva EngineError con un messaggio leggibile."""
    t0 = time.monotonic()
    system, user, reduced, _n = build_prompt(question)
    answer = _call_ollama(system, user)
    sql, kind, warns = extract_sql(answer)
    if reduced:
        warns.append("Schema grande: sono state usate solo le sezioni ritenute pertinenti.")
    return {"sql": sql, "kind": kind, "warnings": warns, "seconds": round(time.monotonic() - t0, 1)}
