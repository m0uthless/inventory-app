"""purchaseorders/models.py — Modulo Purchase Order.

Tabella per il tracciamento di attività (ordinarie o extra) da fatturare a un
committente, con Purchase Order/riferimento cliente collegato.

Workflow (deciso in chat):
    inserito -> inviato -> ricevuto -> fatturato
Transizioni SEMPRE sequenziali, un passo alla volta, sia in avanti
(PurchaseOrderEntryViewSet.advance) sia indietro (.revert). Il PDF allegato a
ogni step (offerta/PO/fattura) è opzionale al momento della transizione: può
essere caricato anche in un secondo momento tramite PATCH sul relativo campo.

Blocco editing: quando lo stato è diverso da INSERITO, `description` e i
campi di importo (`amount_mode`, `days`, `daily_rate`, `amount`) non sono più
modificabili (vedi PurchaseOrderEntrySerializer.validate). Per sbloccarli
bisogna riportare lo stato a INSERITO passo per passo con `.revert`.

Importo: due modalità (`amount_mode`)
    fisso     -> l'utente inserisce direttamente `amount`.
    giornate  -> l'utente inserisce `days` e `daily_rate`; `amount` viene
                 ricalcolato automaticamente in `save()` (days × daily_rate,
                 arrotondato a 2 decimali). Non editabile manualmente in
                 questa modalità (vedi PurchaseOrderEntrySerializer.validate).
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from crm.models import Customer


# ─── Choices ───────────────────────────────────────────────────────────────

class PurchaseOrderType(models.TextChoices):
    ORDINARIO = "ordinario", "Ordinario"
    EXTRA     = "extra",     "Extra"


class PurchaseOrderAmountMode(models.TextChoices):
    FISSO    = "fisso",    "Valore fisso"
    GIORNATE = "giornate", "Giornate × tariffa"


class PurchaseOrderStatus(models.TextChoices):
    INSERITO  = "inserito",  "Inserito"
    INVIATO   = "inviato",   "Inviato"
    RICEVUTO  = "ricevuto",  "Ricevuto"
    FATTURATO = "fatturato", "Fatturato"


# Ordine sequenziale del workflow: usato da advance()/revert() nel ViewSet.
PURCHASE_ORDER_STATUS_ORDER = [
    PurchaseOrderStatus.INSERITO,
    PurchaseOrderStatus.INVIATO,
    PurchaseOrderStatus.RICEVUTO,
    PurchaseOrderStatus.FATTURATO,
]

# Campi bloccati in scrittura quando lo stato è diverso da INSERITO.
LOCKED_WHEN_NOT_INSERITO = ("description", "amount_mode", "days", "daily_rate", "amount")


def offer_document_upload_path(instance, filename):
    return f"purchase_orders/offer_documents/{instance.pk or 'tmp'}/{filename}"


def po_document_upload_path(instance, filename):
    return f"purchase_orders/po_documents/{instance.pk or 'tmp'}/{filename}"


def invoice_document_upload_path(instance, filename):
    return f"purchase_orders/invoice_documents/{instance.pk or 'tmp'}/{filename}"


class PurchaseOrderDocumentKind(models.TextChoices):
    OFFER   = "offer",   "Offerta"
    PO      = "po",      "Purchase Order"
    INVOICE = "invoice", "Fattura"


def purchase_order_document_upload_path(instance, filename):
    return f"purchase_orders/documents/{instance.entry_id or 'tmp'}/{instance.kind}/{filename}"


# ─── PurchaseOrderEntry ──────────────────────────────────────────────────────

class PurchaseOrderEntry(TimeStampedModel):
    # Identificazione / commessa
    offer_date      = models.DateField(verbose_name="Data offerta")
    description     = models.TextField(verbose_name="Descrizione")

    client_name     = models.CharField(max_length=255, verbose_name="Committente")
    customer        = models.ForeignKey(
        Customer, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="purchase_order_entries", verbose_name="Cliente",
    )
    # Cliente collegato (il destinatario del lavoro, diverso dal Committente
    # che paga/commissiona — vedi client_name) quando non è ancora presente
    # in anagrafica. Mutuamente esclusivo con `customer` (vedi
    # PurchaseOrderEntrySerializer.validate). A differenza del pattern
    # equivalente in issues.models (Issue.customer_placeholder), qui non
    # serve un cliente sentinella: `customer` è già nullable.
    customer_placeholder = models.CharField(
        max_length=255, blank=True,
        verbose_name="Cliente collegato (testo libero)",
        help_text=(
            "Nome del cliente su cui è stato eseguito il lavoro, quando non "
            "è ancora presente in anagrafica. Alternativo al campo Cliente."
        ),
    )

    purchase_order  = models.CharField(max_length=128, blank=True, verbose_name="Purchase Order")
    invoice_number  = models.CharField(max_length=128, blank=True, verbose_name="N. Fattura")

    kind            = models.CharField(
        max_length=16, choices=PurchaseOrderType.choices,
        default=PurchaseOrderType.EXTRA, verbose_name="Tipo",
    )

    # Workflow
    status          = models.CharField(
        max_length=16, choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.INSERITO, verbose_name="Stato",
    )
    sent_at         = models.DateTimeField(null=True, blank=True, verbose_name="Data invio offerta")
    received_at     = models.DateTimeField(null=True, blank=True, verbose_name="Data ricezione PO")
    invoiced_at     = models.DateTimeField(null=True, blank=True, verbose_name="Data fatturazione")

    # NOTA: i vecchi campi offer_document/po_document/invoice_document (un solo
    # PDF per tipo, sovrascritto ad ogni upload) sono stati rimossi in favore
    # del modello PurchaseOrderDocument (relazione "documents", Punto 9 —
    # multi-PDF per tipo). Vedi purchaseorders/migrations/0004-0006: 0004 crea
    # PurchaseOrderDocument, 0005 copia i file esistenti, 0006 rimuove i campi.

    # Importo
    amount_mode     = models.CharField(
        max_length=16, choices=PurchaseOrderAmountMode.choices,
        default=PurchaseOrderAmountMode.FISSO, verbose_name="Modalità importo",
    )
    days            = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True, verbose_name="Giornate",
    )
    daily_rate      = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True, verbose_name="Tariffa/giorno",
    )
    amount          = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0"), verbose_name="Importo",
    )

    costs_incurred  = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True, verbose_name="Costi sostenuti",
    )

    notes           = models.TextField(blank=True, verbose_name="Note")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "Purchase Order"
        verbose_name_plural = "Purchase Order"
        ordering = ["-offer_date", "-created_at"]
        indexes = [
            models.Index(fields=["kind"],        name="po_entry_kind_idx"),
            models.Index(fields=["status"],      name="po_entry_status_idx"),
            models.Index(fields=["customer"],    name="po_entry_customer_idx"),
            models.Index(fields=["offer_date"],  name="po_entry_offer_date_idx"),
            models.Index(fields=["deleted_at"],  name="po_entry_deleted_at_idx"),
            models.Index(fields=["-created_at"], name="po_entry_created_at_idx"),
        ]

    def __str__(self):
        return f"{self.client_name} — {self.description[:40]}"

    @property
    def is_invoiced(self) -> bool:
        return bool(self.invoice_number)

    @property
    def is_customer_placeholder(self) -> bool:
        return bool(self.customer_placeholder)

    @property
    def is_editable(self) -> bool:
        """Descrizione e valori sono modificabili solo in stato INSERITO."""
        return self.status == PurchaseOrderStatus.INSERITO

    def save(self, *args, **kwargs):
        # Modalità "giornate": l'importo è sempre ricalcolato dal server,
        # non è editabile a mano dal client (vedi anche il serializer).
        if self.amount_mode == PurchaseOrderAmountMode.GIORNATE and self.days is not None and self.daily_rate is not None:
            self.amount = (self.days * self.daily_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        super().save(*args, **kwargs)


# ─── PurchaseOrderDocument ───────────────────────────────────────────────────
# Punto 9 (roadmap): prima un solo PDF per tipo (offer_document/po_document/
# invoice_document su PurchaseOrderEntry, ora rimossi — vedi migrazioni 0004-
# 0006), che veniva sovrascritto ad ogni nuovo upload. Ora ogni tipo ammette
# più PDF: ogni upload aggiunge una riga invece di sostituire la precedente.

class PurchaseOrderDocument(models.Model):
    entry = models.ForeignKey(
        PurchaseOrderEntry, on_delete=models.CASCADE, related_name="documents",
    )
    kind = models.CharField(max_length=16, choices=PurchaseOrderDocumentKind.choices)
    file = models.FileField(upload_to=purchase_order_document_upload_path)
    # Nome file originale al momento dell'upload: preservato anche se il file
    # su disco viene rinominato da Django per evitare collisioni.
    original_filename = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "Documento Purchase Order"
        verbose_name_plural = "Documenti Purchase Order"
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["entry", "kind"], name="po_doc_entry_kind_idx"),
        ]

    def __str__(self):
        return f"{self.entry_id} — {self.kind} — {self.original_filename or self.file.name}"
