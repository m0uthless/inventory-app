"""expenses/models.py — Modulo Rimborso Spese.

Ricalca il modulo Excel "Nota spese" compilato manualmente ad oggi (foglio
BASE): una nota spese mensile per dipendente con 12 categorie fisse di
spesa (una riga ciascuna), un log di trasferte con i km percorsi per la
voce "Rimborso chilometraggio", un totale anticipi e un totale da rendere.

Workflow (deciso in chat): niente firme multiple come nel foglio Excel,
solo un passaggio di validazione da parte della Segreteria (utenti con
`UserProfile.is_expense_secretary=True`):

    bozza → inviata → validata
                    → rifiutata (con motivo, il dipendente corregge e reinvia)

Ogni ExpenseReport viene creato con le 12 ExpenseItem già pronte (una per
categoria, importo 0), esattamente come le righe fisse del foglio Excel:
il dipendente compila gli importi, non crea/elimina righe.
"""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.models import TimeStampedModel

# ─── Mesi italiani (usati da serializer e export PDF) ──────────────────────

MONTH_NAMES_IT = [
    "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
]


# ─── Categorie di spesa (righe fisse del modello Excel) ─────────────────────

class ExpenseCategory(models.TextChoices):
    TRENI              = "treni",              "Treni, pullman"
    TAXI_COMUNE        = "taxi_comune",         "Taxi/bus/autonoleggio nel comune"
    TAXI_FUORI_COMUNE  = "taxi_fuori_comune",   "Taxi/bus/autonoleggio fuori comune"
    AUTOSTRADE         = "autostrade",          "Autostrade"
    RIMBORSO_KM        = "rimborso_km",         "Rimborso chilometraggio"
    VARIE_AUTOMEZZI    = "varie_automezzi",     "Varie automezzi (lavaggio/parcheggi/manutenzioni fino a 50€)"
    CARBURANTI         = "carburanti",          "Carburanti e lubrificanti"
    PERNOTTAMENTO      = "pernottamento",       "Pernottamento"
    PASTI              = "pasti",               "Pasti (ristorante/bar)"
    RAPPRESENTANZA     = "rappresentanza",      "Spese di rappresentanza"
    TELEFONICHE        = "telefoniche",         "Spese telefoniche"
    VARIE              = "varie",               "Varie"


# Ordine di visualizzazione = stesso ordine del foglio Excel.
EXPENSE_CATEGORY_ORDER = [c.value for c in ExpenseCategory]


class ExpenseReportStatus(models.TextChoices):
    BOZZA     = "bozza",     "Bozza"
    INVIATA   = "inviata",   "Inviata"
    VALIDATA  = "validata",  "Validata"
    RIFIUTATA = "rifiutata", "Rifiutata"


# ─── ExpenseReport ────────────────────────────────────────────────────────────

class ExpenseReport(TimeStampedModel):
    """Nota spese mensile di un dipendente (equivalente al foglio BASE)."""

    user   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="expense_reports", verbose_name="Dipendente",
    )
    year   = models.PositiveIntegerField(verbose_name="Anno")
    month  = models.PositiveSmallIntegerField(
        verbose_name="Mese",
        validators=[MinValueValidator(1), MaxValueValidator(12)],
    )
    advances_total = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal("0"),
        verbose_name="Totale anticipi",
    )
    note = models.TextField(blank=True, verbose_name="Note")

    status = models.CharField(
        max_length=12, choices=ExpenseReportStatus.choices,
        default=ExpenseReportStatus.BOZZA, verbose_name="Stato",
    )
    rejection_reason = models.TextField(blank=True, verbose_name="Motivo rifiuto")
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+", verbose_name="Validata/rifiutata da",
    )
    validated_at = models.DateTimeField(null=True, blank=True, verbose_name="Validata/rifiutata il")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "Nota spese"
        verbose_name_plural = "Note spese"
        ordering = ["-year", "-month", "user__username"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "year", "month"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_expense_report_user_year_month_active",
            ),
        ]
        indexes = [
            models.Index(fields=["status"], name="exprep_status_idx"),
            models.Index(fields=["user", "deleted_at"], name="exprep_user_del_idx"),
        ]

    def __str__(self):
        return f"{self.user} — {self.number}"

    @property
    def number(self) -> str:
        """'NOTA SPESE N. 12/25': numero = mese/anno a 2 cifre, come nel
        modello Excel (non è una sequenza a parte)."""
        return f"{self.month:02d}/{self.year % 100:02d}"

    @property
    def month_label(self) -> str:
        return MONTH_NAMES_IT[self.month] if 1 <= self.month <= 12 else ""

    @property
    def total_expenses(self) -> Decimal:
        return sum((i.amount for i in self.items.all()), Decimal("0"))

    @property
    def total_due(self) -> Decimal:
        return self.total_expenses - self.advances_total


# ─── ExpenseItem ──────────────────────────────────────────────────────────────

class ExpenseItem(TimeStampedModel):
    """Una riga di categoria della nota spese (una per categoria, come nel
    foglio Excel). Per `category=rimborso_km` l'importo è calcolato in
    automatico dalle trasferte collegate (`km_trips`) × tariffa €/km del
    dipendente e non è editabile manualmente (vedi expenses/api.py)."""

    report      = models.ForeignKey(ExpenseReport, on_delete=models.CASCADE, related_name="items")
    category    = models.CharField(max_length=32, choices=ExpenseCategory.choices, verbose_name="Categoria")
    date        = models.DateField(null=True, blank=True, verbose_name="Data")
    description = models.CharField(max_length=255, blank=True, verbose_name="Descrizione")
    amount      = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"), verbose_name="Importo")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "Voce nota spese"
        verbose_name_plural = "Voci nota spese"
        constraints = [
            models.UniqueConstraint(
                fields=["report", "category"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_expense_item_report_category_active",
            ),
        ]

    def __str__(self):
        return f"{self.report} · {self.get_category_display()}"

    @property
    def sort_order(self) -> int:
        try:
            return EXPENSE_CATEGORY_ORDER.index(self.category)
        except ValueError:
            return len(EXPENSE_CATEGORY_ORDER)


# ─── ExpenseKmTrip ────────────────────────────────────────────────────────────

class ExpenseKmTrip(TimeStampedModel):
    """Riga del log trasferte (data / destinazione / km) collegata alla
    voce 'Rimborso chilometraggio'. Inserimento libero: non usa la tabella
    TRAGITTO del modello Excel (deciso in chat — tariffa e km sono per
    tecnico, non per destinazione fissa)."""

    item        = models.ForeignKey(
        ExpenseItem, on_delete=models.CASCADE, related_name="km_trips",
        limit_choices_to={"category": ExpenseCategory.RIMBORSO_KM},
    )
    date        = models.DateField(verbose_name="Data")
    destination = models.CharField(max_length=255, verbose_name="Luogo di destinazione")
    km          = models.PositiveIntegerField(verbose_name="Km percorsi")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "Trasferta km"
        verbose_name_plural = "Trasferte km"
        ordering = ["date", "id"]

    def __str__(self):
        return f"{self.date} — {self.destination} ({self.km} km)"


# ─── TechnicianKmRate ─────────────────────────────────────────────────────────

class TechnicianKmRate(TimeStampedModel):
    """Tariffa €/km per tecnico (deciso in chat: differente per persona,
    valore unico sempre valido — nessuna storicizzazione per data).
    Gestita normalmente dalla Segreteria rimborsi spese."""

    user         = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expense_km_rate",
        verbose_name="Dipendente",
    )
    rate_per_km  = models.DecimalField(
        max_digits=5, decimal_places=3, default=Decimal("0"),
        verbose_name="Tariffa €/km",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "Tariffa km per tecnico"
        verbose_name_plural = "Tariffe km per tecnico"
        ordering = ["user__username"]

    def __str__(self):
        return f"{self.user} — {self.rate_per_km} €/km"


# ─── ExpenseReceipt ───────────────────────────────────────────────────────────

def expense_receipt_upload_path(instance, filename):
    return f"expense_receipts/{instance.item.report_id}/{filename}"


class ExpenseReceipt(TimeStampedModel):
    """Scontrino/ricevuta allegato a una voce. `ocr_amount`/`ocr_date` sono
    un SUGGERIMENTO estratto via OCR (vedi expenses/ocr.py): non
    sovrascrivono mai l'importo/data inseriti dall'utente, restano visibili
    in UI come controllo per evitare errori di trascrizione."""

    item       = models.ForeignKey(ExpenseItem, on_delete=models.CASCADE, related_name="receipts")
    file       = models.FileField(upload_to=expense_receipt_upload_path, verbose_name="File")
    ocr_amount = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name="Importo OCR")
    ocr_date   = models.DateField(null=True, blank=True, verbose_name="Data OCR")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "Scontrino"
        verbose_name_plural = "Scontrini"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Scontrino #{self.pk} — {self.item}"
