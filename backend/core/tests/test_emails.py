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


def _image_cids(msg):
    return [
        part.get("Content-ID")
        for part in msg.message().walk()
        if part.get_content_maintype() == "image"
    ]


@override_settings(DEFAULT_FROM_EMAIL="noreply@biotron.it")
def test_send_templated_email_attaches_inline_image_referenced_by_cid():
    sent, error = send_templated_email(
        template_name="emails/issue_assigned.html",
        context={
            "nome_utente": "Mario",
            "issue_title": "Server KO",
            "customer_name": "ACME",
            "is_new_owner": True,
        },
        subject="Test cid",
        recipient_list=["mario@example.com"],
    )
    assert sent is True and error is None

    msg = mail.outbox[-1]
    assert msg.mixed_subtype == "related"
    assert "<archie-issue_assigned@biotron.email>" in _image_cids(msg)


@override_settings(DEFAULT_FROM_EMAIL="noreply@biotron.it")
def test_send_templated_email_missing_inline_asset_does_not_fail(monkeypatch, tmp_path):
    # Directory asset vuota: il cid del template non trova nessun file.
    monkeypatch.setattr("core.emails._ASSETS_DIR", tmp_path)

    sent, error = send_templated_email(
        template_name="emails/issue_assigned.html",
        context={
            "nome_utente": "Mario",
            "issue_title": "X",
            "customer_name": "Y",
            "is_new_owner": True,
        },
        subject="Test asset mancante",
        recipient_list=["mario@example.com"],
    )
    assert sent is True and error is None

    msg = mail.outbox[-1]
    assert _image_cids(msg) == []  # nessuna immagine, ma l'email è partita


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
