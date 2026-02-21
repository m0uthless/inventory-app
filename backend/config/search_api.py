from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from crm.models import Customer, Site, Contact
from inventory.models import Inventory
from maintenance.models import MaintenancePlan
from wiki.models import WikiPage

# Sentinella per date non parsabili: finiscono in fondo al sort per recency
_EPOCH = datetime.min.replace(tzinfo=timezone.utc)


def _safe_str(v: Any) -> str:
    return "" if v is None else str(v)


def _parse_dt(s: str):
    """Converte una stringa ISO 8601 in datetime per ordinamento robusto.

    Fallback a epoch (datetime.min) se la stringa è vuota o non parsabile,
    così i record senza data finiscono in fondo invece di rompere il sort.
    """
    if not s:
        return _EPOCH
    try:
        # Python 3.7+: fromisoformat non gestisce la 'Z' finale, la sostituiamo
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return _EPOCH


class SearchAPIView(APIView):
    """Simple global search.

    GET /api/search/?q=...&limit=50

    Returns a flat list of results with a 'kind' and a suggested UI path.
    """

    def get(self, request: Request):
        q = (request.query_params.get("q") or "").strip()
        try:
            limit = int(request.query_params.get("limit") or 50)
        except ValueError:
            limit = 50
        limit = max(1, min(limit, 200))

        if not q:
            return Response({"q": q, "results": []})

        results: List[Dict[str, Any]] = []

        def add(kind: str, id_: int, title: str, subtitle: str, updated_at: Any, path: str, meta: Dict[str, Any] | None = None):
            results.append(
                {
                    "kind": kind,
                    "id": id_,
                    "title": title,
                    "subtitle": subtitle,
                    "updated_at": updated_at,
                    "path": path,
                    "meta": meta or {},
                }
            )

        # Customers
        for c in (
            Customer.objects.select_related("status")
            .filter(deleted_at__isnull=True)
            .filter(
                Q(code__icontains=q)
                | Q(name__icontains=q)
                | Q(display_name__icontains=q)
                | Q(vat_number__icontains=q)
                | Q(tax_code__icontains=q)
            )
            .order_by("name")[: max(1, limit // 5)]
        ):
            subtitle = " / ".join([s for s in [_safe_str(c.vat_number), _safe_str(c.tax_code)] if s])
            add("customer", c.id, f"{c.code} — {c.display_name}", subtitle or "Customer", c.updated_at, "/customers", {"code": c.code})

        # Sites
        for s in (
            Site.objects.select_related("customer", "status")
            .filter(deleted_at__isnull=True)
            .filter(
                Q(name__icontains=q)
                | Q(display_name__icontains=q)
                | Q(city__icontains=q)
                | Q(address_line1__icontains=q)
                | Q(postal_code__icontains=q)
                | Q(customer__code__icontains=q)
                | Q(customer__name__icontains=q)
            )
            .order_by("name")[: max(1, limit // 5)]
        ):
            subtitle = f"{s.customer.code} — {s.customer.name}"
            if s.city:
                subtitle += f" • {s.city}"
            add("site", s.id, s.display_name or s.name, subtitle, s.updated_at, "/sites")

        # Contacts
        for ct in (
            Contact.objects.select_related("customer")
            .filter(deleted_at__isnull=True)
            .filter(
                Q(name__icontains=q)
                | Q(email__icontains=q)
                | Q(phone__icontains=q)
                | Q(department__icontains=q)
                | Q(notes__icontains=q)
                | Q(customer__code__icontains=q)
                | Q(customer__name__icontains=q)
            )
            .order_by("-is_primary", "name")[: max(1, limit // 5)]
        ):
            subtitle = f"{ct.customer.code} — {ct.customer.name}"
            extra = " / ".join([s for s in [_safe_str(ct.email), _safe_str(ct.phone)] if s])
            if extra:
                subtitle += f" • {extra}"
            add("contact", ct.id, ct.name, subtitle, ct.updated_at, "/contacts")

        # Inventory
        for inv in (
            Inventory.objects.select_related("site", "site__customer", "status", "type")
            .filter(deleted_at__isnull=True)
            .filter(
                Q(knumber__icontains=q)
                | Q(serial_number__icontains=q)
                | Q(hostname__icontains=q)
                | Q(local_ip__icontains=q)
                | Q(srsa_ip__icontains=q)
                | Q(site__name__icontains=q)
                | Q(site__display_name__icontains=q)
                | Q(site__customer__code__icontains=q)
                | Q(site__customer__name__icontains=q)
            )
            .order_by("hostname")[: max(1, limit // 3)]
        ):
            title = inv.hostname or inv.knumber or inv.serial_number or f"Inventory #{inv.id}"
            # inv.site è nullable: guard esplicita per evitare AttributeError
            if inv.site_id and inv.site:
                cust = inv.site.customer
                subtitle = f"{cust.code} — {cust.name} • {inv.site.name}"
            else:
                subtitle = "Nessun sito"
            if inv.type_id:
                subtitle += f" • {inv.type.label}"
            if inv.status_id:
                subtitle += f" • {inv.status.label}"
            add("inventory", inv.id, title, subtitle, inv.updated_at, "/inventory")

        # Maintenance plans
        for p in (
            MaintenancePlan.objects.select_related("customer")
            .prefetch_related("inventory_types")
            .filter(deleted_at__isnull=True)
            .filter(
                Q(title__icontains=q)
                | Q(notes__icontains=q)
                | Q(customer__code__icontains=q)
                | Q(customer__name__icontains=q)
                | Q(inventory_types__label__icontains=q)
            )
            .distinct()
            .order_by("next_due_date")[: max(1, limit // 5)]
        ):
            cust = p.customer
            type_labels = ", ".join(p.inventory_types.values_list("label", flat=True))
            subtitle = f"{cust.code} — {cust.name}"
            if type_labels:
                subtitle += f" • {type_labels}"
            subtitle += f" • scad. {p.next_due_date}"
            add("maintenance_plan", p.id, p.title, subtitle, p.updated_at, "/maintenance")

        # Wiki
        for wp in (
            WikiPage.objects.select_related("category")
            .filter(deleted_at__isnull=True, is_published=True)
            .filter(
                Q(title__icontains=q)
                | Q(slug__icontains=q)
                | Q(summary__icontains=q)
                | Q(content_markdown__icontains=q)
            )
            .order_by("title")[: max(1, limit // 5)]
        ):
            cat = wp.category.name if wp.category_id else "Wiki"
            subtitle = f"{cat} • {wp.slug}"
            add("wiki_page", wp.id, wp.title, subtitle, wp.updated_at, "/wiki")

        # Sort per recency robusta: parsare la stringa ISO invece di confrontarla
        # come stringa (fragile con timezone naive o formati misti).
        results.sort(key=lambda r: _parse_dt(_safe_str(r.get("updated_at"))), reverse=True)
        return Response({"q": q, "results": results[:limit]})
