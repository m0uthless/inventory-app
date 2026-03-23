"""wiki/api/attachments.py — WikiAttachment serializer + ViewSet."""
from __future__ import annotations

import mimetypes
import os

from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status as drf_status
from rest_framework.throttling import UserRateThrottle
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter


class WikiAttachmentUploadThrottle(UserRateThrottle):
    """Throttle per gli upload di allegati wiki.

    Usa lo scope 'file_upload' definito in DEFAULT_THROTTLE_RATES.
    Sovrascrivibile via env FILE_UPLOAD_THROTTLE_RATE (default: 30/minute).
    """
    scope = "file_upload"

from core.permissions import CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, RestoreActionMixin
from core.soft_delete import apply_soft_delete_filters
from audit.utils import log_event, to_change_value_for_field

from wiki.models import WikiAttachment, WikiPage
from wiki.api.helpers import _attachment_accel_response

# ── Upload limits ─────────────────────────────────────────────────────────────
_WIKI_ATTACH_MAX_MB = int(os.environ.get("WIKI_ATTACHMENT_MAX_MB", "10"))
_WIKI_ATTACH_MAX_BYTES = _WIKI_ATTACH_MAX_MB * 1024 * 1024

_WIKI_BLOCKED_EXTENSIONS = {
    "exe", "bat", "cmd", "com", "msi", "sh", "bash",
    "ps1", "vbs", "js", "ts", "php", "py", "rb", "pl",
    "jar", "dll", "so",
}

try:
    import magic as _wiki_magic
    _WIKI_MAGIC_AVAILABLE = True
except ImportError:
    _WIKI_MAGIC_AVAILABLE = False

_WIKI_BLOCKED_MIMES = {
    "application/x-sh", "application/x-shellscript", "text/x-shellscript",
    "application/x-php", "application/x-httpd-php", "text/x-php",
    "application/x-python", "text/x-python",
    "application/x-ruby", "application/x-perl",
    "application/x-msdos-program", "application/x-msdownload",
    "application/x-dosexec", "application/java-archive",
}


def _validate_wiki_attachment(uploaded) -> None:
    """Valida dimensione, estensione e MIME type di un allegato wiki.
    Solleva serializers.ValidationError se il file non è ammesso.
    """
    if uploaded.size > _WIKI_ATTACH_MAX_BYTES:
        human = f"{uploaded.size / (1024 * 1024):.1f} MB"
        raise serializers.ValidationError(
            f"Il file è troppo grande ({human}). "
            f"Dimensione massima consentita: {_WIKI_ATTACH_MAX_MB} MB."
        )

    _, ext = os.path.splitext(uploaded.name)
    if ext.lower().lstrip(".") in _WIKI_BLOCKED_EXTENSIONS:
        raise serializers.ValidationError(
            f"Il tipo di file '{ext.lower()}' non è consentito come allegato wiki."
        )

    if _WIKI_MAGIC_AVAILABLE:
        header = uploaded.read(2048)
        uploaded.seek(0)
        try:
            real_mime = _wiki_magic.from_buffer(header, mime=True) or ""
        except Exception:
            real_mime = ""
        if real_mime in _WIKI_BLOCKED_MIMES:
            raise serializers.ValidationError(
                f"Il contenuto del file è di un tipo non consentito ({real_mime})."
            )


class WikiAttachmentSerializer(serializers.ModelSerializer):
    page_title = serializers.CharField(source="page.title", read_only=True)
    file_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    def _build_action_url(self, obj, action: str):
        request = self.context.get("request")
        relative = f"/api/wiki-attachments/{obj.pk}/{action}/"
        return request.build_absolute_uri(relative) if request else relative

    def get_file_url(self, obj):
        if not obj.file:
            return None
        return self._build_action_url(obj, "preview")

    def get_preview_url(self, obj):
        if not obj.file:
            return None
        return self._build_action_url(obj, "preview")

    def get_download_url(self, obj):
        if not obj.file:
            return None
        return self._build_action_url(obj, "download")

    class Meta:
        model = WikiAttachment
        fields = [
            "id",
            "page",
            "page_title",
            "filename",
            "mime_type",
            "storage_key",
            "size_bytes",
            "notes",
            "file_url",
            "preview_url",
            "download_url",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiAttachmentViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    restore_has_updated_by  = False
    restore_response_204    = False
    restore_use_split       = False
    restore_use_block_check = False
    serializer_class = WikiAttachmentSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["mime_type"]
    search_fields = ["filename", "storage_key", "notes", "page__title"]
    ordering_fields = ["filename", "size_bytes", "updated_at", "created_at", "deleted_at"]
    ordering = ["filename"]

    def get_queryset(self):
        qs = WikiAttachment.objects.select_related("page")
        page_id = self.request.query_params.get("page_id")
        if page_id not in (None, ""):
            try:
                qs = qs.filter(page_id=int(page_id))
            except (TypeError, ValueError):
                qs = qs.none()
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    # WikiAttachment non ha created_by/updated_by: override senza userstamp.
    def perform_create(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    @action(detail=False, methods=["post"], url_path="upload",
            throttle_classes=[WikiAttachmentUploadThrottle])
    def upload(self, request):
        """Upload un file come allegato a una pagina wiki.
        Form fields: page (int), file (multipart).
        """
        page_id = request.data.get("page")
        uploaded = request.FILES.get("file")

        if not page_id:
            return Response({"detail": "Campo 'page' obbligatorio."}, status=400)
        if not uploaded:
            return Response({"detail": "Campo 'file' obbligatorio."}, status=400)

        try:
            _validate_wiki_attachment(uploaded)
        except Exception as e:
            from rest_framework.exceptions import ValidationError
            if isinstance(e, ValidationError):
                return Response({"detail": str(e.detail[0]) if isinstance(e.detail, list) else e.detail}, status=400)
            return Response({"detail": "File non valido."}, status=400)

        try:
            page = WikiPage.objects.get(pk=page_id)
        except WikiPage.DoesNotExist:
            return Response({"detail": "Pagina non trovata."}, status=404)

        attachment = WikiAttachment.objects.create(
            page=page,
            file=uploaded,
            filename=uploaded.name,
            mime_type=uploaded.content_type or "",
            size_bytes=uploaded.size,
            storage_key="",
        )

        log_event(actor=request.user, action="create", instance=attachment, request=request)

        serializer = self.get_serializer(attachment, context={"request": request})
        return Response(serializer.data, status=201)

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        attachment = self.get_object()
        if not attachment.file:
            return Response({"detail": "File non presente."}, status=404)
        return _attachment_accel_response(
            file_field=attachment.file,
            filename=attachment.filename or "attachment",
            mime_type=attachment.mime_type or None,
            disposition="inline",
        )

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        attachment = self.get_object()
        if not attachment.file:
            return Response({"detail": "File non presente."}, status=404)
        return _attachment_accel_response(
            file_field=attachment.file,
            filename=attachment.filename or "attachment",
            mime_type=attachment.mime_type or None,
            disposition="attachment",
        )
