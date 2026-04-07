from django.utils import timezone
from django.db import IntegrityError, transaction
from django.db.models import OuterRef, Subquery, F, Exists
from django.db.models import TextField
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce

import django_filters as filters

from rest_framework import serializers, viewsets, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response

from crm.models import Customer, Site, Contact, CustomerVpnAccess
from core.crypto import decrypt
from audit.utils import log_event, to_change_value_for_field, to_primitive
from core.soft_delete import apply_soft_delete_filters
from core.integrity import raise_integrity_error_as_validation
from core.permissions import CanPurgeModelPermission, CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin, RestoreActionMixin, PurgeActionMixin
from core.restore_policy import split_restorable  # usato in ContactViewSet.bulk_restore()
from auslbo.mixins import AuslBoScopedMixin

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
        # Usa KeyTextTransform sulle stesse chiavi annotate nel queryset
        # per evitare falsi positivi (Cast serializza l'intera colonna JSON)
        # e per permettere l'uso di indici GIN sul JSONField.
        from django.db.models import Q
        from django.db.models.fields.json import KeyTextTransform
        return queryset.filter(
            Q(city__icontains=v)  # usa l'annotazione già presente nel queryset
        )

class CustomerSerializer(CustomFieldsValidationMixin, serializers.ModelSerializer):
    custom_fields_entity = "customer"
    status_key = serializers.CharField(source="status.key", read_only=True)
    status_label = serializers.CharField(source="status.label", read_only=True)

    # Convenience/computed fields for list UI.
    # `city` legge dall'annotazione Coalesce del queryset (unica fonte di verità).
    # Su retrieve (queryset non annotato) usa _city_from_custom_fields() come fallback
    # per non esporre None quando il dato è presente nei custom_fields.
    city = serializers.SerializerMethodField()
    primary_contact_id = serializers.IntegerField(read_only=True)
    primary_contact_name = serializers.CharField(read_only=True)
    primary_contact_email = serializers.CharField(read_only=True)
    primary_contact_phone = serializers.CharField(read_only=True)
    has_vpn = serializers.BooleanField(read_only=True, default=False)

    # Chiavi riconosciute per "città" nei custom_fields (allineate con la Coalesce nel queryset).
    _CITY_KEYS = frozenset({"city", "citta", "città", "Città", "Citta"})

    def get_city(self, obj) -> str | None:
        """Restituisce la città dall'annotazione del queryset, con fallback sui custom_fields.

        La Coalesce nel queryset (`get_queryset`) è la fonte di verità unica per list,
        ordering e filtering. Questo metodo la legge direttamente quando disponibile,
        evitando qualsiasi logica duplicata.
        """
        # Percorso veloce: annotazione già presente (list, queryset annotato)
        annotated = getattr(obj, "city", None)
        if annotated is not None:
            return str(annotated).strip() or None

        # Fallback per retrieve / queryset non annotato: legge dai custom_fields
        # con le stesse chiavi usate dalla Coalesce, senza normalizzazione complessa
        # (non necessaria: le chiavi sono già in una lista esplicita).
        cf = getattr(obj, "custom_fields", None)
        if not isinstance(cf, dict):
            return None
        for key in self._CITY_KEYS:
            val = cf.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
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
            "has_vpn",
            "tags",
            "custom_fields",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class CustomerViewSet(AuslBoScopedMixin, PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
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
            has_vpn=Exists(
                CustomerVpnAccess.objects.filter(customer_id=OuterRef("pk"))
            ),
        )

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))




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


class SiteViewSet(AuslBoScopedMixin, PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
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



class ContactViewSet(AuslBoScopedMixin, PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
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
        # Override: dopo il restore standard ri-applica la policy is_primary.
        obj = self.get_object()
        from core.restore_policy import get_restore_block_reason
        reason = get_restore_block_reason(obj)
        if reason:
            return Response({'detail': reason}, status=status.HTTP_409_CONFLICT)
        self._restore_obj(obj, request)
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

# -------------------------
# Customer VPN Access
# -------------------------

class VpnSecretsPermissionMixin:
    """Nasconde la password se l'utente non ha il permesso view_vpn_secrets."""

    def _can_view_vpn_secrets(self) -> bool:
        request = self.context.get("request") if hasattr(self, "context") else None
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return bool(
            getattr(user, "is_superuser", False)
            or user.has_perm("crm.view_vpn_secrets")
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self._can_view_vpn_secrets():
            self.fields.pop("password", None)


class CustomerVpnAccessSerializer(VpnSecretsPermissionMixin, serializers.ModelSerializer):
    customer = serializers.IntegerField(source="customer_id", read_only=True)
    # Restituisce la password decifrata (solo se l'utente ha il permesso)
    password = serializers.SerializerMethodField()
    # Campo write-only per ricevere la password in chiaro dal client
    password_input = serializers.CharField(
        write_only=True, required=False, allow_blank=True, allow_null=True
    )

    def get_password(self, obj):
        if not self._can_view_vpn_secrets():
            return None
        try:
            return decrypt(obj.password) if obj.password else None
        except Exception:
            return None

    def validate(self, attrs):
        # Sposta password_input -> password (il model.save() la cifra)
        pwd = attrs.pop("password_input", None)
        if pwd is not None:
            attrs["password"] = pwd
        return attrs

    class Meta:
        model = CustomerVpnAccess
        fields = [
            "id",
            "customer",
            "applicativo",
            "utenza",
            "password",
            "password_input",
            "remote_address",
            "porta",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "customer", "created_at", "updated_at"]


class CustomerVpnAccessViewSet(viewsets.ViewSet):
    """
    GET    /api/customers/{customer_pk}/vpn/  → restituisce l'accesso VPN (o 404)
    POST   /api/customers/{customer_pk}/vpn/  → crea l'accesso VPN
    PATCH  /api/customers/{customer_pk}/vpn/  → aggiorna l'accesso VPN
    DELETE /api/customers/{customer_pk}/vpn/  → elimina l'accesso VPN
    """

    # Necessario affinché IsAuthenticatedDjangoModelPermissions possa
    # ricavare il modello e controllare i permessi crm.{add,change,delete}_customervpnaccess.
    queryset = CustomerVpnAccess.objects.none()

    def _get_customer(self, customer_pk):
        return Customer.objects.filter(pk=customer_pk, deleted_at__isnull=True).first()

    def _serializer(self, instance=None, data=None, partial=False, request=None):
        ctx = {"request": request}
        if data is not None:
            return CustomerVpnAccessSerializer(instance, data=data, partial=partial, context=ctx)
        return CustomerVpnAccessSerializer(instance, context=ctx)

    def retrieve(self, request, customer_pk=None):
        customer = self._get_customer(customer_pk)
        if not customer:
            return Response({"detail": "Cliente non trovato."}, status=status.HTTP_404_NOT_FOUND)
        try:
            vpn = customer.vpn_access
        except CustomerVpnAccess.DoesNotExist:
            return Response({"detail": "Nessun accesso VPN configurato."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self._serializer(vpn, request=request)
        return Response(serializer.data)

    def create(self, request, customer_pk=None):
        customer = self._get_customer(customer_pk)
        if not customer:
            return Response({"detail": "Cliente non trovato."}, status=status.HTTP_404_NOT_FOUND)
        if CustomerVpnAccess.objects.filter(customer=customer).exists():
            return Response(
                {"detail": "Accesso VPN già configurato. Usa PATCH per modificarlo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self._serializer(data=request.data, request=request)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        instance = serializer.save(customer=customer, created_by=request.user, updated_by=request.user)
        log_event(
            actor=request.user, action="create", instance=instance,
            changes={k: {"from": None, "to": v} for k, v in (serializer.validated_data or {}).items()},
            request=request,
        )
        return Response(self._serializer(instance, request=request).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, customer_pk=None):
        customer = self._get_customer(customer_pk)
        if not customer:
            return Response({"detail": "Cliente non trovato."}, status=status.HTTP_404_NOT_FOUND)
        try:
            instance = customer.vpn_access
        except CustomerVpnAccess.DoesNotExist:
            return Response({"detail": "Nessun accesso VPN configurato."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self._serializer(instance, data=request.data, partial=True, request=request)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        before = {f: getattr(instance, f) for f in serializer.validated_data}
        instance = serializer.save(updated_by=request.user)
        log_event(actor=request.user, action="update", instance=instance, request=request)
        return Response(self._serializer(instance, request=request).data)

    def destroy(self, request, customer_pk=None):
        customer = self._get_customer(customer_pk)
        if not customer:
            return Response({"detail": "Cliente non trovato."}, status=status.HTTP_404_NOT_FOUND)
        try:
            instance = customer.vpn_access
        except CustomerVpnAccess.DoesNotExist:
            return Response({"detail": "Nessun accesso VPN configurato."}, status=status.HTTP_404_NOT_FOUND)
        log_event(actor=request.user, action="delete", instance=instance, request=request)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
