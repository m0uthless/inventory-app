"""Punto 9 (roadmap): copia i PDF già caricati nei vecchi campi singoli
(offer_document/po_document/invoice_document) nel nuovo modello
PurchaseOrderDocument, prima che quei campi vengano rimossi (0006).

Nessun file viene ri-caricato/copiato su disco: si riusa lo stesso percorso
già salvato, si crea solo la riga corrispondente nella nuova tabella.
"""
from django.db import migrations

# (nome campo file legacy, kind corrispondente, campo timestamp della transizione
# che ha originariamente popolato quel campo)
DOCUMENT_FIELD_TO_KIND = [
    ("offer_document",   "offer",   "sent_at"),
    ("po_document",      "po",      "received_at"),
    ("invoice_document", "invoice", "invoiced_at"),
]


def copy_documents_forward(apps, schema_editor):
    PurchaseOrderDocument = apps.get_model("purchaseorders", "PurchaseOrderDocument")
    PurchaseOrderEntry = apps.get_model("purchaseorders", "PurchaseOrderEntry")

    for entry in PurchaseOrderEntry.objects.all():
        for file_field_name, kind, ts_field_name in DOCUMENT_FIELD_TO_KIND:
            file_field = getattr(entry, file_field_name)
            if not file_field:
                continue
            uploaded_at = getattr(entry, ts_field_name, None) or entry.updated_at
            original_filename = file_field.name.rsplit("/", 1)[-1]
            doc = PurchaseOrderDocument.objects.create(
                entry=entry,
                kind=kind,
                file=file_field.name,
                original_filename=original_filename,
                uploaded_by=entry.updated_by,
            )
            # auto_now_add sovrascrive sempre il valore passato a create():
            # corregge uploaded_at col timestamp storico reale via update(),
            # che non attiva auto_now_add.
            PurchaseOrderDocument.objects.filter(pk=doc.pk).update(uploaded_at=uploaded_at)


def copy_documents_backward(apps, schema_editor):
    # Irreversibile in modo esatto: i documenti caricati dopo questa
    # migrazione (multi-PDF per tipo) non hanno posto in un singolo campo.
    # Nessuna azione: i vecchi campi vengono ricreati vuoti dal reverse della
    # migrazione precedente/successiva; i dati restano solo nella nuova tabella.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('purchaseorders', '0004_purchaseorderdocument'),
    ]

    operations = [
        migrations.RunPython(copy_documents_forward, copy_documents_backward),
    ]
