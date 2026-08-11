"""purchaseorders/tests/test_documents.py — Punto 9: multi-PDF per tipo.

Copre:
 1. Un upload NON sovrascrive un documento già presente dello stesso kind
    (comportamento precedente, ora sostituito).
 2. Più upload dello stesso kind si accumulano nella lista.
 3. GET della lista documenti.
 4. GET del singolo documento scarica il file (inline).
 5. DELETE del singolo documento lo rimuove senza toccare gli altri.
 6. advance() con un PDF allegato crea una riga documento (non sovrascrive).
 7. Upload/delete richiedono il permesso di modifica.
"""
from io import BytesIO

import pytest

from core.models import CustomerStatus
from purchaseorders.models import PurchaseOrderDocument, PurchaseOrderEntry


def _pdf_file(name="test.pdf", content=b"%PDF-1.4 minimal test content"):
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(name, content, content_type="application/pdf")


@pytest.fixture
def entry(db):
    return PurchaseOrderEntry.objects.create(
        offer_date="2026-01-10",
        description="Test Punto 9",
        client_name="ACME Test",
        kind="extra",
        status="inserito",
        amount_mode="fisso",
        amount="100.00",
    )


@pytest.mark.django_db
def test_upload_appends_not_overwrites(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)

    r1 = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "offer", "file": _pdf_file("offerta1.pdf")},
        format="multipart",
    )
    assert r1.status_code == 201

    r2 = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "offer", "file": _pdf_file("offerta2.pdf")},
        format="multipart",
    )
    assert r2.status_code == 201

    docs = PurchaseOrderDocument.objects.filter(entry=entry, kind="offer")
    assert docs.count() == 2
    filenames = set(docs.values_list("original_filename", flat=True))
    assert filenames == {"offerta1.pdf", "offerta2.pdf"}


@pytest.mark.django_db
def test_list_documents(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)
    api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "po", "file": _pdf_file("po1.pdf")},
        format="multipart",
    )

    resp = api_client.get(f"/api/purchase-order-entries/{entry.id}/documents/")
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]["kind"] == "po"
    assert resp.data[0]["filename"] == "po1.pdf"
    assert resp.data[0]["uploaded_at"] is not None


@pytest.mark.django_db
def test_download_single_document(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)
    upload = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "invoice", "file": _pdf_file("fattura.pdf")},
        format="multipart",
    )
    doc_id = upload.data["id"]

    resp = api_client.get(f"/api/purchase-order-entries/{entry.id}/documents/{doc_id}/")
    assert resp.status_code == 200
    assert resp["X-Accel-Redirect"]
    assert "fattura.pdf" in resp["Content-Disposition"]


@pytest.mark.django_db
def test_delete_single_document_leaves_others(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)
    r1 = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "offer", "file": _pdf_file("a.pdf")},
        format="multipart",
    )
    r2 = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "offer", "file": _pdf_file("b.pdf")},
        format="multipart",
    )
    doc1_id = r1.data["id"]

    resp = api_client.delete(f"/api/purchase-order-entries/{entry.id}/documents/{doc1_id}/")
    assert resp.status_code == 204

    remaining = PurchaseOrderDocument.objects.filter(entry=entry)
    assert remaining.count() == 1
    assert remaining.first().original_filename == "b.pdf"


@pytest.mark.django_db
def test_advance_with_document_creates_row_not_overwrite(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)
    # Un documento offer già presente prima dell'avanzamento...
    api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "offer", "file": _pdf_file("preesistente.pdf")},
        format="multipart",
    )

    # ...advance() allega un secondo PDF offer per lo stesso step:
    resp = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/advance/",
        {"document": _pdf_file("nuovo_in_advance.pdf")},
        format="multipart",
    )
    assert resp.status_code == 200
    assert resp.data["status"] == "inviato"

    docs = PurchaseOrderDocument.objects.filter(entry=entry, kind="offer")
    assert docs.count() == 2, "advance() deve aggiungere, non sostituire, i documenti esistenti"


@pytest.mark.django_db
def test_upload_invalid_kind_rejected(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)
    resp = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "non-esiste", "file": _pdf_file()},
        format="multipart",
    )
    assert resp.status_code == 400
    assert "kind" in resp.data


@pytest.mark.django_db
def test_upload_requires_change_permission(api_client, entry):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    plain_user = User.objects.create_user(username="senza_permessi", password="x")
    api_client.force_authenticate(user=plain_user)

    resp = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "offer", "file": _pdf_file()},
        format="multipart",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_delete_requires_change_permission(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)
    upload = api_client.post(
        f"/api/purchase-order-entries/{entry.id}/documents/",
        {"kind": "offer", "file": _pdf_file()},
        format="multipart",
    )
    doc_id = upload.data["id"]

    from django.contrib.auth import get_user_model
    User = get_user_model()
    plain_user = User.objects.create_user(username="senza_permessi_2", password="x")
    api_client.force_authenticate(user=plain_user)

    resp = api_client.delete(f"/api/purchase-order-entries/{entry.id}/documents/{doc_id}/")
    assert resp.status_code == 403
    assert PurchaseOrderDocument.objects.filter(pk=doc_id).exists()
