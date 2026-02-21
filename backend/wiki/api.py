from __future__ import annotations

import io
import re
from html import escape, unescape

from django.http import HttpResponse
from django.utils import timezone

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import CanRestoreModelPermission
from wiki.models import WikiCategory, WikiPage, WikiAttachment, WikiLink


_TRUTHY = {"1", "true", "yes", "on"}


def _apply_deleted_filters(qs, request, action_name: str | None = None):
    include_deleted = (request.query_params.get("include_deleted") or "").lower()
    only_deleted = (request.query_params.get("only_deleted") or "").lower()

    # `restore` must be able to see soft-deleted objects
    if (action_name or "") == "restore":
        include_deleted = "1"

    if only_deleted in _TRUTHY:
        return qs.filter(deleted_at__isnull=False)
    if include_deleted in _TRUTHY:
        return qs
    return qs.filter(deleted_at__isnull=True)


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


def _markdown_to_html(md: str) -> str:
    """Render markdown to *sanitized* HTML."""

    md = md or ""
    try:
        import markdown as mdlib  # type: ignore

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
            # If sanitizer is not available for any reason, do the safe thing.
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
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = WikiCategorySerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = []
    search_fields = ["name", "description"]
    ordering_fields = ["sort_order", "name", "updated_at", "created_at", "deleted_at"]
    ordering = ["sort_order", "name"]

    def get_queryset(self):
        qs = WikiCategory.objects.all()
        return _apply_deleted_filters(qs, self.request, getattr(self, "action", None))

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at"])
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

        qs = WikiCategory.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)

        return Response({"restored": restored, "count": len(restored)}, status=200)


# -------------------------
# Pages
# -------------------------


class WikiPageSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = WikiPage
        fields = [
            "id",
            "title",
            "slug",
            "category",
            "category_name",
            "summary",
            "tags",
            "content_markdown",
            "is_published",
            "custom_fields",
            "pdf_template_key",
            "pdf_options",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiPageViewSet(viewsets.ModelViewSet):
    serializer_class = WikiPageSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["category", "is_published"]
    search_fields = ["title", "slug", "summary", "content_markdown"]
    ordering_fields = ["title", "updated_at", "created_at", "deleted_at"]
    ordering = ["title"]

    def get_queryset(self):
        qs = WikiPage.objects.select_related("category")
        return _apply_deleted_filters(qs, self.request, getattr(self, "action", None))

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

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at"])
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

        qs = WikiPage.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)

        return Response({"restored": restored, "count": len(restored)}, status=200)


# -------------------------
# Attachments
# -------------------------


class WikiAttachmentSerializer(serializers.ModelSerializer):
    page_title = serializers.CharField(source="page.title", read_only=True)

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
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = WikiAttachmentSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["page", "mime_type"]
    search_fields = ["filename", "storage_key", "notes", "page__title"]
    ordering_fields = ["filename", "size_bytes", "updated_at", "created_at", "deleted_at"]
    ordering = ["filename"]

    def get_queryset(self):
        qs = WikiAttachment.objects.select_related("page")
        return _apply_deleted_filters(qs, self.request, getattr(self, "action", None))

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at"])
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

        qs = WikiAttachment.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)

        return Response({"restored": restored, "count": len(restored)}, status=200)


# -------------------------
# Links
# -------------------------


class WikiLinkSerializer(serializers.ModelSerializer):
    page_title = serializers.CharField(source="page.title", read_only=True)

    class Meta:
        model = WikiLink
        fields = [
            "id",
            "page",
            "page_title",
            "entity_type",
            "entity_id",
            "notes",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiLinkViewSet(viewsets.ModelViewSet):
    serializer_class = WikiLinkSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["page", "entity_type", "entity_id"]
    search_fields = ["notes", "page__title", "entity_type"]
    ordering_fields = ["updated_at", "created_at", "entity_type", "entity_id", "deleted_at"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        qs = WikiLink.objects.select_related("page")
        return _apply_deleted_filters(qs, self.request, getattr(self, "action", None))

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at"])
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

        qs = WikiLink.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)

        return Response({"restored": restored, "count": len(restored)}, status=200)

