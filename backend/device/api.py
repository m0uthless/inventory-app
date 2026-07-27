from django.db import IntegrityError, transaction
from django.db.models import F

import ipaddress

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, status, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework.decorators import action

from crm.models import Site
from device.models import Device, DeviceManufacturer, DeviceRispacs, DeviceStatus, DeviceType, DeviceWifi, Rispacs
from core.soft_delete import apply_soft_delete_filters
from core.crypto import decrypt
from core.integrity import raise_integrity_error_as_validation
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin, RestoreActionMixin, PurgeActionMixin
from core.media import build_action_url, protected_media_response
from core.uploads import validate_upload
from vlan.models import Vlan
from auslbo.mixins import AuslBoScopedMixin, AuslBoTenantWriteMixin
from auslbo.permissions import (
    IsAuslBoUserOrInternal, AuslBoModelPermissions, IsInternalOrReadOnly,
)


# ─────────────────────────────────────────────────────────────────────────────
# Lookup serializers + viewsets
# ─────────────────────────────────────────────────────────────────────────────


WIFI_CERT_MAX_BYTES = 5 * 1024 * 1024
WIFI_CERT_ALLOWED_EXTENSIONS = {"p12", "pfx"}
WIFI_CERT_ALLOWED_CONTENT_TYPES = {
    "application/x-pkcs12",
    "application/pkcs12",
    "application/octet-stream",
}



class DeviceManufacturerSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = DeviceManufacturer
        fields = ["id", "name", "logo", "logo_url"]
        extra_kwargs = {
            "logo": {"write_only": True, "required": False, "allow_null": True},
        }

    def get_logo_url(self, obj):
        request = self.context.get("request")
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None


class DeviceManufacturerViewSet(viewsets.ModelViewSet):
    queryset = DeviceManufacturer.objects.filter(deleted_at__isnull=True).order_by("name")
    serializer_class = DeviceManufacturerSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name"]
    ordering = ["name"]


class DeviceStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceStatus
        fields = ["id", "name"]


class DeviceStatusViewSet(viewsets.ModelViewSet):
    queryset = DeviceStatus.objects.filter(deleted_at__isnull=True).order_by("name")
    serializer_class = DeviceStatusSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name"]
    ordering = ["name"]


class DeviceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceType
        fields = ["id", "name", "dose_sr"]


class DeviceTypeViewSet(viewsets.ModelViewSet):
    queryset = DeviceType.objects.filter(deleted_at__isnull=True).order_by("name")
    serializer_class = DeviceTypeSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name"]
    ordering = ["name"]


# ─────────────────────────────────────────────────────────────────────────────
# Rispacs — registry globale
# ─────────────────────────────────────────────────────────────────────────────

class RispacsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rispacs
        fields = ["id", "name", "ip", "port", "aetitle", "created_at", "updated_at", "deleted_at"]
        extra_kwargs = {
            "name": {"required": True},
        }


class RispacsViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """Registro RIS/PACS globale (condiviso tra tutti i customer).

    Fix 2.3 (audit 2026-07): prima era un ModelViewSet completo aperto a
    qualunque utente portale autenticato, anche solo lettore, senza
    rispettare i permessi Django (add/change/delete_rispacs) né distinguere
    interni da portale. Ora:
    - la lettura richiede `device.view_rispacs` (chiunque, interno o
      portale, via AuslBoModelPermissions);
    - le scritture richiedono ANCHE l'accesso interno Archie
      (IsInternalOrReadOnly) oltre al permesso Django corrispondente.
    Gli utenti portale che devono solo consultare i sistemi collegati ai
    propri device continuano a usare l'endpoint già scoped
    `/api/customer-rispacs/` (CustomerRispacsViewSet, sotto).
    """

    serializer_class = RispacsSerializer
    permission_classes = [IsAuslBoUserOrInternal, IsInternalOrReadOnly, AuslBoModelPermissions]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "ip", "aetitle"]
    ordering_fields = ["name", "ip", "aetitle", "port", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        return apply_soft_delete_filters(
            Rispacs.objects.all(),
            request=self.request,
            action_name=getattr(self, "action", ""),
        )


# ─────────────────────────────────────────────────────────────────────────────
# DeviceRispacs — tabella associativa M2M
# ─────────────────────────────────────────────────────────────────────────────

class DeviceRispacsSerializer(serializers.ModelSerializer):
    # Campi di sola lettura per mostrare i dati del sistema RIS/PACS nel dettaglio device
    rispacs_name    = serializers.CharField(source="rispacs.name",    read_only=True)
    rispacs_ip      = serializers.CharField(source="rispacs.ip",      read_only=True)
    rispacs_port    = serializers.IntegerField(source="rispacs.port", read_only=True)
    rispacs_aetitle = serializers.CharField(source="rispacs.aetitle", read_only=True)

    class Meta:
        model = DeviceRispacs
        fields = ["id", "device", "rispacs", "rispacs_name", "rispacs_ip", "rispacs_port", "rispacs_aetitle"]
        extra_kwargs = {
            "device":  {"required": True},
            "rispacs": {"required": True},
        }


class DeviceRispacsViewSet(AuslBoTenantWriteMixin, AuslBoScopedMixin, viewsets.ModelViewSet):
    """Tabella associativa Device↔RIS/PACS.

    Fix collaterale (stessa famiglia di 2.2/2.3, audit 2026-07): non aveva
    né `AuslBoScopedMixin` né `permission_classes` espliciti, quindi un
    utente portale con un permesso Django sufficiente poteva leggere/creare
    collegamenti per device di QUALSIASI customer, non solo il proprio.
    """

    serializer_class = DeviceRispacsSerializer
    permission_classes = [IsAuslBoUserOrInternal, AuslBoModelPermissions]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["device", "rispacs"]
    ordering = ["rispacs__name"]

    # Il modello non ha un customer proprio: deriva dal device collegato.
    tenant_owned_field = None
    tenant_related_fields = ("device",)

    def get_queryset(self):
        return DeviceRispacs.objects.select_related("rispacs", "device").all()


# ─────────────────────────────────────────────────────────────────────────────
# WiFi
# ─────────────────────────────────────────────────────────────────────────────

class DecryptedPasswordField(serializers.CharField):
    def to_representation(self, value):
        try:
            return decrypt(value)
        except Exception:
            return None


def _can_view_wifi_secrets(request) -> bool:
    """True se l'utente della request può leggere/scrivere pass_certificato
    e scaricare il certificato WiFi (fix 2.4). Richiede il permesso Django
    extra `device.view_wifi_secrets`, non basta essere editor WiFi generico."""
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return bool(getattr(user, "is_superuser", False) or user.has_perm("device.view_wifi_secrets"))


class WifiSecretPermissionMixin:
    """Nasconde `pass_certificato` in lettura a chi non ha `device.view_wifi_secrets`,
    e blocca la scrittura dello stesso campo senza quel permesso (fix 2.4,
    audit 2026-07 — stesso pattern di SecretsPermissionMixin in inventory/api.py).

    NB: il controllo di lettura avviene in `to_representation()`, non in
    `__init__()` come in SecretsPermissionMixin. `DeviceWifiSerializer` viene
    usato anche NESTED (`DeviceDetailSerializer.wifi_detail`): quell'istanza
    è creata una sola volta all'import del modulo, con `context` vuoto — un
    controllo in `__init__` vedrebbe sempre "nessun permesso" per il nested
    field, indipendentemente da chi fa la richiesta. `to_representation` è
    invece chiamato ad ogni serializzazione, quando il field è già bindato
    al serializer radice e `self.context` riflette la request reale.
    """

    _secret_fields = ("pass_certificato",)
    _secret_permission = "device.view_wifi_secrets"

    def _can_view_secrets(self) -> bool:
        request = self.context.get("request") if hasattr(self, "context") else None
        return _can_view_wifi_secrets(request)

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        if not self._can_view_secrets():
            for field_name in self._secret_fields:
                rep.pop(field_name, None)
        return rep

    def _secret_fields_present_in_input(self):
        incoming = getattr(self, "initial_data", None)
        if not incoming or not hasattr(incoming, "keys"):
            return []
        return [f for f in self._secret_fields if f in incoming]

    def enforce_secret_write_permission(self) -> None:
        attempted = self._secret_fields_present_in_input()
        if attempted and not self._can_view_secrets():
            raise serializers.ValidationError({
                f: "Non hai i permessi per modificare questo campo (serve device.view_wifi_secrets)."
                for f in attempted
            })


class DeviceWifiSerializer(WifiSecretPermissionMixin, serializers.ModelSerializer):
    pass_certificato = DecryptedPasswordField(required=False, allow_null=True, allow_blank=True)
    certificato_url  = serializers.SerializerMethodField()

    class Meta:
        model = DeviceWifi
        fields = [
            "id", "device", "ip", "mac_address",
            "certificato", "certificato_url",
            "pass_certificato", "scad_certificato",
        ]
        extra_kwargs = {
            "device":      {"required": True},
            "certificato": {"write_only": True, "required": False, "allow_null": True},
        }

    def validate_certificato(self, value):
        return validate_upload(
            value,
            label="certificato",
            max_bytes=WIFI_CERT_MAX_BYTES,
            allowed_extensions=WIFI_CERT_ALLOWED_EXTENSIONS,
            allowed_content_types=WIFI_CERT_ALLOWED_CONTENT_TYPES,
            strict_real_mime=False,
        )

    def get_certificato_url(self, obj):
        if not obj.certificato:
            return None
        request = self.context.get("request")
        return build_action_url(request=request, relative_path=f"/api/device-wifi/{obj.pk}/certificato/")

    def validate(self, attrs):
        self.enforce_secret_write_permission()
        return super().validate(attrs)


class DeviceWifiViewSet(AuslBoTenantWriteMixin, AuslBoScopedMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """Fix 2.4 (audit 2026-07): prima non aveva alcuno scope tenant (mancava
    AuslBoScopedMixin) — un utente portale poteva leggere/scaricare il
    certificato WiFi di device di QUALSIASI customer, non solo il proprio.
    Vedi anche WifiSecretPermissionMixin sopra per l'esposizione in chiaro
    della password."""

    serializer_class = DeviceWifiSerializer
    # Fix 2.5: sostituisce IsAuslBoEditor con la matrice reale
    # view/add/change/delete_devicewifi.
    permission_classes = [IsAuslBoUserOrInternal, AuslBoModelPermissions]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["device"]
    ordering = ["id"]

    # Il modello non ha un customer proprio: deriva dal device collegato.
    tenant_owned_field = None
    tenant_related_fields = ("device",)

    def get_queryset(self):
        return DeviceWifi.objects.select_related("device").filter(deleted_at__isnull=True)


    @action(detail=True, methods=["get"], url_path="certificato")
    def certificato(self, request, pk=None):
        # self.get_object() passa da filter_queryset() -> AuslBoScopedMixin:
        # un utente portale non può più scaricare il certificato di un
        # device di un altro customer (prima restituiva 200 per qualunque id).
        wifi = self.get_object()
        if not _can_view_wifi_secrets(request):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Non hai i permessi per scaricare il certificato (serve device.view_wifi_secrets).")
        filename = wifi.certificato.name.rsplit('/', 1)[-1] if wifi.certificato else None
        return protected_media_response(
            file_field=wifi.certificato,
            disposition="attachment",
            filename=filename,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Device — serializers
# ─────────────────────────────────────────────────────────────────────────────

class DeviceListSerializer(serializers.ModelSerializer):
    customer      = serializers.IntegerField(source="customer_id", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_code = serializers.CharField(source="customer.code", read_only=True)

    site              = serializers.IntegerField(source="site_id", read_only=True)
    site_name         = serializers.CharField(source="site.name", read_only=True)
    site_display_name = serializers.CharField(source="site.display_name", read_only=True)

    type_name         = serializers.CharField(source="type.name",         read_only=True)
    status_name       = serializers.CharField(source="status.name",       read_only=True)
    manufacturer_name = serializers.CharField(source="manufacturer.name", read_only=True)

    class Meta:
        model = Device
        fields = [
            "id",
            "customer", "customer_name", "customer_code",
            "site", "site_name", "site_display_name",
            "type", "type_name",
            "status", "status_name",
            "manufacturer", "manufacturer_name",
            "model", "aetitle", "serial_number", "inventario", "reparto", "room", "ip",
            "vlan", "wifi", "rispacs", "dose",
            "updated_at", "deleted_at",
        ]


class DeviceDetailSerializer(CustomFieldsValidationMixin, serializers.ModelSerializer):
    custom_fields_entity = "device"

    customer_name     = serializers.CharField(source="customer.name",         read_only=True)
    customer_code     = serializers.CharField(source="customer.code",         read_only=True)
    site_name         = serializers.CharField(source="site.name",             read_only=True)
    site_display_name = serializers.CharField(source="site.display_name",     read_only=True)
    type_name         = serializers.CharField(source="type.name",             read_only=True)
    status_name       = serializers.CharField(source="status.name",           read_only=True)
    manufacturer_name     = serializers.CharField(source="manufacturer.name",     read_only=True)
    manufacturer_logo_url = serializers.SerializerMethodField()
    type_dose_sr          = serializers.BooleanField(source="type.dose_sr",           read_only=True)

    # Nested read-only
    rispacs_links = DeviceRispacsSerializer(many=True, read_only=True)
    wifi_detail   = DeviceWifiSerializer(read_only=True)

    def get_manufacturer_logo_url(self, obj):
        request = self.context.get("request")
        if obj.manufacturer and obj.manufacturer.logo and request:
            return request.build_absolute_uri(obj.manufacturer.logo.url)
        return None

    class Meta:
        model = Device
        fields = [
            "id",
            "customer", "customer_name", "customer_code",
            "site", "site_name", "site_display_name",
            "type", "type_name", "type_dose_sr",
            "status", "status_name",
            "manufacturer", "manufacturer_name", "manufacturer_logo_url",
            "model", "aetitle", "serial_number", "inventario", "reparto", "room", "ip",
            "vlan", "wifi", "rispacs", "dose",
            "note", "location",
            "custom_fields",
            "rispacs_links",
            "wifi_detail",
            "created_at", "updated_at", "deleted_at",
        ]
        extra_kwargs = {
            "customer": {"required": True, "allow_null": False},
            "site":     {"required": True, "allow_null": False},
            "type":     {"required": True, "allow_null": False},
            "status":   {"required": True, "allow_null": False},
        }

    def validate(self, attrs):
        customer = attrs.get("customer") if "customer" in attrs else getattr(self.instance, "customer", None)
        site     = attrs.get("site")     if "site"     in attrs else getattr(self.instance, "site",     None)

        if customer is None:
            raise serializers.ValidationError({"customer": "Campo obbligatorio."})
        if site is None:
            raise serializers.ValidationError({"site": "Campo obbligatorio."})

        if site is not None and customer is not None:
            if isinstance(site, Site) and site.customer_id != customer.id:
                raise serializers.ValidationError({"site": "Il sito non appartiene al customer selezionato."})

        instance_pk = getattr(self.instance, "pk", None)

        ip = attrs.get("ip") if "ip" in attrs else None
        if ip:
            qs = Device.objects.filter(deleted_at__isnull=True, ip=ip)
            if instance_pk:
                qs = qs.exclude(pk=instance_pk)
            if qs.exists():
                raise serializers.ValidationError({"ip": "Indirizzo IP già presente su un device attivo."})

        serial_number = attrs.get("serial_number") if "serial_number" in attrs else None
        if serial_number:
            qs = Device.objects.filter(deleted_at__isnull=True, serial_number=serial_number)
            if instance_pk:
                qs = qs.exclude(pk=instance_pk)
            if qs.exists():
                raise serializers.ValidationError({"serial_number": "Serial number già presente su un device attivo."})

        # ── Validazione IP VLAN ───────────────────────────────────────────────
        # Solo se vlan=True (flag presente negli attrs o già sul device esistente).
        vlan_flag = attrs.get("vlan") if "vlan" in attrs else getattr(self.instance, "vlan", False)
        if vlan_flag and ip and customer:
            try:
                ip_addr = ipaddress.IPv4Address(ip)
            except ValueError:
                ip_addr = None

            if ip_addr is not None:
                # Recupera tutte le VLAN del customer con network valido
                vlans = Vlan.objects.filter(
                    customer=customer,
                    deleted_at__isnull=True,
                ).values("id", "network", "gateway")

                matching_vlan = None
                for v in vlans:
                    try:
                        net = ipaddress.IPv4Network(v["network"], strict=False)
                        if ip_addr in net:
                            matching_vlan = v
                            break
                    except ValueError:
                        continue

                if matching_vlan is None:
                    raise serializers.ValidationError({
                        "ip": (
                            "L'indirizzo IP non appartiene ad alcuna VLAN configurata per questo customer. "
                            "Configura prima la VLAN corrispondente o disattiva il flag VLAN."
                        )
                    })

                # Controlla che non sia network, broadcast o gateway
                try:
                    net = ipaddress.IPv4Network(matching_vlan["network"], strict=False)
                    if ip_addr == net.network_address or ip_addr == net.broadcast_address:
                        raise serializers.ValidationError({
                            "ip": "L'indirizzo IP coincide con l'indirizzo di rete o broadcast della VLAN."
                        })
                    if str(ip_addr) == matching_vlan["gateway"]:
                        raise serializers.ValidationError({
                            "ip": "L'indirizzo IP coincide con il gateway della VLAN."
                        })
                except ValueError:
                    pass

                # Controlla occupazione da inventory
                from inventory.models import Inventory as InventoryModel
                inv_conflict = InventoryModel.objects.filter(
                    deleted_at__isnull=True,
                    local_ip=ip,
                ).exclude(
                    # Nessun device da escludere qui, è un inventory
                ).first()
                if inv_conflict:
                    raise serializers.ValidationError({
                        "ip": f"L'indirizzo IP è già occupato dall'apparecchiatura «{inv_conflict.name}»."
                    })

                # Controlla occupazione da altri device
                dev_conflict = Device.objects.filter(
                    deleted_at__isnull=True,
                    ip=ip,
                )
                if instance_pk:
                    dev_conflict = dev_conflict.exclude(pk=instance_pk)
                dev_conflict = dev_conflict.first()
                if dev_conflict:
                    raise serializers.ValidationError({
                        "ip": f"L'indirizzo IP è già occupato dal device «{dev_conflict}»."
                    })

        attrs = super().validate(attrs)
        return attrs


# ─────────────────────────────────────────────────────────────────────────────
# Device — ViewSet
# ─────────────────────────────────────────────────────────────────────────────

class DeviceViewSet(
    AuslBoTenantWriteMixin,
    AuslBoScopedMixin,
    PurgeActionMixin,
    RestoreActionMixin,
    SoftDeleteAuditMixin,
    viewsets.ModelViewSet,
):
    serializer_class = DeviceDetailSerializer
    # Fix 2.5: sostituisce IsAuslBoEditor (solo device.change_device per
    # QUALSIASI scrittura) con la matrice reale view/add/change/delete_device.
    permission_classes = [IsAuslBoUserOrInternal, AuslBoModelPermissions]
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    # Fix 2.2: per utenti portale "puri" forza customer=proprio tenant e
    # verifica che il site scelto appartenga allo stesso tenant.
    tenant_related_fields = ("site",)

    filterset_fields = ["customer", "site", "status", "type", "manufacturer", "vlan", "wifi", "rispacs", "dose", "reparto"]

    search_fields = [
        "model", "aetitle", "serial_number", "inventario", "reparto", "room", "ip",
        "site__name", "site__display_name",
        "customer__code", "customer__name",
        "manufacturer__name",
    ]

    ordering_fields = [
        "model", "aetitle", "serial_number", "inventario", "reparto", "room", "ip",
        "updated_at", "created_at", "deleted_at",
        "customer_name", "site_name", "type_name", "status_name", "manufacturer_name",
        "customer__name", "site__name", "type__name", "status__name", "manufacturer__name",
    ]
    ordering = ["-updated_at"]
    purge_permission = "device.delete_device"

    def get_serializer_class(self):
        if getattr(self, "action", "") == "list":
            return DeviceListSerializer
        return DeviceDetailSerializer

    def get_queryset(self):
        qs = Device.objects.select_related(
            "customer", "site", "type", "status", "manufacturer"
        )
        if getattr(self, "action", "") == "retrieve":
            qs = qs.prefetch_related("rispacs_links__rispacs", "wifi_detail")

        qs = qs.annotate(
            customer_name=F("customer__name"),
            site_name=F("site__name"),
            type_name=F("type__name"),
            status_name=F("status__name"),
            manufacturer_name=F("manufacturer__name"),
        )

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def create(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(
                e,
                constraint_map={
                    "ux_devices_ip_active":     {"ip":            "Indirizzo IP già presente su un device attivo."},
                    "ux_devices_serial_active": {"serial_number": "Serial number già presente su un device attivo."},
                },
            )

    def update(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(
                e,
                constraint_map={
                    "ux_devices_ip_active":     {"ip":            "Indirizzo IP già presente su un device attivo."},
                    "ux_devices_serial_active": {"serial_number": "Serial number già presente su un device attivo."},
                },
            )
