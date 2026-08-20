from __future__ import annotations

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from portal.permissions import (
    IsPortalUser, HasPortalProfile, _can_edit_portal, _get_portal_customer_id, SESSION_ACTIVE_CUSTOMER_KEY,
)
from core.models import UserProfile


def _serialize_customer(customer):
    return {
        "id": customer.id,
        "name": customer.name,
        "display_name": customer.display_name or customer.name,
        "code": customer.code or "",
    }


def _get_avatar_url(user):
    """Restituisce l'URL dell'avatar del profilo utente, o None."""
    try:
        profile = UserProfile.objects.get(user=user)
        if profile.avatar:
            return profile.avatar.url
    except UserProfile.DoesNotExist:
        pass
    return None


class PortalMeView(APIView):
    """GET /api/portal/me/

    Restituisce le informazioni sull'utente Portal autenticato, il cliente
    ATTIVO (risolto da sessione, con fallback self-healing sul default) e
    la lista di tutti i clienti assegnati (0.9.0: multi-cliente — usata dal
    frontend per popolare il dropdown in topbar, mostrato solo se >1).
    Usato dal frontend Portal come primo endpoint dopo il login per
    inizializzare il contesto.

    Se il profilo esiste ma è bloccato (is_active=False — il cliente di
    default non è più tra quelli assegnati, o è stato disattivato) risponde
    403 con un messaggio esplicito invece di lasciar passare dati stantii:
    nessun fallback automatico su un altro cliente assegnato, per decisione
    esplicita (punto 4 roadmap 0.9.0).

    Risposta (profilo attivo):
    {
        "user": { "id", "username", "email", "first_name", "last_name" },
        "customer": { "id", "name", "display_name", "code" },  // cliente ATTIVO
        "customers": [{ "id", "name", "display_name", "code" }, ...],  // tutti gli assegnati
        "portal": {
            "is_active": true,
            "can_edit_devices": true,
            "permissions": ["device.add_device", ...]  // tutti i permessi Django dell'utente
        }
    }
    """

    permission_classes = [HasPortalProfile]

    def get(self, request):
        user = request.user
        profile = user.portal_profile

        if not profile.is_active:
            return Response(
                {
                    "detail": (
                        "Il tuo accesso al portale è sospeso: il cliente di riferimento "
                        "non è più assegnato al tuo profilo. Contatta un amministratore "
                        "per farti riassegnare un cliente."
                    ),
                    "blocked": True,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        active_customer_id = _get_portal_customer_id(request)
        active_customer = next(
            (c for c in profile.customers.all() if c.id == active_customer_id),
            profile.customer,
        )

        data = {
            "user": {
                "id": user.id,
                "username": user.get_username(),
                "email": user.email or "",
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "avatar": _get_avatar_url(user),
            },
            "customer": _serialize_customer(active_customer),
            "customers": [_serialize_customer(c) for c in profile.customers.all().order_by("name")],
            "portal": {
                "is_active": profile.is_active,
                "can_edit_devices": _can_edit_portal(user),
                "permissions": sorted(user.get_all_permissions()),
            },
        }
        return Response(data, status=status.HTTP_200_OK)


class PortalSwitchCustomerView(APIView):
    """POST /api/portal/switch-customer/  {"customer_id": <int>}

    Cambia il cliente ATTIVO dell'utente portale per la sessione corrente.
    Valida che il cliente richiesto sia tra quelli assegnati all'utente
    (mai fidarsi del client oltre la validazione): se non lo è, 400.
    La scelta viene tenuta in sessione server-side (mai in localStorage/
    header — stesso principio di PortalScopedMixin).
    """

    permission_classes = [IsPortalUser]

    def post(self, request):
        customer_id = request.data.get("customer_id")
        if customer_id is None:
            return Response({"detail": "customer_id mancante."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer_id = int(customer_id)
        except (TypeError, ValueError):
            return Response({"detail": "customer_id non valido."}, status=status.HTTP_400_BAD_REQUEST)

        profile = request.user.portal_profile
        allowed_ids = set(profile.customers.values_list("id", flat=True))
        if customer_id not in allowed_ids:
            return Response(
                {"detail": "Questo cliente non è assegnato al tuo profilo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.session[SESSION_ACTIVE_CUSTOMER_KEY] = customer_id
        customer = next(c for c in profile.customers.all() if c.id == customer_id)
        return Response({"customer": _serialize_customer(customer)}, status=status.HTTP_200_OK)


class PortalConfigView(APIView):
    """GET /api/portal/config/

    Endpoint pubblico (no auth) che il frontend Portal chiama prima del
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
                    "value": "portal",
                    "label": "Portale Clienti",
                    "description": "Portale clienti — accesso limitato al proprio ente",
                },
            ]
        }
        return Response(data, status=status.HTTP_200_OK)
