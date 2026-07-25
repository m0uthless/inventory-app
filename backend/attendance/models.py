"""attendance/models.py — Modello condiviso assenze/attività a mezza giornata.

La stessa tabella (`Absence`) alimenta:
  • il **Piano Ferie** (griglia per mezza giornata, workflow proposta→validata);
  • il **Triage / Statistiche ServiceNow**, che la importano.

Granularità: una riga = utente × giorno × fascia (MATTINA | POMERIGGIO).
Una giornata intera = due righe (MAT + POM), come nel piano ferie Excel.
MAT = 4h di permesso, POM = 4h di permesso; la pausa 13:00–14:00 non è
retribuita ed è esclusa. La soglia mattina/pomeriggio è 13:00 (indipendente
dall'orario del singolo tecnico: alcuni iniziano alle 8, altri alle 9).
"""
from datetime import time

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import LookupBase, TimeStampedModel


# ─── Soglie fascia (mattina / pomeriggio) ────────────────────────────────────
# Pausa pranzo 13:00–14:00 non retribuita, esclusa dal computo.
NOON_THRESHOLD = time(13, 0)   # < 13:00 → mattina
AFTERNOON_START = time(14, 0)  # ≥ 14:00 → pomeriggio


# ─── LeaveArea (colonna "area" del piano ferie) ──────────────────────────────

class LeaveArea(LookupBase):
    """Area organizzativa del piano ferie (colonna B dell'Excel):
    AVEC, Medical Imaging, Romagna/Med.Imaging, Emilia Romagna, Triveneto,
    Ufficio. Gestita da Django admin, estendibile senza modifiche al codice
    (stesso pattern di ServiceNowCaseType).
    """

    class Meta:
        verbose_name = "Area piano ferie"
        verbose_name_plural = "Aree piano ferie"
        ordering = ["sort_order", "label"]
        constraints = [
            models.UniqueConstraint(
                fields=["key"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_leave_area_key_active",
            ),
        ]


# ─── Holiday (festività) ──────────────────────────────────────────────────────

class Holiday(TimeStampedModel):
    """Festività non selezionabile nel Piano Ferie (nazionale o locale).

    `areas` vuoto = vale per tutte le aree (festività nazionale). `areas`
    valorizzato = vale solo per le aree indicate (es. patrono locale,
    chiusura di uno stabilimento specifico).
    """
    date  = models.DateField(verbose_name="Data")
    label = models.CharField(max_length=128, verbose_name="Descrizione")
    areas = models.ManyToManyField(
        LeaveArea, blank=True, related_name="holidays",
        verbose_name="Aree",
        help_text="Vuoto = vale per tutte le aree. Valorizzato = vale solo per le aree selezionate.",
    )

    class Meta:
        verbose_name = "Festività"
        verbose_name_plural = "Festività"
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(
                fields=["date", "label"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_holiday_date_label_active",
            ),
        ]
        indexes = [
            models.Index(fields=["date"], name="holiday_date_idx"),
        ]

    def __str__(self):
        return f"{self.date} — {self.label}"


# ─── Enum condivisi ──────────────────────────────────────────────────────────

class AbsenceReason(models.TextChoices):
    """Tassonomia unica: fonde la legenda del piano ferie con i vecchi
    `reason` di ServiceNow (ferie/malattia/trasferta/altro)."""
    FERIE        = "ferie",        "Ferie"
    MALATTIA     = "malattia",     "Malattia/Infortunio"
    PERMESSO_104 = "permesso_104", "104"
    TRAINING     = "training",     "Training"
    TRASFERTA    = "trasferta",    "Trasferta"
    ALTRO        = "altro",        "Altro"


class AbsenceStatus(models.TextChoices):
    PROPOSTA  = "proposta",  "Proposta"
    VALIDATA  = "validata",  "Validata"
    RIFIUTATA = "rifiutata", "Rifiutata"


class DayPart(models.TextChoices):
    MATTINA    = "mattina",    "Mattina"
    POMERIGGIO = "pomeriggio", "Pomeriggio"


# ─── Absence ──────────────────────────────────────────────────────────────────

class Absence(TimeStampedModel):
    """Attività/assenza di una mezza giornata per un utente.

    Colore Excel = f(reason, status):
      • FERIE + PROPOSTA → giallo   • FERIE + VALIDATA → verde
      • MALATTIA → rosso            • PERMESSO_104 → rosa
      • TRAINING → (suo colore)     • ALTRO → grigio

    Le voci inserite dal coordinatore (malattia/104/training/…) nascono già
    `VALIDATA`. Il dipendente crea solo proposte di ferie sulle proprie righe.

    `time_from`/`time_to` opzionali danno la precisione oraria (permesso
    ServiceNow); quando valorizzati, la fascia si deduce dalla soglia 13:00.
    """

    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="absences", verbose_name="Utente",
    )
    date       = models.DateField(verbose_name="Giorno")
    day_part   = models.CharField(
        max_length=12, choices=DayPart.choices, verbose_name="Fascia",
    )
    reason     = models.CharField(
        max_length=20, choices=AbsenceReason.choices,
        default=AbsenceReason.FERIE, verbose_name="Motivo",
    )
    status     = models.CharField(
        max_length=12, choices=AbsenceStatus.choices,
        default=AbsenceStatus.PROPOSTA, verbose_name="Stato",
    )
    note       = models.CharField(max_length=255, blank=True, verbose_name="Nota")

    request_group = models.UUIDField(
        null=True, blank=True, verbose_name="Gruppo richiesta",
        help_text="Tutte le righe create dalla stessa selezione (singola cella o "
                  "trascinamento multi-giorno) condividono lo stesso valore, cosa "
                  "che permette al coordinatore di validare/rifiutare l'intera "
                  "richiesta con un solo click invece che riga per riga.",
    )

    time_from  = models.TimeField(
        null=True, blank=True, verbose_name="Ora inizio",
        help_text="Precisione oraria opzionale (permesso). Se valorizzata, "
                  "vanno indicate sia ora inizio sia ora fine.",
    )
    time_to    = models.TimeField(null=True, blank=True, verbose_name="Ora fine")

    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+", verbose_name="Validata da",
    )
    validated_at = models.DateTimeField(null=True, blank=True, verbose_name="Validata il")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+", verbose_name="Creata da",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+", verbose_name="Aggiornata da",
    )

    class Meta:
        verbose_name = "Assenza / attività"
        verbose_name_plural = "Assenze / attività"
        ordering = ["-date", "day_part"]
        constraints = [
            # Una sola voce attiva per (utente, giorno, fascia).
            models.UniqueConstraint(
                fields=["user", "date", "day_part"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_absence_user_date_daypart_active",
            ),
            # time_from e time_to sempre insieme (o entrambi nulli).
            models.CheckConstraint(
                condition=(
                    models.Q(time_from__isnull=True, time_to__isnull=True)
                    | models.Q(time_from__isnull=False, time_to__isnull=False)
                ),
                name="ck_absence_time_pair",
            ),
        ]
        indexes = [
            models.Index(fields=["date"],           name="absence_date_idx"),
            models.Index(fields=["user", "date"],   name="absence_user_date_idx"),
            models.Index(fields=["reason"],         name="absence_reason_idx"),
            models.Index(fields=["status"],         name="absence_status_idx"),
            models.Index(fields=["deleted_at"],     name="absence_deleted_at_idx"),
            models.Index(fields=["request_group"],  name="absence_request_group_idx"),
        ]

    def clean(self):
        super().clean()
        if (self.time_from is None) != (self.time_to is None):
            raise ValidationError(
                "Indicare sia l'ora di inizio sia l'ora di fine, oppure nessuna delle due."
            )
        if self.time_from and self.time_to and self.time_to <= self.time_from:
            raise ValidationError({"time_to": "L'ora di fine deve essere successiva all'ora di inizio."})

    @property
    def is_hourly(self) -> bool:
        return bool(self.time_from and self.time_to)

    def __str__(self):
        return f"{self.user} · {self.date} {self.get_day_part_display()} ({self.get_reason_display()})"
