import mimetypes
import os

from django.http import FileResponse
from django.utils import timezone
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsAuthenticatedDjangoModelPermissions, CanRestoreModelPermission
from .models import DriveFolder, DriveFile


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _apply_deleted_filter(qs, request):
    """Replicates the soft-delete filter pattern used across the project."""
    view_param = (request.query_params.get("view") or "").strip().lower()
    if view_param == "deleted":
        return qs.filter(deleted_at__isnull=False)
    if view_param == "all":
        return qs
    return qs.filter(deleted_at__isnull=True)


def _has_folder_access(user, folder: DriveFolder) -> bool:
    """
    Returns True if the user can access this folder.
    Rules:
      - superuser → always
      - allowed_groups is empty → open to all authenticated users
      - otherwise → user must belong to at least one of the allowed groups
    """
    if user.is_superuser:
        return True
    groups = folder.allowed_groups.all()
    if not groups.exists():
        return True
    user_group_ids = set(user.groups.values_list("id", flat=True))
    return bool(user_group_ids & {g.id for g in groups})


def _has_file_access(user, file: DriveFile) -> bool:
    if user.is_superuser:
        return True
    groups = file.allowed_groups.all()
    if not groups.exists():
        return True
    user_group_ids = set(user.groups.values_list("id", flat=True))
    return bool(user_group_ids & {g.id for g in groups})


def fmt_size(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.0f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


# ─────────────────────────────────────────────────────────────────────────────
# Folder serializers
# ─────────────────────────────────────────────────────────────────────────────

class DriveFolderSerializer(serializers.ModelSerializer):
    children_count  = serializers.IntegerField(read_only=True)
    files_count     = serializers.IntegerField(read_only=True)
    full_path       = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        u = obj.created_by
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    class Meta:
        model = DriveFolder
        fields = [
            "id", "name", "parent", "full_path",
            "customers", "allowed_groups",
            "children_count", "files_count",
            "created_by", "created_by_name",
            "notes", "created_at", "updated_at", "deleted_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]


class DriveFolderBreadcrumbSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriveFolder
        fields = ["id", "name", "parent"]


# ─────────────────────────────────────────────────────────────────────────────
# File serializers
# ─────────────────────────────────────────────────────────────────────────────

# ── Upload limits ─────────────────────────────────────────────────────────────
MAX_UPLOAD_MB   = 5000          # must match nginx client_max_body_size
MAX_UPLOAD_SIZE = MAX_UPLOAD_MB * 1024 * 1024

# Extensions explicitly blocked (executables, scripts)
BLOCKED_EXTENSIONS = {
    "exe", "bat", "cmd", "com", "msi", "sh", "bash", "ps1", "vbs",
    "js", "ts", "php", "py", "rb", "pl", "jar", "dll", "so",
}


class DriveFileSerializer(serializers.ModelSerializer):
    size_human      = serializers.SerializerMethodField()
    extension       = serializers.CharField(read_only=True)
    is_previewable  = serializers.BooleanField(read_only=True)
    is_image        = serializers.BooleanField(read_only=True)
    is_pdf          = serializers.BooleanField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    folder_name     = serializers.CharField(source="folder.name", read_only=True)

    def get_size_human(self, obj):
        return fmt_size(obj.size)

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        u = obj.created_by
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    def validate_file(self, value):
        # ── Size check ────────────────────────────────────────────────────────
        if value.size > MAX_UPLOAD_SIZE:
            human = fmt_size(value.size)
            raise serializers.ValidationError(
                f"Il file è troppo grande ({human}). "
                f"Dimensione massima consentita: {MAX_UPLOAD_MB} MB."
            )

        # ── Extension check ───────────────────────────────────────────────────
        import os as _os
        _, ext = _os.path.splitext(value.name)
        ext_clean = ext.lower().lstrip(".")
        if ext_clean in BLOCKED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Il tipo di file '.{ext_clean}' non è consentito per motivi di sicurezza."
            )

        return value

    class Meta:
        model = DriveFile
        fields = [
            "id", "name", "folder", "folder_name",
            "file", "mime_type", "size", "size_human",
            "extension", "is_previewable", "is_image", "is_pdf",
            "customers", "allowed_groups",
            "created_by", "created_by_name",
            "notes", "created_at", "updated_at", "deleted_at",
        ]
        read_only_fields = [
            "created_by", "mime_type", "size",
            "created_at", "updated_at",
        ]


# ─────────────────────────────────────────────────────────────────────────────
# Folder ViewSet
# ─────────────────────────────────────────────────────────────────────────────

class DriveFolderViewSet(viewsets.ModelViewSet):
    serializer_class   = DriveFolderSerializer
    permission_classes = [IsAuthenticatedDjangoModelPermissions]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["parent", "customers"]
    search_fields      = ["name", "notes"]
    ordering_fields    = ["name", "created_at", "updated_at"]
    ordering           = ["name"]

    def get_queryset(self):
        qs = DriveFolder.objects.prefetch_related("customers", "allowed_groups", "children", "files")
        qs = _apply_deleted_filter(qs, self.request)

        # Filter by customer
        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(customers__id=customer).distinct()

        # root=true → only top-level folders
        if self.request.query_params.get("root") == "true":
            qs = qs.filter(parent__isnull=True)

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

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
        qs = DriveFolder.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)
        return Response({"restored": restored, "count": len(restored)})

    # ── Children (contenuto di una cartella) ──────────────────────────────────

    @action(detail=True, methods=["get"], url_path="children")
    def children(self, request, pk=None):
        """
        Restituisce sottocartelle + file di una cartella specifica.
        Usato per la navigazione dell'albero.
        """
        folder = self.get_object()
        if not _has_folder_access(request.user, folder):
            return Response({"detail": "Permesso negato."}, status=403)

        view_param = (request.query_params.get("view") or "").strip().lower()

        sub_qs = folder.children.all()
        if view_param == "deleted":
            sub_qs = sub_qs.filter(deleted_at__isnull=False)
        elif view_param == "all":
            pass
        else:
            sub_qs = sub_qs.filter(deleted_at__isnull=True)

        file_qs = folder.files.all()
        if view_param == "deleted":
            file_qs = file_qs.filter(deleted_at__isnull=False)
        elif view_param == "all":
            pass
        else:
            file_qs = file_qs.filter(deleted_at__isnull=True)

        folders_data = DriveFolderSerializer(sub_qs, many=True).data
        files_data   = DriveFileSerializer(file_qs, many=True).data

        return Response({
            "folder":  DriveFolderSerializer(folder).data,
            "folders": folders_data,
            "files":   files_data,
        })

    # ── Breadcrumb ────────────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="breadcrumb")
    def breadcrumb(self, request, pk=None):
        """Restituisce la catena di cartelle da root fino a questa."""
        folder = self.get_object()
        crumbs = []
        node = folder
        while node:
            crumbs.append({"id": node.id, "name": node.name})
            node = node.parent
        crumbs.reverse()
        return Response(crumbs)

    # ── Move ──────────────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        """
        Sposta la cartella sotto un nuovo parent.
        Body: {"parent": <id | null>}
        """
        folder = self.get_object()
        new_parent_id = request.data.get("parent")

        if new_parent_id is not None:
            try:
                new_parent = DriveFolder.objects.get(id=new_parent_id, deleted_at__isnull=True)
            except DriveFolder.DoesNotExist:
                return Response({"detail": "Cartella destinazione non trovata."}, status=404)

            # Evita cicli: la destinazione non deve essere un discendente
            node = new_parent
            while node:
                if node.id == folder.id:
                    return Response({"detail": "Non puoi spostare una cartella in un suo discendente."}, status=400)
                node = node.parent

            folder.parent = new_parent
        else:
            folder.parent = None

        folder.save(update_fields=["parent", "updated_at"])
        return Response(DriveFolderSerializer(folder).data)


# ─────────────────────────────────────────────────────────────────────────────
# File ViewSet
# ─────────────────────────────────────────────────────────────────────────────

class DriveFileViewSet(viewsets.ModelViewSet):
    serializer_class   = DriveFileSerializer
    permission_classes = [IsAuthenticatedDjangoModelPermissions]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["folder", "customers", "mime_type"]
    search_fields      = ["name", "notes"]
    ordering_fields    = ["name", "size", "created_at", "updated_at"]
    ordering           = ["name"]

    def get_queryset(self):
        qs = DriveFile.objects.select_related("folder", "created_by").prefetch_related("customers", "allowed_groups")
        qs = _apply_deleted_filter(qs, self.request)

        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(customers__id=customer).distinct()

        # file orfani (senza cartella)
        if self.request.query_params.get("root") == "true":
            qs = qs.filter(folder__isnull=True)

        return qs

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        # Aggiorna name al nome del file se non specificato esplicitamente
        if not serializer.validated_data.get("name") and instance.file:
            instance.name = os.path.basename(instance.file.name)
            instance.save(update_fields=["name"])

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])

    # ── Download ──────────────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """Serve il file con Content-Disposition: attachment."""
        obj = self.get_object()
        if not _has_file_access(request.user, obj):
            return Response({"detail": "Permesso negato."}, status=403)
        if not obj.file:
            return Response({"detail": "File non trovato."}, status=404)
        try:
            response = FileResponse(
                obj.file.open("rb"),
                as_attachment=True,
                filename=obj.name,
            )
            return response
        except FileNotFoundError:
            return Response({"detail": "File fisico non trovato."}, status=404)

    # ── Preview URL ───────────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        """Serve il file inline (per preview immagini e PDF)."""
        obj = self.get_object()
        if not _has_file_access(request.user, obj):
            return Response({"detail": "Permesso negato."}, status=403)
        if not obj.file:
            return Response({"detail": "File non trovato."}, status=404)
        try:
            response = FileResponse(
                obj.file.open("rb"),
                as_attachment=False,
                filename=obj.name,
                content_type=obj.mime_type or "application/octet-stream",
            )
            return response
        except FileNotFoundError:
            return Response({"detail": "File fisico non trovato."}, status=404)

    # ── Restore ───────────────────────────────────────────────────────────────

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
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)
        return Response({"restored": restored, "count": len(restored)})

    # ── Move ──────────────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        """
        Sposta il file in una diversa cartella.
        Body: {"folder": <id | null>}
        """
        file_obj = self.get_object()
        new_folder_id = request.data.get("folder")

        if new_folder_id is not None:
            try:
                new_folder = DriveFolder.objects.get(id=new_folder_id, deleted_at__isnull=True)
            except DriveFolder.DoesNotExist:
                return Response({"detail": "Cartella destinazione non trovata."}, status=404)
            file_obj.folder = new_folder
        else:
            file_obj.folder = None

        file_obj.save(update_fields=["folder", "updated_at"])
        return Response(DriveFileSerializer(file_obj).data)
