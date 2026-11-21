"""Viste salvate per utente e pagina: `GET/POST /api/saved-views/?page=…`, `DELETE /api/saved-views/<key>/?page=…`."""
from __future__ import annotations

import json

from rest_framework import mixins, serializers, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import SavedView
from portal.permissions import IsInternalOrPortalDedicatedApp

MAX_STATE_BYTES = 8 * 1024
MAX_VIEWS_PER_PAGE = 50


class SavedViewSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="key", max_length=40)

    class Meta:
        model = SavedView
        fields = ["id", "page", "name", "state"]

    def validate_name(self, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise serializers.ValidationError("Il nome è obbligatorio.")
        return v

    def validate_state(self, v):
        if not isinstance(v, dict):
            raise serializers.ValidationError("Lo stato deve essere un oggetto.")
        if len(json.dumps(v)) > MAX_STATE_BYTES:
            raise serializers.ValidationError("Vista troppo grande.")
        return v


class SavedViewViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Solo le viste dell'utente collegato. POST con una chiave già usata aggiorna la vista."""

    serializer_class = SavedViewSerializer
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp]
    lookup_field = "key"
    lookup_value_regex = r"[^/]+"
    pagination_class = None

    def get_queryset(self):
        qs = SavedView.objects.filter(user=self.request.user)
        page = self.request.query_params.get("page")
        return qs.filter(page=page) if page else qs

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        existing = SavedView.objects.filter(user=request.user, page=d["page"], key=d["key"]).first()
        if existing is None and SavedView.objects.filter(user=request.user, page=d["page"]).count() >= MAX_VIEWS_PER_PAGE:
            return Response({"detail": f"Al massimo {MAX_VIEWS_PER_PAGE} viste per pagina."}, status=status.HTTP_400_BAD_REQUEST)
        obj, created = SavedView.objects.update_or_create(
            user=request.user, page=d["page"], key=d["key"], defaults={"name": d["name"], "state": d["state"]},
        )
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        # La chiave è unica per pagina: senza `page` potrebbe indicare più viste.
        if not request.query_params.get("page"):
            return Response({"detail": "Indica la pagina (?page=…)."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)
