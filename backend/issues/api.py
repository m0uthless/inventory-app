from django.contrib.auth import get_user_model
from django.utils import timezone

import django_filters as filters

from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from audit.utils import log_event
from core.permissions import CanRestoreModelPermission
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
    # Readable denormalized fields
    customer_name       = serializers.CharField(source="customer.name",           read_only=True)
    customer_code       = serializers.CharField(source="customer.code",           read_only=True)
    site_name           = serializers.CharField(source="site.name",               read_only=True)
    inventory_name      = serializers.CharField(source="inventory.name",          read_only=True)
    inventory_knumber   = serializers.CharField(source="inventory.knumber",       read_only=True)
    inventory_serial_number = serializers.CharField(source="inventory.serial_number", read_only=True)
    inventory_hostname  = serializers.CharField(source="inventory.hostname",      read_only=True)
    category_label      = serializers.CharField(source="category.label",          read_only=True)
    assigned_to_username    = serializers.CharField(source="assigned_to.username",    read_only=True)
    assigned_to_full_name   = serializers.SerializerMethodField()
    assigned_to_avatar      = serializers.SerializerMethodField()
    created_by_username     = serializers.CharField(source="created_by.username",     read_only=True)
    created_by_full_name    = serializers.SerializerMethodField()

    # Human-readable choices
    priority_label      = serializers.CharField(source="get_priority_display", read_only=True)
    status_label        = serializers.CharField(source="get_status_display",   read_only=True)

    # Comment count for list view
    comments_count      = serializers.SerializerMethodField()

    # Computed: giorni passati dalla data apertura
    days_open           = serializers.SerializerMethodField()

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
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_assigned_to_avatar(self, obj):
        return self._get_user_avatar(obj.assigned_to)

    def get_comments_count(self, obj):
        # Annotated by the viewset queryset
        return getattr(obj, "comments_count", 0)

    def get_days_open(self, obj):
        from datetime import date
        ref = obj.opened_at or obj.created_at.date()
        return (date.today() - ref).days

    def _sync_closed_at(self, status_value, current_closed_at=None):
        if status_value in {IssueStatus.RESOLVED, IssueStatus.CLOSED}:
            return current_closed_at or timezone.localdate()
        return None

    def create(self, validated_data):
        status_value = validated_data.get("status", IssueStatus.OPEN)
        validated_data["closed_at"] = self._sync_closed_at(status_value)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        status_value = validated_data.get("status", instance.status)
        validated_data["closed_at"] = self._sync_closed_at(status_value, instance.closed_at)
        return super().update(instance, validated_data)

    def validate(self, attrs):
        customer = attrs.get("customer") if "customer" in attrs else getattr(self.instance, "customer", None)
        site = attrs.get("site") if "site" in attrs else getattr(self.instance, "site", None)
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
    deleted     = filters.BooleanFilter(method="filter_deleted")
    hide_closed = filters.BooleanFilter(method="filter_hide_closed")

    class Meta:
        model  = Issue
        fields = ["status", "priority", "customer", "site", "inventory", "category", "assigned_to", "hide_closed"]

    def filter_deleted(self, queryset, name, value):
        if value:
            return queryset.filter(deleted_at__isnull=False)
        return queryset.filter(deleted_at__isnull=True)

    def filter_hide_closed(self, queryset, name, value):
        if value:
            return queryset.filter(status__in=[IssueStatus.OPEN, IssueStatus.IN_PROGRESS])
        return queryset


# ─── ViewSet ─────────────────────────────────────────────────────────────────

class IssueViewSet(viewsets.ModelViewSet):
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
    ]
    ordering            = ["-created_at"]

    def get_queryset(self):
        from django.db.models import Count
        qs = Issue.objects.select_related(
            "customer", "site", "inventory", "category", "assigned_to", "assigned_to__profile", "created_by"
        ).annotate(
            comments_count=Count("comments")
        )
        # Default: only non-deleted
        if self.request.query_params.get("deleted") != "true":
            qs = qs.filter(deleted_at__isnull=True)
        return qs

    def perform_create(self, serializer):
        issue = serializer.save(created_by=self.request.user)
        log_event(
            self.request.user,
            action="create",
            instance=issue,
            changes={"title": [None, issue.title]},
            request=self.request,
        )

    def perform_update(self, serializer):
        old = self.get_object()
        old_status   = old.status
        old_priority = old.priority
        issue = serializer.save()
        changes = {}
        if old_status   != issue.status:   changes["status"]   = [old_status,   issue.status]
        if old_priority != issue.priority: changes["priority"] = [old_priority, issue.priority]
        log_event(self.request.user, action="update", instance=issue, changes=changes or None, request=self.request)

    def destroy(self, request, *args, **kwargs):
        issue = self.get_object()
        issue.soft_delete()
        log_event(request.user, action="delete", instance=issue, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """
        Ritorna i conteggi delle issue per stato.
        Usato dalla sidebar per mostrare il badge delle issue aperte.
        """
        from django.db.models import Count, Q

        qs = Issue.objects.filter(deleted_at__isnull=True)

        counts = qs.aggregate(
            open_count=Count("id", filter=Q(status=IssueStatus.OPEN)),
            in_progress_count=Count("id", filter=Q(status=IssueStatus.IN_PROGRESS)),
            resolved_count=Count("id", filter=Q(status=IssueStatus.RESOLVED)),
            closed_count=Count("id", filter=Q(status=IssueStatus.CLOSED)),
        )

        counts["active_count"] = (
            (counts["open_count"] or 0) + (counts["in_progress_count"] or 0)
        )

        return Response(counts)

    @action(detail=True, methods=["post"], url_path="restore", permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        issue = Issue.objects.filter(pk=pk, deleted_at__isnull=False).first()
        if not issue:
            return Response({"detail": "Issue non trovata o già attiva."}, status=404)
        issue.deleted_at = None
        issue.save(update_fields=["deleted_at", "updated_at"])
        log_event(request.user, action="restore", instance=issue, request=request)
        return Response(IssueSerializer(issue).data)

    # ── Comments nested endpoint ──────────────────────────────────────────────

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        issue = self.get_object()

        if request.method == "GET":
            qs = issue.comments.select_related("author").order_by("created_at")
            serializer = IssueCommentSerializer(qs, many=True)
            return Response(serializer.data)

        # POST — create comment
        serializer = IssueCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(issue=issue, author=request.user)
        log_event(
            request.user,
            action="update",
            instance=issue,
            changes={"comment_added": [None, comment.id]},
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

        # Solo l'autore o uno staff può modificare/eliminare
        if comment.author != request.user and not request.user.is_staff:
            return Response({"detail": "Non autorizzato."}, status=403)

        if request.method == "DELETE":
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        # PATCH
        serializer = IssueCommentSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
