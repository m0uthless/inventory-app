"""Verifica che send_templated_email rilevi il brand "portal" quando la
chiamata arriva da un modulo reale sotto il package `portal` (non solo
dalla funzione pura _brand_for_module, testata in core/tests/test_emails.py).
"""
from __future__ import annotations

from django.core import mail
from django.test import override_settings

from core.emails import send_templated_email


@override_settings(DEFAULT_FROM_EMAIL="noreply@biotron.it")
def test_send_templated_email_called_from_portal_package_uses_portal_brand():
    # Questo file vive in backend/portal/tests/, quindi il modulo chiamante
    # è "portal.tests.test_email_brand_detection" → brand "portal".
    sent, error = send_templated_email(
        template_name="emails/_test_probe.html",
        context={"nome": "Cliente"},
        subject="Test Portal",
        recipient_list=["cliente@example.com"],
    )
    assert sent is True
    assert error is None

    msg = mail.outbox[0]
    assert msg.from_email == "Portal Biotron <noreply@biotron.it>"
    html_body = msg.alternatives[0][0]
    assert "Portal Biotron" in html_body
    assert "Biotron S.p.A. — Portal clienti." in html_body
