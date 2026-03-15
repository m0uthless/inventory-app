from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class ReportKind(models.TextChoices):
    BUG = 'bug', 'Report a bug'
    FEATURE = 'feature', 'Request feature'


class ReportStatus(models.TextChoices):
    OPEN = 'open', 'Open'
    RESOLVED = 'resolved', 'Resolved'


class ReportSection(models.TextChoices):
    DASHBOARD = 'dashboard', 'Dashboard'
    SITE_REPOSITORY = 'site_repository', 'Site Repository'
    CUSTOMERS = 'customers', 'Customers'
    SITES = 'sites', 'Sites'
    CONTACTS = 'contacts', 'Contacts'
    INVENTORY = 'inventory', 'Inventory'
    ISSUES = 'issues', 'Issues'
    AUDIT = 'audit', 'Audit'
    MAINTENANCE = 'maintenance', 'Maintenance'
    DRIVE = 'drive', 'Drive'
    WIKI = 'wiki', 'Wiki'
    SEARCH = 'search', 'Ricerca'
    PROFILE = 'profile', 'Profilo'
    TRASH = 'trash', 'Cestino'
    OTHER = 'other', 'Altro'


class ReportRequest(TimeStampedModel):
    kind = models.CharField(max_length=16, choices=ReportKind.choices, default=ReportKind.BUG)
    status = models.CharField(max_length=16, choices=ReportStatus.choices, default=ReportStatus.OPEN)
    section = models.CharField(max_length=32, choices=ReportSection.choices, default=ReportSection.OTHER)
    description = models.TextField(verbose_name='Descrizione')
    screenshot = models.FileField(upload_to='report_request_screenshots/', null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='report_requests',
        verbose_name='Creato da',
    )
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name='Risolto il')
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='resolved_report_requests',
        null=True,
        blank=True,
        verbose_name='Risolto da',
    )

    class Meta:
        verbose_name = 'Report / Request'
        verbose_name_plural = 'Report / Request'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['kind'], name='reportrequest_kind_idx'),
            models.Index(fields=['status'], name='reportrequest_status_idx'),
            models.Index(fields=['section'], name='reportrequest_section_idx'),
            models.Index(fields=['created_by'], name='reportrequest_created_by_idx'),
            models.Index(fields=['resolved_by'], name='reportrequest_resolved_by_idx'),
            models.Index(fields=['-created_at'], name='reportrequest_created_at_idx'),
            models.Index(fields=['-resolved_at'], name='reportrequest_resolved_at_idx'),
        ]

    def __str__(self):
        return f"{self.get_kind_display()} · {self.get_section_display()} · #{self.pk}"
