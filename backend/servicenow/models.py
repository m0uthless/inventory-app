from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


# ─── Choices ─────────────────────────────────────────────────────────────────

class ServiceNowPriority(models.TextChoices):
    CRITICAL = "1", "1 - Critical"
    HIGH     = "2", "2 - High"
    MODERATE = "3", "3 - Moderate"
    LOW      = "4", "4 - Low"


class ServiceNowCaseStatus(models.TextChoices):
    OPEN        = "open",        "Aperto"
    IN_PROGRESS = "in_progress", "In lavorazione"
    CLOSED      = "closed",      "Chiuso"


class ServiceNowCaseCategory(models.TextChoices):
    PHILIPS = "philips", "Philips"
    BIOTRON = "biotron", "Biotron"


def servicenow_screenshot_upload_path(instance, filename):
    return f"servicenow_cases/screenshots/{filename}"


# ─── ServiceNowCaseType ─────────────────────────────────────────────────────

class ServiceNowCaseType(models.Model):
    """Type disponibili per un ServiceNow Case, definiti per categoria
    (Philips / Biotron). Tabella gestita da Django admin: nuovi type si
    aggiungono da lì, senza bisogno di una modifica al codice.
    Lo stesso nome (es. "L1") può esistere in entrambe le categorie come
    record distinti.
    """

    category    = models.CharField(max_length=20, choices=ServiceNowCaseCategory.choices, verbose_name="Categoria")
    name        = models.CharField(max_length=50, verbose_name="Nome")
    order       = models.PositiveIntegerField(default=0, verbose_name="Ordinamento")
    active      = models.BooleanField(default=True, verbose_name="Attivo")
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Type ServiceNow Case"
        verbose_name_plural = "Type ServiceNow Case"
        ordering = ["category", "order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["category", "name"], name="ux_servicenow_case_type_category_name"),
        ]

    def __str__(self):
        return f"{self.get_category_display()} · {self.name}"


# ─── ServiceNowCase ───────────────────────────────────────────────────────────

class ServiceNowCase(TimeStampedModel):
    """Case ServiceNow importato da screenshot (estrazione OCR) e gestito
    internamente ad Archie con un workflow proprio, indipendente dallo
    stato reale su ServiceNow.

    Tabella indipendente (nessun collegamento a Customer/Site per ora,
    valutabile in futuro).
    """

    # Dati estratti dallo screenshot ServiceNow
    number             = models.CharField(max_length=50, verbose_name="Numero case", help_text="Es. CS0628228")
    account            = models.CharField(max_length=255, verbose_name="Account")
    priority           = models.CharField(
        max_length=20, choices=ServiceNowPriority.choices,
        default=ServiceNowPriority.MODERATE, verbose_name="Priorità",
    )
    opened_date        = models.DateField(null=True, blank=True, verbose_name="Data apertura")
    opened_time        = models.TimeField(
        null=True, blank=True, verbose_name="Ora apertura",
        help_text="Richiesta lato form quando è impostata la data apertura (non estratta via OCR).",
    )
    short_description  = models.TextField(blank=True, verbose_name="Descrizione breve")
    screenshot         = models.ImageField(
        upload_to=servicenow_screenshot_upload_path,
        null=True, blank=True, verbose_name="Screenshot",
    )

    # Classificazione impostata manualmente in fase di inserimento (non estratta dallo screenshot)
    category           = models.CharField(
        max_length=20, choices=ServiceNowCaseCategory.choices,
        default=ServiceNowCaseCategory.BIOTRON, verbose_name="Categoria",
    )
    case_type          = models.ForeignKey(
        ServiceNowCaseType, on_delete=models.PROTECT,
        related_name="cases", verbose_name="Type",
    )

    # Gestione interna (workflow Archie, indipendente da ServiceNow)
    status             = models.CharField(
        max_length=20, choices=ServiceNowCaseStatus.choices,
        default=ServiceNowCaseStatus.OPEN, verbose_name="Stato interno",
    )
    assigned_to        = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="assigned_servicenow_cases",
        verbose_name="Assegnato a",
    )
    external_url       = models.URLField(
        max_length=1000, blank=True, verbose_name="URL",
        help_text="Link opzionale a una pagina esterna collegata al case",
    )

    class Meta:
        verbose_name = "ServiceNow Case"
        verbose_name_plural = "ServiceNow Case"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["number"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_servicenow_case_number_active",
            )
        ]
        indexes = [
            models.Index(fields=["status"],       name="sncase_status_idx"),
            models.Index(fields=["priority"],     name="sncase_priority_idx"),
            models.Index(fields=["category"],     name="sncase_category_idx"),
            models.Index(fields=["assigned_to"],  name="sncase_assigned_idx"),
            models.Index(fields=["deleted_at"],   name="sncase_deleted_at_idx"),
            models.Index(fields=["-created_at"],  name="sncase_created_at_idx"),
        ]

    def __str__(self):
        return f"{self.number} — {self.account}"


# NOTA: il vecchio modello `TechnicianAbsence` è stato spostato e generalizzato
# in `attendance.models.Absence` (granularità mezza giornata MAT/POM, workflow
# proposta→validata, condiviso col Piano Ferie). Triage e Statistiche di questo
# modulo ora importano da `attendance`. Vedi migration
# servicenow/0011_delete_technicianabsence.py.
