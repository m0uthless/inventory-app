# mypy: disable-error-code=annotation-unchecked
from __future__ import annotations

import mimetypes
import os
from pathlib import PurePosixPath

try:
    import magic as _magic
    _MAGIC_AVAILABLE = True
except ImportError:  # pragma: no cover
    _MAGIC_AVAILABLE = False

from django.db.models import Count, Q
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import CanRestoreModelPermission, IsAuthenticatedDjangoModelPermissions
from core.mixins import SoftDeleteAuditMixin
from core.soft_delete import apply_soft_delete_filters
from audit.utils import log_event

from .access import filter_accessible_files, filter_accessible_folders, has_file_access, has_folder_access
from .models import DriveFile, DriveFolder


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _apply_deleted_filters(qs, request, action_name: str | None = None):
    """Soft-delete filters used across the project.

    Supports:
    - ?include_deleted=1
    - ?only_deleted=1

    Backward compatibility for Drive:
    - ?view=all|deleted
    """

    include_deleted = (request.query_params.get("include_deleted") or "").lower()
    only_deleted = (request.query_params.get("only_deleted") or "").lower()

    view_param = (request.query_params.get("view") or "").strip().lower()
    if view_param == "deleted":
        only_deleted = "1"
    elif view_param == "all":
        include_deleted = "1"

    if (action_name or "") == "restore":
        include_deleted = "1"

    # Delegate to shared logic for consistency
    return apply_soft_delete_filters(
        qs,
        request=request,
        action_name=action_name,
        include_deleted=include_deleted,
        only_deleted=only_deleted,
    )


def fmt_size(size: int) -> str:
    value = float(size)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024:
            return f"{value:.0f} {unit}"
        value /= 1024
    return f"{value:.1f} TB"


# ─────────────────────────────────────────────────────────────────────────────
# Upload limits / safety
# ─────────────────────────────────────────────────────────────────────────────

# Keep aligned with nginx/backend.conf `client_max_body_size`.
MAX_UPLOAD_MB = int(os.environ.get("DRIVE_MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_SIZE = MAX_UPLOAD_MB * 1024 * 1024

BLOCKED_EXTENSIONS = {
    "exe",
    "bat",
    "cmd",
    "com",
    "msi",
    "sh",
    "bash",
    "ps1",
    "vbs",
    "js",
    "ts",
    "php",
    "py",
    "rb",
    "pl",
    "jar",
    "dll",
    "so",
}


# ─────────────────────────────────────────────────────────────────────────────
# Folder serializers
# ─────────────────────────────────────────────────────────────────────────────


class DriveFolderSerializer(serializers.ModelSerializer):
    children_count = serializers.IntegerField(source="children_count_db", read_only=True)
    files_count = serializers.IntegerField(source="files_count_db", read_only=True)
    full_path = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DriveFolder
        fields = [
            "id",
            "name",
            "parent",
            "full_path",
            "customers",
            "allowed_groups",
            "children_count",
            "files_count",
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
            "notes",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["created_by", "updated_by", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if not getattr(obj, "created_by", None):
            return None
        u = obj.created_by
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username


    def get_updated_by_name(self, obj):
        if not getattr(obj, "updated_by", None):
            return None
        u = obj.updated_by
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username


class DriveFolderBreadcrumbSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriveFolder
        fields = ["id", "name", "parent"]


# ─────────────────────────────────────────────────────────────────────────────
# File serializers
# ─────────────────────────────────────────────────────────────────────────────


class DriveFileSerializer(serializers.ModelSerializer):
    size_human = serializers.SerializerMethodField()
    extension = serializers.CharField(read_only=True)
    is_previewable = serializers.BooleanField(read_only=True)
    is_image = serializers.BooleanField(read_only=True)
    is_pdf = serializers.BooleanField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    folder_name = serializers.CharField(source="folder.name", read_only=True)

    # Write-only to avoid leaking direct media URLs.
    file = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = DriveFile
        fields = [
            "id",
            "name",
            "folder",
            "folder_name",
            "file",
            "mime_type",
            "size",
            "size_human",
            "extension",
            "is_previewable",
            "is_image",
            "is_pdf",
            "customers",
            "allowed_groups",
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
            "notes",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["created_by", "updated_by", "mime_type", "size", "created_at", "updated_at"]

    def get_size_human(self, obj):
        return fmt_size(getattr(obj, "size", 0) or 0)

    def get_created_by_name(self, obj):
        if not getattr(obj, "created_by", None):
            return None
        u = obj.created_by
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    def get_updated_by_name(self, obj):
        if not getattr(obj, "updated_by", None):
            return None
        u = obj.updated_by
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    def validate_file(self, value):
        if value.size > MAX_UPLOAD_SIZE:
            human = fmt_size(value.size)
            raise serializers.ValidationError(
                f"Il file è troppo grande ({human}). Dimensione massima consentita: {MAX_UPLOAD_MB} MB."
            )

        _, ext = os.path.splitext(value.name)
        ext_clean = ext.lower().lstrip(".")
        if ext_clean in BLOCKED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Il tipo di file '.{ext_clean}' non è consentito per motivi di sicurezza."
            )

        # Verifica MIME type reale del contenuto (non solo l'estensione).
        # Previene il bypass via rinomina (es. script.php → script.txt).
        if _MAGIC_AVAILABLE:
            header = value.read(2048)
            value.seek(0)
            try:
                real_mime = _magic.from_buffer(header, mime=True) or ""
            except Exception:
                real_mime = ""
            # Lista di MIME type bloccati indipendentemente dall'estensione dichiarata.
            BLOCKED_MIMES = {
                "application/x-sh",
                "application/x-shellscript",
                "text/x-shellscript",
                "application/x-php",
                "application/x-httpd-php",
                "text/x-php",
                "application/x-python",
                "text/x-python",
                "application/x-ruby",
                "application/x-perl",
                "application/x-msdos-program",
                "application/x-msdownload",
                "application/x-dosexec",
                "application/java-archive",
                "application/x-java-archive",
            }
            if real_mime in BLOCKED_MIMES:
                raise serializers.ValidationError(
                    f"Il contenuto del file è di un tipo non consentito ({real_mime}). Rinominare l'estensione non aggira questo controllo."
                )

        return value

    def validate(self, attrs):
        # Create requires file.
        if self.instance is None and not attrs.get("file"):
            raise serializers.ValidationError({"file": "Campo obbligatorio."})

        # Disallow replacing file content on update (safer + avoids size/mime drift).
        if self.instance is not None and attrs.get("file") is not None:
            raise serializers.ValidationError({"file": "Non è consentito sostituire il file. Carica un nuovo file."})

        return attrs


# ─────────────────────────────────────────────────────────────────────────────
# Folder ViewSet
# ─────────────────────────────────────────────────────────────────────────────


class DriveFolderViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = DriveFolderSerializer
    permission_classes = [IsAuthenticatedDjangoModelPermissions]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["parent", "customers"]
    search_fields = ["name", "notes"]
    ordering_fields = ["name", "created_at", "updated_at", "deleted_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = (
            DriveFolder.objects.select_related(
                # Carica la catena parent fino a 5 livelli in un'unica query JOIN
                # invece di N query separate in breadcrumb/move.
                "parent",
                "parent__parent",
                "parent__parent__parent",
                "parent__parent__parent__parent",
                "parent__parent__parent__parent__parent",
            ).prefetch_related("customers", "allowed_groups")
            .annotate(
                children_count_db=Count(
                    "children",
                    filter=Q(children__deleted_at__isnull=True),
                    distinct=True,
                ),
                files_count_db=Count(
                    "files",
                    filter=Q(files__deleted_at__isnull=True),
                    distinct=True,
                ),
            )
        )

        qs = _apply_deleted_filters(qs, self.request, getattr(self, "action", None))
        qs = filter_accessible_folders(qs, self.request.user)

        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(customers__id=customer).distinct()

        if (self.request.query_params.get("root") or "").lower() == "true":
            qs = qs.filter(parent__isnull=True)

        return qs

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)
    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)


# ── Restore ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.updated_by = request.user
        obj.save(update_fields=["deleted_at", "updated_by", "updated_at"])
        log_event(actor=request.user, action="restore", instance=obj, request=request)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)

        scoped_qs = self.filter_queryset(self.get_queryset()).filter(deleted_at__isnull=False)
        now = timezone.now()
        restored_ids = list(scoped_qs.filter(id__in=ids).values_list("id", flat=True))
        scoped_qs.filter(id__in=restored_ids).update(deleted_at=None, updated_by=request.user, updated_at=now)
        log_event(
            actor=request.user, action="restore", instance=None,
            changes={"ids": restored_ids}, request=request,
            subject=f"bulk restore DriveFolder: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=200)

    # ── Children (folder contents) ───────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="children")
    def children(self, request, pk=None):
        folder = self.get_object()

        if not has_folder_access(request.user, folder):
            return Response({"detail": "Permesso negato."}, status=403)

        sub_qs = DriveFolder.objects.filter(parent=folder)
        sub_qs = _apply_deleted_filters(sub_qs, request)
        sub_qs = filter_accessible_folders(sub_qs, request.user)

        file_qs = DriveFile.objects.filter(folder=folder)
        file_qs = _apply_deleted_filters(file_qs, request)
        file_qs = filter_accessible_files(file_qs, request.user)

        return Response(
            {
                "folder": DriveFolderSerializer(folder, context=self.get_serializer_context()).data,
                "folders": DriveFolderSerializer(sub_qs, many=True, context=self.get_serializer_context()).data,
                "files": DriveFileSerializer(file_qs, many=True, context=self.get_serializer_context()).data,
            }
        )

    # ── Breadcrumb ───────────────────────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="breadcrumb")
    def breadcrumb(self, request, pk=None):
        folder = self.get_object()

        crumbs: list[dict[str, int | str]] = []
        node = folder
        MAX_DEPTH = 50  # protezione contro cicli nel grafo parent
        depth = 0
        while node and depth < MAX_DEPTH:
            if not has_folder_access(request.user, node):
                break
            crumbs.append({"id": node.id, "name": node.name})
            node = node.parent
            depth += 1

        crumbs.reverse()
        return Response(crumbs)

    # ── Move ────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        """Move this folder under a new parent.

        Body: {"parent": <folder_id|null>}
        """

        folder = self.get_object()

        if not has_folder_access(request.user, folder):
            return Response({"detail": "Permesso negato."}, status=403)

        parent_id = request.data.get("parent", None)

        new_parent = None
        if parent_id not in (None, "", 0, "0"):
            try:
                new_parent = self.get_queryset().get(pk=parent_id)
            except DriveFolder.DoesNotExist:
                return Response({"detail": "Parent non trovato."}, status=404)

        if new_parent and new_parent.id == folder.id:
            return Response({"detail": "Una cartella non può essere parent di se stessa."}, status=400)

        # Prevent cycles (walk up the parent chain with depth limit)
        node = new_parent
        depth = 0
        MAX_DEPTH = 50
        while node is not None and depth < MAX_DEPTH:
            if node.id == folder.id:
                return Response({"detail": "Move non valido: creerebbe un ciclo."}, status=400)
            node = node.parent
            depth += 1

        old_parent_id = folder.parent_id  # cattura PRIMA della modifica

        folder.parent = new_parent
        folder.updated_by = request.user
        folder.save(update_fields=["parent", "updated_by", "updated_at"])
        log_event(
            actor=request.user,
            action="update",
            instance=folder,
            changes={
                "parent": {
                    "from": old_parent_id,
                    "to": new_parent.id if new_parent else None,
                }
            },
            request=request,
            subject=f"move folder '{folder.name}' → '{new_parent.name if new_parent else 'root'}'",
        )
        return Response(self.get_serializer(folder).data)


# ─────────────────────────────────────────────────────────────────────────────
# File ViewSet
# ─────────────────────────────────────────────────────────────────────────────


class DriveFileViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = DriveFileSerializer
    permission_classes = [IsAuthenticatedDjangoModelPermissions]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["folder", "customers"]
    search_fields = ["name", "notes"]
    ordering_fields = ["name", "size", "created_at", "updated_at", "deleted_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = DriveFile.objects.select_related("folder", "created_by").prefetch_related(
            "customers",
            "allowed_groups",
            "folder__allowed_groups",
        )

        qs = _apply_deleted_filters(qs, self.request, getattr(self, "action", None))
        qs = filter_accessible_files(qs, self.request.user)

        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(customers__id=customer).distinct()

        return qs

    def perform_create(self, serializer):
        uploaded = serializer.validated_data.get("file")
        name = serializer.validated_data.get("name") or (uploaded.name if uploaded else None)

        instance = serializer.save(created_by=self.request.user, name=name)

        if uploaded:
            instance.size = uploaded.size
            guessed_mime = uploaded.content_type or mimetypes.guess_type(uploaded.name)[0]
            instance.mime_type = guessed_mime or "application/octet-stream"
            instance.save(update_fields=["size", "mime_type", "updated_at"])

        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    # ── Restore ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.updated_by = request.user
        obj.save(update_fields=["deleted_at", "updated_by", "updated_at"])
        log_event(actor=request.user, action="restore", instance=obj, request=request)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)

        scoped_qs = self.filter_queryset(self.get_queryset()).filter(deleted_at__isnull=False)
        now = timezone.now()
        restored_ids = list(scoped_qs.filter(id__in=ids).values_list("id", flat=True))
        scoped_qs.filter(id__in=restored_ids).update(deleted_at=None, updated_by=request.user, updated_at=now)
        log_event(
            actor=request.user, action="restore", instance=None,
            changes={"ids": restored_ids}, request=request,
            subject=f"bulk restore DriveFile: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=200)

    # ── Move ────────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        """Move this file into another folder.

        Body: {"folder": <folder_id|null>}
        """

        file = self.get_object()
        if not has_file_access(request.user, file):
            return Response({"detail": "Permesso negato."}, status=403)

        folder_id = request.data.get("folder", None)
        new_folder = None
        if folder_id not in (None, "", 0, "0"):
            folder_qs = DriveFolder.objects.all()
            folder_qs = folder_qs.filter(deleted_at__isnull=True)
            folder_qs = filter_accessible_folders(folder_qs, request.user)

            try:
                new_folder = folder_qs.get(pk=folder_id)
            except DriveFolder.DoesNotExist:
                return Response({"detail": "Cartella di destinazione non trovata."}, status=404)

        old_folder_id = file.folder_id  # cattura PRIMA della modifica

        file.folder = new_folder
        file.updated_by = request.user
        file.save(update_fields=["folder", "updated_by", "updated_at"])
        log_event(
            actor=request.user,
            action="update",
            instance=file,
            changes={
                "folder": {
                    "from": old_folder_id,
                    "to": new_folder.id if new_folder else None,
                }
            },
            request=request,
            subject=f"move file '{file.name}' → '{new_folder.name if new_folder else 'root'}'",
        )
        return Response(self.get_serializer(file).data)

    # ── Download ─────────────────────────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        file = self.get_object()

        if not has_file_access(request.user, file):
            return Response({"detail": "Permesso negato."}, status=403)

        if not file.file:
            return Response({"detail": "File non presente."}, status=404)

        # Serve via nginx X-Accel-Redirect (avoid streaming through gunicorn)
        rel_name = (file.file.name or "").lstrip("/")
        p = PurePosixPath(rel_name)
        if ".." in p.parts:
            return Response({"detail": "Percorso file non valido."}, status=400)

        accel_path = f"/protected_media/{rel_name}"
        mime = file.mime_type or mimetypes.guess_type(rel_name)[0] or "application/octet-stream"

        resp = HttpResponse(b"", content_type=mime)
        resp["X-Accel-Redirect"] = accel_path
        # RFC 6266: filename* con encoding UTF-8 per nomi non-ASCII o con caratteri speciali.
        # Il fallback ASCII (filename=) mantiene la compatibilità con client datati.
        from urllib.parse import quote
        ascii_name = file.name.encode("ascii", errors="replace").decode("ascii")
        utf8_name = quote(file.name, safe="")
        resp["Content-Disposition"] = (
            f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{utf8_name}'
        )
        # Do not send a misleading Content-Length for the empty upstream body.
        resp.headers.pop("Content-Length", None)
        return resp

    # ── Preview ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        file = self.get_object()

        if not has_file_access(request.user, file):
            return Response({"detail": "Permesso negato."}, status=403)

        if not file.file:
            return Response({"detail": "File non presente."}, status=404)

        if not getattr(file, "is_previewable", False):
            return Response({"detail": "File non previewable."}, status=400)

        # Serve via nginx X-Accel-Redirect (inline preview)
        rel_name = (file.file.name or "").lstrip("/")
        p = PurePosixPath(rel_name)
        if ".." in p.parts:
            return Response({"detail": "Percorso file non valido."}, status=400)

        accel_path = f"/protected_media/{rel_name}"
        mime = file.mime_type or mimetypes.guess_type(rel_name)[0] or "application/octet-stream"

        resp = HttpResponse(b"", content_type=mime)
        resp["X-Accel-Redirect"] = accel_path
        from urllib.parse import quote
        ascii_name = file.name.encode("ascii", errors="replace").decode("ascii")
        utf8_name = quote(file.name, safe="")
        resp["Content-Disposition"] = (
            f'inline; filename="{ascii_name}"; filename*=UTF-8\'\'{utf8_name}'
        )
        resp.headers.pop("Content-Length", None)
        return resp


# ─────────────────────────────────────────────────────────────────────────────
# Optional: dedicated upload endpoint (kept for backward-compat)
# ─────────────────────────────────────────────────────────────────────────────


class CanUploadDriveFile(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.has_perm("drive.add_drivefile"))


class DriveFileUploadView(APIView):
    """Dedicated upload endpoint (multipart).

    The UI currently posts directly to /api/drive-files/ (ModelViewSet create),
    but this endpoint remains for backward compatibility.
    """

    permission_classes = [IsAuthenticated, CanUploadDriveFile]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = DriveFileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        uploaded = serializer.validated_data.get("file")
        name = serializer.validated_data.get("name") or (uploaded.name if uploaded else None)

        instance = serializer.save(created_by=request.user, name=name)
        if uploaded:
            instance.size = uploaded.size
            guessed_mime = uploaded.content_type or mimetypes.guess_type(uploaded.name)[0]
            instance.mime_type = guessed_mime or "application/octet-stream"
            instance.save(update_fields=["size", "mime_type", "updated_at"])

        out = DriveFileSerializer(instance, context={"request": request}).data
        return Response(out, status=status.HTTP_201_CREATED)
