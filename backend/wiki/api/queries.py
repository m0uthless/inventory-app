"""wiki/api/queries.py — WikiQuery + WikiQueryLanguage serializers + ViewSets."""
from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status as drf_status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, RestoreActionMixin
from core.soft_delete import apply_soft_delete_filters
from audit.utils import log_event, to_change_value_for_field

from django.db import models as django_models
from wiki.models import WikiQuery, WikiQueryLanguage

# ─── WikiQuery ────────────────────────────────────────────────────────────────


class WikiQueryLanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WikiQueryLanguage
        fields = [
            "id", "key", "label", "color", "text_color",
            "sort_order", "is_active", "deleted_at",
        ]
        read_only_fields = ["id", "deleted_at"]


class WikiQueryLanguageViewSet(viewsets.ModelViewSet):
    """
    CRUD per i linguaggi delle query Wiki.
    Endpoint: /wiki-query-languages/
    """
    serializer_class = WikiQueryLanguageSerializer
    pagination_class = None  # lista corta, paginazione non necessaria

    def get_queryset(self):
        qs = WikiQueryLanguage.objects.filter(deleted_at__isnull=True)
        # ?all=1 include anche gli inattivi (per l'admin)
        if self.request.query_params.get("all") == "1":
            qs = WikiQueryLanguage.objects.all()
        return qs.order_by("sort_order", "label")


class WikiQuerySerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)
    # Campi denormalizzati dal linguaggio — comodi per il frontend senza join
    language_key   = serializers.CharField(source="language.key",        read_only=True, allow_null=True)
    language_label = serializers.CharField(source="language.label",      read_only=True, allow_null=True)
    language_color = serializers.CharField(source="language.color",      read_only=True, allow_null=True)
    language_text_color = serializers.CharField(source="language.text_color", read_only=True, allow_null=True)

    class Meta:
        model = WikiQuery
        fields = [
            "id",
            "title",
            "language",        # FK id (writable)
            "language_key",
            "language_label",
            "language_color",
            "language_text_color",
            "body",
            "description",
            "tags",
            "use_count",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = [
            "id", "use_count",
            "created_by", "created_by_username",
            "updated_by", "updated_by_username",
            "language_key", "language_label", "language_color", "language_text_color",
            "created_at", "updated_at", "deleted_at",
        ]


class WikiQueryViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    restore_has_updated_by  = False
    restore_response_204    = False
    restore_use_split       = False
    restore_use_block_check = False
    serializer_class = WikiQuerySerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["language"]
    search_fields = ["title", "description", "body", "tags"]
    ordering_fields = ["title", "language__label", "use_count", "updated_at", "created_at"]
    ordering = ["title"]

    def get_queryset(self):
        return apply_soft_delete_filters(
            WikiQuery.objects.select_related(
                "language", "created_by", "updated_by"
            ),
            request=self.request,
            action_name=getattr(self, "action", ""),
        )

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    @action(detail=True, methods=["post"], url_path="use")
    def use(self, request, pk=None):
        """Incrementa use_count quando un utente copia la query."""
        WikiQuery.objects.filter(pk=pk).update(use_count=django_models.F("use_count") + 1)
        return Response({"ok": True})
