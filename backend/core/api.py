from rest_framework import serializers, viewsets

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType


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
        fields = ["id", "key", "label", "sort_order", "is_active"]


class InventoryStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventoryStatusLookupSerializer
    pagination_class = None  # <-- restituisce una LISTA, non paginata

    def get_queryset(self):
        return InventoryStatus.objects.filter(is_active=True, deleted_at__isnull=True).order_by("sort_order", "label")


class InventoryTypeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventoryTypeLookupSerializer
    pagination_class = None

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
