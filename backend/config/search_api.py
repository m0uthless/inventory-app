from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from crm.models import Contact, Customer, Site
from drive.models import DriveFile, DriveFolder
from inventory.models import Inventory
from maintenance.models import MaintenancePlan
from wiki.models import WikiPage

# Sentinella per date non parsabili: finiscono in fondo al sort per recency
_EPOCH = datetime.min.replace(tzinfo=timezone.utc)


def _safe_str(v: Any) -> str:
    return "" if v is None else str(v)


def _parse_dt(s: str) -> datetime:
    """Parse ISO8601 datetime for robust sorting.

    Fallback to epoch (datetime.min) if empty or not parseable so sorting
    never breaks.
    """

    if not s:
        return _EPOCH
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return _EPOCH


def _model_has_field(model, field_name: str) -> bool:
    try:
        model._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _or_icontains(model, q: str, fields: list[str]) -> Q:
    """Build an OR Q(icontains) across fields that actually exist on the model."""
    q_obj = Q()
    for f in fields:
        if _model_has_field(model, f):
            q_obj |= Q(**{f"{f}__icontains": q})
    return q_obj

class SearchAPIView(APIView):
    """Global search API.

    GET /api/search/?q=...&limit=50

    Returns a flat list of results with a 'kind' and a suggested UI path.
    NOTE: This view is not a ModelViewSet, therefore it must NOT use
    IsAuthenticatedDjangoModelPermissions.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        q = (request.query_params.get("q") or request.query_params.get("search") or "").strip()
        try:
            limit = int(request.query_params.get("limit") or 50)
        except ValueError:
            limit = 50
        limit = max(1, min(limit, 200))

        if not q:
            return Response({"q": q, "results": []})

        user = request.user
        results: List[Dict[str, Any]] = []

        def add(
            kind: str,
            id_: int,
            title: str,
            subtitle: str,
            updated_at: Any,
            path: str,
            meta: Optional[Dict[str, Any]] = None,
        ):
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

        per_small = max(1, limit // 5)
        per_mid = max(1, limit // 3)

        # ------------------------------------------------------------------
        # CRM
        # ------------------------------------------------------------------
        if user.has_perm("crm.view_customer"):
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
                .order_by("name")[:per_small]
            ):
                subtitle = " / ".join([s for s in [_safe_str(c.vat_number), _safe_str(c.tax_code)] if s])
                add(
                    "customer",
                    c.id,
                    f"{c.code} — {c.display_name}",
                    subtitle or "Customer",
                    c.updated_at,
                    "/customers",
                    {"code": c.code},
                )

        if user.has_perm("crm.view_site"):
            # IMPORTANT: Site does NOT have a 'code' field.
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
                .order_by("name")[:per_small]
            ):
                subtitle = ""
                if s.customer_id and s.customer:
                    subtitle = f"{s.customer.code} — {s.customer.name}"
                if s.city:
                    subtitle = (subtitle + " • " if subtitle else "") + s.city
                add("site", s.id, s.display_name or s.name, subtitle or "Site", s.updated_at, "/sites")

        if user.has_perm("crm.view_contact"):
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
                .order_by("-is_primary", "name")[:per_small]
            ):
                subtitle = ""
                if ct.customer_id and ct.customer:
                    subtitle = f"{ct.customer.code} — {ct.customer.name}"
                extra = " / ".join([s for s in [_safe_str(ct.email), _safe_str(ct.phone)] if s])
                if extra:
                    subtitle = (subtitle + " • " if subtitle else "") + extra
                add("contact", ct.id, ct.name, subtitle or "Contact", ct.updated_at, "/contacts")

        # ------------------------------------------------------------------
        # Inventory
        # ------------------------------------------------------------------
        if user.has_perm("inventory.view_inventory"):
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
                .order_by("hostname")[:per_mid]
            ):
                title = inv.hostname or inv.knumber or inv.serial_number or f"Inventory #{inv.id}"
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

        # ------------------------------------------------------------------
        # Maintenance
        # ------------------------------------------------------------------
        if user.has_perm("maintenance.view_maintenanceplan"):
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
                .order_by("next_due_date")[:per_small]
            ):
                cust = p.customer
                type_labels = ", ".join(p.inventory_types.values_list("label", flat=True))
                subtitle = f"{cust.code} — {cust.name}"
                if type_labels:
                    subtitle += f" • {type_labels}"
                if p.next_due_date:
                    subtitle += f" • scad. {p.next_due_date}"
                add("maintenance_plan", p.id, p.title, subtitle, p.updated_at, "/maintenance")

        # ------------------------------------------------------------------
        # Drive
        # ------------------------------------------------------------------
        if user.has_perm("drive.view_drivefolder"):
            for f in (
                DriveFolder.objects.select_related("parent")
                .filter(deleted_at__isnull=True)
                .filter(_or_icontains(DriveFolder, q, ['name', 'notes', 'description']))
                .order_by("name")[:per_small]
            ):
                subtitle = "Cartella"
                if f.parent_id and f.parent:
                    subtitle = f"In {f.parent.name}"
                add("drive_folder", f.id, f.name, subtitle, f.updated_at, "/drive")

        if user.has_perm("drive.view_drivefile"):
            for df in (
                DriveFile.objects.select_related("folder")
                .filter(deleted_at__isnull=True)
                .filter(_or_icontains(DriveFile, q, ['original_filename', 'notes', 'description']))
                .order_by("-created_at")[:per_small]
            ):
                subtitle = "File"
                if df.folder_id and df.folder:
                    subtitle = f"In {df.folder.name}"
                add("drive_file", df.id, df.original_filename, subtitle, df.updated_at, "/drive")

        # ------------------------------------------------------------------
        # Wiki (published only)
        # ------------------------------------------------------------------
        if user.has_perm("wiki.view_wikipage"):
            wiki_qs = WikiPage.objects.select_related("category").filter(deleted_at__isnull=True, is_published=True)
        else:
            wiki_qs = WikiPage.objects.none()

        for wp in (
            wiki_qs.filter(
                Q(title__icontains=q)
                | Q(slug__icontains=q)
                | Q(summary__icontains=q)
                | Q(content_markdown__icontains=q)
            )
            .order_by("title")[:per_small]
        ):
            cat = wp.category.name if wp.category_id else "Wiki"
            subtitle = f"{cat} • {wp.slug}"
            add("wiki_page", wp.id, wp.title, subtitle, wp.updated_at, "/wiki")

        results.sort(key=lambda r: _parse_dt(_safe_str(r.get("updated_at"))), reverse=True)
        return Response({"q": q, "results": results[:limit]})
