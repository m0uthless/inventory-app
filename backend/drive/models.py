import os
import mimetypes

from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


def drive_upload_path(instance, filename):
    """Salva i file in media/drive/<folder_id>/<filename>."""
    folder_id = instance.folder_id or "root"
    return os.path.join("drive", str(folder_id), filename)


class DriveFolder(TimeStampedModel):
    """Cartella virtuale, annidabile illimitatamente."""

    name = models.CharField(max_length=255)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )
    customers = models.ManyToManyField(
        "crm.Customer",
        blank=True,
        related_name="drive_folders",
    )
    allowed_groups = models.ManyToManyField(
        "auth.Group",
        blank=True,
        related_name="drive_folders",
        help_text="Gruppi che possono accedere a questa cartella. Vuoto = tutti.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_drive_folders",
    )
    notes = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = "Cartella"
        verbose_name_plural = "Cartelle"
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def full_path(self):
        parts = []
        node = self
        while node:
            parts.append(node.name)
            node = node.parent
        return "/".join(reversed(parts))

    @property
    def children_count(self):
        return self.children.filter(deleted_at__isnull=True).count()

    @property
    def files_count(self):
        return self.files.filter(deleted_at__isnull=True).count()


class DriveFile(TimeStampedModel):
    """File caricato, opzionalmente collegato a una cartella e a più clienti."""

    folder = models.ForeignKey(
        DriveFolder,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="files",
    )
    name = models.CharField(
        max_length=255,
        help_text="Nome visualizzato (può differire dal nome fisico del file).",
    )
    file = models.FileField(upload_to=drive_upload_path)
    mime_type = models.CharField(max_length=128, blank=True)
    size = models.PositiveBigIntegerField(default=0, help_text="Dimensione in byte")

    customers = models.ManyToManyField(
        "crm.Customer",
        blank=True,
        related_name="drive_files",
    )
    allowed_groups = models.ManyToManyField(
        "auth.Group",
        blank=True,
        related_name="drive_files",
        help_text="Gruppi che possono accedere a questo file. Vuoto = tutti.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_drive_files",
    )
    notes = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = "File"
        verbose_name_plural = "File"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Auto-detect mime_type se non fornito
        if not self.mime_type and self.file:
            guessed, _ = mimetypes.guess_type(self.file.name)
            self.mime_type = guessed or "application/octet-stream"
        # Auto-set size
        if self.file and hasattr(self.file, "size"):
            try:
                self.size = self.file.size
            except Exception:
                pass
        super().save(*args, **kwargs)

    @property
    def extension(self):
        _, ext = os.path.splitext(self.name)
        return ext.lower().lstrip(".")

    @property
    def is_image(self):
        return self.mime_type.startswith("image/") if self.mime_type else False

    @property
    def is_pdf(self):
        return self.mime_type == "application/pdf"

    @property
    def is_previewable(self):
        return self.is_image or self.is_pdf
