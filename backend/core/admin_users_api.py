"""core/admin_users_api.py — Pannello "Utenti e Gruppi" (core.manage_users).

Espone:
- GET  /api/admin/permission-modules/         elenco moduli + permessi extra disponibili
- GET  /api/admin-users/                      lista utenti (con permessi effettivi)
- POST /api/admin-users/                      crea un nuovo utente
- GET  /api/admin-users/{id}/                 dettaglio utente
- PATCH/PUT /api/admin-users/{id}/            aggiorna anagrafica, gruppi, permessi diretti, profilo
- DELETE /api/admin-users/{id}/               elimina l'utente (bloccato per i superuser)
- POST /api/admin-users/{id}/reset-password/  genera nuova password casuale (one-shot, mostrata all'admin)
- POST /api/admin-users/{id}/reset-permissions-to-group/  azzera i permessi diretti dell'utente
- GET  /api/admin-groups/                     lista gruppi (con permessi)
- POST /api/admin-groups/                     crea un nuovo gruppo
- GET  /api/admin-groups/{id}/                dettaglio gruppo
- PATCH/PUT /api/admin-groups/{id}/           rinomina gruppo, aggiorna permessi RWD/extra
- DELETE /api/admin-groups/{id}/              elimina il gruppo

Nota sui permessi diretti utente: sono ADDITIVI rispetto al gruppo (limite nativo
di Django, vedi permission_modules.py). "reset-permissions-to-group" azzera
`user.user_permissions`, riportando l'utente a ereditare solo dai suoi gruppi.

Nota sull'eliminazione utenti: è un DELETE reale (User/Group non hanno soft-delete).
Un superuser non può mai essere eliminato da questo pannello (va prima retrocesso da
Django Admin), e nessuno può eliminare il proprio account. Alcuni moduli (es. ServiceNow)
proteggono l'utente con `on_delete=PROTECT` finché ha ticket assegnati: in quel caso la
delete fallisce con un errore 400 leggibile invece di un 500.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.db.models.deletion import ProtectedError
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

# Livelli del menu a tendina "Accesso Portal" nel drawer utente. Stessa scala
# usata per la matrice permessi (None/Read/Read+Write/Read+Write+Delete),
# applicata qui al modulo "portal" (che rappresenta l'accesso al portal).
PORTAL_ACCESS_LEVELS: dict[str, dict[str, bool]] = {
    "none": {"r": False, "w": False, "d": False},
    "read": {"r": True, "w": False, "d": False},
    "read_write": {"r": True, "w": True, "d": False},
    "full": {"r": True, "w": True, "d": True},
}


def _portal_profile_qs():
    """Subquery per annotare se l'utente ha accesso al Portal.

    Import lazy (dentro la funzione) per evitare dipendenze a livello di
    modulo tra le app `core` e `portal` durante il caricamento di Django.
    Accesso Portal = esiste un PortalUserProfile per l'utente (vedi
    portal/permissions.py::_is_portal_user, stessa unica condizione).
    """
    from portal.models import PortalUserProfile

    return PortalUserProfile.objects.filter(user_id=OuterRef("pk"))


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
            "is_functional_account",
            "is_leave_coordinator",
            "leave_area",
            "leave_area_name",
            "is_expense_secretary",
            "birth_date",
            "gender",
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
    has_portal_access = serializers.BooleanField(read_only=True)
    portal_profile = serializers.SerializerMethodField()

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
            "has_portal_access",
            "portal_profile",
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

    def get_portal_profile(self, obj):
        # getattr con default: se il reverse OneToOne non esiste, Django
        # solleva RelatedObjectDoesNotExist (sottoclasse anche di AttributeError,
        # quindi getattr(..., None) la intercetta correttamente).
        profile = getattr(obj, "portal_profile", None)
        if profile is None:
            return None
        return {
            "customer_id": profile.customer_id,
            "customer_name": str(profile.customer),
            "is_active": profile.is_active,
            # 0.9.0 punto 6: tutti i clienti assegnati (multi-select nel drawer).
            "customers": [
                {"id": c.id, "name": str(c)} for c in profile.customers.all().order_by("name")
            ],
        }


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
    portal_access = serializers.DictField(required=False)


class UserAdminCreateSerializer(serializers.Serializer):
    """Payload di creazione utente. Riusa gli stessi campi "annidati"
    (gruppi/permessi/profilo/portal) di `UserAdminWriteSerializer`, applicati
    tramite `_apply_write` subito dopo la creazione della riga `User`."""

    username = serializers.CharField(max_length=150)
    password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False, default=True)
    group_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    module_permissions = serializers.DictField(required=False)
    extra_permission_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    profile = serializers.DictField(required=False)
    # {"level": "none"|"read"|"read_write"|"full", "customer_id": int|null}
    portal_access = serializers.DictField(required=False)

    def validate_username(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Lo username è obbligatorio.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username già in uso.")
        return value

    def validate_password(self, value: str) -> str:
        if not value:
            return value
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class UserAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Gestione utenti: lista/dettaglio/modifica + creazione ed eliminazione."""

    queryset = User.objects.all()  # sovrascritto da get_queryset()
    serializer_class = UserAdminSerializer
    permission_classes = [IsAuthenticated, HasManageUsersPermission]
    pagination_class = None

    def get_queryset(self):
        return (
            User.objects.all()
            .select_related("profile", "profile__leave_area", "portal_profile", "portal_profile__customer")
            .prefetch_related("groups", "user_permissions", "portal_profile__customers")
            .annotate(has_portal_access=Exists(_portal_profile_qs()))
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
        # Archie/Portal. Enforced qui (non solo lato UI) così una chiamata
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
                "portal_access": {"level": "none"},
            }

        if "group_ids" in data:
            groups = Group.objects.filter(id__in=data["group_ids"])
            user.groups.set(groups)
            changed_fields.append("groups")

        module_permissions = dict(data.get("module_permissions") or {})

        if "portal_access" in data:
            access = data.get("portal_access") or {}
            level = access.get("level") or "none"
            if level not in PORTAL_ACCESS_LEVELS:
                raise serializers.ValidationError({"portal_access": "Livello non valido."})
            customer_id = access.get("customer_id")
            # 0.9.0 punto 6: customer_ids = TUTTI i clienti assegnati (multi-select).
            # Retrocompatibilità: se il client non lo manda ancora (drawer non
            # aggiornato), si comporta come prima — un solo cliente assegnato,
            # coincidente col default.
            customer_ids = access.get("customer_ids")
            if customer_ids is None:
                customer_ids = [customer_id] if customer_id else []

            from portal.models import PortalUserProfile

            if level == "none":
                PortalUserProfile.objects.filter(user=user).delete()
            else:
                if not customer_id:
                    raise serializers.ValidationError(
                        {"portal_access": "Seleziona un cliente di default per abilitare l'accesso Portal."}
                    )
                from crm.models import Customer

                valid_ids = set(
                    Customer.objects.filter(pk__in=[*customer_ids, customer_id]).values_list("id", flat=True)
                )
                if customer_id not in valid_ids:
                    raise serializers.ValidationError({"portal_access": "Cliente di default non trovato."})
                invalid_ids = set(customer_ids) - valid_ids
                if invalid_ids:
                    raise serializers.ValidationError({"portal_access": "Uno o più clienti assegnati non esistono."})

                profile, _ = PortalUserProfile.objects.update_or_create(
                    user=user, defaults={"customer_id": customer_id}
                )
                # Il default deve SEMPRE far parte degli assegnati, altrimenti
                # il profilo nascerebbe già bloccato (is_active=False).
                profile.customers.set({*customer_ids, customer_id})

            # Il livello scelto vale anche come RWD del modulo "portal": ha
            # priorità su un eventuale module_permissions["portal"] inviato
            # dal client (nel drawer il modulo "portal" non è editabile come
            # riga separata, è rappresentato solo da questo controllo).
            module_permissions["portal"] = PORTAL_ACCESS_LEVELS[level]
            changed_fields.append("portal_access")

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
                "is_functional_account",
                "is_leave_coordinator",
                "is_expense_secretary",
            ):
                if field in profile_data:
                    setattr(profile, field, profile_data[field])

            # `leave_area` è una FK (attendance.LeaveArea): il client manda solo
            # l'id grezzo (o null), non un'istanza. Un `setattr` diretto come per
            # i booleani sopra fa fallire Django con un ValueError non gestito
            # ("Cannot assign ...: must be a LeaveArea instance") -> 500.
            # Si assegna via `leave_area_id`, pattern standard per FK by pk, con
            # validazione esplicita così un id inesistente/non valido torna un
            # 400 pulito invece di rompere a metà request.
            if "leave_area" in profile_data:
                raw_value = profile_data["leave_area"]
                if raw_value in (None, "", 0, "0"):
                    profile.leave_area = None
                else:
                    try:
                        leave_area_id = int(raw_value)
                    except (TypeError, ValueError):
                        raise serializers.ValidationError(
                            {"profile": {"leave_area": "Area non valida."}}
                        )
                    from attendance.models import LeaveArea

                    if not LeaveArea.objects.filter(pk=leave_area_id).exists():
                        raise serializers.ValidationError(
                            {"profile": {"leave_area": "Area non trovata."}}
                        )
                    profile.leave_area_id = leave_area_id

            # `birth_date` è un DateField: un campo vuoto dal client arriva come
            # stringa vuota, non None, e farebbe fallire il parsing di Django.
            # Normalizzato esplicitamente, stesso trattamento riservato sopra
            # a `leave_area` per i valori "assenti".
            if "birth_date" in profile_data:
                raw_value = profile_data["birth_date"]
                profile.birth_date = raw_value if raw_value else None

            # `gender` è un CharField con choices ('M'/'F'): stesso trattamento
            # di `birth_date` per il valore "assente" (stringa vuota dal client),
            # con validazione esplicita sui soli valori ammessi.
            if "gender" in profile_data:
                raw_value = profile_data["gender"]
                if raw_value in (None, ""):
                    profile.gender = None
                elif raw_value in (UserProfile.Gender.MALE, UserProfile.Gender.FEMALE):
                    profile.gender = raw_value
                else:
                    raise serializers.ValidationError(
                        {"profile": {"gender": "Valore non valido."}}
                    )

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

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        in_serializer = UserAdminCreateSerializer(data=request.data)
        in_serializer.is_valid(raise_exception=True)
        data = dict(in_serializer.validated_data)

        username = data.pop("username")
        password = data.pop("password", "") or get_random_string(
            length=14,
            allowed_chars="abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%",
        )
        generated_password = not bool(in_serializer.validated_data.get("password"))

        # is_staff/is_superuser non sono creabili da qui (stessa logica di
        # _apply_write): un nuovo utente nasce sempre non-staff/non-superuser.
        user = User(username=username)
        user.set_password(password)
        user.save()

        changed_fields = self._apply_write(user, data, request.user)
        changed_fields.insert(0, "created")

        log_event(
            actor=request.user,
            action="create",
            instance=user,
            changes={"fields": changed_fields},
            request=request,
            subject=f"Gestione utenti: creato {user.username}",
        )

        user.refresh_from_db()
        out_serializer = self.get_serializer(user)
        payload = dict(out_serializer.data)
        payload["generated_password"] = password if generated_password else None
        return Response(payload, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.is_superuser:
            raise serializers.ValidationError(
                {"detail": "Non è possibile eliminare un superuser da questo pannello."}
            )
        if instance.pk == request.user.pk:
            raise serializers.ValidationError(
                {"detail": "Non puoi eliminare il tuo stesso account."}
            )

        username = instance.username
        user_id = instance.pk

        log_event(
            actor=request.user,
            action="delete",
            instance=instance,
            request=request,
            subject=f"Gestione utenti: eliminato {username}",
        )

        try:
            instance.delete()
        except ProtectedError:
            # Rollback anche del log_event sopra: la transazione atomica
            # dell'intera request viene annullata dall'eccezione.
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Impossibile eliminare l'utente: esistono record collegati che lo "
                        "impediscono (es. ticket ServiceNow assegnati). Riassegna quei record "
                        "oppure disattiva l'utente invece di eliminarlo."
                    )
                }
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

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


class GroupAdminCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    module_permissions = serializers.DictField(required=False)
    extra_permission_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Il nome del gruppo è obbligatorio.")
        if Group.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("Esiste già un gruppo con questo nome.")
        return value


class GroupAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Gestione gruppi: lista/dettaglio/modifica + creazione ed eliminazione."""

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

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        in_serializer = GroupAdminCreateSerializer(data=request.data)
        in_serializer.is_valid(raise_exception=True)
        data = in_serializer.validated_data

        group = Group.objects.create(name=data["name"])

        ids = compute_permission_ids(
            data.get("module_permissions") or {},
            data.get("extra_permission_ids"),
        )
        if ids:
            group.permissions.set(ids)

        log_event(
            actor=request.user,
            action="create",
            instance=group,
            changes={"fields": ["created", "permissions"]},
            request=request,
            subject=f"Gestione gruppi: creato {group.name}",
        )

        out_serializer = self.get_serializer(group)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name

        log_event(
            actor=request.user,
            action="delete",
            instance=instance,
            request=request,
            subject=f"Gestione gruppi: eliminato {name}",
        )

        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
