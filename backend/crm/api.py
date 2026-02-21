from django.utils import timezone
from django.db.models import OuterRef, Subquery, F
from django.db.models import TextField
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce

import django_filters as filters

from rest_framework import serializers, viewsets, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import BasePermission
from rest_framework.decorators import action
from rest_framework.response import Response

from crm.models import Customer, Site, Contact
from audit.utils import log_event, to_change_value_for_field, to_primitive
from custom_fields.validation import normalize_and_validate_custom_fields




# -------------------------
# Permissions
# -------------------------

class CanRestoreCustomer(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.has_perm("crm.change_customer"))


class CanRestoreSite(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.has_perm("crm.change_site"))


class CanRestoreContact(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.has_perm("crm.change_contact"))

# -------------------------
# Customers
# -------------------------


class CustomerFilter(filters.FilterSet):
    """Customer filters used by the list UI.

    Notes:
    - "city" is stored inside custom_fields (JSONField). We filter by casting the JSON to text.
      This is intentionally pragmatic (works even if the key name varies), and is good enough for
      an interactive UI filter.
    """

    city = filters.CharFilter(method="filter_city")

    class Meta:
        model = Customer
        fields = ["status", "city"]

    def filter_city(self, queryset, name, value):
        v = (value or "").strip()
        if not v:
            return queryset
        return queryset.annotate(_cf_text=Cast("custom_fields", TextField())).filter(_cf_text__icontains=v)

class CustomerSerializer(serializers.ModelSerializer):
    status_key = serializers.CharField(source="status.key", read_only=True)
    status_label = serializers.CharField(source="status.label", read_only=True)

    # Convenience/computed fields for list UI
    city = serializers.SerializerMethodField()
    primary_contact_id = serializers.IntegerField(read_only=True)
    primary_contact_name = serializers.CharField(read_only=True)
    primary_contact_email = serializers.CharField(read_only=True)
    primary_contact_phone = serializers.CharField(read_only=True)

    def get_city(self, obj):
        """Extract "Città" from custom_fields (case/accents tolerant)."""
        cf = getattr(obj, "custom_fields", None)
        if not isinstance(cf, dict):
            return None

        def norm(k: str) -> str:
            return (
                (k or "")
                .strip()
                .casefold()
                .replace("à", "a")
                .replace("á", "a")
                .replace("â", "a")
                .replace("ä", "a")
                .replace("'", "")
            )

        targets = {"citta", "city"}
        for k, v in cf.items():
            if norm(str(k)) in targets:
                if isinstance(v, str):
                    vv = v.strip()
                    return vv or None
                return v
        return None

    def validate(self, attrs):
        # Validate / normalize custom_fields based on definitions
        if self.instance is None:
            incoming = attrs.get("custom_fields", {})
            normalized = normalize_and_validate_custom_fields(
                entity="customer",
                incoming=incoming if incoming is not None else {},
                existing=None,
                partial=False,
            )
            attrs["custom_fields"] = normalized
        elif "custom_fields" in attrs:
            incoming = attrs.get("custom_fields")
            normalized = normalize_and_validate_custom_fields(
                entity="customer",
                incoming=incoming if incoming is not None else {},
                existing=getattr(self.instance, "custom_fields", None) or {},
                partial=bool(getattr(self, "partial", False)),
            )
            attrs["custom_fields"] = normalized
        return attrs

    class Meta:
        model = Customer
        fields = [
            "id",
            "code",
            "name",
            "display_name",
            "city",
            "primary_contact_id",
            "primary_contact_name",
            "primary_contact_email",
            "primary_contact_phone",
            "vat_number",
            "tax_code",
            "status",
            "status_key",
            "status_label",
            "notes",
            "tags",
            "custom_fields",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_class = CustomerFilter
    search_fields = ["code", "name", "display_name", "vat_number", "tax_code"]
    ordering_fields = [
        "code",
        "name",
        "display_name",
        "city",
        "status_label",
        "status__label",
        "primary_contact_name",
        "primary_contact_email",
        "primary_contact_phone",
        "vat_number",
        "tax_code",
        "updated_at",
        "created_at",
        "deleted_at",
    ]
    ordering = ["name"]

    def get_queryset(self):
        qs = Customer.objects.select_related("status")

        # Annotate city for ordering/filtering (best-effort: supports common keys)
        qs = qs.annotate(
            status_label=F("status__label"),
            city=Coalesce(
                KeyTextTransform("city", "custom_fields"),
                KeyTextTransform("citta", "custom_fields"),
                KeyTextTransform("Città", "custom_fields"),
                KeyTextTransform("Citta", "custom_fields"),
            )
        )

        # Primary contact for the customer with "site" empty (NULL)
        primary_qs = Contact.objects.filter(
            customer_id=OuterRef("pk"),
            site__isnull=True,
            is_primary=True,
            deleted_at__isnull=True,
        ).order_by("-updated_at", "id")

        qs = qs.annotate(
            primary_contact_id=Subquery(primary_qs.values("id")[:1]),
            primary_contact_name=Subquery(primary_qs.values("name")[:1]),
            primary_contact_email=Subquery(primary_qs.values("email")[:1]),
            primary_contact_phone=Subquery(primary_qs.values("phone")[:1]),
        )

        truthy = {"1", "true", "yes", "on"}
        include_deleted = (self.request.query_params.get("include_deleted") or "").lower()
        only_deleted = (self.request.query_params.get("only_deleted") or "").lower()

        if getattr(self, "action", "") == "restore":
            include_deleted = "1"

        if only_deleted in truthy:
            qs = qs.filter(deleted_at__isnull=False)
        elif include_deleted in truthy:
            pass
        else:
            qs = qs.filter(deleted_at__isnull=True)

        return qs


    def _changes_from_validated(self, instance, validated):
        changes = {}
        for k, v in (validated or {}).items():
            before_raw = getattr(instance, k, None)
            after_raw = v
            if to_primitive(before_raw) != to_primitive(after_raw):
                changes[k] = {
                    "from": to_change_value_for_field(k, before_raw),
                    "to": to_change_value_for_field(k, after_raw),
                }
        return changes

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(actor=self.request.user, action="create", instance=instance, changes=changes, request=self.request)

    def perform_update(self, serializer):
        instance_before = serializer.instance
        changes = self._changes_from_validated(instance_before, serializer.validated_data)
        instance = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=instance, changes=changes or None, request=self.request)


    def perform_destroy(self, instance):
        before = getattr(instance, 'deleted_at', None)
        instance.deleted_at = timezone.now()
        instance.updated_by = self.request.user
        instance.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
        changes = {
            'deleted_at': {
                'from': to_change_value_for_field('deleted_at', before),
                'to': to_change_value_for_field('deleted_at', instance.deleted_at),
            }
        }
        log_event(actor=self.request.user, action='delete', instance=instance, changes=changes, request=self.request)


    @action(detail=True, methods=['post'], permission_classes=[CanRestoreCustomer])
    def restore(self, request, pk=None):
        obj = self.get_object()
        before = getattr(obj, 'deleted_at', None)
        obj.deleted_at = None
        obj.updated_by = request.user
        obj.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
        changes = {
            'deleted_at': {
                'from': to_change_value_for_field('deleted_at', before),
                'to': None,
            }
        }
        log_event(actor=request.user, action='restore', instance=obj, changes=changes, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


    @action(detail=False, methods=['post'], permission_classes=[CanRestoreCustomer])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted Customer objects.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Customer.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            before = getattr(obj, 'deleted_at', None)
            obj.deleted_at = None
            obj.updated_by = request.user
            obj.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
            changes = {'deleted_at': {'from': to_change_value_for_field('deleted_at', before), 'to': None}}
            log_event(actor=request.user, action='restore', instance=obj, changes=changes, request=request)
            restored.append(obj.id)

        return Response({'restored': restored, 'count': len(restored)}, status=status.HTTP_200_OK)

# -------------------------
# Sites
# -------------------------

class SiteSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    status_key = serializers.CharField(source="status.key", read_only=True)
    status_label = serializers.CharField(source="status.label", read_only=True)

    def validate(self, attrs):
        if self.instance is None:
            incoming = attrs.get("custom_fields", {})
            normalized = normalize_and_validate_custom_fields(
                entity="site",
                incoming=incoming if incoming is not None else {},
                existing=None,
                partial=False,
            )
            attrs["custom_fields"] = normalized
        elif "custom_fields" in attrs:
            incoming = attrs.get("custom_fields")
            normalized = normalize_and_validate_custom_fields(
                entity="site",
                incoming=incoming if incoming is not None else {},
                existing=getattr(self.instance, "custom_fields", None) or {},
                partial=bool(getattr(self, "partial", False)),
            )
            attrs["custom_fields"] = normalized
        return attrs

    class Meta:
        model = Site
        fields = [
            "id",
            "customer",
            "customer_code",
            "customer_name",
            "name",
            "display_name",
            "city",
            "address_line1",
            "postal_code",
            "status",
            "status_key",
            "status_label",
            "notes",
            "custom_fields",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class SiteViewSet(viewsets.ModelViewSet):
    serializer_class = SiteSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["customer", "status"]
    search_fields = ["name", "display_name", "city", "address_line1", "postal_code"]
    ordering_fields = [
        "name",
        "display_name",
        # Aliases used by frontend (annotated in get_queryset)
        "customer_display_name",
        "status_label",
        "city",
        "postal_code",
        "deleted_at",
        "updated_at",
        "created_at",
        # Backward-compatible ORM paths
        "customer__name",
        "customer__display_name",
        "status__label",
    ]
    ordering = ["name"]

    def get_queryset(self):
        qs = Site.objects.select_related("customer", "status")

        qs = qs.annotate(
            customer_display_name=Coalesce(F("customer__display_name"), F("customer__name")),
            status_label=F("status__label"),
        )

        truthy = {"1", "true", "yes", "on"}
        include_deleted = (self.request.query_params.get("include_deleted") or "").lower()
        only_deleted = (self.request.query_params.get("only_deleted") or "").lower()

        if getattr(self, "action", "") == "restore":
            include_deleted = "1"

        if only_deleted in truthy:
            qs = qs.filter(deleted_at__isnull=False)
        elif include_deleted in truthy:
            pass
        else:
            qs = qs.filter(deleted_at__isnull=True)

        return qs


    def _changes_from_validated(self, instance, validated):
        changes = {}
        for k, v in (validated or {}).items():
            before_raw = getattr(instance, k, None)
            after_raw = v
            if to_primitive(before_raw) != to_primitive(after_raw):
                changes[k] = {
                    "from": to_change_value_for_field(k, before_raw),
                    "to": to_change_value_for_field(k, after_raw),
                }
        return changes

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(actor=self.request.user, action="create", instance=instance, changes=changes, request=self.request)

    def perform_update(self, serializer):
        instance_before = serializer.instance
        changes = self._changes_from_validated(instance_before, serializer.validated_data)
        instance = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=instance, changes=changes or None, request=self.request)


    def perform_destroy(self, instance):
        before = getattr(instance, 'deleted_at', None)
        instance.deleted_at = timezone.now()
        instance.updated_by = self.request.user
        instance.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
        changes = {
            'deleted_at': {
                'from': to_change_value_for_field('deleted_at', before),
                'to': to_change_value_for_field('deleted_at', instance.deleted_at),
            }
        }
        log_event(actor=self.request.user, action='delete', instance=instance, changes=changes, request=self.request)


    @action(detail=True, methods=['post'], permission_classes=[CanRestoreSite])
    def restore(self, request, pk=None):
        obj = self.get_object()
        before = getattr(obj, 'deleted_at', None)
        obj.deleted_at = None
        obj.updated_by = request.user
        obj.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
        changes = {
            'deleted_at': {
                'from': to_change_value_for_field('deleted_at', before),
                'to': None,
            }
        }
        log_event(actor=request.user, action='restore', instance=obj, changes=changes, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


    @action(detail=False, methods=['post'], permission_classes=[CanRestoreSite])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted Site objects.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Site.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            before = getattr(obj, 'deleted_at', None)
            obj.deleted_at = None
            obj.updated_by = request.user
            obj.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
            changes = {'deleted_at': {'from': to_change_value_for_field('deleted_at', before), 'to': None}}
            log_event(actor=request.user, action='restore', instance=obj, changes=changes, request=request)
            restored.append(obj.id)

        return Response({'restored': restored, 'count': len(restored)}, status=status.HTTP_200_OK)

# -------------------------
# Contacts
# -------------------------

class ContactSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    site_name = serializers.CharField(source="site.name", read_only=True)
    site_display_name = serializers.CharField(source="site.display_name", read_only=True)

    class Meta:
        model = Contact
        fields = [
            "id",
            "customer", "customer_code", "customer_name",
            "site", "site_name", "site_display_name",
            "name", "email", "phone", "department",
            "is_primary", "notes",
            "created_at", "updated_at", "deleted_at",
        ]



class ContactViewSet(viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["customer", "site", "is_primary"]
    search_fields = ["name", "email", "phone", "department", "notes"]
    ordering_fields = [
        "name",
        "email",
        "phone",
        # Aliases used by frontend (annotated in get_queryset)
        "customer_display_name",
        "site_display_name",
        "is_primary",
        "deleted_at",
        "updated_at",
        "created_at",
        # Backward-compatible ORM paths
        "customer__name",
        "customer__display_name",
        "site__name",
        "site__display_name",
    ]
    ordering = ["-is_primary", "name"]

    def get_queryset(self):
        qs = Contact.objects.select_related("customer", "site")

        qs = qs.annotate(
            customer_display_name=Coalesce(F("customer__display_name"), F("customer__name")),
            site_display_name=Coalesce(F("site__display_name"), F("site__name")),
        )

        truthy = {"1", "true", "yes", "on"}
        include_deleted = (self.request.query_params.get("include_deleted") or "").lower()
        only_deleted = (self.request.query_params.get("only_deleted") or "").lower()

        if getattr(self, "action", "") == "restore":
            include_deleted = "1"

        if only_deleted in truthy:
            qs = qs.filter(deleted_at__isnull=False)
        elif include_deleted in truthy:
            pass
        else:
            qs = qs.filter(deleted_at__isnull=True)

        return qs

    def perform_destroy(self, instance):
        before = getattr(instance, 'deleted_at', None)
        instance.deleted_at = timezone.now()
        instance.updated_by = self.request.user
        instance.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
        changes = {
            'deleted_at': {
                'from': to_change_value_for_field('deleted_at', before),
                'to': to_change_value_for_field('deleted_at', instance.deleted_at),
            }
        }
        log_event(actor=self.request.user, action='delete', instance=instance, changes=changes, request=self.request)


    @action(detail=True, methods=['post'], permission_classes=[CanRestoreContact])
    def restore(self, request, pk=None):
        obj = self.get_object()
        before = getattr(obj, 'deleted_at', None)
        obj.deleted_at = None
        obj.updated_by = request.user
        obj.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
        changes = {
            'deleted_at': {
                'from': to_change_value_for_field('deleted_at', before),
                'to': None,
            }
        }
        log_event(actor=request.user, action='restore', instance=obj, changes=changes, request=request)
        # se era primary, ri-enforce
        self._enforce_primary(obj)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], permission_classes=[CanRestoreContact])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted Contact objects.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Contact.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            before = getattr(obj, 'deleted_at', None)
            obj.deleted_at = None
            obj.updated_by = request.user
            obj.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
            changes = {'deleted_at': {'from': to_change_value_for_field('deleted_at', before), 'to': None}}
            log_event(actor=request.user, action='restore', instance=obj, changes=changes, request=request)
            self._enforce_primary(obj)
            restored.append(obj.id)

        return Response({'restored': restored, 'count': len(restored)}, status=status.HTTP_200_OK)

    def _enforce_primary(self, instance):
        if not instance.is_primary:
            return
        Contact.objects.filter(
            customer=instance.customer,
            site=instance.site,
            deleted_at__isnull=True,
            is_primary=True,
        ).exclude(id=instance.id).update(is_primary=False)

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        self._enforce_primary(instance)
        changes = {
            k: {'from': None, 'to': to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(actor=self.request.user, action='create', instance=instance, changes=changes, request=self.request)

    def perform_update(self, serializer):
        instance_before = serializer.instance
        changes = {}
        for k, v in (serializer.validated_data or {}).items():
            before_raw = getattr(instance_before, k, None)
            after_raw = v
            if to_primitive(before_raw) != to_primitive(after_raw):
                changes[k] = {
                    'from': to_change_value_for_field(k, before_raw),
                    'to': to_change_value_for_field(k, after_raw),
                }
        instance = serializer.save(updated_by=self.request.user)
        self._enforce_primary(instance)
        log_event(actor=self.request.user, action='update', instance=instance, changes=changes or None, request=self.request)
