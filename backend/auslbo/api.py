from __future__ import annotations

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from auslbo.permissions import IsAuslBoUser, _can_edit_auslbo
from core.models import UserProfile


def _get_avatar_url(user):
    """Restituisce l'URL dell'avatar del profilo utente, o None."""
    try:
        profile = UserProfile.objects.get(user=user)
        if profile.avatar:
            return profile.avatar.url
    except UserProfile.DoesNotExist:
        pass
    return None


class AuslBoMeView(APIView):
    """GET /api/auslbo/me/

    Restituisce le informazioni sull'utente AUSL BO autenticato e il suo
    customer associato. Usato dal frontend AUSL BO come primo endpoint
    dopo il login per inizializzare il contesto.

    Risposta:
    {
        "user": { "id", "username", "email", "first_name", "last_name" },
        "customer": { "id", "name", "display_name", "code" },
        "auslbo": {
            "is_active": true,
            "can_edit_devices": true,
            "permissions": ["device.add_device", ...]  // tutti i permessi Django dell'utente
        }
    }
    """

    permission_classes = [IsAuslBoUser]

    def get(self, request):
        user = request.user
        profile = user.auslbo_profile
        customer = profile.customer

        data = {
            "user": {
                "id": user.id,
                "username": user.get_username(),
                "email": user.email or "",
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "avatar": _get_avatar_url(user),
            },
            "customer": {
                "id": customer.id,
                "name": customer.name,
                "display_name": customer.display_name or customer.name,
                "code": customer.code or "",
            },
            "auslbo": {
                "is_active": profile.is_active,
                "can_edit_devices": _can_edit_auslbo(user),
                "permissions": sorted(user.get_all_permissions()),
            },
        }
        return Response(data, status=status.HTTP_200_OK)


class AuslBoConfigView(APIView):
    """GET /api/auslbo/config/

    Endpoint pubblico (no auth) che il frontend AUSL BO chiama prima del
    login per sapere se il backend è raggiungibile e ottenere la lista
    degli ambiti disponibili per il select del login.

    Non espone dati sensibili.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        data = {
            "ambiti": [
                {
                    "value": "site-repo",
                    "label": "Site-Repository",
                    "description": "Gestionale interno — accesso completo",
                },
                {
                    "value": "auslbo",
                    "label": "AUSL Bologna",
                    "description": "Portale clienti — accesso limitato al proprio ente",
                },
            ]
        }
        return Response(data, status=status.HTTP_200_OK)
