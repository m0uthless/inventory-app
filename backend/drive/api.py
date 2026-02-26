from __future__ import annotations

import mimetypes
import os
from pathlib import PurePosixPath

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
from core.soft_delete import apply_soft_delete_filters

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


def _user_group_ids(user) -> set[int]:
    return set(user.groups.values_list("id", flat=True))


def _groups_allow_access(user, groups_qs) -> bool:
    """Access rule:

    - superuser: always
    - allowed_groups empty: open to all authenticated users
    - otherwise: user must be in at least one allowed group
    """

    if getattr(user, "is_superuser", False):
        return True

    allowed_ids = list(groups_qs.values_list("id", flat=True))
    if not allowed_ids:
        return True

    return bool(_user_group_ids(user) & set(allowed_ids))


def _has_folder_access(user, folder: DriveFolder) -> bool:
    return _groups_allow_access(user, folder.allowed_groups.all())


def _has_file_access(user, file: DriveFile) -> bool:
    if not _groups_allow_access(user, file.allowed_groups.all()):
        return False

    # Folder-level groups (if any)
    if getattr(file, "folder_id", None):
        folder = getattr(file, "folder", None)
        if folder and not _groups_allow_access(user, folder.allowed_groups.all()):
            return False

    return True


def _filter_accessible_folders(qs, user):
    if getattr(user, "is_superuser", False):
        return qs
    user_groups = user.groups.all()
    return qs.filter(Q(allowed_groups__isnull=True) | Q(allowed_groups__in=user_groups)).distinct()


def _filter_accessible_files(qs, user):
    if getattr(user, "is_superuser", False):
        return qs

    user_groups = user.groups.all()

    return (
        qs.filter(
            # file groups
            (Q(allowed_groups__isnull=True) | Q(allowed_groups__in=user_groups))
            &
            # folder groups (if folder is NULL, this condition passes)
            (Q(folder__allowed_groups__isnull=True) | Q(folder__allowed_groups__in=user_groups))
        )
        .distinct()
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
            "notes",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if not getattr(obj, "created_by", None):
            return None
        u = obj.created_by
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
            "notes",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["created_by", "mime_type", "size", "created_at", "updated_at"]

    def get_size_human(self, obj):
        return fmt_size(getattr(obj, "size", 0) or 0)

    def get_created_by_name(self, obj):
        if not getattr(obj, "created_by", None):
            return None
        u = obj.created_by
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


class DriveFolderViewSet(viewsets.ModelViewSet):
    serializer_class = DriveFolderSerializer
    permission_classes = [IsAuthenticatedDjangoModelPermissions]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["parent", "customers"]
    search_fields = ["name", "notes"]
    ordering_fields = ["name", "created_at", "updated_at", "deleted_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = (
            DriveFolder.objects.prefetch_related("customers", "allowed_groups")
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
        qs = _filter_accessible_folders(qs, self.request.user)

        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(customers__id=customer).distinct()

        if (self.request.query_params.get("root") or "").lower() == "true":
            qs = qs.filter(parent__isnull=True)

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])

    
    # ── Children ─────────────────────────────────────────────────────────────
    @action(detail=True, methods=["get"])
    def children(self, request, pk=None):
        """Return direct children (folders + files) for the given folder.

        Frontend expects /drive-folders/{id}/children/.
        """
        folder = self.get_object()

        # Folders
        folders_qs = DriveFolder.objects.filter(parent=folder)
        folders_qs = _apply_deleted_filters(folders_qs, request, getattr(self, "action", None))
        folders_qs = _filter_accessible_folders(folders_qs, request.user)
        folders_qs = folders_qs.prefetch_related("customers", "allowed_groups").order_by("name")

        # Files
        files_qs = DriveFile.objects.filter(folder=folder)
        files_qs = _apply_deleted_filters(files_qs, request, getattr(self, "action", None))
        files_qs = _filter_accessible_files(files_qs, request.user)
        files_qs = files_qs.prefetch_related("customers", "allowed_groups", "folder").order_by("name")

        return Response(
            {
                "folders": DriveFolderSerializer(folders_qs, many=True, context=self.get_serializer_context()).data,
                "files": DriveFileSerializer(files_qs, many=True, context=self.get_serializer_context()).data,
            }
        )

# ── Restore ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at", "updated_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)

        qs = DriveFolder.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored: list[int] = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)

        return Response({"restored": restored, "count": len(restored)}, status=200)

    # ── Children (folder contents) ───────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="children")
    def children(self, request, pk=None):
        folder = self.get_object()

        if not _has_folder_access(request.user, folder):
            return Response({"detail": "Permesso negato."}, status=403)

        sub_qs = DriveFolder.objects.filter(parent=folder)
        sub_qs = _apply_deleted_filters(sub_qs, request)
        sub_qs = _filter_accessible_folders(sub_qs, request.user)

        file_qs = DriveFile.objects.filter(folder=folder)
        file_qs = _apply_deleted_filters(file_qs, request)
        file_qs = _filter_accessible_files(file_qs, request.user)

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
        while node:
            if not _has_folder_access(request.user, node):
                break
            crumbs.append({"id": node.id, "name": node.name})
            node = node.parent

        crumbs.reverse()
        return Response(crumbs)

    # ── Move ────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        """Move this folder under a new parent.

        Body: {"parent": <folder_id|null>}
        """

        folder = self.get_object()

        if not _has_folder_access(request.user, folder):
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

        # Prevent cycles (walk up)
        node = new_parent
        while node is not None:
            if node.id == folder.id:
                return Response({"detail": "Move non valido: creerebbe un ciclo."}, status=400)
            node = node.parent

        folder.parent = new_parent
        folder.save(update_fields=["parent", "updated_at"])
        return Response(self.get_serializer(folder).data)


# ─────────────────────────────────────────────────────────────────────────────
# File ViewSet
# ─────────────────────────────────────────────────────────────────────────────


class DriveFileViewSet(viewsets.ModelViewSet):
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
        qs = _filter_accessible_files(qs, self.request.user)

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

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])

    # ── Restore ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at", "updated_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)

        qs = DriveFile.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored: list[int] = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)

        return Response({"restored": restored, "count": len(restored)}, status=200)

    # ── Move ────────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        """Move this file into another folder.

        Body: {"folder": <folder_id|null>}
        """

        file = self.get_object()
        if not _has_file_access(request.user, file):
            return Response({"detail": "Permesso negato."}, status=403)

        folder_id = request.data.get("folder", None)
        new_folder = None
        if folder_id not in (None, "", 0, "0"):
            folder_qs = DriveFolder.objects.all()
            folder_qs = folder_qs.filter(deleted_at__isnull=True)
            folder_qs = _filter_accessible_folders(folder_qs, request.user)

            try:
                new_folder = folder_qs.get(pk=folder_id)
            except DriveFolder.DoesNotExist:
                return Response({"detail": "Cartella di destinazione non trovata."}, status=404)

        file.folder = new_folder
        file.save(update_fields=["folder", "updated_at"])
        return Response(self.get_serializer(file).data)

    # ── Download ─────────────────────────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        file = self.get_object()

        if not _has_file_access(request.user, file):
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
        resp["Content-Disposition"] = f'attachment; filename="{file.name}"'
        # Do not send a misleading Content-Length for the empty upstream body.
        resp.headers.pop("Content-Length", None)
        return resp

    # ── Preview ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        file = self.get_object()

        if not _has_file_access(request.user, file):
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
        resp["Content-Disposition"] = f'inline; filename="{file.name}"'
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
