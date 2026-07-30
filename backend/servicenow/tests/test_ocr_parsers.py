"""Test unitari per le funzioni di parsing pure di servicenow/ocr.py.

Non richiedono Tesseract né immagini: verificano solo la logica di
interpretazione del testo già estratto (priorità, data, pulizia artefatti),
che è la parte deterministica e testabile senza OCR reale.
"""
import pytest

from servicenow.ocr import (
    _Word,
    _estimate_char_height,
    _find_value_words_for_label,
    _is_icon_artifact,
    _is_probable_label_or_icon_fragment,
    _parse_date,
    _parse_priority,
    _strip_icon_artifacts,
)


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


# ─── _is_icon_artifact ────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", ["|", "Q", "©", "Q.", "||"])
def test_is_icon_artifact_true_for_known_glyphs(text):
    assert _is_icon_artifact(text) is True


@pytest.mark.parametrize("text", ["ACME", "3", "SPA", "-", "2026"])
def test_is_icon_artifact_false_for_real_tokens(text):
    assert _is_icon_artifact(text) is False


# ─── _find_value_words_for_label — filtro icone tra label e valore ────────────
# Non richiede Tesseract: costruisce direttamente le bounding-box (_Word),
# come farebbe pytesseract, per testare la logica geometrica pura.

def test_find_value_words_skips_leading_icon_artifact():
    label = _Word(text="Account", left=0, top=0, right=50, bottom=10)
    icon  = _Word(text="|", left=55, top=0, right=60, bottom=10)
    v1    = _Word(text="ACME", left=65, top=0, right=100, bottom=10)
    v2    = _Word(text="Hospital", left=105, top=0, right=150, bottom=10)
    words = [label, icon, v1, v2]

    value_words = _find_value_words_for_label(
        words, label, y_tolerance=2.0, max_label_gap=50.0, max_word_gap=10.0,
    )
    assert [w.text for w in value_words] == ["ACME", "Hospital"]


def test_find_value_words_skips_icon_artifact_between_value_words():
    label = _Word(text="Short", left=0, top=0, right=40, bottom=10)
    v1    = _Word(text="Nuovo", left=45, top=0, right=80, bottom=10)
    icon  = _Word(text="|", left=83, top=0, right=88, bottom=10)
    v2    = _Word(text="profilo", left=91, top=0, right=130, bottom=10)
    words = [label, v1, icon, v2]

    value_words = _find_value_words_for_label(
        words, label, y_tolerance=2.0, max_label_gap=50.0, max_word_gap=10.0,
    )
    assert [w.text for w in value_words] == ["Nuovo", "profilo"]


# ─── _is_probable_label_or_icon_fragment ──────────────────────────────────────
# Usato solo nel fallback "Short" → valore quando "Description" non viene
# rilevata a bassa risoluzione (vedi extract_servicenow_fields).

@pytest.mark.parametrize(
    "text",
    ["Descrption|", "Description", "descr", "2", "|", "©"],
)
def test_is_probable_label_or_icon_fragment_true(text):
    assert _is_probable_label_or_icon_fragment(text) is True


@pytest.mark.parametrize("text", ["Nuovo", "profilo", "Problema", "42gg"])
def test_is_probable_label_or_icon_fragment_false_for_real_value_tokens(text):
    assert _is_probable_label_or_icon_fragment(text) is False


# ─── _estimate_char_height — soglia bassa risoluzione ─────────────────────────

def test_estimate_char_height_median_ignores_icon_outliers():
    # Simula uno screenshot dove la maggior parte del testo è a 8-9px ma
    # alcune icone vengono lette con bounding-box enormi (28-32px): la
    # mediana deve restare vicina alla dimensione reale del testo, non
    # farsi trascinare dagli outlier (è la base per decidere se attivare
    # il pass di recupero a bassa risoluzione).
    heights = [8, 8, 9, 9, 9, 8, 28, 32, 28] * 3
    words = [_Word(text="x", left=0, top=0, right=5, bottom=h) for h in heights]
    assert _estimate_char_height(words) == pytest.approx(9.0)
