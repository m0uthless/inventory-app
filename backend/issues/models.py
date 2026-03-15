from django.conf import settings
from django.db import models

from core.models import TimeStampedModel, LookupBase
from crm.models import Customer, Site
from inventory.models import Inventory


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
    RESOLVED    = "resolved",    "Risolta"
    CLOSED      = "closed",      "Chiusa"


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

    # Data apertura
    opened_at       = models.DateField(null=True, blank=True, verbose_name="Data apertura")

    due_date        = models.DateField(null=True, blank=True, verbose_name="Scadenza")
    closed_at       = models.DateField(null=True, blank=True, verbose_name="Data chiusura")

    class Meta:
        verbose_name = "Issue"
        verbose_name_plural = "Issues"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"],              name="issue_status_idx"),
            models.Index(fields=["priority"],            name="issue_priority_idx"),
            models.Index(fields=["customer", "status"],  name="issue_customer_status_idx"),
            models.Index(fields=["assigned_to"],         name="issue_assigned_idx"),
            models.Index(fields=["due_date"],            name="issue_due_date_idx"),
            models.Index(fields=["deleted_at"],          name="issue_deleted_at_idx"),
            models.Index(fields=["-created_at"],         name="issue_created_at_idx"),
        ]

    def __str__(self):
        return f"[{self.get_priority_display()}] {self.title}"


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
