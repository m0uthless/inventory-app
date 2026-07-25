"""core/admin_users_api.py — Pannello "Utenti e Gruppi" (core.manage_users).

Espone:
- GET  /api/admin/permission-modules/         elenco moduli + permessi extra disponibili
- GET  /api/admin-users/                      lista utenti (con permessi effettivi)
- GET  /api/admin-users/{id}/                 dettaglio utente
- PATCH/PUT /api/admin-users/{id}/            aggiorna anagrafica, gruppi, permessi diretti, profilo
- POST /api/admin-users/{id}/reset-password/  genera nuova password casuale (one-shot, mostrata all'admin)
- POST /api/admin-users/{id}/reset-permissions-to-group/  azzera i permessi diretti dell'utente
- GET  /api/admin-groups/                     lista gruppi (con permessi)
- GET  /api/admin-groups/{id}/                dettaglio gruppo
- PATCH/PUT /api/admin-groups/{id}/           rinomina gruppo, aggiorna permessi RWD/extra

Solo gestione di utenti/gruppi ESISTENTI: niente create/delete (per ora).

Nota sui permessi diretti utente: sono ADDITIVI rispetto al gruppo (limite nativo
di Django, vedi permission_modules.py). "reset-permissions-to-group" azzera
`user.user_permissions`, riportando l'utente a ereditare solo dai suoi gruppi.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils.crypto import get_random_string

from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.utils import log_event
from core.models import UserProfile
from core.permissions import HasManageUsersPermission
from core.permission_modules import (
    MODULE_LABELS,
    compute_permission_ids,
    get_permission_modules,
    serialize_permission_state,
)

logger = logging.getLogger(__name__)

User = get_user_model()

# Livelli del menu a tendina "Accesso AUSL BO" nel drawer utente. Stessa scala
# usata per la matrice permessi (None/Read/Read+Write/Read+Write+Delete),
# applicata qui al modulo "auslbo" (che rappresenta l'accesso al portal).
AUSLBO_ACCESS_LEVELS: dict[str, dict[str, bool]] = {
    "none": {"r": False, "w": False, "d": False},
    "read": {"r": True, "w": False, "d": False},
    "read_write": {"r": True, "w": True, "d": False},
    "full": {"r": True, "w": True, "d": True},
}


def _auslbo_profile_qs():
    """Subquery per annotare se l'utente ha accesso al portal AUSL BO.

    Import lazy (dentro la funzione) per evitare dipendenze a livello di
    modulo tra le app `core` e `auslbo` durante il caricamento di Django.
    Accesso AUSL BO = esiste un AuslBoUserProfile per l'utente (vedi
    auslbo/permissions.py::_is_auslbo_user, stessa unica condizione).
    """
    from auslbo.models import AuslBoUserProfile

    return AuslBoUserProfile.objects.filter(user_id=OuterRef("pk"))


# ─────────────────────────────────────────────────────────────────────────────
# Permission modules (read-only, metadata per costruire la UI)
# ─────────────────────────────────────────────────────────────────────────────

class PermissionModulesView(APIView):
    permission_classes = [IsAuthenticated, HasManageUsersPermission]

    def get(self, request):
        return Response(get_permission_modules(), status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Profilo (sotto-oggetto di User)
# ─────────────────────────────────────────────────────────────────────────────

class UserAdminProfileSerializer(serializers.ModelSerializer):
    leave_area_name = serializers.CharField(source="leave_area.label", read_only=True, default=None)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "avatar",
            "is_philips",
            "is_servicenow_technician",
            "is_leave_coordinator",
            "leave_area",
            "leave_area_name",
            "is_expense_secretary",
        ]

    def get_avatar(self, obj):
        # Stesso pattern di core/me_api.py: URL relativo (funziona dietro nginx /api).
        if not obj.avatar:
            return None
        try:
            return obj.avatar.url
        except Exception:
            return None


# ─────────────────────────────────────────────────────────────────────────────
# Utenti
# ─────────────────────────────────────────────────────────────────────────────

class UserAdminSerializer(serializers.ModelSerializer):
    profile = UserAdminProfileSerializer(read_only=True)
    groups = serializers.SerializerMethodField()
    group_permissions = serializers.SerializerMethodField()
    direct_permissions = serializers.SerializerMethodField()
    has_auslbo_access = serializers.BooleanField(read_only=True)
    auslbo_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
            "groups",
            "group_permissions",
            "direct_permissions",
            "has_auslbo_access",
            "auslbo_profile",
            "profile",
        ]
        read_only_fields = ["username", "date_joined", "last_login"]

    def get_groups(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.groups.all()]

    def get_group_permissions(self, obj):
        # Unione dei permessi di TUTTI i gruppi dell'utente (per mostrare
        # in UI cosa è già concesso "da gruppo", a prescindere dai diretti).
        perms = Permission.objects.filter(group__user=obj).distinct()
        return serialize_permission_state(perms)

    def get_direct_permissions(self, obj):
        return serialize_permission_state(obj.user_permissions.all())

    def get_auslbo_profile(self, obj):
        # getattr con default: se il reverse OneToOne non esiste, Django
        # solleva RelatedObjectDoesNotExist (sottoclasse anche di AttributeError,
        # quindi getattr(..., None) la intercetta correttamente).
        profile = getattr(obj, "auslbo_profile", None)
        if profile is None:
            return None
        return {"customer_id": profile.customer_id, "customer_name": str(profile.customer)}


class UserAdminWriteSerializer(serializers.Serializer):
    """Serializer "libero" per il payload di scrittura (non 1:1 col model,
    perché include gruppi/permessi/profilo come strutture annidate)."""

    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    is_staff = serializers.BooleanField(required=False)
    is_superuser = serializers.BooleanField(required=False)
    group_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    module_permissions = serializers.DictField(required=False)
    extra_permission_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    profile = serializers.DictField(required=False)
    # {"level": "none"|"read"|"read_write"|"full", "customer_id": int|null}
    auslbo_access = serializers.DictField(required=False)


class UserAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Gestione utenti (SOLO lettura + modifica: niente create/delete per ora)."""

    queryset = User.objects.all()  # sovrascritto da get_queryset()
    serializer_class = UserAdminSerializer
    permission_classes = [IsAuthenticated, HasManageUsersPermission]
    pagination_class = None

    def get_queryset(self):
        return (
            User.objects.all()
            .select_related("profile", "profile__leave_area", "auslbo_profile", "auslbo_profile__customer")
            .prefetch_related("groups", "user_permissions")
            .annotate(has_auslbo_access=Exists(_auslbo_profile_qs()))
            .order_by("username")
        )

    def _apply_write(self, user: User, data: dict, requester) -> list[str]:
        """Applica il payload di scrittura validato. Ritorna la lista dei
        campi utente modificati (per l'audit log)."""
        changed_fields: list[str] = []

        for field in ("first_name", "last_name", "email", "is_active"):
            if field in data:
                setattr(user, field, data[field])
                changed_fields.append(field)

        # is_staff / is_superuser: solo un superuser può concederli o toglierli,
        # per evitare che un utente con il solo permesso core.manage_users
        # possa auto-promuoversi (o promuovere altri) a superuser.
        for field in ("is_staff", "is_superuser"):
            if field in data:
                if not getattr(requester, "is_superuser", False):
                    raise serializers.ValidationError(
                        {field: "Solo un superuser può modificare questo campo."}
                    )
                setattr(user, field, data[field])
                changed_fields.append(field)

        user.save()

        # ── Profilo Philips: profilo "circoscritto" all'app ServiceNow ──────
        # Un utente Philips è automaticamente tecnico ServiceNow, non può
        # essere coordinatore ferie né segreteria rimborsi spese, non ha area
        # ferie, non appartiene a nessun gruppo e non ha permessi sui moduli
        # Archie/AUSL BO. Enforced qui (non solo lato UI) così una chiamata
        # diretta all'API non può aggirare il vincolo.
        incoming_profile = dict(data.get("profile") or {})
        if "is_philips" in incoming_profile:
            is_philips = bool(incoming_profile["is_philips"])
        else:
            is_philips = UserProfile.objects.filter(user=user).values_list("is_philips", flat=True).first() or False

        if is_philips:
            incoming_profile["is_servicenow_technician"] = True
            incoming_profile["is_leave_coordinator"] = False
            incoming_profile["is_expense_secretary"] = False
            incoming_profile["leave_area"] = None
            data = {
                **data,
                "profile": incoming_profile,
                "group_ids": [],
                "module_permissions": {},
                "extra_permission_ids": [],
                "auslbo_access": {"level": "none"},
            }

        if "group_ids" in data:
            groups = Group.objects.filter(id__in=data["group_ids"])
            user.groups.set(groups)
            changed_fields.append("groups")

        module_permissions = dict(data.get("module_permissions") or {})

        if "auslbo_access" in data:
            access = data.get("auslbo_access") or {}
            level = access.get("level") or "none"
            if level not in AUSLBO_ACCESS_LEVELS:
                raise serializers.ValidationError({"auslbo_access": "Livello non valido."})
            customer_id = access.get("customer_id")

            from auslbo.models import AuslBoUserProfile

            if level == "none":
                AuslBoUserProfile.objects.filter(user=user).delete()
            else:
                if not customer_id:
                    raise serializers.ValidationError(
                        {"auslbo_access": "Seleziona un cliente per abilitare l'accesso AUSL BO."}
                    )
                from crm.models import Customer

                if not Customer.objects.filter(pk=customer_id).exists():
                    raise serializers.ValidationError({"auslbo_access": "Cliente non trovato."})
                AuslBoUserProfile.objects.update_or_create(user=user, defaults={"customer_id": customer_id})

            # Il livello scelto vale anche come RWD del modulo "auslbo": ha
            # priorità su un eventuale module_permissions["auslbo"] inviato
            # dal client (nel drawer il modulo "auslbo" non è editabile come
            # riga separata, è rappresentato solo da questo controllo).
            module_permissions["auslbo"] = AUSLBO_ACCESS_LEVELS[level]
            changed_fields.append("auslbo_access")

        if module_permissions or "extra_permission_ids" in data:
            ids = compute_permission_ids(
                module_permissions,
                data.get("extra_permission_ids"),
            )
            user.user_permissions.set(ids)
            changed_fields.append("direct_permissions")

        if "profile" in data:
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile_data = data["profile"] or {}
            for field in (
                "is_philips",
                "is_servicenow_technician",
                "is_leave_coordinator",
                "leave_area",
                "is_expense_secretary",
            ):
                if field in profile_data:
                    setattr(profile, field, profile_data[field])
            profile.save()
            changed_fields.append("profile")

        return changed_fields

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        in_serializer = UserAdminWriteSerializer(data=request.data, partial=partial)
        in_serializer.is_valid(raise_exception=True)

        changed_fields = self._apply_write(instance, in_serializer.validated_data, request.user)

        log_event(
            actor=request.user,
            action="update",
            instance=instance,
            changes={"fields": changed_fields},
            request=request,
            subject=f"Gestione utenti: modificato {instance.username}",
        )

        instance.refresh_from_db()
        out_serializer = self.get_serializer(instance)
        return Response(out_serializer.data)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = get_random_string(
            length=14,
            allowed_chars="abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%",
        )
        user.set_password(new_password)
        user.save(update_fields=["password"])

        email_sent = False
        email_error = None
        if user.email:
            try:
                send_mail(
                    subject="ARCHIE — Password reimpostata",
                    message=(
                        f"Ciao {user.first_name or user.username},\n\n"
                        f"La tua password ARCHIE è stata reimpostata da un amministratore.\n"
                        f"Nuova password temporanea: {new_password}\n\n"
                        f"Ti consigliamo di cambiarla al primo accesso."
                    ),
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None) or "archie@biotron.it",
                    recipient_list=[user.email],
                    fail_silently=False,
                )
                email_sent = True
            except Exception as exc:  # SMTP non ancora configurato: non bloccare il reset
                email_error = str(exc)
                logger.warning("Invio email reset password fallito per %s: %s", user.username, exc)

        log_event(
            actor=request.user,
            action="update",
            instance=user,
            changes={"password": {"from": "***", "to": "***"}},
            request=request,
            subject=f"Gestione utenti: reset password per {user.username}",
        )

        return Response(
            {
                "password": new_password,
                "email_sent": email_sent,
                "email_error": None if email_sent else email_error,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="reset-permissions-to-group")
    def reset_permissions_to_group(self, request, pk=None):
        user = self.get_object()
        user.user_permissions.clear()

        log_event(
            actor=request.user,
            action="update",
            instance=user,
            changes={"direct_permissions": {"from": "custom", "to": "reset (eredita solo dal gruppo)"}},
            request=request,
            subject=f"Gestione utenti: reset permessi a default gruppo per {user.username}",
        )

        serializer = self.get_serializer(user)
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
# Gruppi
# ─────────────────────────────────────────────────────────────────────────────

class GroupAdminSerializer(serializers.ModelSerializer):
    permissions_state = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ["id", "name", "user_count", "permissions_state"]

    def get_permissions_state(self, obj):
        return serialize_permission_state(obj.permissions.all())

    def get_user_count(self, obj):
        return obj.user_set.count()


class GroupAdminWriteSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    module_permissions = serializers.DictField(required=False)
    extra_permission_ids = serializers.ListField(child=serializers.IntegerField(), required=False)


class GroupAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Gestione gruppi (SOLO lettura + modifica: niente create/delete per ora)."""

    queryset = Group.objects.all().prefetch_related("permissions").order_by("name")
    serializer_class = GroupAdminSerializer
    permission_classes = [IsAuthenticated, HasManageUsersPermission]
    pagination_class = None

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        in_serializer = GroupAdminWriteSerializer(data=request.data, partial=partial)
        in_serializer.is_valid(raise_exception=True)
        data = in_serializer.validated_data

        changed_fields = []
        if "name" in data:
            instance.name = data["name"]
            instance.save(update_fields=["name"])
            changed_fields.append("name")

        if "module_permissions" in data or "extra_permission_ids" in data:
            ids = compute_permission_ids(
                data.get("module_permissions") or {},
                data.get("extra_permission_ids"),
            )
            instance.permissions.set(ids)
            changed_fields.append("permissions")

        log_event(
            actor=request.user,
            action="update",
            instance=instance,
            changes={"fields": changed_fields},
            request=request,
            subject=f"Gestione gruppi: modificato {instance.name}",
        )

        out_serializer = self.get_serializer(instance)
        return Response(out_serializer.data)
