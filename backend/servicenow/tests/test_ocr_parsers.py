"""Test unitari per le funzioni di parsing pure di servicenow/ocr.py.

Non richiedono Tesseract né immagini: verificano solo la logica di
interpretazione del testo già estratto (priorità, data, pulizia artefatti),
che è la parte deterministica e testabile senza OCR reale.
"""
import pytest

from servicenow.ocr import _parse_date, _parse_priority, _strip_icon_artifacts


# ─── _parse_priority ───────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "raw, expected_value, expected_raw",
    [
        ("1 - Critical", "1", "1 - Critical"),
        ("2 - High", "2", "2 - High"),
        ("3 - Moderate", "3", "3 - Moderate"),
        ("4 - Low", "4", "4 - Low"),
        ("  3 - Moderate  ", "3", "3 - Moderate"),
    ],
)
def test_parse_priority_valid(raw, expected_value, expected_raw):
    value, raw_out = _parse_priority(raw)
    assert value == expected_value
    assert raw_out == expected_raw


def test_parse_priority_unrecognized_text_keeps_raw_but_no_value():
    value, raw_out = _parse_priority("Not a priority")
    assert value is None
    assert raw_out == "Not a priority"


def test_parse_priority_empty_or_none_returns_none_none():
    assert _parse_priority(None) == (None, None)
    assert _parse_priority("") == (None, None)


# ─── _parse_date ───────────────────────────────────────────────────────────

def test_parse_date_valid_dd_mm_yyyy_with_dash():
    assert _parse_date("28-03-2025") == "2025-03-28"


def test_parse_date_valid_dd_mm_yyyy_with_slash():
    assert _parse_date("28/03/2025 10:15:00") == "2025-03-28"


def test_parse_date_embedded_in_longer_string():
    assert _parse_date("Opened 05-11-2025 by John") == "2025-11-05"


def test_parse_date_invalid_calendar_date_returns_none():
    # 31 non esiste in aprile
    assert _parse_date("31-04-2025") is None


def test_parse_date_no_match_returns_none():
    assert _parse_date("nessuna data qui") is None


def test_parse_date_none_or_empty_returns_none():
    assert _parse_date(None) is None
    assert _parse_date("") is None


# ─── _strip_icon_artifacts ───────────────────────────────────────────────────

def test_strip_icon_artifacts_removes_trailing_search_icon_q():
    assert _strip_icon_artifacts("ACME Hospital Q") == "ACME Hospital"


def test_strip_icon_artifacts_removes_trailing_pipe():
    assert _strip_icon_artifacts("ACME Hospital |") == "ACME Hospital"


def test_strip_icon_artifacts_removes_repeated_artifacts():
    assert _strip_icon_artifacts("ACME Hospital Q. |") == "ACME Hospital"


def test_strip_icon_artifacts_leaves_clean_text_untouched():
    assert _strip_icon_artifacts("ACME Hospital") == "ACME Hospital"


def test_strip_icon_artifacts_none_passthrough():
    assert _strip_icon_artifacts(None) is None


def test_strip_icon_artifacts_all_artifact_falls_back_to_original():
    # Se la pulizia svuoterebbe la stringa, mantiene il testo originale
    # invece di restituire una stringa vuota inutile.
    assert _strip_icon_artifacts("Q") == "Q"
