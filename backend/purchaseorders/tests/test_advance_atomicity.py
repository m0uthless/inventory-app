"""Test di regressione 0.9.1 (WP-05, archie-atomicworkflows — audit
2026-08-19, REL-002): PurchaseOrderEntryViewSet.advance() creava il
documento allegato e aggiornava lo stato dell'entry in due passi separati
senza transaction.atomic() — se obj.save() falliva DOPO che il documento
era già stato creato, restava un PurchaseOrderDocument taggato per il
nuovo stato ma con l'entry ancora nello stato vecchio (metadati
inconsistenti: "documento ricevuto caricato" su un PO che risulta ancora
"inviato").
"""
from io import BytesIO
from unittest.mock import patch

import pytest
from django.db import DatabaseError

from purchaseorders.models import PurchaseOrderDocument, PurchaseOrderEntry

pytestmark = pytest.mark.django_db


def _pdf_file(name="offerta.pdf", content=b"%PDF-1.4 minimal test content"):
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(name, content, content_type="application/pdf")


@pytest.fixture
def entry(db):
    return PurchaseOrderEntry.objects.create(
        offer_date="2026-01-10",
        description="Test REL-002",
        client_name="ACME Test",
        kind="extra",
        status="inserito",
        amount_mode="fisso",
        amount="100.00",
    )


def test_advance_with_document_succeeds_normally(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)

    resp = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/advance/",
        {"document": _pdf_file()},
        format="multipart",
    )
    assert resp.status_code == 200, resp.data

    entry.refresh_from_db()
    assert entry.status == "inviato"
    assert entry.documents.filter(kind="offer").count() == 1


def test_advance_is_atomic_when_status_save_fails(api_client, superuser, entry):
    """Riproduce il bug: se obj.save() fallisce DOPO che il documento è
    già stato creato, con il fix non deve restare un documento orfano
    associato a un'entry il cui stato non è mai avanzato."""
    api_client.force_authenticate(user=superuser)

    with patch(
        "purchaseorders.api.PurchaseOrderEntry.save",
        side_effect=DatabaseError("simulated failure"),
    ):
        with pytest.raises(DatabaseError):
            api_client.post(
                f"/api/purchase-order-entries/{entry.id}/advance/",
                {"document": _pdf_file()},
                format="multipart",
            )

    entry.refresh_from_db()
    assert entry.status == "inserito", "lo stato non deve essere cambiato dopo il rollback"
    assert entry.documents.count() == 0, "nessun documento orfano deve restare dopo il rollback"
