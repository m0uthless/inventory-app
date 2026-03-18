from django.utils import timezone
from django.db import IntegrityError, transaction
from django.db.models import OuterRef, Subquery, F
from django.db.models import TextField
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce

import django_filters as filters

from rest_framework import serializers, viewsets, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response

from crm.models import Customer, Site, Contact
from audit.utils import log_event, to_change_value_for_field, to_primitive
from core.soft_delete import apply_soft_delete_filters
from core.integrity import raise_integrity_error_as_validation
from core.permissions import CanPurgeModelPermission, CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin
from core.purge_policy import try_purge_instance
from core.restore_policy import get_restore_block_reason, split_restorable

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

class CustomerSerializer(CustomFieldsValidationMixin, serializers.ModelSerializer):
    custom_fields_entity = "customer"
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


class CustomerViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
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
    purge_permission = "crm.delete_customer"

    def create(self, request, *args, **kwargs):
        """Convert DB integrity errors into 400 ValidationError."""
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(
                e,
                constraint_map={
                    "ux_customers_code_active": {"code": "Codice cliente già presente su un cliente attivo."},
                    "ux_customers_vat_active": {"vat_number": "Partita IVA già presente su un cliente attivo."},
                    "ux_customers_tax_active": {"tax_code": "Codice fiscale già presente su un cliente attivo."},
                },
            )

    def update(self, request, *args, **kwargs):
        """Convert DB integrity errors into 400 ValidationError."""
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(
                e,
                constraint_map={
                    "ux_customers_code_active": {"code": "Codice cliente già presente su un cliente attivo."},
                    "ux_customers_vat_active": {"vat_number": "Partita IVA già presente su un cliente attivo."},
                    "ux_customers_tax_active": {"tax_code": "Codice fiscale già presente su un cliente attivo."},
                },
            )

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

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))



    @action(detail=True, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        # Customer è root del modello dati (nessun parent), ma applichiamo
        # get_restore_block_reason per coerenza con tutti gli altri ViewSet e
        # per non dover aggiornare questa view se in futuro viene aggiunto un parent.
        reason = get_restore_block_reason(obj)
        if reason:
            return Response({'detail': reason}, status=status.HTTP_409_CONFLICT)
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


    @action(detail=False, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted Customer objects.
        Body: {"ids": [1,2,3]} (or a raw list).

        Usa split_restorable per coerenza con Site e Contact: anche se Customer
        è root (nessun parent bloccante oggi), la policy viene applicata in modo
        uniforme e sopravvive a future estensioni del modello.
        """
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        qs = list(Customer.objects.filter(id__in=ids, deleted_at__isnull=False))
        restorable, blocked = split_restorable(qs)
        restored_ids = [obj.id for obj in restorable]
        if restored_ids:
            now = timezone.now()
            Customer.objects.filter(id__in=restored_ids).update(
                deleted_at=None,
                updated_by=request.user,
                updated_at=now,
            )

        log_event(
            actor=request.user,
            action='restore',
            instance=None,
            changes={'ids': restored_ids},
            request=request,
            subject=f"bulk restore Customer: {restored_ids}",
        )

        return Response(
            {'restored': restored_ids, 'count': len(restored_ids), 'blocked': blocked, 'blocked_count': len(blocked)},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[CanPurgeModelPermission])
    def purge(self, request, pk=None):
        obj = Customer.objects.filter(pk=pk, deleted_at__isnull=False).first()
        if obj is None:
            return Response({'detail': 'Elemento non trovato nel cestino.'}, status=status.HTTP_404_NOT_FOUND)
        ok, reason, blockers = try_purge_instance(obj)
        if not ok:
            return Response({'detail': reason, 'blocked': blockers}, status=status.HTTP_409_CONFLICT)
        log_event(actor=request.user, action='delete', instance=None, request=request, metadata={'purge': True}, subject=f'purge Customer #{pk}')
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], permission_classes=[CanPurgeModelPermission])
    def bulk_purge(self, request):
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)
        purged = []
        blocked = []
        for obj in Customer.objects.filter(id__in=ids, deleted_at__isnull=False):
            obj_id = obj.id
            ok, reason, blockers = try_purge_instance(obj)
            if ok:
                purged.append(obj_id)
            else:
                blocked.append({'id': obj.id, 'reason': reason, 'blocked': blockers})
        log_event(actor=request.user, action='delete', instance=None, request=request, metadata={'purge': True, 'blocked_count': len(blocked)}, changes={'ids': purged}, subject=f'bulk purge Customer: {purged}')
        return Response({'purged': purged, 'count': len(purged), 'blocked': blocked, 'blocked_count': len(blocked)}, status=status.HTTP_200_OK)

# -------------------------
# Sites
# -------------------------

class SiteSerializer(CustomFieldsValidationMixin, serializers.ModelSerializer):
    custom_fields_entity = "site"
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    status_key = serializers.CharField(source="status.key", read_only=True)
    status_label = serializers.CharField(source="status.label", read_only=True)

    primary_contact_id    = serializers.IntegerField(read_only=True, allow_null=True)
    primary_contact_name  = serializers.CharField(read_only=True, allow_null=True)
    primary_contact_email = serializers.CharField(read_only=True, allow_null=True)
    primary_contact_phone = serializers.CharField(read_only=True, allow_null=True)

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
            "province",
            "country",
            "status",
            "status_key",
            "status_label",
            "primary_contact_id",
            "primary_contact_name",
            "primary_contact_email",
            "primary_contact_phone",
            "notes",
            "custom_fields",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class SiteViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
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
    purge_permission = "crm.delete_site"

    def get_queryset(self):
        qs = Site.objects.select_related("customer", "status")

        # Primary contact for this site (site FK matches, is_primary=True)
        primary_contact_qs = Contact.objects.filter(
            site_id=OuterRef("pk"),
            is_primary=True,
            deleted_at__isnull=True,
        ).order_by("-updated_at", "id")

        qs = qs.annotate(
            customer_display_name=Coalesce(F("customer__display_name"), F("customer__name")),
            status_label=F("status__label"),
            primary_contact_id=Subquery(primary_contact_qs.values("id")[:1]),
            primary_contact_name=Subquery(primary_contact_qs.values("name")[:1]),
            primary_contact_email=Subquery(primary_contact_qs.values("email")[:1]),
            primary_contact_phone=Subquery(primary_contact_qs.values("phone")[:1]),
        )

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))


    @action(detail=True, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        reason = get_restore_block_reason(obj)
        if reason:
            return Response({'detail': reason}, status=status.HTTP_409_CONFLICT)
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


    @action(detail=False, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted Site objects.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        qs = list(Site.objects.select_related('customer').filter(id__in=ids, deleted_at__isnull=False))
        restorable, blocked = split_restorable(qs)
        restored = []
        for obj in restorable:
            before = getattr(obj, 'deleted_at', None)
            obj.deleted_at = None
            obj.updated_by = request.user
            obj.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
            changes = {'deleted_at': {'from': to_change_value_for_field('deleted_at', before), 'to': None}}
            log_event(actor=request.user, action='restore', instance=obj, changes=changes, request=request)
            restored.append(obj.id)

        return Response({'restored': restored, 'count': len(restored), 'blocked': blocked, 'blocked_count': len(blocked)}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[CanPurgeModelPermission])
    def purge(self, request, pk=None):
        obj = Site.objects.filter(pk=pk, deleted_at__isnull=False).first()
        if obj is None:
            return Response({'detail': 'Elemento non trovato nel cestino.'}, status=status.HTTP_404_NOT_FOUND)
        ok, reason, blockers = try_purge_instance(obj)
        if not ok:
            return Response({'detail': reason, 'blocked': blockers}, status=status.HTTP_409_CONFLICT)
        log_event(actor=request.user, action='delete', instance=None, request=request, metadata={'purge': True}, subject=f'purge Site #{pk}')
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], permission_classes=[CanPurgeModelPermission])
    def bulk_purge(self, request):
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)
        purged = []
        blocked = []
        for obj in Site.objects.filter(id__in=ids, deleted_at__isnull=False):
            obj_id = obj.id
            ok, reason, blockers = try_purge_instance(obj)
            if ok:
                purged.append(obj_id)
            else:
                blocked.append({'id': obj.id, 'reason': reason, 'blocked': blockers})
        log_event(actor=request.user, action='delete', instance=None, request=request, metadata={'purge': True, 'blocked_count': len(blocked)}, changes={'ids': purged}, subject=f'bulk purge Site: {purged}')
        return Response({'purged': purged, 'count': len(purged), 'blocked': blocked, 'blocked_count': len(blocked)}, status=status.HTTP_200_OK)

# -------------------------
# Contacts
# -------------------------

class ContactSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    site_name = serializers.CharField(source="site.name", read_only=True)
    site_display_name = serializers.CharField(source="site.display_name", read_only=True)

    def validate(self, attrs):
        customer = attrs.get("customer") if "customer" in attrs else getattr(self.instance, "customer", None)
        site = attrs.get("site") if "site" in attrs else getattr(self.instance, "site", None)

        if site is not None and customer is not None and site.customer_id != customer.id:
            raise serializers.ValidationError({
                "site": ["Il sito selezionato non appartiene al cliente del contatto."]
            })

        return attrs

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



class ContactViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
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

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    @action(detail=True, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        reason = get_restore_block_reason(obj)
        if reason:
            return Response({'detail': reason}, status=status.HTTP_409_CONFLICT)
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

    @action(detail=False, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted Contact objects.
        Body: {"ids": [1,2,3]} (or a raw list).
        Uses QuerySet.update() to avoid N+1; runs _enforce_primary only on
        restored contacts that are is_primary=True (typically very few).
        """
        from django.utils import timezone as tz
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        qs = list(Contact.objects.select_related('customer', 'site').filter(id__in=ids, deleted_at__isnull=False))
        restorable, blocked = split_restorable(qs)
        restored_ids = [obj.id for obj in restorable]
        if restored_ids:
            now = tz.now()
            Contact.objects.filter(id__in=restored_ids).update(
                deleted_at=None, updated_by=request.user, updated_at=now
            )
            # _enforce_primary only on restored contacts that are primary (business logic invariant)
            for obj in Contact.objects.filter(id__in=restored_ids, is_primary=True):
                self._enforce_primary(obj)

        log_event(
            actor=request.user, action='restore', instance=None,
            changes={'ids': restored_ids}, request=request,
            subject=f'bulk restore Contact: {restored_ids}',
        )
        return Response({'restored': restored_ids, 'count': len(restored_ids), 'blocked': blocked, 'blocked_count': len(blocked)}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[CanPurgeModelPermission])
    def purge(self, request, pk=None):
        obj = Contact.objects.filter(pk=pk, deleted_at__isnull=False).first()
        if obj is None:
            return Response({'detail': 'Elemento non trovato nel cestino.'}, status=status.HTTP_404_NOT_FOUND)
        ok, reason, blockers = try_purge_instance(obj)
        if not ok:
            return Response({'detail': reason, 'blocked': blockers}, status=status.HTTP_409_CONFLICT)
        log_event(actor=request.user, action='delete', instance=None, request=request, metadata={'purge': True}, subject=f'purge Contact #{pk}')
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], permission_classes=[CanPurgeModelPermission])
    def bulk_purge(self, request):
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)
        purged = []
        blocked = []
        for obj in Contact.objects.filter(id__in=ids, deleted_at__isnull=False):
            obj_id = obj.id
            ok, reason, blockers = try_purge_instance(obj)
            if ok:
                purged.append(obj_id)
            else:
                blocked.append({'id': obj.id, 'reason': reason, 'blocked': blockers})
        log_event(actor=request.user, action='delete', instance=None, request=request, metadata={'purge': True, 'blocked_count': len(blocked)}, changes={'ids': purged}, subject=f'bulk purge Contact: {purged}')
        return Response({'purged': purged, 'count': len(purged), 'blocked': blocked, 'blocked_count': len(blocked)}, status=status.HTTP_200_OK)

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
        # Override per eseguire _enforce_primary dopo il salvataggio.
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        self._enforce_primary(instance)
        changes = {
            k: {'from': None, 'to': to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(actor=self.request.user, action='create', instance=instance, changes=changes, request=self.request)

    def perform_update(self, serializer):
        # Override per eseguire _enforce_primary dopo il salvataggio.
        instance_before = serializer.instance
        changes = self._changes_from_validated(instance_before, serializer.validated_data)
        instance = serializer.save(updated_by=self.request.user)
        self._enforce_primary(instance)
        log_event(actor=self.request.user, action='update', instance=instance, changes=changes or None, request=self.request)