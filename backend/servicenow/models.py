from django.conf import settings
from django.core.exceptions import ValidationError
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


# ─── TechnicianAbsence ────────────────────────────────────────────────────────

class TechnicianAbsenceReason(models.TextChoices):
    FERIE     = "ferie",     "Ferie"
    MALATTIA  = "malattia",  "Malattia"
    TRASFERTA = "trasferta", "Trasferta"
    ALTRO     = "altro",     "Altro"


class TechnicianAbsence(models.Model):
    """Periodo di assenza programmata di un tecnico (ferie, malattia, ecc.).

    Usato dal pannello 'Triage' (ServiceNow Case) per non proporre come
    disponibili i tecnici assenti nella giornata, e dalla heatmap della
    pagina Statistiche per segnalare visivamente i giorni di assenza
    (chip rosso "F") nelle celle del tecnico interessato.
    """

    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="servicenow_absences", verbose_name="Tecnico",
    )
    date_from  = models.DateField(verbose_name="Dal")
    date_to    = models.DateField(verbose_name="Al")
    reason     = models.CharField(
        max_length=20, choices=TechnicianAbsenceReason.choices,
        default=TechnicianAbsenceReason.FERIE, verbose_name="Motivo",
    )
    note       = models.CharField(max_length=255, blank=True, verbose_name="Nota")
    time_from  = models.TimeField(
        null=True, blank=True, verbose_name="Ora inizio",
        help_text="Valorizzare insieme a Ora fine solo per un'assenza oraria (permesso) su un singolo giorno.",
    )
    time_to    = models.TimeField(
        null=True, blank=True, verbose_name="Ora fine",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+", verbose_name="Creato da",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Assenza tecnico"
        verbose_name_plural = "Assenze tecnici"
        ordering = ["-date_from"]
        constraints = [
            models.CheckConstraint(
                # `condition=` sostituisce `check=`, deprecato e rimosso in
                # Django 6. Stesso constraint: Django non genera migrazioni.
                condition=models.Q(date_to__gte=models.F("date_from")),
                name="ck_technician_absence_date_range",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "date_from", "date_to"], name="sn_absence_user_range_idx"),
        ]

    def clean(self):
        super().clean()
        if self.time_from or self.time_to:
            if not (self.time_from and self.time_to):
                raise ValidationError("Per un'assenza oraria vanno indicate sia l'ora di inizio sia l'ora di fine.")
            if self.date_from != self.date_to:
                raise ValidationError("Un'assenza oraria (permesso) deve riguardare un solo giorno (Dal = Al).")
            if self.time_to <= self.time_from:
                raise ValidationError({"time_to": "L'ora di fine deve essere successiva all'ora di inizio."})

    @property
    def is_hourly(self) -> bool:
        return bool(self.time_from and self.time_to)

    def __str__(self):
        return f"{self.user} · {self.date_from} → {self.date_to} ({self.get_reason_display()})"
