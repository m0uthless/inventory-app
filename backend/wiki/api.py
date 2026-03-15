# mypy: disable-error-code=annotation-unchecked
from __future__ import annotations

import io
import re
import logging
import mimetypes
from pathlib import PurePosixPath
from html import escape, unescape
from typing import ClassVar

from django.conf import settings
from django.db import models as django_models
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status as drf_status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin
from core.soft_delete import apply_soft_delete_filters
from audit.utils import log_event, to_change_value_for_field
from wiki.models import WikiCategory, WikiPage, WikiAttachment, WikiLink, WikiPageRevision, WikiPageRating


logger = logging.getLogger(__name__)


def _sanitize_html(html: str) -> str:
    """Sanitize HTML to prevent XSS.

    - Strips disallowed tags/attributes.
    - Adds rel/target to links.

    Requires `bleach` (added to requirements).
    """

    import bleach

    allowed_tags = [
        "a",
        "p",
        "br",
        "strong",
        "em",
        "ul",
        "ol",
        "li",
        "pre",
        "code",
        "blockquote",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "img",
    ]

    allowed_attrs = {
        "a": ["href", "title", "rel", "target"],
        "img": ["src", "alt", "title"],
        "code": ["class"],
        "pre": ["class"],
        "th": ["colspan", "rowspan"],
        "td": ["colspan", "rowspan"],
    }

    cleaned = bleach.clean(
        html or "",
        tags=allowed_tags,
        attributes=allowed_attrs,
        protocols=["http", "https", "mailto"],
        strip=True,
    )

    # Linkify plain URLs and make links safer
    cleaned = bleach.linkify(
        cleaned,
        callbacks=[bleach.callbacks.nofollow, bleach.callbacks.target_blank],
        skip_tags=["pre", "code"],
    )

    return cleaned


def _is_html(text: str) -> bool:
    """Heuristic: se inizia con un tag HTML, è già HTML (da Tiptap)."""
    t = (text or "").lstrip()
    return t.startswith("<") and not t.startswith("```")


def _markdown_to_html(md: str) -> str:
    """Render markdown to *sanitized* HTML.
    Se il contenuto è già HTML (es. da editor Tiptap), lo sanitizza direttamente.
    """
    md = md or ""
    if _is_html(md):
        try:
            return _sanitize_html(md)
        except Exception:
            return f"<pre>{escape(md)}</pre>"
    try:
        import markdown as mdlib

        html = mdlib.markdown(
            md,
            extensions=[
                "fenced_code",
                "tables",
            ],
        )
        try:
            return _sanitize_html(html)
        except Exception:
            return f"<pre>{escape(md)}</pre>"
    except Exception:
        return f"<pre>{escape(md)}</pre>"


def _markdown_to_plain_text(md: str) -> str:
    """Best-effort conversion to a readable plain text for PDF."""

    md = md or ""

    # Drop fenced code blocks entirely (keeps PDF compact)
    md = re.sub(r"```[\s\S]*?```", "", md)

    # Inline code
    md = re.sub(r"`([^`]*)`", r"\1", md)

    # Bold/italic markers
    md = re.sub(r"\*\*(.*?)\*\*", r"\1", md)
    md = re.sub(r"__(.*?)__", r"\1", md)
    md = re.sub(r"\*(.*?)\*", r"\1", md)
    md = re.sub(r"_(.*?)_", r"\1", md)

    # Links: [text](url) -> text (url)
    md = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", md)

    # Headings: strip leading #'s
    md = re.sub(r"^\s{0,3}#{1,6}\s+", "", md, flags=re.MULTILINE)

    # List markers
    md = re.sub(r"^\s*[-*+]\s+", "• ", md, flags=re.MULTILINE)
    md = re.sub(r"^\s*\d+\.\s+", "• ", md, flags=re.MULTILINE)

    return md.strip()


def _attachment_accel_response(*, file_field, filename: str, mime_type: str | None = None, disposition: str = "inline") -> HttpResponse:
    if not file_field:
        return HttpResponse(status=404)

    rel_name = (file_field.name or "").lstrip("/")
    p = PurePosixPath(rel_name)
    if not rel_name or ".." in p.parts:
        return HttpResponse(status=400)

    resolved_mime = mime_type or mimetypes.guess_type(rel_name)[0] or "application/octet-stream"
    resp = HttpResponse(b"", content_type=resolved_mime)
    resp["X-Accel-Redirect"] = f"/protected_media/{rel_name}"
    resp["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    resp.headers.pop("Content-Length", None)
    return resp


def _label_for_wiki_link(entity_type: str, entity_id: int) -> str | None:
    if entity_type == "customer":
        from crm.models import Customer

        return Customer.objects.filter(pk=entity_id).values_list("name", flat=True).first()
    if entity_type == "site":
        from crm.models import Site

        return Site.objects.filter(pk=entity_id).values_list("name", flat=True).first()
    if entity_type == "inventory":
        from inventory.models import Inventory

        return Inventory.objects.filter(pk=entity_id).values_list("name", flat=True).first()
    return None


def _path_for_wiki_link(entity_type: str, entity_id: int) -> str | None:
    if entity_type == "customer":
        return f"/customers?open={entity_id}"
    if entity_type == "site":
        return f"/sites?open={entity_id}"
    if entity_type == "inventory":
        return f"/inventory?open={entity_id}"
    return None


def _slug_is_available(*, slug: str, exclude_id: int | None = None) -> bool:
    qs = WikiPage.objects.filter(slug=slug, deleted_at__isnull=True)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return not qs.exists()


def _suggest_available_slug(base_slug: str, *, exclude_id: int | None = None) -> str:
    base = (base_slug or "").strip("-") or "wiki-page"
    if _slug_is_available(slug=base, exclude_id=exclude_id):
        return base
    for suffix in range(2, 1000):
        candidate = f"{base}-{suffix}"
        if _slug_is_available(slug=candidate, exclude_id=exclude_id):
            return candidate
    return f"{base}-{timezone.now().strftime('%Y%m%d%H%M%S')}"


# -------------------------
# Categories
# -------------------------


class WikiCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = WikiCategory
        fields = [
            "id",
            "name",
            "description",
            "sort_order",
            "emoji",
            "color",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiCategoryViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = WikiCategorySerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields: ClassVar[list[str]] = []
    search_fields = ["name", "description"]
    ordering_fields = ["sort_order", "name", "updated_at", "created_at", "deleted_at"]
    ordering = ["sort_order", "name"]

    def get_queryset(self):
        qs = WikiCategory.objects.all()
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    # WikiCategory non ha created_by/updated_by: override senza userstamp.
    def perform_create(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        before = obj.deleted_at
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at", "updated_at"])
        log_event(
            actor=request.user,
            action="restore",
            instance=obj,
            changes={"deleted_at": {"from": to_change_value_for_field("deleted_at", before), "to": None}},
            request=request,
        )
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted records.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)

        now = timezone.now()
        restored_ids = list(
            WikiCategory.objects.filter(id__in=ids, deleted_at__isnull=False)
            .values_list("id", flat=True)
        )
        WikiCategory.objects.filter(id__in=restored_ids).update(deleted_at=None, updated_at=now)
        log_event(
            actor=request.user,
            action="restore",
            instance=None,
            changes={"ids": restored_ids},
            request=request,
            subject=f"bulk restore WikiCategory: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=200)


# -------------------------
# Pages
# -------------------------


class WikiPageSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    average_rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()
    current_user_rating = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()
    updated_by_username = serializers.SerializerMethodField()

    def get_average_rating(self, obj):
        value = getattr(obj, "average_rating", None)
        if value is None:
            value = obj.ratings.aggregate(avg=django_models.Avg("rating"))["avg"]
        return round(float(value), 1) if value is not None else None

    def get_rating_count(self, obj):
        value = getattr(obj, "rating_count", None)
        if value is None:
            value = obj.ratings.count()
        return int(value or 0)

    def get_current_user_rating(self, obj):
        prefetched = getattr(obj, "_current_user_ratings", None)
        if prefetched is not None:
            return prefetched[0].rating if prefetched else None

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None

        return obj.ratings.filter(user=user).values_list("rating", flat=True).first()

    def get_attachment_count(self, obj):
        value = getattr(obj, "attachment_count", None)
        if value is None:
            value = obj.attachments.count()
        return int(value or 0)

    def get_created_by_username(self, obj):
        u = obj.created_by
        if not u:
            return None
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    def get_updated_by_username(self, obj):
        u = obj.updated_by
        if not u:
            return None
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    class Meta:
        model = WikiPage
        fields = [
            "id",
            "kb_code",
            "title",
            "slug",
            "category",
            "category_name",
            "summary",
            "tags",
            "content_markdown",
            "is_published",
            "view_count",
            "average_rating",
            "rating_count",
            "current_user_rating",
            "attachment_count",
            "custom_fields",
            "pdf_template_key",
            "pdf_options",
            "created_by_username",
            "updated_by_username",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["kb_code", "view_count"]


class WikiPageViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = WikiPageSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["category", "is_published", "slug"]
    search_fields = ["title", "slug", "summary", "content_markdown"]
    ordering_fields = [
        "title",
        "updated_at",
        "created_at",
        "deleted_at",
        "average_rating",
        "rating_count",
        "view_count",
        "attachment_count",
    ]
    ordering = ["title"]

    def get_queryset(self):
        qs = (
            WikiPage.objects
            .select_related("category", "created_by", "updated_by")
            .annotate(
                average_rating=django_models.Avg("ratings__rating"),
                rating_count=django_models.Count("ratings", distinct=True),
                attachment_count=django_models.Count("attachments", distinct=True),
            )
        )

        user = getattr(self.request, "user", None)
        if user and user.is_authenticated:
            qs = qs.prefetch_related(
                django_models.Prefetch(
                    "ratings",
                    queryset=WikiPageRating.objects.filter(user=user),
                    to_attr="_current_user_ratings",
                )
            )

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    @action(detail=False, methods=["get"], url_path="slug-availability")
    def slug_availability(self, request):
        raw_slug = (request.query_params.get("slug") or "").strip()
        exclude_id_raw = request.query_params.get("exclude_id")
        exclude_id = None
        if exclude_id_raw not in (None, ""):
            try:
                exclude_id = int(exclude_id_raw)
            except (TypeError, ValueError):
                return Response({"detail": "exclude_id non valido."}, status=400)

        if not raw_slug:
            return Response({"detail": "slug obbligatorio."}, status=400)

        available = _slug_is_available(slug=raw_slug, exclude_id=exclude_id)
        suggested = raw_slug if available else _suggest_available_slug(raw_slug, exclude_id=exclude_id)
        return Response({"slug": raw_slug, "available": available, "suggested_slug": suggested})

    @action(detail=True, methods=["get"], url_path="render")
    def render_page(self, request, pk=None):
        """Return rendered (sanitized) HTML for a wiki page's markdown."""

        page = self.get_object()
        html = _markdown_to_html(page.content_markdown or "")
        return Response({"id": page.id, "title": page.title, "slug": page.slug, "html": html})

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        """Export the wiki page as a simple PDF (server-side)."""

        page = self.get_object()

        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.units import cm
            from reportlab.pdfgen import canvas
        except Exception as e:
            return Response({"detail": f"PDF export dependency missing: {e}"}, status=501)

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4

        left = 2 * cm
        right = 2 * cm
        top = 2 * cm
        bottom = 2 * cm
        _ = width - left - right  # max_w (kept for clarity)

        # Title
        y = height - top
        c.setFont("Helvetica-Bold", 16)
        c.drawString(left, y, unescape(page.title or "Wiki page"))
        y -= 24

        # Body text
        c.setFont("Helvetica", 10)
        text = _markdown_to_plain_text(page.content_markdown or "")

        def wrap_line(line: str, max_chars: int) -> list[str]:
            if not line:
                return [""]
            out: list[str] = []
            cur = ""
            for word in line.split():
                if len(cur) + (1 if cur else 0) + len(word) <= max_chars:
                    cur = f"{cur} {word}".strip()
                else:
                    out.append(cur)
                    cur = word
            if cur:
                out.append(cur)
            return out

        # Very rough char-based wrap; good enough for readable PDFs
        max_chars = 110
        lines: list[str] = []
        for para in re.split(r"\n\n+", text):
            para = para.strip()
            if not para:
                lines.append("")
                continue
            for ln in para.splitlines():
                lines.extend(wrap_line(ln, max_chars))
            lines.append("")

        line_h = 13
        for ln in lines:
            if y <= bottom:
                c.showPage()
                c.setFont("Helvetica", 10)
                y = height - top
            c.drawString(left, y, ln)
            y -= line_h

        c.save()
        buf.seek(0)

        filename = re.sub(r"[^A-Za-z0-9._-]+", "_", page.slug or f"wiki_{page.id}") + ".pdf"
        resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    def perform_create(self, serializer):
        instance = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        instance.kb_code = f"KB{instance.pk:07d}"
        instance.save(update_fields=["kb_code"])
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    @action(detail=True, methods=["post"], url_path="view", permission_classes=[IsAuthenticated])
    def record_view(self, request, pk=None):
        """Incrementa il contatore visualizzazioni atomicamente."""
        WikiPage.objects.filter(pk=pk).update(view_count=django_models.F("view_count") + 1)
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="rate", permission_classes=[IsAuthenticated])
    def rate_page(self, request, pk=None):
        page = self.get_object()
        raw_rating = request.data.get("rating") if isinstance(request.data, dict) else None

        try:
            rating = int(raw_rating)
        except (TypeError, ValueError):
            return Response({"detail": "rating deve essere un intero tra 1 e 5."}, status=400)

        if rating < 1 or rating > 5:
            return Response({"detail": "rating deve essere compreso tra 1 e 5."}, status=400)

        if WikiPageRating.objects.filter(page=page, user=request.user).exists():
            return Response({"detail": "Hai già votato questa pagina."}, status=400)

        WikiPageRating.objects.create(page=page, user=request.user, rating=rating)
        log_event(
            actor=request.user,
            action="rate",
            instance=page,
            changes={"rating": rating},
            request=request,
            subject=f"wiki rating page {page.pk}: {rating}",
        )

        refreshed = self.get_queryset().get(pk=page.pk)
        return Response(self.get_serializer(refreshed).data, status=201)

    def perform_update(self, serializer):
        instance = serializer.instance
        # Snapshot della versione corrente PRIMA di sovrascrivere
        last_rev = WikiPageRevision.objects.filter(page=instance).order_by("-revision_number").first()
        next_num = (last_rev.revision_number + 1) if last_rev else 1
        WikiPageRevision.objects.create(
            page=instance,
            revision_number=next_num,
            title=instance.title,
            summary=instance.summary,
            tags=instance.tags,
            content_markdown=instance.content_markdown or "",
            saved_by=self.request.user,
        )
        updated = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=updated, request=self.request)

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.updated_by = request.user
        obj.save(update_fields=["deleted_at", "updated_at", "updated_by"])
        log_event(actor=request.user, action="restore", instance=obj, request=request)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted records.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)

        now = timezone.now()
        restored_ids = list(
            WikiPage.objects.filter(id__in=ids, deleted_at__isnull=False)
            .values_list("id", flat=True)
        )
        WikiPage.objects.filter(id__in=restored_ids).update(
            deleted_at=None, updated_at=now, updated_by=request.user
        )
        log_event(
            actor=request.user, action="restore", instance=None,
            changes={"ids": restored_ids}, request=request,
            subject=f"bulk restore WikiPage: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=200)


# -------------------------
# Attachments
# -------------------------


class WikiAttachmentSerializer(serializers.ModelSerializer):
    page_title = serializers.CharField(source="page.title", read_only=True)
    file_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    def _build_action_url(self, obj, action: str):
        request = self.context.get("request")
        relative = f"/api/wiki-attachments/{obj.pk}/{action}/"
        return request.build_absolute_uri(relative) if request else relative

    def get_file_url(self, obj):
        if not obj.file:
            return None
        return self._build_action_url(obj, "preview")

    def get_preview_url(self, obj):
        if not obj.file:
            return None
        return self._build_action_url(obj, "preview")

    def get_download_url(self, obj):
        if not obj.file:
            return None
        return self._build_action_url(obj, "download")

    class Meta:
        model = WikiAttachment
        fields = [
            "id",
            "page",
            "page_title",
            "filename",
            "mime_type",
            "storage_key",
            "size_bytes",
            "notes",
            "file_url",
            "preview_url",
            "download_url",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiAttachmentViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = WikiAttachmentSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["mime_type"]
    search_fields = ["filename", "storage_key", "notes", "page__title"]
    ordering_fields = ["filename", "size_bytes", "updated_at", "created_at", "deleted_at"]
    ordering = ["filename"]

    def get_queryset(self):
        qs = WikiAttachment.objects.select_related("page")
        page_id = self.request.query_params.get("page_id")
        if page_id not in (None, ""):
            try:
                qs = qs.filter(page_id=int(page_id))
            except (TypeError, ValueError):
                qs = qs.none()
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    # WikiAttachment non ha created_by/updated_by: override senza userstamp.
    def perform_create(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        """Upload un file come allegato a una pagina wiki.
        Form fields: page (int), file (multipart).
        """
        page_id = request.data.get("page")
        uploaded = request.FILES.get("file")

        if not page_id:
            return Response({"detail": "Campo 'page' obbligatorio."}, status=400)
        if not uploaded:
            return Response({"detail": "Campo 'file' obbligatorio."}, status=400)

        try:
            page = WikiPage.objects.get(pk=page_id)
        except WikiPage.DoesNotExist:
            return Response({"detail": "Pagina non trovata."}, status=404)

        attachment = WikiAttachment.objects.create(
            page=page,
            file=uploaded,
            filename=uploaded.name,
            mime_type=uploaded.content_type or "",
            size_bytes=uploaded.size,
            storage_key="",
        )

        log_event(actor=request.user, action="create", instance=attachment, request=request)

        serializer = self.get_serializer(attachment, context={"request": request})
        return Response(serializer.data, status=201)

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        attachment = self.get_object()
        if not attachment.file:
            return Response({"detail": "File non presente."}, status=404)
        return _attachment_accel_response(
            file_field=attachment.file,
            filename=attachment.filename or "attachment",
            mime_type=attachment.mime_type or None,
            disposition="inline",
        )

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        attachment = self.get_object()
        if not attachment.file:
            return Response({"detail": "File non presente."}, status=404)
        return _attachment_accel_response(
            file_field=attachment.file,
            filename=attachment.filename or "attachment",
            mime_type=attachment.mime_type or None,
            disposition="attachment",
        )

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at", "updated_at"])
        log_event(actor=request.user, action="restore", instance=obj, request=request)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)
        now = timezone.now()
        restored_ids = list(
            WikiAttachment.objects.filter(id__in=ids, deleted_at__isnull=False)
            .values_list("id", flat=True)
        )
        WikiAttachment.objects.filter(id__in=restored_ids).update(deleted_at=None, updated_at=now)
        log_event(
            actor=request.user, action="restore", instance=None,
            changes={"ids": restored_ids}, request=request,
            subject=f"bulk restore WikiAttachment: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=200)


# -------------------------
# Links
# -------------------------


class WikiLinkSerializer(serializers.ModelSerializer):
    page_title = serializers.CharField(source="page.title", read_only=True)
    entity_label = serializers.SerializerMethodField()
    entity_path = serializers.SerializerMethodField()

    def get_entity_label(self, obj):
        label = _label_for_wiki_link(obj.entity_type, obj.entity_id)
        if label:
            return label
        fallback_type = {
            "customer": "Cliente",
            "site": "Sito",
            "inventory": "Inventory",
        }.get(obj.entity_type, obj.entity_type.capitalize())
        return f"{fallback_type} #{obj.entity_id}"

    def get_entity_path(self, obj):
        return _path_for_wiki_link(obj.entity_type, obj.entity_id)

    class Meta:
        model = WikiLink
        fields = [
            "id",
            "page",
            "page_title",
            "entity_type",
            "entity_id",
            "entity_label",
            "entity_path",
            "notes",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiLinkViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = WikiLinkSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["entity_type", "entity_id"]
    search_fields = ["notes", "page__title", "entity_type"]
    ordering_fields = ["updated_at", "created_at", "entity_type", "entity_id", "deleted_at"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        qs = WikiLink.objects.select_related("page")
        page_id = self.request.query_params.get("page_id")
        if page_id not in (None, ""):
            try:
                qs = qs.filter(page_id=int(page_id))
            except (TypeError, ValueError):
                qs = qs.none()
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    # WikiLink non ha created_by/updated_by: override senza userstamp.
    def perform_create(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at", "updated_at"])
        log_event(actor=request.user, action="restore", instance=obj, request=request)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted records.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)

        now = timezone.now()
        restored_ids = list(
            WikiLink.objects.filter(id__in=ids, deleted_at__isnull=False)
            .values_list("id", flat=True)
        )
        WikiLink.objects.filter(id__in=restored_ids).update(deleted_at=None, updated_at=now)
        log_event(
            actor=request.user, action="restore", instance=None,
            changes={"ids": restored_ids}, request=request,
            subject=f"bulk restore WikiLink: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=200)


# -------------------------
# Revisions
# -------------------------


class WikiPageRevisionSerializer(serializers.ModelSerializer):
    saved_by_username = serializers.SerializerMethodField()

    def get_saved_by_username(self, obj):
        u = obj.saved_by
        if not u:
            return None
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    class Meta:
        model = WikiPageRevision
        fields = [
            "id",
            "page",
            "revision_number",
            "title",
            "summary",
            "tags",
            "content_markdown",
            "saved_by_username",
            "saved_at",
        ]
        read_only_fields = fields


class WikiPageRevisionViewSet(viewsets.ReadOnlyModelViewSet):
    """Revisioni in sola lettura. Il restore avviene tramite action dedicata."""
    serializer_class = WikiPageRevisionSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = []
    ordering_fields = ["revision_number", "saved_at"]
    ordering = ["-revision_number"]

    def get_queryset(self):
        qs = WikiPageRevision.objects.select_related("saved_by", "page")
        page_id = self.request.query_params.get("page_id")
        if page_id not in (None, ""):
            try:
                qs = qs.filter(page_id=int(page_id))
            except (TypeError, ValueError):
                qs = qs.none()
        return qs

    @action(detail=True, methods=["get"], url_path="render")
    def render_revision(self, request, pk=None):
        rev = self.get_object()
        html = _markdown_to_html(rev.content_markdown or "")
        return Response({"id": rev.id, "title": rev.title, "html": html})

    @action(detail=True, methods=["post"], url_path="restore", permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        """Ripristina la pagina a questa revisione creando una nuova revisione."""
        rev = self.get_object()
        page = rev.page

        # Snapshot dello stato attuale prima di sovrascrivere
        last = WikiPageRevision.objects.filter(page=page).order_by("-revision_number").first()
        next_num = (last.revision_number + 1) if last else 1
        WikiPageRevision.objects.create(
            page=page,
            revision_number=next_num,
            title=page.title,
            summary=page.summary,
            tags=page.tags,
            content_markdown=page.content_markdown or "",
            saved_by=request.user,
        )

        # Applica la revisione scelta
        page.title = rev.title
        page.summary = rev.summary
        page.tags = rev.tags
        page.content_markdown = rev.content_markdown
        page.updated_by = request.user
        page.save(update_fields=["title", "summary", "tags", "content_markdown", "updated_by", "updated_at"])

        from wiki.api import WikiPageSerializer
        return Response(WikiPageSerializer(page, context={"request": request}).data)


# -------------------------
# Stats
# -------------------------

class WikiStatsView(APIView):
    """Statistiche aggregate per la dashboard wiki."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            from django.db.models import Count, Sum

            pages_qs = WikiPage.objects.filter(deleted_at__isnull=True)
            rated_pages_qs = pages_qs.annotate(
                avg_rating=django_models.Avg("ratings__rating"),
                rating_count=Count("ratings", distinct=True),
            )

            rating_votes_qs = WikiPageRating.objects.filter(page__deleted_at__isnull=True)

            by_category = (
                pages_qs
                .values("category__name", "category__color", "category__emoji")
                .annotate(count=Count("id"))
                .order_by("-count", "category__name")
            )
            by_category_data = [
                {
                    "name": row["category__name"] or "Senza categoria",
                    "color": row["category__color"] or "#64748b",
                    "emoji": row["category__emoji"] or "📄",
                    "count": row["count"],
                }
                for row in by_category
            ]

            recent = rated_pages_qs.select_related("updated_by").order_by("-updated_at")[:10]
            recent_data = [
                {
                    "id": page.pk,
                    "kb_code": page.kb_code,
                    "title": page.title,
                    "updated_at": page.updated_at.isoformat() if page.updated_at else None,
                    "updated_by": (
                        f"{page.updated_by.first_name} {page.updated_by.last_name}".strip() or page.updated_by.username
                    ) if page.updated_by else None,
                    "view_count": page.view_count,
                    "is_published": page.is_published,
                    "avg_rating": round(float(page.avg_rating or 0), 2) if page.rating_count else None,
                    "rating_count": int(page.rating_count or 0),
                }
                for page in recent
            ]

            top_authors = (
                WikiPageRevision.objects
                .filter(saved_by__isnull=False)
                .values("saved_by__id", "saved_by__first_name", "saved_by__last_name", "saved_by__username")
                .annotate(edits=Count("id"))
                .order_by("-edits", "saved_by__username")[:8]
            )
            top_authors_data = [
                {
                    "user_id": row["saved_by__id"],
                    "name": (
                        f"{row['saved_by__first_name']} {row['saved_by__last_name']}".strip() or row["saved_by__username"]
                    ),
                    "edits": row["edits"],
                }
                for row in top_authors
            ]

            def serialize_page(page):
                return {
                    "id": page.pk,
                    "kb_code": page.kb_code or "",
                    "title": page.title,
                    "view_count": page.view_count,
                    "updated_at": page.updated_at.isoformat() if page.updated_at else None,
                    "is_published": page.is_published,
                    "avg_rating": round(float(page.avg_rating or 0), 2) if page.rating_count else None,
                    "rating_count": int(page.rating_count or 0),
                }

            top_rated_pages_data = [
                serialize_page(page)
                for page in rated_pages_qs.filter(rating_count__gt=0).order_by("-avg_rating", "-rating_count", "title")[:8]
            ]

            low_rated_pages_data = [
                serialize_page(page)
                for page in rated_pages_qs.filter(rating_count__gt=0).order_by("avg_rating", "-rating_count", "title")[:8]
            ]

            unrated_pages_data = [
                serialize_page(page)
                for page in rated_pages_qs.filter(rating_count=0).order_by("-updated_at", "title")[:8]
            ]

            most_viewed_pages_data = [
                serialize_page(page)
                for page in rated_pages_qs.order_by("-view_count", "title")[:8]
            ]

            distribution_rows = {
                row["rating"]: row["count"]
                for row in rating_votes_qs.values("rating").annotate(count=Count("id"))
            }
            rating_distribution = [
                {"stars": stars, "count": int(distribution_rows.get(stars, 0))}
                for stars in range(1, 6)
            ]

            totals = pages_qs.aggregate(
                total=Count("id"),
                published=Count("id", filter=django_models.Q(is_published=True)),
                drafts=Count("id", filter=django_models.Q(is_published=False)),
                total_views=Sum("view_count"),
            )
            rating_totals = rating_votes_qs.aggregate(
                total_votes=Count("id"),
                average_rating=django_models.Avg("rating"),
                rated_pages=Count("page_id", distinct=True),
            )
            rated_pages_count = int(rating_totals["rated_pages"] or 0)
            total_pages = int(totals["total"] or 0)

            return Response({
                "totals": {
                    "total": total_pages,
                    "published": int(totals["published"] or 0),
                    "drafts": int(totals["drafts"] or 0),
                    "total_views": int(totals["total_views"] or 0),
                    "rated_pages": rated_pages_count,
                    "unrated_pages": max(total_pages - rated_pages_count, 0),
                    "total_votes": int(rating_totals["total_votes"] or 0),
                    "average_rating": round(float(rating_totals["average_rating"] or 0), 2),
                },
                "by_category": by_category_data,
                "recent": recent_data,
                "top_authors": top_authors_data,
                "top_rated_pages": top_rated_pages_data,
                "low_rated_pages": low_rated_pages_data,
                "unrated_pages": unrated_pages_data,
                "most_viewed_pages": most_viewed_pages_data,
                "rating_distribution": rating_distribution,
            })
        except Exception as e:
            logger.exception("Wiki stats error")
            payload = {
                "detail": "Errore durante il calcolo delle statistiche Wiki.",
                "code": "wiki_stats_error",
            }
            if settings.DEBUG:
                payload.update({
                    "error_type": e.__class__.__name__,
                    "error": str(e),
                })
            return Response(payload, status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR)
