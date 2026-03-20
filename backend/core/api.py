from rest_framework import serializers, viewsets
from rest_framework.filters import OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType

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
