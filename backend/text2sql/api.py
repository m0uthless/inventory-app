"""API del generatore SQL: coda personale, giudizio del tecnico, revisione del superuser."""
from __future__ import annotations

from django.conf import settings
from django.db.models import F
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from audit.utils import log_event
from portal.permissions import IsInternalOrPortalDedicatedApp
from text2sql.models import Text2SqlRequest

MAX_QUESTION = 2000
MAX_CORRECTED_SQL = 20000
MAX_NOTE = 2000


class CanUseText2Sql(BasePermission):
    message = "Non hai il permesso di usare il generatore SQL."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.has_perm("text2sql.use_text2sql"))


class Text2SqlSerializer(serializers.ModelSerializer):
    class Meta:
        model = Text2SqlRequest
        fields = [
            "id", "question", "status", "sql", "kind", "warnings", "seconds", "error",
            "created_at", "started_at", "finished_at",
            "feedback", "corrected_sql", "feedback_note", "feedback_at",
        ]
        read_only_fields = [f for f in fields if f != "question"]

    def validate_question(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Scrivi la domanda.")
        if len(value) > MAX_QUESTION:
            raise serializers.ValidationError(f"La domanda supera i {MAX_QUESTION} caratteri.")
        return value


class Text2SqlReviewSerializer(Text2SqlSerializer):
    user_full_name = serializers.SerializerMethodField()
    example_markdown = serializers.CharField(read_only=True)

    class Meta(Text2SqlSerializer.Meta):
        fields = Text2SqlSerializer.Meta.fields + ["user_full_name", "example_markdown", "reviewed_at"]
        read_only_fields = fields

    def get_user_full_name(self, obj):
        u = obj.user
        return f"{u.first_name} {u.last_name}".strip() or u.username


class FeedbackSerializer(serializers.Serializer):
    feedback = serializers.ChoiceField(choices=["ok", "ko"])
    corrected_sql = serializers.CharField(required=False, allow_blank=True, default="", max_length=MAX_CORRECTED_SQL)
    feedback_note = serializers.CharField(required=False, allow_blank=True, default="", max_length=MAX_NOTE)


class Text2SqlViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                      mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Le proprie domande al generatore. La revisione (`review/`, `reviewed/`) è del superuser."""

    serializer_class = Text2SqlSerializer
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp, CanUseText2Sql]

    def get_queryset(self):
        return Text2SqlRequest.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        if not getattr(settings, "T2S_OLLAMA_URL", ""):
            return Response({"detail": "Generatore non configurato: manca l'indirizzo di Ollama (OLLAMA_URL)."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        obj = serializer.save(user=self.request.user)
        log_event(actor=self.request.user, action="create", instance=obj, request=self.request)

    def _notifications(self, obj):
        from notifications.models import Notification, NotificationType

        return Notification.objects.filter(recipient_id=obj.user_id, notification_type=NotificationType.TEXT2SQL_READY, source_key=str(obj.pk))

    def perform_destroy(self, instance):
        log_event(actor=self.request.user, action="delete", instance=instance, request=self.request)
        # La notifica «Query SQL pronta» porterebbe a una domanda che non c'è più.
        self._notifications(instance).delete()
        instance.delete()

    @action(detail=True, methods=["post"], url_path="seen")
    def seen(self, request, pk=None):
        """La risposta è stata aperta: la sua notifica diventa letta."""
        obj = self.get_object()
        self._notifications(obj).filter(is_read=False).update(is_read=True, read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["patch"], url_path="feedback")
    def feedback(self, request, pk=None):
        obj = self.get_object()
        if obj.status != Text2SqlRequest.STATUS_DONE:
            return Response({"detail": "Si giudica solo una query pronta."}, status=status.HTTP_400_BAD_REQUEST)
        ser = FeedbackSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        obj.feedback = d["feedback"]
        obj.corrected_sql = d["corrected_sql"] if d["feedback"] == "ko" else ""
        obj.feedback_note = d["feedback_note"] if d["feedback"] == "ko" else ""
        obj.feedback_at = timezone.now()
        obj.reviewed_at = None  # un giudizio nuovo torna da rivedere
        obj.save(update_fields=["feedback", "corrected_sql", "feedback_note", "feedback_at", "reviewed_at"])
        log_event(actor=request.user, action="update", instance=obj, changes={"feedback": {"from": None, "to": obj.feedback}}, request=request)
        return Response(self.get_serializer(obj).data)

    def _require_superuser(self, request):
        if not request.user.is_superuser:
            return Response({"detail": "La revisione è riservata al superuser."}, status=status.HTTP_403_FORBIDDEN)
        return None

    @action(detail=False, methods=["get"], url_path="review")
    def review(self, request):
        denied = self._require_superuser(request)
        if denied:
            return denied
        qs = Text2SqlRequest.objects.select_related("user").exclude(feedback="").order_by(F("reviewed_at").asc(nulls_first=True), "-feedback_at", "-id")
        fb = request.query_params.get("feedback")
        if fb in ("ok", "ko"):
            qs = qs.filter(feedback=fb)
        if request.query_params.get("reviewed") == "false":
            qs = qs.filter(reviewed_at__isnull=True)
        page = self.paginate_queryset(qs)
        rows = page if page is not None else qs
        data = Text2SqlReviewSerializer(rows, many=True).data
        return self.get_paginated_response(data) if page is not None else Response(data)

    @action(detail=True, methods=["post"], url_path="reviewed")
    def reviewed(self, request, pk=None):
        denied = self._require_superuser(request)
        if denied:
            return denied
        obj = Text2SqlRequest.objects.filter(pk=pk).exclude(feedback="").first()
        if obj is None:
            return Response({"detail": "Non trovato."}, status=status.HTTP_404_NOT_FOUND)
        obj.reviewed_at = timezone.now() if request.data.get("reviewed", True) else None
        obj.save(update_fields=["reviewed_at"])
        return Response(Text2SqlReviewSerializer(obj).data)
