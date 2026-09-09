from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from portal.permissions import IsInternalOrPortalDedicatedApp
from notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "subtitle",
            "link",
            "event_date",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Sola lettura + azioni di mark-read: le notifiche sono generate solo dal
    management command `refresh_notifications`, mai da input utente diretto.
    """

    serializer_class = NotificationSerializer
    # Come UserTaskViewSet (core/api.py): dato personale filtrato per utente in
    # get_queryset, quindi niente DjangoModelPermissions (richiederebbe un
    # permesso Django dedicato da assegnare a mano a ogni utente/gruppo — non
    # è lo scopo qui, ogni utente deve vedere le proprie notifiche di default,
    # come faceva la vecchia campanella live). Barriera Portal/Archie esplicita
    # per non bypassare il default di sicurezza (vedi WP-03 / 0.9.1).
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"count": count})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        if not notif.is_read:
            notif.is_read = True
            notif.read_at = timezone.now()
            notif.save(update_fields=["is_read", "read_at"])
        return Response(self.get_serializer(notif).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        now = timezone.now()
        self.get_queryset().filter(is_read=False).update(is_read=True, read_at=now)
        return Response(status=204)
