from __future__ import annotations

from django.contrib.auth import get_user_model, update_session_auth_hash
from django.conf import settings
from django.db import transaction

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from audit.utils import log_event
from core.models import UserProfile
from crm.models import Customer


def _validate_avatar_upload(uploaded_file):
    """Validazione pratica per l'upload dell'avatar.

    - dimensione massima (bytes)
    - content-type consentiti
    - verifica che sia un'immagine valida
    - limite dimensioni massime in pixel

    Non effettua resize: valida soltanto.
    """

    if uploaded_file is None:
        return None

    max_bytes = getattr(settings, "PROFILE_AVATAR_MAX_BYTES", 2 * 1024 * 1024)
    max_dim = getattr(settings, "PROFILE_AVATAR_MAX_DIM", 1024)
    allowed_ct = set(
        getattr(
            settings,
            "PROFILE_AVATAR_ALLOWED_CONTENT_TYPES",
            ["image/jpeg", "image/png", "image/webp"],
        )
    )

    try:
        size = int(getattr(uploaded_file, "size", 0) or 0)
    except Exception:
        size = 0

    if max_bytes and size and size > int(max_bytes):
        return f"File troppo grande. Max {int(max_bytes) // (1024 * 1024)} MB."

    content_type = (getattr(uploaded_file, "content_type", "") or "").lower()
    if allowed_ct and content_type and content_type not in allowed_ct:
        return "Formato non supportato. Usa JPG, PNG o WEBP."

    # Verifica immagine (Pillow) e dimensioni.
    try:
        from PIL import Image

        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
        img.verify()

        uploaded_file.seek(0)
        img2 = Image.open(uploaded_file)
        w, h = img2.size
        if max_dim and (w > int(max_dim) or h > int(max_dim)):
            return f"Immagine troppo grande. Dimensione massima {int(max_dim)}x{int(max_dim)} px."
    except Exception:
        return "File immagine non valido o corrotto."
    finally:
        try:
            uploaded_file.seek(0)
        except Exception:
            pass

    return None

User = get_user_model()


class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def _get_profile(self, user):
        """Restituisce il profilo con select_related per evitare query N+1."""
        try:
            return UserProfile.objects.select_related("preferred_customer").get(user=user)
        except UserProfile.DoesNotExist:
            return None

    def _serialize(self, user, request):
        # _get_profile usa select_related: preferred_customer.name non fa query aggiuntiva
        profile = self._get_profile(user)

        avatar_url = None
        preferred_customer_id = None
        preferred_customer_name = None

        if profile is not None:
            if profile.avatar:
                # DRF returns relative URLs; keep relative (works behind nginx /api)
                try:
                    avatar_url = profile.avatar.url
                except Exception:
                    avatar_url = None

            if profile.preferred_customer_id:
                preferred_customer_id = profile.preferred_customer_id
                # preferred_customer già in JOIN grazie a select_related: nessuna query extra
                try:
                    preferred_customer_name = profile.preferred_customer.name
                except Exception:
                    preferred_customer_name = None

        data = {
            "id": user.id,
            "username": user.get_username(),
            "email": user.email or "",
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "is_staff": bool(user.is_staff),
            "is_superuser": bool(user.is_superuser),
            "groups": list(user.groups.values_list("name", flat=True)),
            "permissions": sorted(list(user.get_all_permissions())),
            "profile": {
                "avatar": avatar_url,
                "preferred_customer": preferred_customer_id,
                "preferred_customer_name": preferred_customer_name,
            },
        }
        return data

    def get(self, request):
        return Response(self._serialize(request.user, request), status=status.HTTP_200_OK)

    @transaction.atomic
    def patch(self, request):
        user = request.user
        data = request.data

        # user fields
        if "email" in data:
            user.email = data.get("email") or ""
        if "first_name" in data:
            user.first_name = data.get("first_name") or ""
        if "last_name" in data:
            user.last_name = data.get("last_name") or ""
        user.save()

        profile, _ = UserProfile.objects.select_related("preferred_customer").get_or_create(user=user)

        # preferred customer: allow null/empty to clear
        if "preferred_customer" in data:
            raw = data.get("preferred_customer")
            if raw in ("", None):
                profile.preferred_customer = None
            else:
                try:
                    cid = int(raw)
                except Exception:
                    return Response(
                        {"preferred_customer": "Valore non valido."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    cust = Customer.objects.get(id=cid, deleted_at__isnull=True)
                except Customer.DoesNotExist:
                    return Response(
                        {"preferred_customer": "Customer non valido o eliminato."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                profile.preferred_customer = cust

        # avatar: multipart file or allow empty string to clear
        if "avatar" in data:
            raw = data.get("avatar")
            if raw in ("", None):
                profile.avatar = None
            else:
                err = _validate_avatar_upload(raw)
                if err:
                    return Response({"avatar": err}, status=status.HTTP_400_BAD_REQUEST)
                profile.avatar = raw

        profile.save()

        return Response(self._serialize(user, request), status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """POST /api/me/change-password/

    Body (JSON):
        old_password      – password corrente (richiesta per conferma)
        new_password      – nuova password
        new_password2     – conferma nuova password

    Regole di validazione:
    - old_password deve corrispondere alla password attuale
    - new_password != old_password
    - new_password == new_password2
    - new_password deve avere almeno 8 caratteri

    Dopo il cambio la sessione viene aggiornata automaticamente
    (update_session_auth_hash) così l'utente non viene disconnesso.
    L'evento viene tracciato nell'audit log.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        data = request.data

        old_password = data.get("old_password") or ""
        new_password = data.get("new_password") or ""
        new_password2 = data.get("new_password2") or ""

        errors = {}

        # Verifica password attuale
        if not old_password:
            errors["old_password"] = "La password attuale è obbligatoria."
        elif not user.check_password(old_password):
            errors["old_password"] = "La password attuale non è corretta."

        # Validazione nuova password
        if not new_password:
            errors["new_password"] = "La nuova password è obbligatoria."
        elif len(new_password) < 8:
            errors["new_password"] = "La nuova password deve avere almeno 8 caratteri."
        elif new_password == old_password:
            errors["new_password"] = "La nuova password deve essere diversa da quella attuale."

        # Conferma
        if new_password and not new_password2:
            errors["new_password2"] = "Conferma la nuova password."
        elif new_password and new_password2 and new_password != new_password2:
            errors["new_password2"] = "Le password non coincidono."

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # Aggiorna la password e mantieni la sessione attiva
        user.set_password(new_password)
        user.save(update_fields=["password"])
        update_session_auth_hash(request, user)

        # Traccia nell'audit (senza loggare le password)
        try:
            log_event(
                actor=user,
                action="update",
                instance=user,
                changes={"password": {"from": "***", "to": "***"}},
                request=request,
            )
        except Exception:
            pass  # non bloccare la risposta per un errore di audit

        return Response({"detail": "Password aggiornata con successo."}, status=status.HTTP_200_OK)
