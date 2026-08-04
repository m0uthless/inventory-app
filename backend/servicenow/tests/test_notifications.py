"""Test per servicenow/notifications.py — notifica Teams alla creazione di
un ServiceNowCase.

Copre: no-op quando il webhook non è configurato, struttura del payload
(Adaptive Card, mention assegnatario), e comportamento "best-effort" — un
fallimento HTTP o un'eccezione di rete non devono mai propagarsi.
"""
from types import SimpleNamespace
from unittest.mock import patch

import requests

from servicenow.notifications import notify_teams_new_case, get_philips_notify_mode


def _make_case(**overrides):
    """Un case 'finto' minimale: notify_teams_new_case usa solo attributi,
    non serve un'istanza reale di ServiceNowCase né il DB."""
    defaults = dict(
        pk=1,
        number="CS0628228",
        account="ACME Hospital",
        short_description="Server down",
        external_url="",
        assigned_to=None,
    )
    defaults.update(overrides)
    case = SimpleNamespace(**defaults)
    case.get_category_display = lambda: "Biotron"
    case.case_type = SimpleNamespace(name="L1")
    case.case_type_id = 1
    return case


def test_noop_when_webhook_not_configured(settings):
    settings.SERVICENOW_TEAMS_WEBHOOK_URL = ""
    with patch("servicenow.notifications.requests.post") as mock_post:
        notify_teams_new_case(_make_case())
    mock_post.assert_not_called()


def test_sends_adaptive_card_with_expected_facts(settings):
    settings.SERVICENOW_TEAMS_WEBHOOK_URL = "https://example.com/webhook"
    case = _make_case()

    with patch("servicenow.notifications.requests.post") as mock_post:
        mock_post.return_value = SimpleNamespace(status_code=200, text="")
        notify_teams_new_case(case)

    assert mock_post.call_count == 1
    _, kwargs = mock_post.call_args
    payload = kwargs["json"]
    card = payload["attachments"][0]["content"]
    body_texts = [b["text"] for b in card["body"] if b["type"] == "TextBlock"]

    assert any("CS0628228" in t for t in body_texts)
    assert any("Server down" in t for t in body_texts)
    facts = card["body"][2]["facts"]
    assert {"title": "Account", "value": "ACME Hospital"} in facts
    assert {"title": "Type", "value": "Biotron · L1"} in facts
    assert "msteams" not in card  # nessun assegnatario -> nessuna mention


def test_case_number_becomes_markdown_link_when_external_url_set(settings):
    settings.SERVICENOW_TEAMS_WEBHOOK_URL = "https://example.com/webhook"
    case = _make_case(external_url="https://servicenow.example.com/CS0628228")

    with patch("servicenow.notifications.requests.post") as mock_post:
        mock_post.return_value = SimpleNamespace(status_code=200, text="")
        notify_teams_new_case(case)

    card = mock_post.call_args.kwargs["json"]["attachments"][0]["content"]
    title_text = card["body"][0]["text"]
    assert "[CS0628228](https://servicenow.example.com/CS0628228)" in title_text


def test_mentions_assignee_when_email_present(settings):
    settings.SERVICENOW_TEAMS_WEBHOOK_URL = "https://example.com/webhook"
    assignee = SimpleNamespace(email="mario.rossi@biotron.it", get_full_name=lambda: "Mario Rossi")
    case = _make_case(assigned_to=assignee)

    with patch("servicenow.notifications.requests.post") as mock_post:
        mock_post.return_value = SimpleNamespace(status_code=200, text="")
        notify_teams_new_case(case)

    card = mock_post.call_args.kwargs["json"]["attachments"][0]["content"]
    assert "msteams" in card
    entities = card["msteams"]["entities"]
    assert entities[0]["mentioned"] == {"id": "mario.rossi@biotron.it", "name": "Mario Rossi"}


def test_assignee_without_email_is_silently_skipped(settings):
    settings.SERVICENOW_TEAMS_WEBHOOK_URL = "https://example.com/webhook"
    assignee = SimpleNamespace(email="", get_full_name=lambda: "Mario Rossi")
    case = _make_case(assigned_to=assignee)

    with patch("servicenow.notifications.requests.post") as mock_post:
        mock_post.return_value = SimpleNamespace(status_code=200, text="")
        notify_teams_new_case(case)

    card = mock_post.call_args.kwargs["json"]["attachments"][0]["content"]
    assert "msteams" not in card


def test_http_error_response_does_not_raise(settings):
    settings.SERVICENOW_TEAMS_WEBHOOK_URL = "https://example.com/webhook"
    with patch("servicenow.notifications.requests.post") as mock_post:
        mock_post.return_value = SimpleNamespace(status_code=500, text="boom")
        notify_teams_new_case(_make_case())  # non deve sollevare


def test_network_exception_does_not_raise(settings):
    settings.SERVICENOW_TEAMS_WEBHOOK_URL = "https://example.com/webhook"
    with patch("servicenow.notifications.requests.post", side_effect=requests.ConnectionError("down")):
        notify_teams_new_case(_make_case())  # non deve sollevare


def test_request_uses_short_timeout(settings):
    settings.SERVICENOW_TEAMS_WEBHOOK_URL = "https://example.com/webhook"
    with patch("servicenow.notifications.requests.post") as mock_post:
        mock_post.return_value = SimpleNamespace(status_code=200, text="")
        notify_teams_new_case(_make_case())
    assert mock_post.call_args.kwargs["timeout"] == 5


# ─── get_philips_notify_mode ────────────────────────────────────────────────
# Switch TEMPORANEO in prova (SERVICENOW_PHILIPS_NOTIFY_MODE): "teams"
# (default, storico) oppure "modal" (niente Teams per i case Philips).

def test_philips_notify_mode_defaults_to_teams(settings):
    settings.SERVICENOW_PHILIPS_NOTIFY_MODE = "teams"
    assert get_philips_notify_mode() == "teams"


def test_philips_notify_mode_reads_modal(settings):
    settings.SERVICENOW_PHILIPS_NOTIFY_MODE = "modal"
    assert get_philips_notify_mode() == "modal"


def test_philips_notify_mode_falls_back_to_teams_on_invalid_value(settings):
    settings.SERVICENOW_PHILIPS_NOTIFY_MODE = "carrier-pigeon"
    assert get_philips_notify_mode() == "teams"
