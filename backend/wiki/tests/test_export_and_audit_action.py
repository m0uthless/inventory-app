"""wiki/tests/test_export_and_audit_action.py

Verifica:
 1. export_pdf restituisce un PDF valido (content-type, content-disposition, bytes non vuoti).
 2. export_pdf funziona con contenuto markdown vuoto.
 3. export_pdf funziona con contenuto molto lungo (multi-pagina).
 4. export_pdf restituisce 404 su pagina inesistente.
 5. export_pdf restituisce 404 su pagina soft-deleted.
 6. AuditEvent.Action.RATE è nella enum e viene salvato correttamente
    da rate_page (fix PC-02).
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model

from audit.models import AuditEvent
from wiki.models import WikiCategory, WikiPage

pytestmark = pytest.mark.django_db

User = get_user_model()


# ─── Fixtures ────────────────────────────────────────────────────────────────

def _uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:6]}"


def _superuser():
    return User.objects.create_superuser(
        username=_uid("su_"), email="s@e.com", password="pw"
    )


def _make_page(owner, *, title="Test Page", content="# Hello\n\nParagrafo di test."):
    return WikiPage.objects.create(
        title=title,
        slug=_uid("slug-"),
        content_markdown=content,
        is_published=True,
        created_by=owner,
        updated_by=owner,
    )


def _auth_client(user):
    from rest_framework.test import APIClient
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ─── Test: export_pdf ─────────────────────────────────────────────────────────

class TestExportPdf:
    def test_returns_pdf_content_type_and_attachment_header(self):
        user = _superuser()
        page = _make_page(user)
        client = _auth_client(user)

        res = client.get(f"/api/wiki-pages/{page.id}/export-pdf/")

        assert res.status_code == 200, f"Atteso 200, ricevuto {res.status_code}: {res.content[:200]}"
        assert res["Content-Type"] == "application/pdf"
        assert "attachment" in res["Content-Disposition"]
        assert page.slug in res["Content-Disposition"]

    def test_pdf_content_is_non_empty_bytes(self):
        user = _superuser()
        page = _make_page(user, content="## Sezione\n\nTesto del documento.")
        client = _auth_client(user)

        res = client.get(f"/api/wiki-pages/{page.id}/export-pdf/")

        assert res.status_code == 200
        # Un PDF valido inizia sempre con %PDF-
        assert res.content[:5] == b"%PDF-", (
            "Il contenuto restituito non è un PDF valido (manca l'header %PDF-)."
        )
        assert len(res.content) > 100, "Il PDF è troppo corto per essere valido."

    def test_pdf_with_empty_content_does_not_crash(self):
        user = _superuser()
        page = _make_page(user, content="")
        client = _auth_client(user)

        res = client.get(f"/api/wiki-pages/{page.id}/export-pdf/")

        assert res.status_code == 200
        assert res.content[:5] == b"%PDF-"

    def test_pdf_with_long_content_produces_valid_pdf(self):
        """Verifica che contenuto lungo (multi-pagina) non causi overflow o crash."""
        user = _superuser()
        # Genera circa 200 righe di testo per forzare il salto pagina
        long_content = "\n\n".join(
            f"## Sezione {i}\n\n" + ("Testo di esempio per la sezione. " * 10)
            for i in range(20)
        )
        page = _make_page(user, content=long_content)
        client = _auth_client(user)

        res = client.get(f"/api/wiki-pages/{page.id}/export-pdf/")

        assert res.status_code == 200
        assert res.content[:5] == b"%PDF-"

    def test_pdf_filename_uses_page_slug(self):
        user = _superuser()
        page = WikiPage.objects.create(
            title="Documento Speciale",
            slug="documento-speciale",
            content_markdown="Contenuto.",
            created_by=user,
            updated_by=user,
        )
        client = _auth_client(user)

        res = client.get(f"/api/wiki-pages/{page.id}/export-pdf/")

        assert res.status_code == 200
        assert "documento-speciale.pdf" in res["Content-Disposition"]

    def test_pdf_returns_404_for_nonexistent_page(self):
        user = _superuser()
        client = _auth_client(user)

        res = client.get("/api/wiki-pages/999999/export-pdf/")

        assert res.status_code == 404

    def test_pdf_returns_404_for_soft_deleted_page(self):
        from django.utils import timezone
        user = _superuser()
        page = _make_page(user)
        page.deleted_at = timezone.now()
        page.save(update_fields=["deleted_at"])
        client = _auth_client(user)

        res = client.get(f"/api/wiki-pages/{page.id}/export-pdf/")

        assert res.status_code == 404, (
            "Le pagine soft-deleted non devono essere esportabili."
        )

    def test_pdf_requires_authentication(self):
        from rest_framework.test import APIClient
        user = _superuser()
        page = _make_page(user)
        anon_client = APIClient()

        res = anon_client.get(f"/api/wiki-pages/{page.id}/export-pdf/")

        assert res.status_code in (401, 403), (
            "L'endpoint export-pdf deve richiedere autenticazione."
        )


# ─── Test: AuditEvent.Action.RATE (fix PC-02) ────────────────────────────────

class TestAuditEventActionRate:
    def test_rate_is_in_action_choices(self):
        """Verifica che RATE sia nella enum Action dopo il fix PC-02."""
        choices = [choice[0] for choice in AuditEvent.Action.choices]
        assert "rate" in choices, (
            "AuditEvent.Action non contiene 'rate'. "
            "Applica il fix PC-02 (aggiungi RATE = 'rate', 'Rate' alla enum)."
        )
        assert AuditEvent.Action.RATE == "rate"

    def test_rate_page_creates_audit_event_with_rate_action(self):
        """rate_page() deve creare un AuditEvent con action='rate'."""
        owner = _superuser()
        voter = User.objects.create_user(username=_uid("voter_"), password="pw")
        page = _make_page(owner)
        client = _auth_client(voter)

        res = client.post(
            f"/api/wiki-pages/{page.id}/rate/",
            {"rating": 4},
            format="json",
        )
        assert res.status_code == 201, f"Atteso 201, ricevuto {res.status_code}: {res.data}"

        event = AuditEvent.objects.filter(
            action="rate",
            object_id=str(page.pk),
        ).first()
        assert event is not None, (
            "Nessun AuditEvent con action='rate' trovato dopo rate_page()."
        )
        assert event.actor_id == voter.pk
        assert event.changes == {"rating": 4}

    def test_audit_event_rate_is_stored_and_retrievable(self):
        """Un AuditEvent con action='rate' deve essere salvato e recuperabile."""
        user = _superuser()
        page = _make_page(user)

        # Crea direttamente tramite utils per isolare dal ViewSet
        from audit.utils import log_event
        log_event(
            actor=user,
            action=AuditEvent.Action.RATE,
            instance=page,
            changes={"rating": 5},
        )

        event = AuditEvent.objects.filter(action="rate").last()
        assert event is not None
        assert event.action == "rate"
        assert event.changes == {"rating": 5}

    def test_audit_event_max_length_supports_rate(self):
        """max_length=32 deve essere sufficiente per tutti i valori dell'enum."""
        for value, _ in AuditEvent.Action.choices:
            assert len(value) <= 32, (
                f"Il valore '{value}' supera max_length=32."
            )
