from django.conf import settings
from django.db import models

from core.models import TimeStampedModel, LookupBase, CustomerStatus
from crm.models import Customer, Site
from inventory.models import Inventory


# ─── Cliente placeholder (issue create da caso ServiceNow senza match in anagrafica) ──

# Codice fisso del cliente "sentinella": tenere il FK Issue.customer sempre
# valorizzato (obbligatorio, on_delete=PROTECT) anche quando il cliente reale
# non è ancora presente in anagrafica. Il nome effettivo digitato dall'utente
# viene conservato in Issue.customer_placeholder; l'API sostituisce sempre il
# FK con questo record quando customer_placeholder è valorizzato.
PLACEHOLDER_CUSTOMER_CODE = "SYS-PLACEHOLDER"


def get_placeholder_customer():
    """Recupera (o crea) il cliente sentinella usato per le issue con cliente
    non ancora presente in anagrafica. Idempotente: safe da chiamare ad ogni
    save, non richiede una migrazione dati dedicata.

    Il record viene creato soft-deleted (deleted_at valorizzato) in modo da
    non comparire mai nelle liste/autocomplete cliente standard: resta
    comunque un FK valido e riutilizzabile via get_or_create(code=...)."""
    from django.utils import timezone

    status, _ = CustomerStatus.objects.get_or_create(
        key="placeholder",
        defaults={"label": "N/D (placeholder)", "sort_order": 999, "is_active": True},
    )
    customer = Customer.objects.filter(code=PLACEHOLDER_CUSTOMER_CODE).first()
    if customer is None:
        customer = Customer.objects.create(
            code=PLACEHOLDER_CUSTOMER_CODE,
            name="Cliente da specificare",
            status=status,
            deleted_at=timezone.now(),
        )
    return customer


# ─── Lookup: categoria issue (configurabile da admin) ────────────────────────

class IssueCategory(LookupBase):
    class Meta:
        verbose_name = "Categoria issue"
        verbose_name_plural = "Categorie issue"
        ordering = ["sort_order", "label"]
        constraints = [
            models.UniqueConstraint(
                fields=["key"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_issue_category_key_active",
            )
        ]


# ─── Choices ─────────────────────────────────────────────────────────────────

class IssuePriority(models.TextChoices):
    LOW      = "low",      "Bassa"
    MEDIUM   = "medium",   "Media"
    HIGH     = "high",     "Alta"
    CRITICAL = "critical", "Critica"


class IssueStatus(models.TextChoices):
    OPEN        = "open",        "Aperta"
    IN_PROGRESS = "in_progress", "In lavorazione"
    WAITING     = "waiting",     "In attesa"
    RESOLVED    = "resolved",    "Risolta"
    CLOSED      = "closed",      "Chiusa"


class IssueWaitingReason(models.TextChoices):
    PHILIPS  = "philips",  "Philips"
    ELCO     = "elco",     "Elco"
    CLIENTE  = "cliente",  "Cliente"
    EXPRIVIA = "exprivia", "Exprivia"
    ALTRO    = "altro",    "Altro"


# ─── Issue ────────────────────────────────────────────────────────────────────

class Issue(TimeStampedModel):
    # Identificazione
    title           = models.CharField(max_length=255, verbose_name="Titolo")
    description     = models.TextField(blank=True, verbose_name="Descrizione")
    servicenow_id   = models.CharField(
        max_length=100, blank=True,
        verbose_name="Caso ServiceNow",
        help_text="Es. INC0012345",
    )

    # Relazioni
    customer        = models.ForeignKey(
        Customer, on_delete=models.PROTECT,
        related_name="issues", verbose_name="Cliente",
    )
    customer_placeholder = models.CharField(
        max_length=255, blank=True,
        verbose_name="Cliente (testo libero)",
        help_text=(
            "Nome del cliente reale, usato quando non è ancora presente in "
            "anagrafica. Se valorizzato, il campo Cliente punta al record "
            "sentinella e questo testo viene mostrato al suo posto."
        ),
    )
    site            = models.ForeignKey(
        Site, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="issues", verbose_name="Sito",
    )
    inventory       = models.ForeignKey(
        Inventory, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="issues", verbose_name="Inventory",
    )
    category        = models.ForeignKey(
        IssueCategory, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="issues", verbose_name="Categoria",
    )
    # Area organizzativa (stessa `attendance.LeaveArea` del profilo utente e dei
    # task di area). Facoltativa: senza area la issue la modifica chiunque abbia
    # i permessi delle issue; con un'area solo i membri di quell'area.
    area            = models.ForeignKey(
        "attendance.LeaveArea", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="issues", verbose_name="Area",
    )
    assigned_to     = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="assigned_issues",
        verbose_name="Assegnato a",
    )
    created_by      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="created_issues", verbose_name="Creato da",
    )

    # Classificazione
    priority        = models.CharField(
        max_length=20, choices=IssuePriority.choices,
        default=IssuePriority.MEDIUM, verbose_name="Priorità",
    )
    status          = models.CharField(
        max_length=20, choices=IssueStatus.choices,
        default=IssueStatus.OPEN, verbose_name="Stato",
    )
    waiting_reason  = models.CharField(
        max_length=20, choices=IssueWaitingReason.choices,
        blank=True, verbose_name="In attesa di",
        help_text="Obbligatorio quando lo stato è «In attesa».",
    )

    # Data apertura
    opened_at       = models.DateField(null=True, blank=True, verbose_name="Data apertura")

    due_date        = models.DateField(null=True, blank=True, verbose_name="Scadenza")
    closed_at       = models.DateField(null=True, blank=True, verbose_name="Data chiusura")

    class Meta:
        verbose_name = "Issue"
        verbose_name_plural = "Issues"
        ordering = ["-created_at"]
        permissions = [
            ("be_assignee", "Può essere assegnatario delle issue"),
            ("view_all_areas", "Vede le issue di tutte le aree"),
        ]
        indexes = [
            models.Index(fields=["status"],              name="issue_status_idx"),
            models.Index(fields=["priority"],            name="issue_priority_idx"),
            models.Index(fields=["customer", "status"],  name="issue_customer_status_idx"),
            models.Index(fields=["assigned_to"],         name="issue_assigned_idx"),
            models.Index(fields=["area"],                name="issue_area_idx"),
            models.Index(fields=["due_date"],            name="issue_due_date_idx"),
            models.Index(fields=["deleted_at"],          name="issue_deleted_at_idx"),
            models.Index(fields=["-created_at"],         name="issue_created_at_idx"),
        ]

    def __str__(self):
        return f"[{self.get_priority_display()}] {self.title}"

    @property
    def is_customer_placeholder(self):
        return bool(self.customer_placeholder)


# ─── IssueComment ─────────────────────────────────────────────────────────────

class IssueComment(models.Model):
    issue       = models.ForeignKey(
        Issue, on_delete=models.CASCADE,
        related_name="comments", verbose_name="Issue",
    )
    author      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="issue_comments", verbose_name="Autore",
    )
    body        = models.TextField(verbose_name="Testo")
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Commento issue"
        verbose_name_plural = "Commenti issue"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["issue", "created_at"], name="issuecomment_issue_idx"),
        ]

    def __str__(self):
        return f"Comment by {self.author_id} on Issue #{self.issue_id}"



def issue_attachment_path(instance, filename):
    # Cartella protetta: nginx la blocca, i file passano solo da /api/issues/{id}/attachments/.
    return f"issue_attachments/{instance.issue_id}/{filename}"


class IssueAttachment(models.Model):
    """Allegato di una issue (spec 2026-11-20): un file caricato oppure un collegamento a un file del
    Drive (gli allegati ereditati da un task di area, con `from_task`). Esattamente uno dei due."""

    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=issue_attachment_path, blank=True, max_length=500)
    drive_file = models.ForeignKey("drive.DriveFile", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    name = models.CharField(max_length=255)
    size = models.PositiveBigIntegerField(default=0)
    mime_type = models.CharField(max_length=127, blank=True)
    from_task = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["issue", "created_at"], name="issueatt_issue_idx")]

    def __str__(self):
        return f"{self.name} (issue #{self.issue_id})"
