"""Test per la logica di parsing/mapping dell'import storico ServiceNow
(backend/servicenow/historical_import.py), isolata dal ciclo request/response
così da poter testare ogni regola di mappatura in modo mirato.
"""
import uuid

import pytest

from servicenow.historical_import import (
    decode_csv_bytes,
    parse_opened_at,
    parse_priority,
    parse_tags,
    resolve_category,
    resolve_case_type_name,
    build_users_name_index,
    build_users_username_index,
    match_assigned_to,
    resolve_assignment,
    validate_columns,
    process_csv,
    build_case_type_lookup,
    summarize,
    REQUIRED_COLUMNS,
    FIXED_TYPE_ASSIGNEE_USERNAME,
)
from servicenow.models import ServiceNowCaseCategory, ServiceNowCaseType

pytestmark = pytest.mark.django_db


# ─── decode_csv_bytes ────────────────────────────────────────────────────────

def test_decode_csv_bytes_handles_utf8():
    assert decode_csv_bytes("città".encode("utf-8")) == "città"


def test_decode_csv_bytes_falls_back_to_cp1252():
    # "à" in cp1252 (0xe0) non è UTF-8 valido da solo
    raw = "citt\xe0".encode("cp1252")
    assert decode_csv_bytes(raw) == "città"


def test_decode_csv_bytes_never_raises_on_garbage():
    decode_csv_bytes(b"\xff\xfe\x00\x01garbage")  # non deve sollevare eccezioni


# ─── parse_opened_at ─────────────────────────────────────────────────────────

def test_parse_opened_at_valid():
    date, time = parse_opened_at("03-08-2026 23:32:18")
    assert date == "2026-08-03"
    assert time == "23:32:18"


def test_parse_opened_at_empty():
    assert parse_opened_at("") == (None, None)
    assert parse_opened_at(None) == (None, None)


def test_parse_opened_at_unparseable_does_not_raise():
    assert parse_opened_at("not a date") == (None, None)


# ─── parse_priority ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("1 - Critical", "1"),
    ("2 - High", "2"),
    ("3 - Moderate", "3"),
    ("4 - Low", "4"),
])
def test_parse_priority_direct_mapping(raw, expected):
    value, warning = parse_priority(raw)
    assert value == expected
    assert warning is None


def test_parse_priority_5_planning_maps_to_low_with_warning():
    value, warning = parse_priority("5 - Planning")
    assert value == "4"
    assert warning is not None


def test_parse_priority_unrecognized_defaults_to_moderate_with_warning():
    value, warning = parse_priority("qualcosa di strano")
    assert value == "3"
    assert warning is not None


def test_parse_priority_empty_defaults_without_warning():
    value, warning = parse_priority("")
    assert value == "3"
    assert warning is None


# ─── parse_tags ───────────────────────────────────────────────────────────────

def test_parse_tags_splits_and_uppercases():
    assert parse_tags("ebit1, rts;  cdd") == {"EBIT1", "RTS", "CDD"}


def test_parse_tags_empty():
    assert parse_tags("") == set()
    assert parse_tags(None) == set()


# ─── resolve_category ─────────────────────────────────────────────────────────

def test_resolve_category_biotron():
    assert resolve_category("Radiology Italy Biotron") == ServiceNowCaseCategory.BIOTRON
    assert resolve_category("BIOTRON") == ServiceNowCaseCategory.BIOTRON


def test_resolve_category_philips_known_group():
    assert resolve_category("Radiology IIG") == ServiceNowCaseCategory.PHILIPS


def test_resolve_category_unknown_group_defaults_to_philips():
    assert resolve_category("Qualche Altro Gruppo") == ServiceNowCaseCategory.PHILIPS
    assert resolve_category("") == ServiceNowCaseCategory.PHILIPS


# ─── resolve_case_type_name (Philips) ────────────────────────────────────────

def test_philips_type_ebit_from_tag():
    assert resolve_case_type_name(ServiceNowCaseCategory.PHILIPS, {"EBIT1"}, "Radiology IIG", "ACME") == "EBIT"
    assert resolve_case_type_name(ServiceNowCaseCategory.PHILIPS, {"EBIT"}, "Radiology IIG", "ACME") == "EBIT"


def test_philips_type_ac_from_group():
    assert resolve_case_type_name(ServiceNowCaseCategory.PHILIPS, set(), "Radiology IIG AC", "ACME") == "AC"


def test_philips_type_ris_from_group():
    assert resolve_case_type_name(ServiceNowCaseCategory.PHILIPS, set(), "Radiology IIG RIS", "ACME") == "RIS"


def test_philips_type_gemelli_from_account():
    assert resolve_case_type_name(ServiceNowCaseCategory.PHILIPS, set(), "Radiology IIG", "POLICLINICO GEMELLI") == "GEMELLI"


def test_philips_type_gemelli_matches_real_truncated_account_name():
    # L'account reale in ServiceNow è troncato ("...UNIV.A.GEMEL", non
    # "GEMELLI" per intero) — verificato su CSV storico reale.
    assert resolve_case_type_name(
        ServiceNowCaseCategory.PHILIPS, set(), "Radiology IIG", "FONDAZIONE POLICLINICO UNIV.A.GEMEL",
    ) == "GEMELLI"


def test_philips_type_defaults_to_l1():
    assert resolve_case_type_name(ServiceNowCaseCategory.PHILIPS, set(), "Radiology IIG", "ACME Hospital") == "L1"


def test_philips_ebit_tag_wins_over_ac_group():
    # Ordine di precedenza: EBIT (tag) controllato prima di AC (gruppo).
    assert resolve_case_type_name(ServiceNowCaseCategory.PHILIPS, {"EBIT"}, "Radiology IIG AC", "ACME") == "EBIT"


# ─── resolve_case_type_name (Biotron) ────────────────────────────────────────

def test_biotron_type_privati_from_tag():
    assert resolve_case_type_name(ServiceNowCaseCategory.BIOTRON, {"PRIVATI"}, "Radiology Italy Biotron", "ACME") == "PRIVATI"


@pytest.mark.parametrize("tag", ["CDD", "GCI", "DSS", "EPSON", "RTS"])
def test_biotron_type_cdd_group_from_tags(tag):
    assert resolve_case_type_name(ServiceNowCaseCategory.BIOTRON, {tag}, "Radiology Italy Biotron", "ACME") == "CDD"


def test_biotron_type_defaults_to_l1():
    assert resolve_case_type_name(ServiceNowCaseCategory.BIOTRON, set(), "Radiology Italy Biotron", "ACME") == "L1"


# ─── match_assigned_to ────────────────────────────────────────────────────────

def _make_user(first, last, username=None):
    User = pytest.importorskip("django.contrib.auth").get_user_model()
    return User.objects.create_user(username=username or f"u{uuid.uuid4().hex[:8]}", first_name=first, last_name=last)


def test_match_assigned_to_exact_name():
    _make_user("Nicole", "Spazzoli")
    index = build_users_name_index()
    user, warning = match_assigned_to("Nicole Spazzoli", index)
    assert user is not None
    assert user.first_name == "Nicole"
    assert warning is None


def test_match_assigned_to_case_insensitive_and_word_order():
    _make_user("Mario", "Rossi")
    index = build_users_name_index()
    user, warning = match_assigned_to("rossi mario", index)
    assert user is not None
    assert warning is None


def test_match_assigned_to_no_match_returns_warning():
    index = build_users_name_index()
    user, warning = match_assigned_to("Persona Inesistente", index)
    assert user is None
    assert warning is not None


def test_match_assigned_to_ambiguous_returns_warning():
    _make_user("Luca", "Bianchi")
    _make_user("Luca", "Bianchi")  # omonimo
    index = build_users_name_index()
    user, warning = match_assigned_to("Luca Bianchi", index)
    assert user is None
    assert "ambigu" in warning.lower()


def test_match_assigned_to_empty_name_no_warning():
    index = build_users_name_index()
    user, warning = match_assigned_to("", index)
    assert user is None
    assert warning is None


# ─── resolve_assignment (assegnatario fisso AC/RIS) ──────────────────────────

def test_fixed_type_assignee_usernames_are_ac_philips_and_ris_philips():
    assert FIXED_TYPE_ASSIGNEE_USERNAME == {"AC": "ac.philips", "RIS": "ris.philips"}


def test_resolve_assignment_ac_uses_fixed_user_ignoring_csv_name():
    _make_user("Ana", "Csystem")  # username custom
    fixed = _make_user("Servizio", "AC", username="ac.philips")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.PHILIPS, "AC", "Nome Diverso Nel Csv", names_index, username_index)
    assert user is not None
    assert user.id == fixed.id
    assert any("assegnato automaticamente" in n for n in notes)


def test_resolve_assignment_ris_uses_fixed_user():
    fixed = _make_user("Servizio", "RIS", username="ris.philips")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.PHILIPS, "RIS", "", names_index, username_index)
    assert user is not None
    assert user.id == fixed.id


def test_resolve_assignment_ac_missing_fixed_user_returns_warning_no_fallback():
    names_index = build_users_name_index()
    username_index = build_users_username_index()  # ac.philips non esiste

    user, notes = resolve_assignment(ServiceNowCaseCategory.PHILIPS, "AC", "Qualcuno Reale", names_index, username_index)
    assert user is None
    assert any("ac.philips" in n and "non trovato" in n for n in notes)


def test_resolve_assignment_l1_falls_back_to_normal_name_matching():
    real_user = _make_user("Mario", "Rossi")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.PHILIPS, "L1", "Mario Rossi", names_index, username_index)
    assert user is not None
    assert user.id == real_user.id
    assert notes == []


# ─── resolve_assignment (fallback Type CDD, categoria Biotron) ───────────────

def test_resolve_assignment_cdd_matches_real_name_first_no_fallback():
    real_user = _make_user("Mario", "Rossi")
    _make_user("Cdd", "Biotron", username="cdd.biotron")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.BIOTRON, "CDD", "Mario Rossi", names_index, username_index)
    assert user is not None
    assert user.id == real_user.id
    assert notes == []


def test_resolve_assignment_cdd_falls_back_when_name_not_found():
    fallback = _make_user("Cdd", "Biotron", username="cdd.biotron")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.BIOTRON, "CDD", "Persona Inesistente", names_index, username_index)
    assert user is not None
    assert user.id == fallback.id
    assert any("cdd.biotron" in n and "fallback" in n for n in notes)
    # l'avviso originale (nome non trovato) resta comunque presente
    assert any("Persona Inesistente" in n for n in notes)


def test_resolve_assignment_cdd_falls_back_when_name_ambiguous():
    _make_user("Luca", "Bianchi")
    _make_user("Luca", "Bianchi")  # omonimo
    fallback = _make_user("Cdd", "Biotron", username="cdd.biotron")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.BIOTRON, "CDD", "Luca Bianchi", names_index, username_index)
    assert user is not None
    assert user.id == fallback.id
    assert any("ambigu" in n.lower() for n in notes)
    assert any("fallback" in n for n in notes)


def test_resolve_assignment_cdd_falls_back_when_csv_name_empty():
    fallback = _make_user("Cdd", "Biotron", username="cdd.biotron")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.BIOTRON, "CDD", "", names_index, username_index)
    assert user is not None
    assert user.id == fallback.id
    assert any("non specificato" in n.lower() for n in notes)


def test_resolve_assignment_cdd_missing_fallback_user_returns_warning_only():
    names_index = build_users_name_index()
    username_index = build_users_username_index()  # cdd.biotron non esiste

    user, notes = resolve_assignment(ServiceNowCaseCategory.BIOTRON, "CDD", "Persona Inesistente", names_index, username_index)
    assert user is None
    assert any("cdd.biotron" in n and "non trovato" in n for n in notes)


# ─── resolve_assignment (fallback categoria Philips) ─────────────────────────

def test_resolve_assignment_philips_l1_matches_real_name_first_no_fallback():
    real_user = _make_user("Mario", "Rossi")
    _make_user("Jolly", "Philips", username="jolly.philips")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.PHILIPS, "L1", "Mario Rossi", names_index, username_index)
    assert user is not None
    assert user.id == real_user.id
    assert notes == []


def test_resolve_assignment_philips_l1_falls_back_when_name_not_found():
    fallback = _make_user("Jolly", "Philips", username="jolly.philips")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.PHILIPS, "L1", "Persona Inesistente", names_index, username_index)
    assert user is not None
    assert user.id == fallback.id
    assert any("jolly.philips" in n and "fallback" in n for n in notes)


def test_resolve_assignment_philips_gemelli_falls_back_when_csv_name_empty():
    fallback = _make_user("Jolly", "Philips", username="jolly.philips")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.PHILIPS, "GEMELLI", "", names_index, username_index)
    assert user is not None
    assert user.id == fallback.id
    assert any("non specificato" in n.lower() for n in notes)


def test_resolve_assignment_philips_missing_fallback_user_returns_warning_only():
    names_index = build_users_name_index()
    username_index = build_users_username_index()  # jolly.philips non esiste

    user, notes = resolve_assignment(ServiceNowCaseCategory.PHILIPS, "L1", "Persona Inesistente", names_index, username_index)
    assert user is None
    assert any("jolly.philips" in n and "non trovato" in n for n in notes)


def test_resolve_assignment_biotron_l1_no_philips_fallback_stays_unassigned():
    # Un Type Biotron generico (non CDD) NON deve avere alcun fallback: solo
    # CDD (Biotron) e qualsiasi Type Philips lo hanno.
    _make_user("Jolly", "Philips", username="jolly.philips")
    _make_user("Cdd", "Biotron", username="cdd.biotron")
    names_index = build_users_name_index()
    username_index = build_users_username_index()

    user, notes = resolve_assignment(ServiceNowCaseCategory.BIOTRON, "L1", "Persona Inesistente", names_index, username_index)
    assert user is None
    assert len(notes) == 1
    assert "non trovato" in notes[0]
    assert not any("fallback" in n for n in notes)


# ─── validate_columns ──────────────────────────────────────────────────────────

def test_validate_columns_all_present():
    assert validate_columns(REQUIRED_COLUMNS) == []


def test_validate_columns_reports_missing():
    missing = validate_columns(["number", "account"])
    assert "opened_at" in missing
    assert "priority" in missing


# ─── process_csv (integrazione della sola logica di parsing) ─────────────────

def _csv_bytes(rows_text: str) -> bytes:
    header = ",".join(REQUIRED_COLUMNS)
    return (header + "\n" + rows_text).encode("utf-8")


def test_process_csv_missing_columns():
    rows, missing = process_csv(b"number,account\nCS1,ACME\n", set(), {}, {})
    assert rows == []
    assert missing  # almeno una colonna mancante


def test_process_csv_creates_row_for_valid_data():
    ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.PHILIPS, name="L1")
    lookup = build_case_type_lookup()
    csv_bytes = _csv_bytes(
        'CS0001,ACME Hospital,03-08-2026 10:00:00,Server down,3 - Moderate,Radiology IIG,,\n'
    )
    rows, missing = process_csv(csv_bytes, set(), {}, lookup)
    assert missing == []
    assert len(rows) == 1
    assert rows[0].outcome == "create"
    assert rows[0].category == ServiceNowCaseCategory.PHILIPS
    assert rows[0].case_type_name == "L1"


def test_process_csv_ac_type_gets_fixed_assignee_via_full_pipeline():
    ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.PHILIPS, name="AC")
    fixed = _make_user("Servizio", "AC", username="ac.philips")
    lookup = build_case_type_lookup()
    username_index = build_users_username_index()
    csv_bytes = _csv_bytes(
        'CS0002,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG AC,Persona Diversa,\n'
    )
    rows, _ = process_csv(csv_bytes, set(), {}, lookup, username_index)
    assert rows[0].case_type_name == "AC"
    assert rows[0].assigned_to_id == fixed.id
    assert rows[0].assigned_to_csv == "Persona Diversa"  # il nome CSV resta visibile, ma ignorato


def test_process_csv_cdd_type_falls_back_to_service_user_via_full_pipeline():
    ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.BIOTRON, name="CDD")
    fallback = _make_user("Cdd", "Biotron", username="cdd.biotron")
    lookup = build_case_type_lookup()
    username_index = build_users_username_index()
    csv_bytes = _csv_bytes(
        'CS0003,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology Italy Biotron,Persona Inesistente,CDD\n'
    )
    rows, _ = process_csv(csv_bytes, set(), build_users_name_index(), lookup, username_index)
    assert rows[0].case_type_name == "CDD"
    assert rows[0].assigned_to_id == fallback.id
    assert any("fallback" in w for w in rows[0].warnings)


def test_process_csv_philips_l1_falls_back_to_service_user_via_full_pipeline():
    ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.PHILIPS, name="L1")
    fallback = _make_user("Jolly", "Philips", username="jolly.philips")
    lookup = build_case_type_lookup()
    username_index = build_users_username_index()
    csv_bytes = _csv_bytes(
        'CS0004,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,Persona Inesistente,\n'
    )
    rows, _ = process_csv(csv_bytes, set(), build_users_name_index(), lookup, username_index)
    assert rows[0].case_type_name == "L1"
    assert rows[0].category == ServiceNowCaseCategory.PHILIPS
    assert rows[0].assigned_to_id == fallback.id
    assert any("fallback" in w for w in rows[0].warnings)


def test_process_csv_skips_duplicate_against_existing_db_numbers():
    ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.PHILIPS, name="L1")
    lookup = build_case_type_lookup()
    csv_bytes = _csv_bytes('CS0001,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,\n')
    rows, _ = process_csv(csv_bytes, {"CS0001"}, {}, lookup)
    assert rows[0].outcome == "duplicate"


def test_process_csv_skips_duplicate_within_same_file():
    ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.PHILIPS, name="L1")
    lookup = build_case_type_lookup()
    csv_bytes = _csv_bytes(
        'CS0001,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,\n'
        'CS0001,ACME Hospital,03-08-2026 11:00:00,y,3 - Moderate,Radiology IIG,,\n'
    )
    rows, _ = process_csv(csv_bytes, set(), {}, lookup)
    assert rows[0].outcome == "create"
    assert rows[1].outcome == "duplicate"


def test_process_csv_missing_number_is_a_row_error():
    ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.PHILIPS, name="L1")
    lookup = build_case_type_lookup()
    csv_bytes = _csv_bytes(',ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,\n')
    rows, _ = process_csv(csv_bytes, set(), {}, lookup)
    assert rows[0].outcome == "error"
    assert "numero" in rows[0].error.lower()


def test_process_csv_missing_case_type_in_db_is_a_row_error():
    # Nessun ServiceNowCaseType creato: il lookup è vuoto → riga in errore,
    # non un crash.
    csv_bytes = _csv_bytes('CS0001,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,\n')
    rows, _ = process_csv(csv_bytes, set(), {}, {})
    assert rows[0].outcome == "error"
    assert "type" in rows[0].error.lower()


def test_summarize_counts_outcomes():
    ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.PHILIPS, name="L1")
    lookup = build_case_type_lookup()
    csv_bytes = _csv_bytes(
        'CS0001,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,\n'
        'CS0001,ACME Hospital,03-08-2026 11:00:00,y,3 - Moderate,Radiology IIG,,\n'
        ',ACME Hospital,03-08-2026 11:00:00,y,3 - Moderate,Radiology IIG,,\n'
    )
    rows, _ = process_csv(csv_bytes, set(), {}, lookup)
    summary = summarize(rows)
    assert summary["total"] == 3
    assert summary["to_create"] == 1
    assert summary["duplicates"] == 1
    assert summary["errors"] == 1
