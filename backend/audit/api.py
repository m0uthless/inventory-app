import django_filters as filters

from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from audit.models import AuditEvent
from config.ui_paths import build_entity_path
from portal.permissions import IsInternalUserStrictAmbito, PortalModelPermissions


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    actor_name = serializers.SerializerMethodField()
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
            "actor_name",
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

    def get_actor_name(self, obj):
        u = obj.actor
        if u is None:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username

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
    # Più azioni insieme (viste "Modifiche", "Accessi"): ?actions=create,update,delete
    actions = filters.CharFilter(method="filter_actions")
    # Eventi senza utente (sincronizzazioni e operazioni automatiche): ?actor_null=true
    actor_null = filters.BooleanFilter(field_name="actor", lookup_expr="isnull")
    ip = filters.CharFilter(field_name="ip_address")
    # Nota: content_type è nullable (migration 0007). DjangoFilterBackend genera INNER JOIN
    # su content_type__app_label / content_type__model, escludendo silenziosamente gli eventi
    # con content_type=NULL (login, bulk restore, ecc.).
    # Usiamo filtri con metodo esplicito per mantenere il LEFT JOIN corretto.
    app_label = filters.CharFilter(method="filter_app_label")
    model = filters.CharFilter(method="filter_model")
    object_id = filters.CharFilter(field_name="object_id")
    created_after = filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")

    def filter_actions(self, queryset, name, value):
        vals = [v.strip() for v in (value or "").split(",") if v.strip()]
        return queryset.filter(action__in=vals) if vals else queryset

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
        fields = ["actor", "action", "actions", "actor_null", "ip", "app_label", "model", "object_id", "created_after", "created_before"]


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    # 0.9.1 (contenimento SEC-001/SEC-002): l'audit non è più coperto dal
    # default IsAuthenticatedDjangoModelPermissions (che per GET/HEAD non
    # richiede alcun permesso Django, solo autenticazione). Richiede ora
    # esplicitamente sessione interna Archie fuori ambito Portal +
    # permesso Django audit.view_auditevent. La sanitizzazione del
    # contenuto (SEC-001, masking password VPN) resta un intervento
    # separato lato log_event, non ancora incluso in questa patch.
    permission_classes = [IsInternalUserStrictAmbito, PortalModelPermissions]
    queryset = AuditEvent.objects.select_related("actor", "content_type")
    serializer_class = AuditEventSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AuditEventFilter

    search_fields = ["subject", "object_repr", "path", "object_id"]
    ordering_fields = ["created_at", "action"]
    ordering = ["-created_at"]

    def get_queryset(self):
        """Visibilità delle issue per area: gli eventi delle issue che l'utente
        non può vedere (titolo in `object_repr`, modifiche in `changes`) non si
        mostrano."""
        qs = super().get_queryset()
        from django.contrib.contenttypes.models import ContentType
        from django.db.models.functions import Cast
        from django.db.models import CharField

        from issues.models import Issue
        from issues.visibility import visible_issues_q

        visible = visible_issues_q(self.request.user)
        if not visible:
            return qs
        hidden_ids = (
            Issue.objects.exclude(visible)
            .annotate(pk_str=Cast("pk", output_field=CharField()))
            .values("pk_str")
        )
        return qs.exclude(content_type=ContentType.objects.get_for_model(Issue), object_id__in=hidden_ids)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Indicatori della pagina Audit (giorni nel fuso locale).

        - today: eventi di oggi, di cui modifiche (create/update/delete/restore);
        - days: eventi per giorno negli ultimi 14 giorni (dal più vecchio a oggi);
        - failed_24h: accessi falliti nelle ultime 24 ore e la coppia nome utente/IP più frequente;
        - deleted_7d: eliminazioni negli ultimi 7 giorni;
        - top_modifiers_7d: chi ha fatto più modifiche negli ultimi 7 giorni (massimo 3);
        - system_7d: eventi senza utente (sincronizzazioni) negli ultimi 7 giorni.
        """
        qs = AuditEvent.objects.all()
        now = timezone.now()
        today = timezone.localdate()
        tz = timezone.get_current_timezone()

        def day_start(d):
            return timezone.make_aware(datetime.combine(d, time.min), tz)

        start_today = day_start(today)
        changes = ["create", "update", "delete", "restore"]
        auth = ["login", "logout", "login_failed"]

        today_qs = qs.filter(created_at__gte=start_today)
        first = today - timedelta(days=13)
        per_day = {d: 0 for d in (first + timedelta(days=i) for i in range(14))}
        for ts in qs.filter(created_at__gte=day_start(first)).values_list("created_at", flat=True).iterator():
            d = timezone.localtime(ts, tz).date()
            if d in per_day:
                per_day[d] += 1

        failed = list(
            qs.filter(action="login_failed", created_at__gte=now - timedelta(hours=24))
            .values_list("object_repr", "metadata", "ip_address")
        )
        pairs: dict[tuple[str, str], int] = {}
        for repr_, meta, ip in failed:
            username = (meta or {}).get("username") if isinstance(meta, dict) else None
            key = (username or repr_ or "", ip or "")
            pairs[key] = pairs.get(key, 0) + 1
        top_pair = max(pairs.items(), key=lambda kv: kv[1]) if pairs else None

        week = now - timedelta(days=7)
        top = (
            qs.filter(created_at__gte=week, action__in=changes, actor__isnull=False)
            .values("actor", "actor__username", "actor__first_name", "actor__last_name")
            .annotate(n=Count("id"))
            .order_by("-n", "actor__username")[:3]
        )
        return Response({
            "today": {"total": today_qs.count(), "changes": today_qs.filter(action__in=changes).count()},
            "days": [{"date": d.isoformat(), "count": n} for d, n in per_day.items()],
            "failed_24h": {
                "count": len(failed),
                "top": {"username": top_pair[0][0], "ip": top_pair[0][1] or None, "count": top_pair[1]} if top_pair else None,
            },
            "deleted_7d": qs.filter(created_at__gte=week, action="delete").count(),
            "top_modifiers_7d": [
                {
                    "id": r["actor"],
                    "name": f"{r['actor__first_name']} {r['actor__last_name']}".strip() or r["actor__username"],
                    "count": r["n"],
                }
                for r in top
            ],
            "system_7d": qs.filter(created_at__gte=week, actor__isnull=True).exclude(action__in=auth).count(),
        })

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
