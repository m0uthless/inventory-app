"""attendance/api.py — API Piano Ferie / assenze.

Perimetro permessi indipendente da ServiceNow:
  • Roster del Piano Ferie = utenti attivi con profilo NON Philips
    (is_philips=False) e NON account funzionale (is_functional_account=False):
    un account di servizio Biotron (es. cdd.biotron) non è una persona e non
    deve avere righe di ferie/assenze proprie.
  • Dipendente in roster: crea/modifica/elimina SOLO le proprie righe, solo
    `reason=ferie` e solo in stato `proposta` (non può validare).
  • Coordinatore (`profile.is_leave_coordinator` o superuser): valida/rifiuta e
    inserisce qualsiasi attività (training/104/malattia/…) per chiunque.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response
import uuid

from core.mixins import RestoreActionMixin, SoftDeleteAuditMixin
from audit.utils import log_event, to_change_value_for_field
from portal.permissions import IsInternalOrPortalDedicatedApp

from .models import Absence, AbsenceReason, AbsenceStatus, DayPart, Holiday, LeaveArea

User = get_user_model()


# ─── Helpers permessi / roster ───────────────────────────────────────────────

def _profile(user):
    return getattr(user, "profile", None)


def is_leave_coordinator(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    # Superuser e staff (privilegi Django) possono validare/modificare chiunque.
    if user.is_superuser or user.is_staff:
        return True
    prof = _profile(user)
    return bool(prof and getattr(prof, "is_leave_coordinator", False))


def in_leave_plan(user) -> bool:
    """Roster Piano Ferie: utenti attivi NON Philips e NON account
    funzionale, esclusi i superuser (account tecnici/root, es. l'utente
    amministrativo di sistema)."""
    if not user or not user.is_authenticated or not user.is_active or user.is_superuser:
        return False
    prof = _profile(user)
    if prof is None:
        return False
    return not getattr(prof, "is_philips", False) and not getattr(prof, "is_functional_account", False)


def _user_name(u) -> str:
    return f"{u.first_name} {u.last_name}".strip() or u.username


# ─── LeaveArea (sola lettura, gestita da admin) ──────────────────────────────

class LeaveAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveArea
        fields = ["id", "key", "label", "sort_order"]


class LeaveAreaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LeaveAreaSerializer
    pagination_class = None

    def get_queryset(self):
        return LeaveArea.objects.filter(deleted_at__isnull=True, is_active=True).order_by("sort_order", "label")


# ─── Holiday (sola lettura) ───────────────────────────────────────────────────

class HolidaySerializer(serializers.ModelSerializer):
    area_ids = serializers.PrimaryKeyRelatedField(source="areas", many=True, read_only=True)

    class Meta:
        model = Holiday
        fields = ["id", "date", "label", "area_ids"]


class HolidayViewSet(viewsets.ReadOnlyModelViewSet):
    """Festività per un anno (`?year=2026`). `area_ids` vuoto = vale per
    tutte le aree; altrimenti vale solo per le aree elencate."""
    serializer_class = HolidaySerializer
    pagination_class = None

    def get_queryset(self):
        qs = (
            Holiday.objects.filter(deleted_at__isnull=True)
            .prefetch_related("areas")
            .order_by("date")
        )
        year = self.request.query_params.get("year")
        if year:
            qs = qs.filter(date__year=year)
        return qs


# ─── Absence ──────────────────────────────────────────────────────────────────

class AbsenceSerializer(serializers.ModelSerializer):
    user_name         = serializers.SerializerMethodField()
    reason_label      = serializers.CharField(source="get_reason_display", read_only=True)
    status_label      = serializers.CharField(source="get_status_display", read_only=True)
    day_part_label    = serializers.CharField(source="get_day_part_display", read_only=True)
    is_hourly         = serializers.BooleanField(read_only=True)
    validated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Absence
        fields = [
            "id", "user", "user_name", "date", "day_part", "day_part_label",
            "reason", "reason_label", "status", "status_label", "note",
            "time_from", "time_to", "is_hourly", "request_group",
            "validated_by", "validated_by_name", "validated_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "user_name", "reason_label", "status_label", "day_part_label",
            "is_hourly", "request_group", "validated_by", "validated_by_name", "validated_at",
            "created_at", "updated_at",
        ]

    def get_user_name(self, obj):
        return _user_name(obj.user)

    def get_validated_by_name(self, obj):
        return _user_name(obj.validated_by) if obj.validated_by_id else None

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        coord = is_leave_coordinator(actor)

        # Coppia oraria coerente
        tf = attrs.get("time_from", getattr(self.instance, "time_from", None))
        tt = attrs.get("time_to",   getattr(self.instance, "time_to", None))
        if (tf is None) != (tt is None):
            raise serializers.ValidationError(
                "Indicare sia l'ora di inizio sia l'ora di fine, oppure nessuna."
            )
        if tf and tt and tt <= tf:
            raise serializers.ValidationError({"time_to": "L'ora di fine deve essere successiva all'ora di inizio."})

        if not coord:
            # Il dipendente può solo proporre ferie sulle proprie righe.
            target_user = attrs.get("user", getattr(self.instance, "user", None))
            if target_user is None:
                attrs["user"] = actor
            elif target_user != actor:
                raise serializers.ValidationError("Puoi gestire solo le tue righe.")
            reason = attrs.get("reason", getattr(self.instance, "reason", AbsenceReason.FERIE))
            if reason != AbsenceReason.FERIE:
                raise serializers.ValidationError({"reason": "Puoi inserire solo proposte di ferie."})
            status = attrs.get("status", getattr(self.instance, "status", AbsenceStatus.PROPOSTA))
            if status != AbsenceStatus.PROPOSTA:
                raise serializers.ValidationError({"status": "Non hai i permessi per validare/rifiutare."})
            attrs["reason"] = AbsenceReason.FERIE
            attrs["status"] = AbsenceStatus.PROPOSTA
        return attrs


class AbsencePermission(BasePermission):
    """Lettura per utenti in roster o coordinatori; scrittura consentita
    (dettagli — proprietà riga, reason, transizioni di stato — applicati dal
    serializer e da has_object_permission)."""

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return is_leave_coordinator(user) or in_leave_plan(user)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if request.method in SAFE_METHODS:
            return True
        if is_leave_coordinator(user):
            return True
        # Non-coordinatore: solo proprie righe, ancora in stato proposta di ferie.
        return (
            obj.user_id == user.id
            and obj.status == AbsenceStatus.PROPOSTA
            and obj.reason == AbsenceReason.FERIE
        )


class AbsenceViewSet(SoftDeleteAuditMixin, RestoreActionMixin, viewsets.ModelViewSet):
    """CRUD delle voci del Piano Ferie (mezza giornata). Soft-delete + audit.

    Filtri query: `user`, `area` (LeaveArea id), `date_from`/`date_to`
    (sovrapposizione), `year`+`month`, `reason`, `status`.
    """

    serializer_class   = AbsenceSerializer
    # 0.9.1 (WP-03): permission_classes esplicite -> estese qui.
    permission_classes = [AbsencePermission, IsInternalOrPortalDedicatedApp]
    http_method_names  = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class   = None
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["user", "reason", "status", "day_part"]

    def get_queryset(self):
        qs = (
            Absence.objects
            .filter(deleted_at__isnull=True)
            .select_related("user", "user__profile", "validated_by")
            .order_by("date", "day_part")
        )
        p = self.request.query_params
        if p.get("date_from"):
            qs = qs.filter(date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(date__lte=p["date_to"])
        year, month = p.get("year"), p.get("month")
        if year:
            qs = qs.filter(date__year=year)
        if month:
            qs = qs.filter(date__month=month)
        if p.get("area"):
            qs = qs.filter(user__profile__leave_area_id=p["area"])
        return qs

    # ── Transizioni di stato (validazione) ───────────────────────────────────

    def _status_kwargs(self, validated_data, instance):
        """validated_by/at impostati quando il coordinatore valida/rifiuta."""
        new_status = validated_data.get("status")
        if new_status in (AbsenceStatus.VALIDATA, AbsenceStatus.RIFIUTATA):
            return {"validated_by": self.request.user, "validated_at": timezone.now()}
        if new_status == AbsenceStatus.PROPOSTA and instance is not None:
            return {"validated_by": None, "validated_at": None}
        return {}

    def perform_create(self, serializer):
        extra = self._status_kwargs(serializer.validated_data, instance=None)
        # Ogni creazione singola (una cella cliccata) è la propria "richiesta":
        # riceve un request_group dedicato, distinto da qualunque trascinamento
        # multi-giorno, cosa che nel pannello coordinatore la mantiene come
        # voce separata invece di essere raggruppata con altre proposte.
        instance = serializer.save(
            created_by=self.request.user, updated_by=self.request.user,
            request_group=uuid.uuid4(), **extra,
        )
        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(actor=self.request.user, action="create", instance=instance,
                  changes=changes, request=self.request)

    def perform_update(self, serializer):
        instance_before = serializer.instance
        changes = self._changes_from_validated(instance_before, serializer.validated_data)
        extra = self._status_kwargs(serializer.validated_data, instance=instance_before)
        instance = serializer.save(updated_by=self.request.user, **extra)
        log_event(actor=self.request.user, action="update", instance=instance,
                  changes=changes or None, request=self.request)

    @action(detail=True, methods=["post"], url_path="validate")
    def validate_entry(self, request, pk=None):
        obj = self.get_object()
        if not is_leave_coordinator(request.user):
            return Response({"detail": "Permesso negato."}, status=403)
        obj.status = AbsenceStatus.VALIDATA
        obj.validated_by = request.user
        obj.validated_at = timezone.now()
        obj.updated_by = request.user
        obj.save(update_fields=["status", "validated_by", "validated_at", "updated_by", "updated_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject_entry(self, request, pk=None):
        obj = self.get_object()
        if not is_leave_coordinator(request.user):
            return Response({"detail": "Permesso negato."}, status=403)
        obj.status = AbsenceStatus.RIFIUTATA
        obj.validated_by = request.user
        obj.validated_at = timezone.now()
        obj.updated_by = request.user
        obj.save(update_fields=["status", "validated_by", "validated_at", "updated_by", "updated_at"])
        return Response(self.get_serializer(obj).data)

    def _resolve_group(self, request, new_status):
        """Applica `new_status` a tutte le righe in stato 'proposta' che
        condividono lo stesso `request_group` (una selezione = un click).
        Usato da validate-group/reject-group."""
        if not is_leave_coordinator(request.user):
            return Response({"detail": "Permesso negato."}, status=403)
        group = request.data.get("request_group")
        if not group:
            return Response({"detail": "Parametro 'request_group' mancante."}, status=400)
        qs = Absence.objects.filter(
            request_group=group, status=AbsenceStatus.PROPOSTA, deleted_at__isnull=True,
        )
        now = timezone.now()
        updated_ids = []
        for obj in qs:
            obj.status = new_status
            obj.validated_by = request.user
            obj.validated_at = now
            obj.updated_by = request.user
            obj.save(update_fields=["status", "validated_by", "validated_at", "updated_by", "updated_at"])
            log_event(actor=request.user, action="update", instance=obj, request=request)
            updated_ids.append(obj.id)
        return Response({"updated": len(updated_ids), "ids": updated_ids})

    @action(detail=False, methods=["post"], url_path="validate-group")
    def validate_group(self, request):
        return self._resolve_group(request, AbsenceStatus.VALIDATA)

    @action(detail=False, methods=["post"], url_path="reject-group")
    def reject_group(self, request):
        return self._resolve_group(request, AbsenceStatus.RIFIUTATA)

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """Applica lo stesso motivo/stato a più giorni (selezione multipla).

        Body: {user, day_part, dates: [iso, ...], action: "set"|"clear",
               reason?, status?, note?}. `day_part` accetta anche "entrambe"
               (giornata intera: applica sia MATTINA sia POMERIGGIO per ogni
               data). Rispetta gli stessi permessi del create: il dipendente
               può solo proporre ferie sulle proprie righe.
        """
        data = request.data
        try:
            user_id = int(data["user"])
            day_part = data["day_part"]
            dates = list(data.get("dates") or [])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "Parametri mancanti (user, day_part, dates)."}, status=400)
        if day_part == "entrambe":
            day_parts = [DayPart.MATTINA, DayPart.POMERIGGIO]
        elif day_part in (DayPart.MATTINA, DayPart.POMERIGGIO):
            day_parts = [day_part]
        else:
            return Response({"detail": "Fascia non valida."}, status=400)
        if not dates:
            return Response({"detail": "Nessun giorno selezionato."}, status=400)

        coord = is_leave_coordinator(request.user)
        mode = data.get("action", "set")
        note = (data.get("note") or "")[:255]

        if coord:
            target_user_id = user_id
            reason = data.get("reason", AbsenceReason.FERIE)
            status_val = data.get("status", AbsenceStatus.VALIDATA)
        else:
            if user_id != request.user.id:
                return Response({"detail": "Puoi gestire solo le tue righe."}, status=403)
            target_user_id = request.user.id
            reason = AbsenceReason.FERIE
            status_val = AbsenceStatus.PROPOSTA

        if reason not in AbsenceReason.values:
            return Response({"detail": "Motivo non valido."}, status=400)
        if status_val not in AbsenceStatus.values:
            return Response({"detail": "Stato non valido."}, status=400)

        def _employee_can_touch(obj):
            return (obj.user_id == request.user.id
                    and obj.status == AbsenceStatus.PROPOSTA
                    and obj.reason == AbsenceReason.FERIE)

        # Un'unica selezione (click o trascinamento) = un'unica "richiesta":
        # tutte le righe toccate da questa chiamata condividono lo stesso
        # request_group, cosa che nel pannello coordinatore le presenta come
        # UNA voce validabile/rifiutabile con un solo click. Due selezioni
        # distinte (anche su giorni contigui) restano invece separate perché
        # generano due chiamate bulk diverse con due group id diversi.
        group_id = uuid.uuid4()

        created = updated = cleared = skipped = 0
        for d in dates:
            for dp in day_parts:
                existing = Absence.objects.filter(
                    user_id=target_user_id, date=d, day_part=dp, deleted_at__isnull=True,
                ).first()

                if mode == "clear":
                    if existing and (coord or _employee_can_touch(existing)):
                        existing.deleted_at = timezone.now()
                        existing.updated_by = request.user
                        existing.save(update_fields=["deleted_at", "updated_by", "updated_at"])
                        log_event(actor=request.user, action="delete", instance=existing, request=request)
                        cleared += 1
                    elif existing:
                        skipped += 1
                    continue

                val_kwargs = (
                    {"validated_by": request.user, "validated_at": timezone.now()}
                    if status_val in (AbsenceStatus.VALIDATA, AbsenceStatus.RIFIUTATA)
                    else {"validated_by": None, "validated_at": None}
                )
                if existing:
                    if not coord and not _employee_can_touch(existing):
                        skipped += 1
                        continue
                    existing.reason = reason
                    existing.status = status_val
                    existing.note = note
                    existing.request_group = group_id
                    existing.updated_by = request.user
                    for k, v in val_kwargs.items():
                        setattr(existing, k, v)
                    existing.save()
                    log_event(actor=request.user, action="update", instance=existing, request=request)
                    updated += 1
                else:
                    obj = Absence.objects.create(
                        user_id=target_user_id, date=d, day_part=dp,
                        reason=reason, status=status_val, note=note,
                        request_group=group_id,
                        created_by=request.user, updated_by=request.user, **val_kwargs,
                    )
                    log_event(actor=request.user, action="create", instance=obj, request=request)
                    created += 1

        return Response({"created": created, "updated": updated, "cleared": cleared, "skipped": skipped})

    @action(detail=False, methods=["get"], url_path="roster")
    def roster(self, request):
        """Righe del Piano Ferie: utenti attivi NON Philips (esclusi i
        superuser, es. account root/amministrativi) e NON account funzionali
        (es. cdd.biotron: sono utenti di servizio Biotron, non persone reali,
        vedi profile.is_functional_account), con area.
        Include `can_edit_all` (coordinatore o staff/superuser, per i
        permessi di modifica) e `is_full_access` (solo staff/superuser, per
        distinguere il coordinatore "puro" — che vede le statistiche solo
        della propria area — da chi deve vederle su tutte le aree)."""
        users = (
            User.objects.select_related("profile", "profile__leave_area")
            .filter(is_active=True, is_superuser=False)
            .order_by("first_name", "last_name", "username")
        )
        rows = []
        current_user_area_id = None
        current_prof = _profile(request.user)
        if current_prof is not None:
            current_area = getattr(current_prof, "leave_area", None)
            current_user_area_id = current_area.id if current_area else None
        for u in users:
            prof = getattr(u, "profile", None)
            if prof is None or getattr(prof, "is_philips", False):
                continue
            if getattr(prof, "is_functional_account", False):
                continue
            area = getattr(prof, "leave_area", None)
            rows.append({
                "id": u.id,
                "name": _user_name(u),
                "area_id": area.id if area else None,
                "area_label": area.label if area else None,
                "area_sort": area.sort_order if area else 9999,
            })
        rows.sort(key=lambda r: (r["area_sort"], r["area_label"] or "", r["name"]))
        return Response({
            "can_edit_all": is_leave_coordinator(request.user),
            "is_full_access": bool(request.user.is_staff or request.user.is_superuser),
            "current_user_id": request.user.id,
            "current_user_area_id": current_user_area_id,
            "rows": rows,
        })
