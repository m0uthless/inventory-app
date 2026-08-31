from __future__ import annotations

from core.emails import _brand_for_module


def test_brand_for_module_portal_package_root():
    assert _brand_for_module("portal") == "portal"


def test_brand_for_module_portal_submodule():
    assert _brand_for_module("portal.api") == "portal"
    assert _brand_for_module("portal.signals") == "portal"
    assert _brand_for_module("portal.tests.test_email_brand_detection") == "portal"


def test_brand_for_module_non_portal_defaults_to_archie():
    assert _brand_for_module("core.admin_users_api") == "archie"
    assert _brand_for_module("maintenance.api.plans") == "archie"
    assert _brand_for_module("notifications.management.commands.refresh_notifications") == "archie"


def test_brand_for_module_does_not_match_unrelated_prefix():
    # "portalx" non è il package "portal": non deve fare match per prefisso stringa.
    assert _brand_for_module("portalx.api") == "archie"


from django.core import mail
from django.test import override_settings

from core.emails import send_templated_email


@override_settings(DEFAULT_FROM_EMAIL="noreply@biotron.it")
def test_send_templated_email_from_non_portal_module_uses_archie_brand():
    # Questo test file vive in core/tests/, quindi il modulo chiamante è
    # "core.tests.test_emails" → non inizia per "portal." → brand "archie".
    sent, error = send_templated_email(
        template_name="emails/_test_probe.html",
        context={"nome": "Mario"},
        subject="Test Archie",
        recipient_list=["mario@example.com"],
    )
    assert sent is True
    assert error is None
    assert len(mail.outbox) == 1

    msg = mail.outbox[0]
    assert msg.subject == "Test Archie"
    assert msg.to == ["mario@example.com"]
    assert msg.from_email == "ARCHIE <noreply@biotron.it>"

    html_body = msg.alternatives[0][0]
    assert msg.alternatives[0][1] == "text/html"
    assert "ARCHIE" in html_body
    assert "Ciao Mario, questo è un contenuto di prova." in html_body

    # Fallback plain-text auto-generato da strip_tags(): niente tag HTML,
    # ma il testo del contenuto è presente.
    assert "<p" not in msg.body
    assert "Ciao Mario, questo è un contenuto di prova." in msg.body


@override_settings(DEFAULT_FROM_EMAIL="noreply@biotron.it")
def test_send_templated_email_plain_text_unescapes_html_entities():
    sent, error = send_templated_email(
        template_name="emails/_test_probe.html",
        context={"nome": "D'Angelo & Co"},
        subject="Test entities",
        recipient_list=["mario@example.com"],
    )
    assert sent is True
    msg = mail.outbox[-1]
    html_body = msg.alternatives[0][0]
    assert "D&#x27;Angelo &amp; Co" in html_body  # HTML stays escaped (autoescape correctly on)
    assert "D'Angelo & Co" in msg.body  # plain-text is unescaped, readable


def test_send_templated_email_returns_false_and_message_on_failure(monkeypatch):
    def _raise_on_send(self, fail_silently=False):
        raise RuntimeError("SMTP non raggiungibile")

    monkeypatch.setattr(
        "django.core.mail.EmailMultiAlternatives.send", _raise_on_send
    )

    sent, error = send_templated_email(
        template_name="emails/_test_probe.html",
        context={"nome": "Mario"},
        subject="Test Archie",
        recipient_list=["mario@example.com"],
    )
    assert sent is False
    assert error == "SMTP non raggiungibile"
