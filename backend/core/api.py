from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model

from core.models import Announcement, CustomerStatus, SiteStatus, InventoryStatus, InventoryType, UserTask

User = get_user_model()


# ─── Users (read-only, per dropdown assegnazione) ────────────────────────────

class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    class Meta:
        model  = User
        fields = ["id", "username", "first_name", "last_name", "full_name", "is_active"]


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserListSerializer
    pagination_class = None

    def get_queryset(self):
        return User.objects.filter(is_active=True).order_by("first_name", "last_name", "username")


class CustomerStatusLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerStatus
        fields = ["id", "key", "label", "sort_order", "is_active"]


class SiteStatusLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteStatus
        fields = ["id", "key", "label", "sort_order", "is_active"]


class InventoryStatusLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryStatus
        fields = ["id", "key", "label", "sort_order", "is_active"]


class InventoryTypeLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryType
        fields = ["id", "key", "label", "sort_order", "is_active", "is_hw"]


class InventoryStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventoryStatusLookupSerializer
    pagination_class = None  # <-- restituisce una LISTA, non paginata

    def get_queryset(self):
        return InventoryStatus.objects.filter(is_active=True, deleted_at__isnull=True).order_by("sort_order", "label")


class InventoryTypeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventoryTypeLookupSerializer
    pagination_class = None
    filter_backends  = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["is_active", "is_hw"]
    ordering_fields  = ["sort_order", "label"]
    ordering         = ["sort_order", "label"]

    def get_queryset(self):
        return InventoryType.objects.filter(is_active=True, deleted_at__isnull=True).order_by("sort_order", "label")


class CustomerStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CustomerStatusLookupSerializer
    pagination_class = None

    def get_queryset(self):
        return CustomerStatus.objects.filter(is_active=True, deleted_at__isnull=True).order_by("sort_order", "label")


class SiteStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SiteStatusLookupSerializer
    pagination_class = None

    def get_queryset(self):
        return SiteStatus.objects.filter(is_active=True, deleted_at__isnull=True).order_by("sort_order", "label")


# ─── Announcements ────────────────────────────────────────────────────────────

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = Announcement
        fields = [
            'id', 'title', 'body', 'category',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        u = obj.created_by
        if not u:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username


class IsStaffOrReadOnly(BasePermission):
    """Lettura: tutti gli autenticati. Scrittura: superuser o permesso core.access_archie."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        if getattr(request.user, "is_superuser", False):
            return True
        return request.user.has_perm("core.access_archie")


class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    CRUD comunicazioni bacheca.
    Lettura: tutti gli utenti autenticati.
    Scrittura: solo gruppo admin o superuser.
    """
    queryset           = Announcement.objects.select_related('created_by').all()
    serializer_class   = AnnouncementSerializer
    permission_classes = [IsAuthenticated, IsStaffOrReadOnly]
    ordering           = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# ─── UserTask ─────────────────────────────────────────────────────────────────

class UserTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model  = UserTask
        fields = ['id', 'text', 'done', 'created_at', 'done_at']
        read_only_fields = ['id', 'created_at']


class UserTaskViewSet(viewsets.ModelViewSet):
    """
    Task personali dell'utente loggato.
    Ogni utente vede e gestisce solo i propri task.
    """
    serializer_class   = UserTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserTask.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        done = serializer.validated_data.get('done', instance.done)
        done_at = timezone.now() if done and not instance.done else (None if not done else instance.done_at)
        serializer.save(done_at=done_at)
