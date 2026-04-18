from django.contrib.auth import get_user_model
from django.utils import timezone

import django_filters as filters

from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from audit.utils import log_event, to_change_value_for_field
from core.permissions import CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, RestoreActionMixin
from core.soft_delete import apply_soft_delete_filters
from issues.models import Issue, IssueCategory, IssueComment, IssueStatus

User = get_user_model()


# ─── Lookup: IssueCategory ───────────────────────────────────────────────────

class IssueCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = IssueCategory
        fields = ["id", "key", "label", "sort_order", "is_active"]


class IssueCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = IssueCategorySerializer
    pagination_class = None

    def get_queryset(self):
        return IssueCategory.objects.filter(
            is_active=True, deleted_at__isnull=True
        ).order_by("sort_order", "label")


# ─── Serializers ─────────────────────────────────────────────────────────────

class IssueCommentSerializer(serializers.ModelSerializer):
    author_username     = serializers.CharField(source="author.username",   read_only=True)
    author_first_name   = serializers.CharField(source="author.first_name", read_only=True)
    author_last_name    = serializers.CharField(source="author.last_name",  read_only=True)

    class Meta:
        model   = IssueComment
        fields  = [
            "id", "issue", "author", "author_username",
            "author_first_name", "author_last_name",
            "body", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "issue", "author", "created_at", "updated_at"]


class IssueSerializer(serializers.ModelSerializer):
    customer_name           = serializers.CharField(source="customer.name",              read_only=True)
    customer_code           = serializers.CharField(source="customer.code",              read_only=True)
    site_name               = serializers.CharField(source="site.name",                  read_only=True)
    inventory_name          = serializers.CharField(source="inventory.name",             read_only=True)
    inventory_knumber       = serializers.CharField(source="inventory.knumber",          read_only=True)
    inventory_serial_number = serializers.CharField(source="inventory.serial_number",    read_only=True)
    inventory_hostname      = serializers.CharField(source="inventory.hostname",         read_only=True)
    category_label          = serializers.CharField(source="category.label",             read_only=True)
    assigned_to_username    = serializers.CharField(source="assigned_to.username",       read_only=True)
    assigned_to_full_name   = serializers.SerializerMethodField()
    assigned_to_avatar      = serializers.SerializerMethodField()
    created_by_username     = serializers.CharField(source="created_by.username",        read_only=True)
    created_by_full_name    = serializers.SerializerMethodField()
    priority_label          = serializers.CharField(source="get_priority_display",       read_only=True)
    status_label            = serializers.CharField(source="get_status_display",         read_only=True)
    comments_count          = serializers.SerializerMethodField()
    days_open               = serializers.SerializerMethodField()

    def get_assigned_to_full_name(self, obj):
        u = obj.assigned_to
        if not u:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def _get_user_avatar(self, user):
        if not user:
            return None
        try:
            profile = user.profile
        except Exception:
            return None
        if not profile or not profile.avatar:
            return None
        try:
            return profile.avatar.url
        except Exception:
            return None

    def get_created_by_full_name(self, obj):
        u = obj.created_by
        if not u:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_assigned_to_avatar(self, obj):
        return self._get_user_avatar(obj.assigned_to)

    def get_comments_count(self, obj):
        return getattr(obj, "comments_count", 0)

    def get_days_open(self, obj):
        from datetime import date
        ref = obj.opened_at or obj.created_at.date()
        return max(0, (date.today() - ref).days)

    def _sync_closed_at(self, status_value, current_closed_at=None):
        if status_value in {IssueStatus.RESOLVED, IssueStatus.CLOSED}:
            return current_closed_at or timezone.localdate()
        return None

    def _auto_close_at(self, closed_at):
        """Restituisce la data di auto-chiusura: 48h (2 giorni) dopo closed_at."""
        if closed_at is None:
            return None
        import datetime
        return closed_at + datetime.timedelta(hours=48)

    def create(self, validated_data):
        status_value = validated_data.get("status", IssueStatus.OPEN)
        validated_data["closed_at"] = self._sync_closed_at(status_value)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        status_value = validated_data.get("status", instance.status)
        validated_data["closed_at"] = self._sync_closed_at(status_value, instance.closed_at)
        return super().update(instance, validated_data)

    def validate(self, attrs):
        # ── Blocca qualsiasi modifica a issue già chiuse ──────────────────────
        if self.instance is not None and self.instance.status == IssueStatus.CLOSED:
            raise serializers.ValidationError(
                "Questa issue è chiusa e non può essere modificata."
            )

        # ── Blocca l'impostazione manuale dello stato 'closed' ────────────────
        if attrs.get("status") == IssueStatus.CLOSED:
            raise serializers.ValidationError(
                {"status": "Lo stato «Chiusa» viene impostato automaticamente dal sistema."}
            )

        customer  = attrs.get("customer")  if "customer"  in attrs else getattr(self.instance, "customer",  None)
        site      = attrs.get("site")      if "site"      in attrs else getattr(self.instance, "site",      None)
        inventory = attrs.get("inventory") if "inventory" in attrs else getattr(self.instance, "inventory", None)

        errors = {}

        if site is not None and customer is not None and site.customer_id != customer.id:
            errors["site"] = "Il sito selezionato non appartiene al cliente della issue."

        if inventory is not None and customer is not None and inventory.customer_id != customer.id:
            errors["inventory"] = "L'inventory selezionato non appartiene al cliente della issue."

        if inventory is not None and site is not None and inventory.site_id and inventory.site_id != site.id:
            errors["inventory"] = "L'inventory selezionato non appartiene al sito indicato nella issue."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    class Meta:
        model   = Issue
        fields  = [
            "id",
            "title", "description", "servicenow_id",
            "customer", "customer_name", "customer_code",
            "site", "site_name",
            "inventory", "inventory_name", "inventory_knumber", "inventory_serial_number", "inventory_hostname",
            "category", "category_label",
            "assigned_to", "assigned_to_username", "assigned_to_full_name", "assigned_to_avatar",
            "created_by", "created_by_username", "created_by_full_name",
            "priority", "priority_label",
            "status", "status_label",
            "opened_at", "closed_at", "days_open",
            "due_date",
            "comments_count",
            "created_at", "updated_at", "deleted_at",
        ]
        read_only_fields = [
            "id", "created_by", "created_at", "updated_at", "deleted_at",
            "customer_name", "customer_code", "site_name", "category_label",
            "inventory_name", "inventory_knumber", "inventory_serial_number", "inventory_hostname",
            "assigned_to_username", "assigned_to_full_name", "assigned_to_avatar",
            "created_by_username", "created_by_full_name",
            "priority_label", "status_label", "comments_count", "days_open", "closed_at",
        ]


# ─── Filters ─────────────────────────────────────────────────────────────────

class IssueFilter(filters.FilterSet):
    status      = filters.MultipleChoiceFilter(choices=Issue.status.field.choices)
    priority    = filters.MultipleChoiceFilter(choices=Issue.priority.field.choices)
    customer    = filters.NumberFilter(field_name="customer_id")
    site        = filters.NumberFilter(field_name="site_id")
    inventory   = filters.NumberFilter(field_name="inventory_id")
    category    = filters.NumberFilter(field_name="category_id")
    assigned_to = filters.NumberFilter(field_name="assigned_to_id")
    due_before  = filters.DateFilter(field_name="due_date", lookup_expr="lte")
    due_after   = filters.DateFilter(field_name="due_date", lookup_expr="gte")
    hide_closed = filters.BooleanFilter(method="filter_hide_closed")

    class Meta:
        model  = Issue
        fields = ["status", "priority", "customer", "site", "inventory", "category", "assigned_to", "hide_closed"]

    def filter_hide_closed(self, queryset, name, value):
        if value:
            return queryset.filter(status__in=[IssueStatus.OPEN, IssueStatus.IN_PROGRESS])
        return queryset


# ─── ViewSet ─────────────────────────────────────────────────────────────────

class IssueViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """ViewSet per Issue.

    Eredita da:
    - RestoreActionMixin  → action `restore` standard (response con serializer)
    - SoftDeleteAuditMixin → perform_destroy (soft-delete), perform_create, perform_update

    Override specifici:
    - perform_create: passa solo created_by (Issue non ha updated_by); audit
      changes include title per la leggibilità nel log.
    - perform_update: audit diff limitato a status/priority (i campi chiave
      che interessano nelle notifiche e nei report).
    - get_queryset: usa apply_soft_delete_filters standard + annotazione
      comments_count.
    """

    # RestoreActionMixin config:
    # Issue non ha updated_by → no userstamp al restore.
    # Risponde con il serializer dell'oggetto ripristinato (coerente con CRM).
    restore_has_updated_by  = False
    restore_response_204    = False
    restore_use_split       = False
    restore_use_block_check = False

    serializer_class    = IssueSerializer
    filter_backends     = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class     = IssueFilter
    search_fields       = [
        "title", "description", "servicenow_id", "customer__name",
        "inventory__name", "inventory__knumber", "inventory__serial_number", "inventory__hostname",
    ]
    ordering_fields     = [
        "created_at", "updated_at", "due_date", "closed_at",
        "priority", "status", "title", "servicenow_id",
        "opened_at", "customer__name", "category__label",
        "assigned_to__last_name", "comments_count",
        "deleted_at",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        from django.db.models import Count
        qs = Issue.objects.select_related(
            "customer", "site", "inventory", "category",
            "assigned_to", "assigned_to__profile", "created_by",
        ).annotate(
            comments_count=Count("comments")
        )
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    # ── perform_create override ───────────────────────────────────────────────

    def perform_create(self, serializer):
        """Issue ha solo created_by, non updated_by: override minimo del mixin."""
        issue = serializer.save(created_by=self.request.user)
        log_event(
            self.request.user,
            action="create",
            instance=issue,
            changes={"title": {"from": None, "to": to_change_value_for_field("title", issue.title)}},
            request=self.request,
        )

    # ── perform_update override ───────────────────────────────────────────────

    def perform_update(self, serializer):
        """Audit diff limitato a status e priority — i campi chiave per i report."""
        old = serializer.instance
        old_status   = old.status
        old_priority = old.priority
        issue = serializer.save()
        changes = {}
        if old_status   != issue.status:   changes["status"]   = {"from": old_status,   "to": issue.status}
        if old_priority != issue.priority: changes["priority"] = {"from": old_priority, "to": issue.priority}
        log_event(
            self.request.user,
            action="update",
            instance=issue,
            changes=changes or None,
            request=self.request,
        )

    # ── summary ──────────────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Conteggi per stato, avg chiusura e bucket grafico — globali, senza filtri."""
        from django.db.models import Count, Q, Avg, F, ExpressionWrapper, fields as dj_fields
        from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
        from django.utils.timezone import now
        import datetime

        qs = Issue.objects.filter(deleted_at__isnull=True)
        counts = qs.aggregate(
            open_count=Count("id", filter=Q(status=IssueStatus.OPEN)),
            in_progress_count=Count("id", filter=Q(status=IssueStatus.IN_PROGRESS)),
            resolved_count=Count("id", filter=Q(status=IssueStatus.RESOLVED)),
            closed_count=Count("id", filter=Q(status=IssueStatus.CLOSED)),
        )
        counts["active_count"] = (counts["open_count"] or 0) + (counts["in_progress_count"] or 0)

        # Tempo medio di chiusura
        avg_row = (
            Issue.objects
            .filter(
                deleted_at__isnull=True,
                status__in=(IssueStatus.RESOLVED, IssueStatus.CLOSED),
                opened_at__isnull=False,
                closed_at__isnull=False,
            )
            .annotate(days=ExpressionWrapper(F("closed_at") - F("opened_at"), output_field=dj_fields.DurationField()))
            .aggregate(avg=Avg("days"))
        )
        avg_duration = avg_row["avg"]
        counts["avg_days_to_close"] = (
            round(avg_duration.days + avg_duration.seconds / 86400, 1)
            if avg_duration is not None else None
        )

        # Bucket grafico: usa opened_at se presente, altrimenti created_at (come il serializer)
        granularity = (request.query_params.get("granularity") or "day").strip().lower()
        today = now().date()

        from django.db.models.functions import Coalesce, Cast
        from django.db.models import DateField as DjDateField

        # Campo data effettiva: opened_at ?? cast(created_at as date)
        effective_date = Coalesce(
            F("opened_at"),
            Cast(F("created_at"), output_field=DjDateField()),
        )

        if granularity == "week":
            trunc_fn = TruncWeek(effective_date, output_field=dj_fields.DateField())
            # Allinea il cutoff al lunedì della settimana più vecchia (11 settimane fa)
            oldest = today - datetime.timedelta(weeks=11)
            cutoff = oldest - datetime.timedelta(days=oldest.weekday())  # lunedì della settimana
        elif granularity == "month":
            trunc_fn = TruncMonth(effective_date, output_field=dj_fields.DateField())
            # Primo giorno del mese di 11 mesi fa
            y, m = today.year, today.month - 11
            if m <= 0:
                y, m = y - 1, m + 12
            cutoff = datetime.date(y, m, 1)
        else:
            trunc_fn = TruncDate(effective_date)
            cutoff = today - datetime.timedelta(days=29)

        buckets_qs = (
            Issue.objects
            .filter(deleted_at__isnull=True)
            .annotate(eff_date=effective_date)
            .filter(eff_date__gte=cutoff)
            .annotate(period=trunc_fn)
            .values("period")
            .annotate(count=Count("id"))
            .order_by("period")
        )
        counts["chart_buckets"] = [
            {"date": b["period"].isoformat() if b["period"] else None, "count": b["count"]}
            for b in buckets_qs
        ]

        # Bucket issue chiuse/risolte — usa closed_at come data pivot
        if granularity == "week":
            closed_trunc = TruncWeek("closed_at", output_field=dj_fields.DateField())
        elif granularity == "month":
            closed_trunc = TruncMonth("closed_at", output_field=dj_fields.DateField())
        else:
            closed_trunc = TruncDate("closed_at")

        closed_qs = (
            Issue.objects
            .filter(
                deleted_at__isnull=True,
                status__in=(IssueStatus.RESOLVED, IssueStatus.CLOSED),
                closed_at__isnull=False,
                closed_at__gte=cutoff,
            )
            .annotate(period=closed_trunc)
            .values("period")
            .annotate(count=Count("id"))
            .order_by("period")
        )
        counts["closed_buckets"] = [
            {"date": b["period"].isoformat() if b["period"] else None, "count": b["count"]}
            for b in closed_qs
        ]

        return Response(counts)

    # ── Comments nested endpoint ──────────────────────────────────────────────

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        issue = self.get_object()

        if request.method == "GET":
            qs = issue.comments.select_related("author").order_by("created_at")
            return Response(IssueCommentSerializer(qs, many=True).data)

        serializer = IssueCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(issue=issue, author=request.user)
        log_event(
            request.user,
            action="update",
            instance=issue,
            changes={"comment_added": {"from": None, "to": comment.id}},
            request=request,
        )
        return Response(IssueCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"comments/(?P<comment_pk>\d+)")
    def comment_detail(self, request, pk=None, comment_pk=None):
        issue = self.get_object()
        try:
            comment = issue.comments.get(pk=comment_pk)
        except IssueComment.DoesNotExist:
            return Response({"detail": "Commento non trovato."}, status=404)

        if comment.author != request.user and not getattr(request.user, "is_superuser", False) and not request.user.has_perm("core.access_archie"):
            return Response({"detail": "Non autorizzato."}, status=403)

        if request.method == "DELETE":
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = IssueCommentSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
