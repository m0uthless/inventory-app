import django_filters as filters

from django.contrib.auth import get_user_model
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from audit.models import AuditEvent
from config.ui_paths import build_entity_path


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    actor_email = serializers.CharField(source="actor.email", read_only=True)
    content_type_app = serializers.CharField(source="content_type.app_label", read_only=True)
    content_type_model = serializers.CharField(source="content_type.model", read_only=True)
    changes = serializers.SerializerMethodField()
    entity_path = serializers.SerializerMethodField()
    metadata_summary = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "created_at",
            "action",
            "actor",
            "actor_username",
            "actor_email",
            "content_type",
            "content_type_app",
            "content_type_model",
            "object_id",
            "object_repr",
            "subject",
            "changes",
            "entity_path",
            "metadata_summary",
            "path",
            "method",
            "ip_address",
            "user_agent",
        ]

    def get_changes(self, obj):
        raw = obj.changes or {}
        if not isinstance(raw, dict):
            return raw

        normalized = {}
        for field, change in raw.items():
            if not isinstance(change, dict):
                normalized[field] = change
                continue
            if "from" in change or "to" in change:
                normalized[field] = {
                    "from": change.get("from"),
                    "to": change.get("to"),
                }
                continue
            normalized[field] = {
                "from": change.get("before"),
                "to": change.get("after"),
            }
        return normalized

    def get_entity_path(self, obj):
        return build_entity_path(
            getattr(obj.content_type, "app_label", None),
            getattr(obj.content_type, "model", None),
            obj.object_id,
        )

    def get_metadata_summary(self, obj):
        raw = obj.metadata or {}
        if not isinstance(raw, dict):
            return None

        summary = {
            k: v
            for k, v in raw.items()
            if k not in {"path", "method", "ip", "user_agent", "x_forwarded_for"}
        }
        return summary or None


class AuditEventFilter(filters.FilterSet):
    actor = filters.NumberFilter(field_name="actor_id")
    action = filters.CharFilter(field_name="action")
    # Nota: content_type è nullable (migration 0007). DjangoFilterBackend genera INNER JOIN
    # su content_type__app_label / content_type__model, escludendo silenziosamente gli eventi
    # con content_type=NULL (login, bulk restore, ecc.).
    # Usiamo filtri con metodo esplicito per mantenere il LEFT JOIN corretto.
    app_label = filters.CharFilter(method="filter_app_label")
    model = filters.CharFilter(method="filter_model")
    object_id = filters.CharFilter(field_name="object_id")
    created_after = filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")

    def filter_app_label(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(content_type__app_label=value)

    def filter_model(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(content_type__model=value)

    class Meta:
        model = AuditEvent
        fields = ["actor", "action", "app_label", "model", "object_id", "created_after", "created_before"]


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("actor", "content_type")
    serializer_class = AuditEventSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AuditEventFilter

    search_fields = ["subject", "object_repr", "path", "object_id"]
    ordering_fields = ["created_at", "action"]
    ordering = ["-created_at"]

    @action(detail=False, methods=["get"], url_path="actors")
    def actors(self, request):
        """Return a small list of actors that appear in audit events.

        GET /api/audit-events/actors/?q=...
        GET /api/audit-events/actors/?id=123
        """

        User = get_user_model()

        actor_id = request.query_params.get("id")
        q = (request.query_params.get("q") or "").strip()

        base = User.objects.filter(
            id__in=AuditEvent.objects.exclude(actor_id__isnull=True)
            .values_list("actor_id", flat=True)
            .distinct()
        )

        if actor_id:
            try:
                aid = int(actor_id)
            except ValueError:
                aid = None
            if aid is not None:
                base = base.filter(id=aid)

        if q:
            base = base.filter(
                Q(username__icontains=q)
                | Q(email__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )

        base = base.order_by("username")[:25]

        def label(u) -> str:
            full = " ".join([x for x in [u.first_name, u.last_name] if (x or "").strip()]).strip()
            if full and u.username:
                return f"{full} ({u.username})"
            return u.username or (u.email or f"User #{u.id}")

        return Response(
            [
                {
                    "id": u.id,
                    "username": u.username,
                    "email": u.email,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                    "label": label(u),
                }
                for u in base
            ]
        )

    @action(detail=False, methods=["get"], url_path="entities")
    def entities(self, request):
        """Return distinct entity types present in audit events.

        Esclude le righe con content_type=NULL (eventi senza entità associata,
        es. login o bulk-restore): non avrebbero comunque app_label/model utili.
        """
        rows = (
            AuditEvent.objects.filter(content_type__isnull=False)
            .values("content_type__app_label", "content_type__model")
            .distinct()
            .order_by("content_type__app_label", "content_type__model")
        )
        return Response(
            [
                {
                    "app_label": r["content_type__app_label"],
                    "model": r["content_type__model"],
                }
                for r in rows
                if r["content_type__app_label"] and r["content_type__model"]
            ]
        )
