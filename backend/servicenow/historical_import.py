"""Import storico ServiceNow da CSV (export "sn_customerservice_case").

Logica di parsing/mapping isolata dalla view così da poter essere testata
senza passare per il ciclo request/response DRF. Vedi ServiceNowCaseViewSet
per gli endpoint che la usano (`import-historical-preview` e
`import-historical-commit`).

Regole di mappatura concordate (vedi anche commento nella view):
- categoria da `assignment_group`: contiene "biotron" → Biotron, altrimenti
  Philips (anche per valori non riconosciuti).
- Type Philips, in ordine: sys_tags contiene EBIT/EBIT1 → EBIT; assignment_
  group contiene AC → AC; assignment_group contiene RIS → RIS; account
  contiene GEMEL (l'account ServiceNow reale è troncato,
  "...UNIV.A.GEMEL", non "GEMELLI" per intero) → GEMELLI; altrimenti L1.
- Type Biotron, in ordine: sys_tags contiene PRIVATI → PRIVATI; sys_tags
  contiene uno tra CDD/GCI/DSS/EPSON/RTS → CDD; altrimenti L1.
- priorità: 1-4 diretta, "5 - Planning" → 4 (Low), valore ignoto → 3
  (Moderate, non blocca la riga).
- assigned_to: match per nome+cognome (case-insensitive, ordine parole
  indifferente) contro gli User Archie; nessun match/ambiguo → nessun
  assegnatario, solo un avviso. Due eccezioni "fallback" (mai al posto di
  un match riuscito, solo quando fallisce):
  - Type CDD (Biotron) → utente di servizio "cdd.biotron" (CDD_FALLBACK_USERNAME);
  - qualsiasi Type categoria Philips → utente di servizio "jolly.philips"
    (da servicenow.models.PHILIPS_UNASSIGNED_FALLBACK_USERNAME), stessa
    regola applicata anche fuori da questo import (vedi ServiceNowCase.save()):
    replicata qui SOLO per mostrarla già in anteprima, non per duplicarne
    la fonte di verità.
  Sempre con avviso esplicito che spiega il motivo dell'assegnazione automatica.
- numero duplicato (in Archie o nello stesso file) → riga saltata.
- status sempre "open"; MAI notifica Teams/modal Philips per righe importate
  da qui (l'endpoint non richiama servicenow.notifications).
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from django.contrib.auth import get_user_model

from servicenow.models import (
    ServiceNowCaseCategory, ServiceNowCaseType, ServiceNowPriority,
    PHILIPS_UNASSIGNED_FALLBACK_USERNAME,
)

User = get_user_model()

REQUIRED_COLUMNS = [
    "number", "account", "opened_at", "short_description",
    "priority", "assignment_group", "assigned_to", "sys_tags",
]

EBIT_TAGS = {"EBIT", "EBIT1"}
CDD_TAGS  = {"CDD", "GCI", "DSS", "EPSON", "RTS"}

# "1 - Critical" .. "4 - Low" mappano diretti sul primo carattere; "5 -
# Planning" (esiste in ServiceNow ma non nel modello Archie, fermo a 4
# livelli) ricade su 4 - Low.
PRIORITY_DIGIT_MAP = {"1": "1", "2": "2", "3": "3", "4": "4", "5": "4"}
PRIORITY_DEFAULT = ServiceNowPriority.MODERATE  # "3"

_OPENED_AT_FORMAT = "%d-%m-%Y %H:%M:%S"


# ─── Decodifica file ──────────────────────────────────────────────────────────

def decode_csv_bytes(raw: bytes) -> str:
    """Gli export ServiceNow non sono sempre UTF-8 (spesso Windows-1252).
    Prova in ordine di probabilità; latin-1 non fallisce mai ed è l'ultima
    rete di sicurezza (mappa 1:1 ogni byte, quindi non perde dati anche se
    il risultato non fosse perfettamente leggibile per caratteri esotici).
    """
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1")


# ─── Parsing singoli campi ────────────────────────────────────────────────────

def parse_opened_at(raw: str) -> tuple[Optional[str], Optional[str]]:
    """"03-08-2026 23:32:18" → ("2026-08-03", "23:32:18"). Non bloccante:
    valore mancante o non parsabile → (None, None)."""
    raw = (raw or "").strip()
    if not raw:
        return None, None
    try:
        dt = datetime.strptime(raw, _OPENED_AT_FORMAT)
    except ValueError:
        return None, None
    return dt.date().isoformat(), dt.time().isoformat()


def parse_priority(raw: str) -> tuple[str, Optional[str]]:
    """Ritorna (valore_priorità, avviso_o_None)."""
    raw = (raw or "").strip()
    match = re.match(r"^(\d)", raw)
    if not match:
        return PRIORITY_DEFAULT, f'Priorità "{raw}" non riconosciuta, impostata a "3 - Moderate".' if raw else None
    digit = match.group(1)
    mapped = PRIORITY_DIGIT_MAP.get(digit)
    if mapped is None:
        return PRIORITY_DEFAULT, f'Priorità "{raw}" non riconosciuta, impostata a "3 - Moderate".'
    if digit == "5":
        return mapped, f'Priorità "{raw}" mappata su "4 - Low" (non esiste in Archie).'
    return mapped, None


def parse_tags(raw: str) -> set[str]:
    return {t.strip().upper() for t in re.split(r"[,;]", raw or "") if t.strip()}


def resolve_category(assignment_group: str) -> str:
    group = (assignment_group or "").strip().lower()
    if "biotron" in group:
        return ServiceNowCaseCategory.BIOTRON
    return ServiceNowCaseCategory.PHILIPS


def resolve_case_type_name(category: str, tags: set[str], assignment_group: str, account: str) -> str:
    group_upper = (assignment_group or "").upper()
    account_upper = (account or "").upper()
    if category == ServiceNowCaseCategory.PHILIPS:
        if tags & EBIT_TAGS:
            return "EBIT"
        if "AC" in group_upper:
            return "AC"
        if "RIS" in group_upper:
            return "RIS"
        if "GEMEL" in account_upper:
            return "GEMELLI"
        return "L1"
    # Biotron
    if "PRIVATI" in tags:
        return "PRIVATI"
    if tags & CDD_TAGS:
        return "CDD"
    return "L1"


# ─── Matching assegnatario ────────────────────────────────────────────────────

def build_users_name_index() -> dict[frozenset, list]:
    """Indice {frozenset di token nome/cognome in minuscolo -> [User,...]}
    per un matching insensibile all'ordine delle parole. Costruito una sola
    volta per import (non per riga) per motivi di performance.
    """
    index: dict[frozenset, list] = {}
    for user in User.objects.filter(is_active=True).only("id", "first_name", "last_name", "username"):
        if not user.first_name and not user.last_name:
            continue
        key = frozenset(
            tok.lower() for tok in f"{user.first_name} {user.last_name}".split() if tok
        )
        if not key:
            continue
        index.setdefault(key, []).append(user)
    return index


# Type Philips con assegnatario fisso (utenti "di servizio", non persone
# reali): il nome nella colonna assigned_to del CSV viene ignorato per
# queste righe, il case va sempre a questo login. Vedi resolve_assignment().
FIXED_TYPE_ASSIGNEE_USERNAME = {
    "AC": "ac.philips",
    "RIS": "ris.philips",
}

# Type Biotron con assegnatario di FALLBACK (non fisso): a differenza di
# FIXED_TYPE_ASSIGNEE_USERNAME, qui il nome nella colonna assigned_to del
# CSV viene provato per primo con il match normale per nome+cognome; solo
# se non trova nessun utente (o è ambiguo) il case va a questo login di
# servizio, invece di restare senza assegnatario. Vedi resolve_assignment().
CDD_FALLBACK_USERNAME = "cdd.biotron"


def build_users_username_index() -> dict[str, object]:
    """Indice {username in minuscolo -> User} per il match esatto usato dagli
    assegnatari fissi (FIXED_TYPE_ASSIGNEE_USERNAME), separato dall'indice
    per nome+cognome usato per il match "a occhio" da CSV.
    """
    return {u.username.lower(): u for u in User.objects.filter(is_active=True).only("id", "username", "first_name", "last_name")}


def match_assigned_to(raw_name: str, index: dict[frozenset, list]) -> tuple[Optional[object], Optional[str]]:
    """Ritorna (User_o_None, avviso_o_None)."""
    raw_name = (raw_name or "").strip()
    if not raw_name:
        return None, None
    key = frozenset(tok.lower() for tok in raw_name.split() if tok)
    matches = index.get(key, [])
    if len(matches) == 1:
        return matches[0], None
    if not matches:
        return None, f'Assegnatario "{raw_name}" non trovato tra gli utenti Archie: case importato senza assegnatario.'
    return None, f'Assegnatario "{raw_name}" ambiguo ({len(matches)} utenti corrispondenti): case importato senza assegnatario.'


def _user_label(user) -> str:
    return f"{user.first_name} {user.last_name}".strip() or user.username


def resolve_assignment(
    category: str, type_name: str, raw_name: str, users_by_name: dict, users_by_username: dict,
) -> tuple[Optional[object], list]:
    """Determina l'assegnatario del case, incrociando la regola "assegnatario
    fisso per Type" (AC/RIS → utenti di servizio, vedi
    FIXED_TYPE_ASSIGNEE_USERNAME), quella "assegnatario di fallback per Type"
    (CDD → utente di servizio, vedi CDD_FALLBACK_USERNAME) e quella
    "assegnatario di fallback per categoria" (Philips → utente di servizio,
    vedi PHILIPS_UNASSIGNED_FALLBACK_USERNAME) con il normale match per nome
    da CSV.

    Per i Type con assegnatario fisso il nome nel CSV viene ignorato (quel
    campo su ServiceNow riporta spesso una persona diversa dall'utente di
    servizio reale): ritorna sempre l'utente fisso se esiste, altrimenti
    nessun assegnatario con un avviso esplicito — MAI un fallback silenzioso
    sul nome CSV per questi Type.

    Per il Type CDD e, più in generale, per QUALSIASI case categoria Philips,
    invece, si tenta prima il match normale per nome; solo se fallisce
    (nessun match o ambiguo, incluso il caso di nome assente nel CSV) il case
    viene assegnato all'utente di servizio corrispondente (cdd.biotron per
    CDD, jolly.philips per Philips), sempre con un avviso esplicito. Se
    entrambe le condizioni si applicassero (non capita nella pratica: CDD è
    sempre categoria Biotron), vince il ramo CDD, controllato per primo.
    """
    fixed_username = FIXED_TYPE_ASSIGNEE_USERNAME.get(type_name)
    if fixed_username:
        user = users_by_username.get(fixed_username.lower())
        if user:
            return user, [f'Type {type_name}: assegnato automaticamente a "{_user_label(user)}" ({fixed_username}).']
        return None, [f'Type {type_name}: utente di servizio "{fixed_username}" non trovato in Archie, case importato senza assegnatario.']

    user, warning = match_assigned_to(raw_name, users_by_name)
    if user is not None:
        return user, []

    fallback_username = None
    fallback_reason = None
    if type_name == "CDD":
        fallback_username = CDD_FALLBACK_USERNAME
        fallback_reason = "fallback Type CDD"
    elif category == ServiceNowCaseCategory.PHILIPS:
        fallback_username = PHILIPS_UNASSIGNED_FALLBACK_USERNAME
        fallback_reason = "fallback categoria Philips"

    if fallback_username:
        fallback_user = users_by_username.get(fallback_username.lower())
        if fallback_user is None:
            extra = f'Utente di fallback "{fallback_username}" non trovato in Archie: case importato senza assegnatario.'
            return None, [warning, extra] if warning else [extra]
        fallback_note = f'Assegnato automaticamente a "{_user_label(fallback_user)}" ({fallback_username}) come {fallback_reason}.'
        if warning:
            return fallback_user, [warning, fallback_note]
        return fallback_user, [f'Assegnatario non specificato nel CSV. {fallback_note}']

    return None, ([warning] if warning else [])


# ─── Risultato per riga ───────────────────────────────────────────────────────

@dataclass
class RowResult:
    line: int
    number: str = ""
    account: str = ""
    category: Optional[str] = None
    case_type_name: Optional[str] = None
    priority: Optional[str] = None
    opened_date: Optional[str] = None
    opened_time: Optional[str] = None
    short_description: str = ""
    assigned_to_csv: str = ""
    assigned_to_id: Optional[int] = None
    assigned_to_label: Optional[str] = None
    outcome: str = "create"  # "create" | "duplicate" | "error"
    error: Optional[str] = None
    warnings: list = field(default_factory=list)

    def payload(self, case_type_id: int) -> dict:
        return {
            "number": self.number,
            "account": self.account,
            "short_description": self.short_description,
            "priority": self.priority,
            "category": self.category,
            "case_type": case_type_id,
            "opened_date": self.opened_date,
            "opened_time": self.opened_time,
            "status": "open",
            "assigned_to": self.assigned_to_id,
            "external_url": "",
        }


def validate_columns(fieldnames: Optional[list]) -> list:
    """Colonne obbligatorie mancanti nell'header del CSV (lista vuota se ok)."""
    present = set(fieldnames or [])
    return [c for c in REQUIRED_COLUMNS if c not in present]


def process_csv(
    raw_bytes: bytes,
    existing_numbers: set,
    users_index: dict,
    case_type_lookup: dict,
    users_by_username: Optional[dict] = None,
) -> tuple[list, list]:
    """Elabora l'intero CSV e ritorna (rows, missing_columns).

    `existing_numbers`: numeri case già presenti in Archie (case-insensitive,
    upper-case), per il controllo duplicati.
    `case_type_lookup`: {(category, name_upper): case_type_id}.
    `users_by_username`: indice per l'assegnatario fisso dei Type AC/RIS
    (vedi FIXED_TYPE_ASSIGNEE_USERNAME); opzionale per compatibilità con
    chiamate esistenti che non lo passano (equivale a dict vuoto: nessun
    utente di servizio trovato, avviso invece di crash).
    Non scrive nulla sul DB: puramente funzionale, utilizzabile sia per
    l'anteprima sia (a valle, riga per riga) per il commit.
    """
    users_by_username = users_by_username or {}
    text = decode_csv_bytes(raw_bytes)
    reader = csv.DictReader(io.StringIO(text))
    missing = validate_columns(reader.fieldnames)
    if missing:
        return [], missing

    seen_in_file: set = set()
    rows: list[RowResult] = []

    for line_no, raw_row in enumerate(reader, start=2):  # riga 1 = header
        row = RowResult(line=line_no)
        number = (raw_row.get("number") or "").strip()
        row.number = number

        if not number:
            row.outcome = "error"
            row.error = "Numero case mancante."
            rows.append(row)
            continue

        number_key = number.upper()
        if number_key in existing_numbers or number_key in seen_in_file:
            row.outcome = "duplicate"
            row.account = (raw_row.get("account") or "").strip()
            rows.append(row)
            continue

        account = (raw_row.get("account") or "").strip()
        if not account:
            row.outcome = "error"
            row.error = "Account mancante."
            rows.append(row)
            continue
        row.account = account

        row.short_description = (raw_row.get("short_description") or "").strip()
        row.opened_date, row.opened_time = parse_opened_at(raw_row.get("opened_at") or "")
        if not row.opened_date:
            row.warnings.append("Data apertura mancante o non riconosciuta: lasciata vuota.")

        priority, priority_warning = parse_priority(raw_row.get("priority") or "")
        row.priority = priority
        if priority_warning:
            row.warnings.append(priority_warning)

        category = resolve_category(raw_row.get("assignment_group") or "")
        row.category = category

        tags = parse_tags(raw_row.get("sys_tags") or "")
        type_name = resolve_case_type_name(category, tags, raw_row.get("assignment_group") or "", account)
        row.case_type_name = type_name
        if (category, type_name.upper()) not in case_type_lookup:
            row.outcome = "error"
            row.error = f'Type "{type_name}" non trovato per la categoria "{category}" (controlla i Type in configurazione).'
            rows.append(row)
            continue

        assigned_name = (raw_row.get("assigned_to") or "").strip()
        row.assigned_to_csv = assigned_name
        user, assign_notes = resolve_assignment(category, type_name, assigned_name, users_index, users_by_username)
        if user is not None:
            row.assigned_to_id = user.id
            row.assigned_to_label = _user_label(user)
        row.warnings.extend(assign_notes)

        seen_in_file.add(number_key)
        rows.append(row)

    return rows, []


def build_case_type_lookup() -> dict:
    return {
        (ct.category, ct.name.upper()): ct.id
        for ct in ServiceNowCaseType.objects.all()
    }


def summarize(rows: list) -> dict:
    return {
        "total": len(rows),
        "to_create": sum(1 for r in rows if r.outcome == "create"),
        "duplicates": sum(1 for r in rows if r.outcome == "duplicate"),
        "errors": sum(1 for r in rows if r.outcome == "error"),
        "warnings": sum(1 for r in rows if r.warnings),
    }
