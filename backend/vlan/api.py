from __future__ import annotations

import ipaddress

from django.contrib.auth.models import Group
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from auslbo.mixins import AuslBoScopedMixin
from auslbo.permissions import IsAuslBoUserOrInternal, IsAuslBoEditor, _can_edit_auslbo
from crm.models import Site
from device.models import Device, DeviceManufacturer, DeviceType, Rispacs
from inventory.models import Inventory
from vlan.models import Vlan, VlanIpRequest

VLAN_MANAGER_GROUP = "auslbo_editor"  # kept for reference, logic now in IsAuslBoEditor


# ─────────────────────────────────────────────────────────────────────────────
# Serializers
# ─────────────────────────────────────────────────────────────────────────────

class VlanSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source="site.name", read_only=True)
    site_display_name = serializers.CharField(source="site.display_name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    # Contatori calcolati inline (leggeri: solo conteggio IP occupati)
    total_hosts = serializers.SerializerMethodField()
    used_count = serializers.SerializerMethodField()
    free_count = serializers.SerializerMethodField()

    class Meta:
        model = Vlan
        fields = [
            "id",
            "customer",
            "customer_name",
            "site",
            "site_name",
            "site_display_name",
            "vlan_id",
            "name",
            "network",
            "subnet",
            "gateway",
            "lan",
            "note",
            "total_hosts",
            "used_count",
            "free_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def _get_used_ips(self, obj: Vlan) -> set[str]:
        """Raccoglie tutti gli IP occupati da inventory e device nella subnet."""
        net = obj.get_network_obj()
        if net is None:
            return set()

        used: set[str] = set()

        # inventory.local_ip
        inv_ips = (
            Inventory.objects.filter(
                customer=obj.customer,
                deleted_at__isnull=True,
                local_ip__isnull=False,
            )
            .exclude(local_ip="")
            .values_list("local_ip", flat=True)
        )
        for raw in inv_ips:
            try:
                if ipaddress.IPv4Address(raw) in net:
                    used.add(raw)
            except ValueError:
                pass

        # device.ip (campo vlan_ip nella semantica del progetto)
        dev_ips = (
            Device.objects.filter(
                customer=obj.customer,
                deleted_at__isnull=True,
                ip__isnull=False,
            )
            .values_list("ip", flat=True)
        )
        for raw in dev_ips:
            try:
                if raw and ipaddress.IPv4Address(raw) in net:
                    used.add(raw)
            except ValueError:
                pass

        return used

    def get_total_hosts(self, obj: Vlan) -> int:
        hosts = obj.iter_host_ips()
        return len(hosts)

    def get_used_count(self, obj: Vlan) -> int:
        hosts = set(obj.iter_host_ips())
        used = self._get_used_ips(obj)
        return len(hosts & used)

    def get_free_count(self, obj: Vlan) -> int:
        hosts = set(obj.iter_host_ips())
        used = self._get_used_ips(obj)
        return len(hosts - used)

    def validate(self, attrs):
        # Verifica che il sito appartenga al customer
        site: Site | None = attrs.get("site")
        customer = attrs.get("customer")
        if site and customer and site.customer_id != customer.pk:
            raise serializers.ValidationError(
                {"site": "Il sito selezionato non appartiene al customer."}
            )
        return attrs


# ─────────────────────────────────────────────────────────────────────────────
# IP Pool serializer (per l'action /ip_pool/)
# ─────────────────────────────────────────────────────────────────────────────

class IpPoolEntrySerializer(serializers.Serializer):
    ip = serializers.CharField()
    kind = serializers.ChoiceField(choices=["network", "broadcast", "gateway", "host"])
    status = serializers.ChoiceField(choices=["free", "used"])
    used_by = serializers.CharField(allow_null=True)       # nome del device/inventory
    used_by_type = serializers.ChoiceField(
        choices=["inventory", "device", None], allow_null=True
    )
    used_by_id = serializers.IntegerField(allow_null=True)


# ─────────────────────────────────────────────────────────────────────────────
# ViewSet
# ─────────────────────────────────────────────────────────────────────────────

class VlanViewSet(AuslBoScopedMixin, viewsets.ModelViewSet):
    serializer_class = VlanSerializer
    permission_classes = [IsAuslBoUserOrInternal, IsAuslBoEditor]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["customer", "site", "vlan_id"]
    search_fields = ["name", "network", "gateway", "lan"]
    ordering_fields = ["vlan_id", "name", "site"]
    ordering = ["site", "vlan_id"]

    def get_queryset(self):
        return (
            Vlan.objects.filter(deleted_at__isnull=True)
            .select_related("customer", "site")
            .order_by("site", "vlan_id")
        )

    @action(detail=True, methods=["get"], url_path="ip-pool")
    def ip_pool(self, request, pk=None):
        """Restituisce il pool completo degli IP della VLAN con stato occupazione."""
        vlan: Vlan = self.get_object()
        net = vlan.get_network_obj()
        if net is None:
            return Response(
                {"detail": "Network non valido, impossibile calcolare il pool."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        network_addr = str(net.network_address)
        broadcast_addr = str(net.broadcast_address)
        gateway_addr = vlan.gateway

        # Raccoglie IP occupati con dettaglio sorgente
        used_map: dict[str, dict] = {}  # ip -> {name, type, id}

        inv_qs = Inventory.objects.filter(
            customer=vlan.customer,
            deleted_at__isnull=True,
            local_ip__isnull=False,
        ).exclude(local_ip="").values("id", "name", "local_ip")

        for row in inv_qs:
            raw = row["local_ip"]
            try:
                if ipaddress.IPv4Address(raw) in net:
                    used_map[raw] = {
                        "name": row["name"],
                        "type": "inventory",
                        "id": row["id"],
                    }
            except ValueError:
                pass

        dev_qs = Device.objects.filter(
            customer=vlan.customer,
            deleted_at__isnull=True,
            ip__isnull=False,
        ).values("id", "model", "ip")

        for row in dev_qs:
            raw = row["ip"]
            if not raw:
                continue
            try:
                if ipaddress.IPv4Address(raw) in net and raw not in used_map:
                    used_map[raw] = {
                        "name": row["model"] or f"Device #{row['id']}",
                        "type": "device",
                        "id": row["id"],
                    }
            except ValueError:
                pass

        # Raccoglie IP riservati da richieste pendenti
        reserved_map: dict[str, int] = {}  # ip → request_id
        pending_qs = VlanIpRequest.objects.filter(
            vlan=vlan,
            stato=VlanIpRequest.Stato.PENDING,
        ).values("id", "ip")
        for row in pending_qs:
            reserved_map[row["ip"]] = row["id"]

        # Costruisce la lista ordinata di tutti gli IP della subnet
        entries = []
        for ip_obj in net:
            ip_str = str(ip_obj)
            if ip_str == network_addr:
                entries.append(
                    {"ip": ip_str, "kind": "network", "status": "used",
                     "used_by": None, "used_by_type": None, "used_by_id": None}
                )
            elif ip_str == broadcast_addr:
                entries.append(
                    {"ip": ip_str, "kind": "broadcast", "status": "used",
                     "used_by": None, "used_by_type": None, "used_by_id": None}
                )
            elif ip_str == gateway_addr:
                entries.append(
                    {"ip": ip_str, "kind": "gateway", "status": "used",
                     "used_by": "Gateway", "used_by_type": None, "used_by_id": None}
                )
            else:
                info = used_map.get(ip_str)
                req_id = reserved_map.get(ip_str)
                if info:
                    st = "used"
                elif req_id:
                    st = "reserved"
                else:
                    st = "free"
                entries.append(
                    {
                        "ip": ip_str,
                        "kind": "host",
                        "status": st,
                        "used_by": info["name"] if info else ("Richiesta in attesa" if req_id else None),
                        "used_by_type": info["type"] if info else ("request" if req_id else None),
                        "used_by_id": info["id"] if info else req_id,
                    }
                )

        return Response(entries)


# ─────────────────────────────────────────────────────────────────────────────
# VlanIpRequest — serializer + viewset
# ─────────────────────────────────────────────────────────────────────────────

class RispacsLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rispacs
        fields = ["id", "name", "ip", "aetitle"]


class VlanIpRequestSerializer(serializers.ModelSerializer):
    rispacs_detail = RispacsLiteSerializer(source="rispacs", many=True, read_only=True)
    rispacs        = serializers.PrimaryKeyRelatedField(
        queryset=Rispacs.objects.filter(deleted_at__isnull=True),
        many=True, required=False,
    )
    richiedente_username  = serializers.CharField(source="richiedente.username",  read_only=True)
    richiedente_full_name = serializers.SerializerMethodField()
    approvato_da_username = serializers.CharField(source="approvato_da.username", read_only=True)
    approvato_da_full_name = serializers.SerializerMethodField()

    def _full_name(self, user) -> str | None:
        if user is None:
            return None
        full = f"{user.first_name} {user.last_name}".strip()
        return full or None
    vlan_network  = serializers.CharField(source="vlan.network",  read_only=True)
    vlan_gateway  = serializers.CharField(source="vlan.gateway",  read_only=True)
    vlan_subnet   = serializers.CharField(source="vlan.subnet",   read_only=True)
    vlan_name     = serializers.CharField(source="vlan.name",     read_only=True)
    modalita_label = serializers.CharField(source="modalita", read_only=True)
    stato_label    = serializers.CharField(source="get_stato_display",    read_only=True)

    # Campi aggiuntivi per precompilare il device drawer
    site         = serializers.PrimaryKeyRelatedField(
        queryset=Site.objects.filter(deleted_at__isnull=True),
        required=False, allow_null=True,
    )
    device_type  = serializers.PrimaryKeyRelatedField(
        queryset=DeviceType.objects.filter(deleted_at__isnull=True),
        required=False, allow_null=True,
    )
    manufacturer = serializers.PrimaryKeyRelatedField(
        queryset=DeviceManufacturer.objects.filter(deleted_at__isnull=True),
        required=False, allow_null=True,
    )
    site_name         = serializers.CharField(source="site.name",         read_only=True)
    device_type_name  = serializers.CharField(source="device_type.name",  read_only=True)
    manufacturer_name = serializers.CharField(source="manufacturer.name", read_only=True)

    def get_richiedente_full_name(self, obj) -> str | None:
        return self._full_name(obj.richiedente)

    def get_approvato_da_full_name(self, obj) -> str | None:
        return self._full_name(obj.approvato_da)

    class Meta:
        model = VlanIpRequest
        fields = [
            "id", "customer", "vlan", "vlan_name", "vlan_network", "vlan_gateway", "vlan_subnet",
            "ip", "aetitle", "modalita", "modalita_label",
            "rispacs", "rispacs_detail", "rispacs_config",
            "site", "site_name",
            "reparto",
            "device_type", "device_type_name",
            "manufacturer", "manufacturer_name",
            "stato", "stato_label",
            "note",
            "richiedente", "richiedente_username", "richiedente_full_name",
            "approvato_da", "approvato_da_username", "approvato_da_full_name", "approvato_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "stato", "richiedente", "approvato_da", "approvato_at",
            "created_at", "updated_at",
        ]

    def validate(self, attrs):
        vlan: Vlan | None = attrs.get("vlan") or (self.instance.vlan if self.instance else None)
        ip = attrs.get("ip") or (self.instance.ip if self.instance else None)
        customer = attrs.get("customer") or (self.instance.customer if self.instance else None)

        if vlan and customer and vlan.customer_id != customer.pk:
            raise serializers.ValidationError({"vlan": "La VLAN non appartiene al customer."})

        if vlan and ip:
            net = vlan.get_network_obj()
            if net:
                try:
                    if ipaddress.IPv4Address(ip) not in net:
                        raise serializers.ValidationError(
                            {"ip": f"L'indirizzo {ip} non appartiene alla VLAN selezionata."}
                        )
                except ValueError:
                    raise serializers.ValidationError({"ip": "Indirizzo IP non valido."})

        return attrs


class IsAdminAuslBo(IsAuslBoEditor):
    """Solo admin_auslbo o superuser possono approvare/rifiutare richieste."""
    message = "Solo gli amministratori AUSL BO possono approvare le richieste."

    def has_permission(self, request, view) -> bool:
        from auslbo.permissions import AUSLBO_ADMIN_GROUPS, _user_groups
        if not request.user or not getattr(request.user, "is_authenticated", False):
            return False
        if getattr(request.user, "is_superuser", False):
            return True
        return bool(_user_groups(request.user) & AUSLBO_ADMIN_GROUPS)


class VlanIpRequestViewSet(AuslBoScopedMixin, viewsets.ModelViewSet):
    serializer_class   = VlanIpRequestSerializer
    permission_classes = [IsAuslBoUserOrInternal, IsAuslBoEditor]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["customer", "vlan", "stato", "modalita"]
    search_fields      = ["ip", "aetitle"]
    ordering_fields    = ["created_at", "stato", "ip"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        return (
            VlanIpRequest.objects.filter(deleted_at__isnull=True)
            .select_related(
                "customer", "vlan", "richiedente", "approvato_da",
                "site", "device_type", "manufacturer",
            )
            .prefetch_related("rispacs")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        serializer.save(
            richiedente=self.request.user,
            stato=VlanIpRequest.Stato.PENDING,
        )

    @action(detail=True, methods=["post"], url_path="approve",
            permission_classes=[IsAuslBoUserOrInternal, IsAdminAuslBo])
    def approve(self, request, pk=None):
        """Approva una richiesta pendente (solo admin_auslbo)."""
        from django.utils import timezone
        req: VlanIpRequest = self.get_object()
        if req.stato != VlanIpRequest.Stato.PENDING:
            return Response(
                {"detail": "Solo le richieste in attesa possono essere approvate."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        req.stato = VlanIpRequest.Stato.APPROVED
        req.approvato_da = request.user
        req.approvato_at = timezone.now()
        req.save(update_fields=["stato", "approvato_da", "approvato_at", "updated_at"])
        return Response(VlanIpRequestSerializer(req, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="reject",
            permission_classes=[IsAuslBoUserOrInternal, IsAdminAuslBo])
    def reject(self, request, pk=None):
        """Rifiuta una richiesta pendente (solo admin_auslbo)."""
        req: VlanIpRequest = self.get_object()
        if req.stato != VlanIpRequest.Stato.PENDING:
            return Response(
                {"detail": "Solo le richieste in attesa possono essere rifiutate."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        motivo = (request.data.get("motivo") or "").strip()
        if motivo:
            prefix = f"Motivo rifiuto: {motivo}"
            req.note = f"{prefix}\n{req.note}".strip() if req.note else prefix
        req.stato = VlanIpRequest.Stato.REJECTED
        req.approvato_da = request.user
        req.save(update_fields=["stato", "approvato_da", "note", "updated_at"])
        return Response(VlanIpRequestSerializer(req, context={"request": request}).data)


# Endpoint per i sistemi RIS/PACS del customer (filtrati tramite device)
class CustomerRispacsViewSet(viewsets.ReadOnlyModelViewSet):
    """Restituisce i sistemi RIS/PACS collegati ai device del customer autenticato."""
    serializer_class   = RispacsLiteSerializer
    permission_classes = [IsAuslBoUserOrInternal]
    filter_backends    = [SearchFilter]
    search_fields      = ["name", "ip", "aetitle"]

    def get_queryset(self):
        from auslbo.permissions import _get_auslbo_customer_id, _is_auslbo_user
        user = self.request.user
        if _is_auslbo_user(user):
            customer_id = _get_auslbo_customer_id(user)
        else:
            # utente interno: filtra per customer passato come query param
            customer_id = self.request.query_params.get("customer")
        if not customer_id:
            return Rispacs.objects.none()
        return Rispacs.objects.filter(
            deleted_at__isnull=True,
            device_links__device__customer_id=customer_id,
            device_links__device__deleted_at__isnull=True,
        ).distinct().order_by("name")

