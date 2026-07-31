from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model

from attendance.models import LeaveArea
from audit.utils import log_event, to_change_value_for_field, to_primitive

from core.models import (
    AreaTask, Announcement, ChangelogEntry, CustomerStatus, SiteStatus, InventoryStatus,
    InventoryType, UserProfile, UserTask, DashboardWidget, UserDashboardLayout,
)

User = get_user_model()


# ─── Users (read-only, per dropdown assegnazione) ────────────────────────────

class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    is_philips = serializers.SerializerMethodField()
    is_servicenow_technician = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_is_philips(self, obj):
        try:
            return obj.profile.is_philips
        except Exception:
            return False

    def get_is_servicenow_technician(self, obj):
        try:
            return obj.profile.is_servicenow_technician
        except Exception:
            return True

    class Meta:
        model  = User
        fields = ["id", "username", "first_name", "last_name", "full_name", "is_active", "is_philips", "is_servicenow_technician"]


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserListSerializer
    pagination_class = None

    def get_queryset(self):
        return User.objects.select_related("profile").filter(is_active=True).order_by("first_name", "last_name", "username")


class CustomerStatusLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerStatus
        fields = ["id", "key", "label", "sort_order", "is_active"]


class SiteStatusLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteStatus
        fields = ["id", "key", "label", "sort_order", "is_active"]


class InventoryStatusLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryStatus
        fields = ["id", "key", "label", "sort_order", "is_active"]


class InventoryTypeLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryType
        fields = ["id", "key", "label", "sort_order", "is_active", "is_hw"]


class InventoryStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventoryStatusLookupSerializer
    pagination_class = None  # <-- restituisce una LISTA, non paginata

    def get_queryset(self):
        return InventoryStatus.objects.filter(is_active=True, deleted_at__isnull=True).order_by("sort_order", "label")


class InventoryTypeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventoryTypeLookupSerializer
    pagination_class = None
    filter_backends  = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["is_active", "is_hw"]
    ordering_fields  = ["sort_order", "label"]
    ordering         = ["sort_order", "label"]

    def get_queryset(self):
        return InventoryType.objects.filter(is_active=True, deleted_at__isnull=True).order_by("sort_order", "label")


class CustomerStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CustomerStatusLookupSerializer
    pagination_class = None

    def get_queryset(self):
        return CustomerStatus.objects.filter(is_active=True, deleted_at__isnull=True).order_by("sort_order", "label")


class SiteStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SiteStatusLookupSerializer
    pagination_class = None

    def get_queryset(self):
        return SiteStatus.objects.filter(is_active=True, deleted_at__isnull=True).order_by("sort_order", "label")


# ─── Announcements ────────────────────────────────────────────────────────────

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = Announcement
        fields = [
            'id', 'title', 'body', 'category',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        u = obj.created_by
        if not u:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username


class IsStaffOrReadOnly(BasePermission):
    """Lettura: tutti gli autenticati. Scrittura: superuser o permesso core.access_archie."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        if getattr(request.user, "is_superuser", False):
            return True
        return request.user.has_perm("core.access_archie")


class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    CRUD comunicazioni bacheca.
    Lettura: tutti gli utenti autenticati.
    Scrittura: solo gruppo admin o superuser.
    """
    queryset           = Announcement.objects.select_related('created_by').all()
    serializer_class   = AnnouncementSerializer
    permission_classes = [IsAuthenticated, IsStaffOrReadOnly]
    ordering           = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# ─── Changelog ─────────────────────────────────────────────────────────────────
#
# Modal obbligatorio (con checkbox di conferma) mostrato al login se esistono
# voci non ancora viste dall'utente + voce "Changelog" nel menu utente per
# rileggerle in qualsiasi momento. Il contenuto è Markdown, renderizzato lato
# client (nessun HTML salvato/eseguito lato server).
#
# Tracking "letto/non letto": UserProfile.last_seen_changelog punta alla voce
# più recente (per id di inserimento) confermata dall'utente. "Più recente" è
# sempre calcolato per id (non per `date`, che è editabile e può essere
# retrodatata inserendo voci storiche) così l'ordine di comparsa del modal
# segue l'ordine reale di pubblicazione.

class ChangelogEntrySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ChangelogEntry
        fields = [
            'id', 'version', 'title', 'body', 'date',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        u = obj.created_by
        if not u:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username


class ChangelogEntryViewSet(viewsets.ModelViewSet):
    """
    CRUD voci di changelog.
    Lettura: tutti gli utenti autenticati. Scrittura: staff/superuser (vedi
    IsStaffOrReadOnly, stesso criterio usato per le Announcements).
    """
    queryset           = ChangelogEntry.objects.select_related('created_by').all()
    serializer_class   = ChangelogEntrySerializer
    permission_classes = [IsAuthenticated, IsStaffOrReadOnly]
    ordering           = ['-date', '-id']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ChangelogUnseenView(APIView):
    """
    GET /api/changelog/unseen/
    Voci non ancora confermate dall'utente loggato (per il modal al login).

    - Se l'utente non ha mai confermato nulla: solo l'ultima voce inserita
      (evita di sommergere un utente nuovo con l'intero storico).
    - Altrimenti: tutte le voci inserite dopo l'ultima confermata, in ordine
      cronologico di rilascio (le più vecchie per prime), fino a 10.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        latest = ChangelogEntry.objects.order_by('-id').first()
        if latest is None:
            return Response({'entries': [], 'latest_id': None})

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        last_seen_id = profile.last_seen_changelog_id

        if last_seen_id is None:
            qs = ChangelogEntry.objects.filter(id=latest.id)
        elif last_seen_id < latest.id:
            qs = ChangelogEntry.objects.filter(id__gt=last_seen_id).order_by('date', 'id')[:10]
        else:
            qs = ChangelogEntry.objects.none()

        entries = ChangelogEntrySerializer(qs, many=True).data
        return Response({'entries': entries, 'latest_id': latest.id})


class ChangelogDismissView(APIView):
    """
    POST /api/changelog/dismiss/
    Segna come letto il changelog fino all'ultima voce esistente (calcolata
    lato server, ignorando qualsiasi id passato dal client).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        latest = ChangelogEntry.objects.order_by('-id').first()
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        profile.last_seen_changelog = latest
        profile.save(update_fields=['last_seen_changelog'])
        return Response({'latest_id': latest.id if latest else None}, status=status.HTTP_200_OK)


# ─── UserTask ─────────────────────────────────────────────────────────────────

class UserTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model  = UserTask
        fields = ['id', 'text', 'done', 'created_at', 'done_at']
        read_only_fields = ['id', 'created_at']


class UserTaskViewSet(viewsets.ModelViewSet):
    """
    Task personali dell'utente loggato.
    Ogni utente vede e gestisce solo i propri task.
    """
    serializer_class   = UserTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserTask.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        done = serializer.validated_data.get('done', instance.done)
        done_at = timezone.now() if done and not instance.done else (None if not done else instance.done_at)
        serializer.save(done_at=done_at)


# ─── AreaTask ───────────────────────────────────────────────────────────────
# Task specifici per area organizzativa (dashboard). L'area è la stessa già
# usata per il Piano Ferie (`attendance.LeaveArea`, vedi `UserProfile.leave_area`):
# ogni utente appartiene a una sola area, riusata qui per evitare di
# duplicare il concetto con un modello "gruppo" separato.

class AreaTaskSerializer(serializers.ModelSerializer):
    # Scrivibile (necessario per permettere ai superuser di creare un task
    # in un'area diversa dalla propria): la validazione di CHI può
    # effettivamente scegliere l'area è nella view (perform_create), non qui.
    area = serializers.PrimaryKeyRelatedField(
        queryset=LeaveArea.objects.filter(deleted_at__isnull=True, is_active=True),
        required=False,
    )
    area_label      = serializers.CharField(source='area.label', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    can_edit        = serializers.SerializerMethodField()

    class Meta:
        model  = AreaTask
        fields = [
            'id', 'area', 'area_label', 'title', 'description', 'status',
            'due_date', 'created_by', 'created_by_name', 'created_at',
            'updated_at', 'completed_at', 'can_edit',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'completed_at']

    def get_created_by_name(self, obj):
        if not obj.created_by_id:
            return None
        u = obj.created_by
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        user = request.user
        if getattr(user, 'is_superuser', False):
            return True
        user_area_id = getattr(getattr(user, 'profile', None), 'leave_area_id', None)
        return user_area_id is not None and user_area_id == obj.area_id


class AreaTaskViewSet(viewsets.ModelViewSet):
    """
    Task di area per la dashboard. Lettura: tutte le aree, a chiunque sia
    autenticato (sola lettura sulle aree diverse dalla propria). Scrittura
    (create/update/delete): solo sui task della propria area
    (`request.user.profile.leave_area`).

    I task completati da più di `AreaTask.HIDE_COMPLETED_AFTER_DAYS` giorni
    sono esclusi dalla lista di default (restano in DB, non cancellati) —
    passare `?include_hidden=1` per vederli comunque.

    Soft-delete + audit: l'eliminazione è un soft-delete (`deleted_at`,
    stesso pattern di `SoftDeleteAuditMixin` — vedi `core/mixins.py`) e ogni
    create/update/delete viene registrato in `AuditEvent`. Per ora non c'è
    un ripristino esposto in UI: serve come salvaguardia/audit trail.
    """
    serializer_class   = AreaTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = AreaTask.objects.select_related('area', 'created_by').filter(deleted_at__isnull=True)
        area_param = self.request.query_params.get('area')
        if area_param:
            qs = qs.filter(area_id=area_param)
        if self.request.query_params.get('include_hidden') != '1':
            hide_before = timezone.now() - timedelta(days=AreaTask.HIDE_COMPLETED_AFTER_DAYS)
            qs = qs.exclude(status=AreaTask.STATUS_COMPLETATO, completed_at__lt=hide_before)
        return qs

    @staticmethod
    def _changes_from_validated(instance, validated: dict) -> dict:
        """Stesso schema di `SoftDeleteAuditMixin._changes_from_validated`
        (core/mixins.py), non riusabile direttamente qui perché la viewset
        ha una logica di permessi/campi troppo specifica per il mixin
        generico — vedi `_check_own_area` e la gestione di `completed_at`."""
        changes = {}
        for k, v in (validated or {}).items():
            before_raw = getattr(instance, k, None)
            after_raw = v
            if to_primitive(before_raw) != to_primitive(after_raw):
                changes[k] = {
                    "from": to_change_value_for_field(k, before_raw),
                    "to":   to_change_value_for_field(k, after_raw),
                }
        return changes

    @staticmethod
    def _user_area_id(user):
        return getattr(getattr(user, 'profile', None), 'leave_area_id', None)

    def _check_own_area(self, area_id):
        """I superuser possono sempre gestire task di qualunque area; per
        tutti gli altri l'area deve coincidere con quella del proprio
        profilo (`UserProfile.leave_area`)."""
        user = self.request.user
        if getattr(user, 'is_superuser', False):
            return area_id
        user_area_id = self._user_area_id(user)
        if user_area_id is None or area_id != user_area_id:
            raise PermissionDenied(
                "Puoi creare o modificare solo i task della tua area. "
                "Se non hai un'area assegnata, contatta un amministratore."
            )
        return user_area_id

    def perform_create(self, serializer):
        user = self.request.user
        user_area_id = self._user_area_id(user)

        if getattr(user, 'is_superuser', False):
            # Il superuser può creare in una qualunque area: usa quella
            # inviata dal client (il selettore area del widget), con
            # fallback alla propria se non specificata.
            chosen_area = serializer.validated_data.get('area')
            area_id = chosen_area.id if chosen_area is not None else user_area_id
            if not area_id:
                raise PermissionDenied(
                    "Specifica un'area: il tuo profilo non ne ha una assegnata."
                )
            instance = serializer.save(created_by=user, updated_by=user, area_id=area_id)
        else:
            # Utenti normali: sempre e solo la propria area, a prescindere
            # da cosa venga eventualmente inviato dal client.
            if not user_area_id:
                raise PermissionDenied(
                    "Nessuna area assegnata al tuo profilo: contatta un amministratore."
                )
            instance = serializer.save(created_by=user, updated_by=user, area_id=user_area_id)

        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(
            actor=user, action="create", instance=instance,
            changes=changes, request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        self._check_own_area(instance.area_id)
        changes = self._changes_from_validated(instance, serializer.validated_data)

        new_status = serializer.validated_data.get('status', instance.status)
        if new_status == AreaTask.STATUS_COMPLETATO and instance.status != AreaTask.STATUS_COMPLETATO:
            completed_at = timezone.now()
        elif new_status != AreaTask.STATUS_COMPLETATO:
            completed_at = None
        else:
            completed_at = instance.completed_at

        # L'area di un task non si cambia mai in modifica (nemmeno per il
        # superuser): resta quella di creazione, a prescindere da cosa
        # venga eventualmente inviato dal client.
        saved = serializer.save(
            completed_at=completed_at, area_id=instance.area_id, updated_by=self.request.user,
        )
        log_event(
            actor=self.request.user, action="update", instance=saved,
            changes=changes or None, request=self.request,
        )

    def perform_destroy(self, instance):
        self._check_own_area(instance.area_id)
        before = instance.deleted_at
        instance.deleted_at = timezone.now()
        instance.updated_by = self.request.user
        instance.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
        log_event(
            actor=self.request.user, action="delete", instance=instance,
            changes={
                "deleted_at": {
                    "from": to_change_value_for_field("deleted_at", before),
                    "to":   to_change_value_for_field("deleted_at", instance.deleted_at),
                }
            },
            request=self.request,
        )

    @action(detail=False, methods=['get'])
    def due(self, request):
        """
        Task della propria area, non completati, con scadenza entro domani
        (inclusa) o già scaduta. Usati dalla campanella "Scadenze" in header.
        """
        user_area_id = self._user_area_id(request.user)
        if not user_area_id:
            return Response([])
        tomorrow = timezone.localdate() + timedelta(days=1)
        qs = (
            AreaTask.objects
            .filter(area_id=user_area_id, due_date__isnull=False, due_date__lte=tomorrow, deleted_at__isnull=True)
            .exclude(status=AreaTask.STATUS_COMPLETATO)
            .select_related('area')
            .order_by('due_date')
        )
        return Response(AreaTaskSerializer(qs, many=True, context={'request': request}).data)


# ─── Dashboard dinamica ───────────────────────────────────────────────────────
# Catalogo widget (sola lettura) + layout personalizzato per utente.
# Il frontend salva l'intero layout in un colpo solo via l'azione `bulk`
# (POST /dashboard-layout/bulk/), non riga per riga: evita N richieste dopo
# ogni drag/resize e permette una validazione server-side coerente in un
#'unica transazione.

class DashboardWidgetSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DashboardWidget
        fields = ['id', 'key', 'label', 'allowed_sizes', 'default_w', 'default_h', 'sort_order']


class DashboardWidgetViewSet(viewsets.ReadOnlyModelViewSet):
    """Catalogo dei widget disponibili (statico, non editabile da UI)."""
    serializer_class   = DashboardWidgetSerializer
    permission_classes = [IsAuthenticated]
    queryset            = DashboardWidget.objects.filter(is_active=True).order_by('sort_order', 'id')


class UserDashboardLayoutSerializer(serializers.ModelSerializer):
    widget_key = serializers.CharField(source='widget.key', read_only=True)

    class Meta:
        model  = UserDashboardLayout
        fields = ['id', 'widget', 'widget_key', 'x', 'y', 'w', 'h', 'visible', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class DashboardLayoutBulkItemSerializer(serializers.Serializer):
    """Un singolo item nel payload di `bulk`: identifica il widget per `key`
    (stabile, coincide col catalogo) invece che per id numerico, per
    semplicità lato frontend (WIDGET_REGISTRY è keyed per `key`)."""
    widget_key = serializers.CharField(max_length=64)
    x          = serializers.IntegerField(min_value=0)
    y          = serializers.IntegerField(min_value=0)
    w          = serializers.IntegerField(min_value=1)
    h          = serializers.IntegerField(min_value=1)
    visible    = serializers.BooleanField(required=False, default=True)


class UserDashboardLayoutViewSet(viewsets.ModelViewSet):
    """Layout dashboard personale dell'utente loggato.

    Il CRUD standard resta disponibile (utile per debug/admin), ma il
    frontend usa esclusivamente l'azione `bulk` per salvare l'intero layout
    dopo ogni modifica in modalità "Personalizza".
    """
    serializer_class   = UserDashboardLayoutSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            UserDashboardLayout.objects
            .filter(user=self.request.user)
            .select_related('widget')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'])
    def bulk(self, request):
        """Sostituisce l'intero layout dell'utente con quello inviato.

        Valida ogni item contro `allowed_sizes` del widget corrispondente nel
        catalogo (difesa in profondità: lo snap ai formati ammessi avviene
        già lato frontend durante il drag, ma il backend non si fida di
        coppie w/h arbitrarie in arrivo). `allowed_sizes` è una lista di
        coppie [w, h] esplicite, non due assi indipendenti: alcuni widget
        (es. il meteo) ammettono combinazioni specifiche non cartesiane.
        """
        items_serializer = DashboardLayoutBulkItemSerializer(data=request.data, many=True)
        items_serializer.is_valid(raise_exception=True)
        items = items_serializer.validated_data

        widget_keys = [it['widget_key'] for it in items]
        widgets_by_key = {
            w.key: w for w in DashboardWidget.objects.filter(key__in=widget_keys, is_active=True)
        }

        errors = []
        for it in items:
            widget = widgets_by_key.get(it['widget_key'])
            if widget is None:
                errors.append(f"Widget sconosciuto: {it['widget_key']}")
                continue
            if widget.allowed_sizes and [it['w'], it['h']] not in widget.allowed_sizes:
                errors.append(
                    f"{widget.key}: formato {it['w']}x{it['h']} non ammesso "
                    f"(formati validi: {widget.allowed_sizes})"
                )
        if errors:
            return Response({'detail': errors}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for it in items:
                widget = widgets_by_key[it['widget_key']]
                UserDashboardLayout.objects.update_or_create(
                    user=request.user,
                    widget=widget,
                    defaults={
                        'x': it['x'], 'y': it['y'], 'w': it['w'], 'h': it['h'],
                        'visible': it['visible'],
                    },
                )

        qs = self.get_queryset()
        return Response(UserDashboardLayoutSerializer(qs, many=True).data)
