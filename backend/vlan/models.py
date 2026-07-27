from __future__ import annotations

import ipaddress

from django.db import models
from django.core.exceptions import ValidationError

from core.models import TimeStampedModel
from crm.models import Customer, Site

# Prefisso CIDR minimo ammesso per una VLAN (fix 2.9, audit 2026-07): una rete
# più ampia di /24 (>254 host) materializzata via iter_host_ips()/hosts() può
# esaurire memoria/CPU del worker (una /8 produce oltre 16 milioni di IP).
# Valore deciso con Fede il 2026-07-25: /24, 254 host max.
MIN_VLAN_PREFIXLEN = 24


def _validate_network(value: str) -> None:
    """Valida che il valore sia un indirizzo di rete IPv4 valido (es. 10.241.0.64/26)
    e non più ampio del limite massimo consentito (fix 2.9)."""
    try:
        net = ipaddress.IPv4Network(value, strict=False)
        # Avvisiamo se l'host è diverso dall'indirizzo di rete
        if ipaddress.IPv4Address(value.split("/")[0]) != net.network_address:
            raise ValidationError(
                f"L'indirizzo di rete dovrebbe essere {net.network_address}/{net.prefixlen}."
            )
    except ValueError:
        raise ValidationError("Inserire un indirizzo di rete IPv4 valido (es. 10.241.0.64/26).")

    if net.prefixlen < MIN_VLAN_PREFIXLEN:
        raise ValidationError(
            f"La rete /{net.prefixlen} è troppo ampia: il massimo consentito è "
            f"/{MIN_VLAN_PREFIXLEN} ({2 ** (32 - MIN_VLAN_PREFIXLEN) - 2} host)."
        )


def _validate_subnet(value: str) -> None:
    """Valida che il valore sia una subnet mask IPv4 valida e *contigua*
    (es. 255.255.255.192), non un IPv4 generico (fix 2.10)."""
    try:
        # ipaddress solleva ValueError se la maschera non è contigua
        # (es. 255.0.255.0), quindi questo controllo copre già il caso.
        ipaddress.IPv4Network(f"0.0.0.0/{value}", strict=False)
    except ValueError:
        raise ValidationError(
            "Inserire una subnet mask IPv4 valida e contigua (es. 255.255.255.192)."
        )


def _validate_ip(value: str) -> None:
    try:
        ipaddress.IPv4Address(value)
    except ValueError:
        raise ValidationError("Inserire un indirizzo IPv4 valido.")


def validate_subnet_matches_network(network: str, subnet: str) -> str | None:
    """Verifica incrociata (fix 2.10): la subnet mask deve corrispondere
    esattamente al prefisso CIDR dichiarato in `network`.

    Ritorna un messaggio di errore, oppure None se tutto è coerente.
    """
    try:
        net = ipaddress.IPv4Network(network, strict=False)
        mask_net = ipaddress.IPv4Network(f"0.0.0.0/{subnet}", strict=False)
    except ValueError:
        return None  # i validator sui singoli campi segnalano già il problema
    if mask_net.prefixlen != net.prefixlen:
        return (
            f"La subnet mask {subnet} corrisponde a /{mask_net.prefixlen}, "
            f"ma la rete dichiarata è /{net.prefixlen}."
        )
    return None


def validate_gateway_in_network(network: str, gateway: str) -> str | None:
    """Verifica incrociata (fix 2.10): il gateway deve appartenere alla rete
    dichiarata e non può coincidere con network o broadcast address.

    Ritorna un messaggio di errore, oppure None se tutto è coerente.
    """
    try:
        net = ipaddress.IPv4Network(network, strict=False)
        gw = ipaddress.IPv4Address(gateway)
    except ValueError:
        return None  # i validator sui singoli campi segnalano già il problema
    if gw not in net:
        return f"Il gateway {gateway} non appartiene alla rete {network}."
    if gw == net.network_address:
        return f"Il gateway {gateway} coincide con l'indirizzo di rete."
    if gw == net.broadcast_address:
        return f"Il gateway {gateway} coincide con l'indirizzo di broadcast."
    return None


class Vlan(TimeStampedModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="vlans",
        verbose_name="Customer",
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="vlans",
        verbose_name="Sede",
    )
    vlan_id = models.PositiveIntegerField(verbose_name="VLAN ID")
    name = models.CharField(max_length=255, verbose_name="Nome / Descrizione")

    # Rete
    network = models.CharField(
        max_length=18,
        verbose_name="Network (CIDR)",
        help_text="Es. 10.241.0.64/26",
        validators=[_validate_network],
    )
    subnet = models.CharField(
        max_length=15,
        verbose_name="Subnet mask",
        help_text="Es. 255.255.255.192",
        validators=[_validate_subnet],
    )
    gateway = models.CharField(
        max_length=15,
        verbose_name="Gateway",
        help_text="Es. 10.241.0.65",
        validators=[_validate_ip],
    )
    lan = models.CharField(
        max_length=18,
        null=True,
        blank=True,
        verbose_name="LAN",
        help_text="Es. 172.26.99.0/24",
    )

    note = models.TextField(null=True, blank=True, verbose_name="Note")

    class Meta:
        verbose_name = "VLAN"
        verbose_name_plural = "VLAN"
        ordering = ["site", "vlan_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "vlan_id"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_vlan_customer_vlan_id_active",
            ),
        ]

    def __str__(self) -> str:
        return f"VLAN {self.vlan_id} — {self.name}"

    def clean(self) -> None:
        if self.site_id and self.customer_id:
            if self.site.customer_id != self.customer_id:
                raise ValidationError({"site": "Il sito selezionato non appartiene al customer."})

        if self.network and self.subnet:
            error = validate_subnet_matches_network(self.network, self.subnet)
            if error:
                raise ValidationError({"subnet": error})

        if self.network and self.gateway:
            error = validate_gateway_in_network(self.network, self.gateway)
            if error:
                raise ValidationError({"gateway": error})

    # ── Helpers di calcolo pool ───────────────────────────────────────────────

    def get_network_obj(self) -> ipaddress.IPv4Network | None:
        try:
            return ipaddress.IPv4Network(self.network, strict=False)
        except ValueError:
            return None

    def iter_host_ips(self) -> list[str]:
        """Restituisce tutti gli IP host della subnet (esclusi network e broadcast)."""
        net = self.get_network_obj()
        if net is None:
            return []
        return [str(ip) for ip in net.hosts()]


# ─────────────────────────────────────────────────────────────────────────────
# VlanIpRequest — richiesta di pre-allocazione IP
# ─────────────────────────────────────────────────────────────────────────────

from django.conf import settings


class VlanIpRequest(TimeStampedModel):
    """Richiesta di nuova modalità: pre-alloca un IP libero su una VLAN.

    Stato pending → IP mostrato come "Riservato" (giallo) nella heatmap.
    Stato approved/rejected → IP torna libero nella heatmap.
    """

    class Stato(models.TextChoices):
        PENDING  = "pending",  "In attesa"
        APPROVED = "approved", "Approvata"
        REJECTED = "rejected", "Rifiutata"

    class Modalita(models.TextChoices):
        PACS           = "pacs",           "PACS"
        PACS_EMERGENZA = "pacs_emergenza",  "PACS Emergenza"
        WORKLIST       = "worklist",        "Worklist"
        ALTRO          = "altro",           "Altro"

    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="vlan_ip_requests",
        verbose_name="Customer",
    )
    vlan = models.ForeignKey(
        Vlan,
        on_delete=models.PROTECT,
        related_name="ip_requests",
        verbose_name="VLAN",
    )
    ip = models.GenericIPAddressField(
        protocol="IPv4",
        verbose_name="Indirizzo IP riservato",
    )
    aetitle = models.CharField(
        max_length=128, null=True, blank=True, verbose_name="AE Title",
    )
    modalita = models.CharField(
        max_length=128, verbose_name="Modalità",
    )
    site = models.ForeignKey(
        "crm.Site",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="vlan_ip_requests",
        verbose_name="Sede",
    )
    reparto = models.CharField(
        max_length=128, null=True, blank=True, verbose_name="Reparto",
    )
    device_type = models.ForeignKey(
        "device.DeviceType",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="vlan_ip_requests",
        verbose_name="Tipo Device",
    )
    manufacturer = models.ForeignKey(
        "device.DeviceManufacturer",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="vlan_ip_requests",
        verbose_name="Produttore",
    )
    rispacs = models.ManyToManyField(
        "device.Rispacs",
        blank=True,
        related_name="ip_requests",
        verbose_name="Sistemi RIS/PACS",
    )
    rispacs_config = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Configurazione RIS/PACS",
        help_text='Lista di {rispacs_id, etichetta} per ogni sistema associato.',
    )
    stato = models.CharField(
        max_length=16, choices=Stato.choices, default=Stato.PENDING, verbose_name="Stato",
    )
    note = models.TextField(null=True, blank=True, verbose_name="Note")
    richiedente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="vlan_ip_requests_create",
        verbose_name="Richiedente",
    )
    approvato_da = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="vlan_ip_requests_approve",
        verbose_name="Approvato da",
    )
    approvato_at = models.DateTimeField(null=True, blank=True, verbose_name="Data approvazione")

    class Meta:
        verbose_name = "Richiesta IP VLAN"
        verbose_name_plural = "Richieste IP VLAN"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["vlan", "ip"],
                condition=models.Q(stato="pending"),
                name="ux_vlan_ip_request_pending",
            ),
        ]

    def __str__(self) -> str:
        return f"Richiesta {self.ip} su VLAN {self.vlan_id} [{self.stato}]"

    def clean(self) -> None:
        if self.vlan_id and self.ip:
            net = self.vlan.get_network_obj()
            if net is not None:
                try:
                    if ipaddress.IPv4Address(self.ip) not in net:
                        raise ValidationError(
                            {"ip": f"L'indirizzo {self.ip} non appartiene alla VLAN {self.vlan}."}
                        )
                except ValueError:
                    pass
        if self.vlan_id and self.customer_id:
            if self.vlan.customer_id != self.customer_id:
                raise ValidationError({"vlan": "La VLAN non appartiene al customer."})


# ─────────────────────────────────────────────────────────────────────────────
# VlanExcludedIp — IP esclusi manualmente dalla heatmap (mostrati in rosso)
# ─────────────────────────────────────────────────────────────────────────────

class VlanExcludedIp(TimeStampedModel):
    """IP escluso manualmente: compare in rosso nella heatmap senza essere
    associato ad alcun inventory o device."""

    vlan = models.ForeignKey(
        Vlan,
        on_delete=models.CASCADE,
        related_name="excluded_ips",
        verbose_name="VLAN",
    )
    ip = models.GenericIPAddressField(
        protocol="IPv4",
        verbose_name="Indirizzo IP",
    )
    note = models.TextField(null=True, blank=True, verbose_name="Note")
    excluded_by = models.ForeignKey(
        "auth.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        verbose_name="Escluso da",
    )

    class Meta:
        verbose_name = "IP escluso"
        verbose_name_plural = "IP esclusi"
        constraints = [
            models.UniqueConstraint(
                fields=["vlan", "ip"],
                name="ux_vlan_excluded_ip",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.ip} escluso da {self.vlan}"
