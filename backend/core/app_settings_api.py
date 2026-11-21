"""API delle Impostazioni di Archie (spec 2026-11-20). Non è un modulo spegnibile."""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.app_settings import MANAGE_PERM, SettingError, all_settings, office_emails, set_settings
from core.emails import send_templated_email
from portal.permissions import IsInternalOrPortalDedicatedApp


class CanManageAppSettings(BasePermission):
    message = "Non hai il permesso di gestire le impostazioni di Archie."

    def has_permission(self, request, view) -> bool:
        u = request.user
        return bool(u and (u.is_superuser or u.has_perm(MANAGE_PERM)))


PERMS = [IsAuthenticated, IsInternalOrPortalDedicatedApp, CanManageAppSettings]


class AppSettingsView(APIView):
    """GET: impostazioni per sezione. PATCH {chiave: valore}: tutto o niente."""

    permission_classes = PERMS

    def get(self, request):
        return Response(all_settings())

    def patch(self, request):
        if not isinstance(request.data, dict):
            return Response({"detail": "Serve un oggetto {chiave: valore}."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            set_settings(dict(request.data), actor=request.user, request=request)
        except SettingError as e:
            return Response(e.args[0], status=status.HTTP_400_BAD_REQUEST)
        return Response(all_settings())


class ContractReminderTestEmailView(APIView):
    """Email di prova agli indirizzi dell'ufficio dei promemoria dei contratti."""

    permission_classes = PERMS

    def post(self, request):
        to = office_emails()
        if not to:
            return Response({"detail": "Imposta prima gli indirizzi dell'ufficio."}, status=status.HTTP_400_BAD_REQUEST)
        ok, err = send_templated_email(
            template_name="emails/contract_reminder_test.html",
            context={},
            subject="Prova dei promemoria dei contratti",
            recipient_list=to,
        )
        if not ok:
            return Response({"detail": f"Invio non riuscito: {err}"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"sent_to": to})
