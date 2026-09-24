from datetime import timedelta

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
import django_filters as filters
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model

from attendance.models import LeaveArea
from audit.utils import log_event, to_change_value_for_field
from drive.access import filter_accessible_files, has_file_access
from drive.models import DriveFile
from core.mixins import RestoreActionMixin, SoftDeleteAuditMixin
from core.soft_delete import TRUTHY, apply_soft_delete_filters
from portal.permissions import IsInternalOrPortalDedicatedApp

from core.models import (
    AreaTask, AreaTaskComment, Announcement, ChangelogEntry, CustomerStatus, SiteStatus, InventoryStatus,
    InventoryType, UserProfile, UserTask, DashboardWidget, UserDashboardLayout, StickyNote,
    DefaultDashboardLayout,
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
    permission_classes = [IsAuthenticated, IsStaffOrReadOnly, IsInternalOrPortalDedicatedApp]
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
    permission_classes = [IsAuthenticated, IsStaffOrReadOnly, IsInternalOrPortalDedicatedApp]
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
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp]

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
    area_label       = serializers.CharField(source='area.label', read_only=True)
    created_by_name  = serializers.SerializerMethodField()
    assigned_to      = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        allow_null=True, required=False,
    )
    assigned_to_name = serializers.SerializerMethodField()
    comments_count   = serializers.SerializerMethodField()
    drive_files = serializers.PrimaryKeyRelatedField(
        queryset=DriveFile.objects.filter(deleted_at__isnull=True),
        many=True, required=False, write_only=True,
    )
    drive_files_detail = serializers.SerializerMethodField()
    can_edit         = serializers.SerializerMethodField()

    class Meta:
        model  = AreaTask
        fields = [
            'id', 'area', 'area_label', 'title', 'description', 'status',
            'priority', 'due_date', 'assigned_to', 'assigned_to_name',
            'drive_files', 'drive_files_detail',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'completed_at', 'comments_count', 'can_edit',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'completed_at']

    @staticmethod
    def _display_name(user):
        return f"{user.first_name} {user.last_name}".strip() or user.username

    def get_created_by_name(self, obj):
        return self._display_name(obj.created_by) if obj.created_by_id else None

    def get_assigned_to_name(self, obj):
        return self._display_name(obj.assigned_to) if obj.assigned_to_id else None

    def get_comments_count(self, obj):
        annotated = getattr(obj, 'comments_count', None)
        return annotated if annotated is not None else obj.comments.count()

    def _request_user(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return user if user is not None and getattr(user, 'is_authenticated', False) else None

    def get_drive_files_detail(self, obj):
        user = self._request_user()
        if user is None:
            return []
        files = filter_accessible_files(obj.drive_files.filter(deleted_at__isnull=True), user)
        return [
            {'id': f.id, 'name': f.name, 'mime_type': f.mime_type, 'size': f.size, 'folder': f.folder_id}
            for f in files
        ]

    def validate_drive_files(self, files):
        user = self._request_user()
        denied = [f.id for f in files if user is None or not has_file_access(user, f)]
        if denied:
            raise serializers.ValidationError(
                f"File non disponibili o non accessibili: {sorted(denied)}"
            )
        return files

    def update(self, instance, validated_data):
        files = validated_data.pop('drive_files', None)
        instance = super().update(instance, validated_data)
        if files is not None:
            user = self._request_user()
            visible_ids = set(
                filter_accessible_files(
                    instance.drive_files.filter(deleted_at__isnull=True), user,
                ).values_list('pk', flat=True)
            ) if user is not None else set()
            preserved = [f.pk for f in instance.drive_files.all() if f.pk not in visible_ids]
            instance.drive_files.set([f.pk for f in files] + preserved)
        return instance

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        user = request.user
        if getattr(user, 'is_superuser', False):
            return True
        user_area_id = getattr(getattr(user, 'profile', None), 'leave_area_id', None)
        return user_area_id is not None and user_area_id == obj.area_id

    def validate(self, attrs):
        attrs = super().validate(attrs)
        assignee = attrs.get('assigned_to')
        if assignee is None:
            return attrs
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        if getattr(actor, 'is_superuser', False):
            return attrs
        if self.instance is not None:
            if assignee.pk == self.instance.assigned_to_id:
                return attrs  # valore invariato: niente ricontrollo area
            area_id = self.instance.area_id
        else:
            area_id = getattr(getattr(actor, 'profile', None), 'leave_area_id', None)
        assignee_area_id = getattr(getattr(assignee, 'profile', None), 'leave_area_id', None)
        if area_id is None or assignee_area_id != area_id:
            raise serializers.ValidationError(
                {'assigned_to': "L'assegnatario deve appartenere all'area del task."}
            )
        return attrs


class AreaTaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model  = AreaTaskComment
        fields = ['id', 'task', 'author', 'author_name', 'body', 'created_at', 'updated_at']
        read_only_fields = ['id', 'task', 'author', 'created_at', 'updated_at']

    def get_author_name(self, obj):
        u = obj.author
        return f"{u.first_name} {u.last_name}".strip() or u.username


class AreaTaskFilter(filters.FilterSet):
    status      = filters.MultipleChoiceFilter(choices=AreaTask.STATUS_CHOICES)
    priority    = filters.MultipleChoiceFilter(choices=AreaTask._meta.get_field('priority').choices)
    area        = filters.NumberFilter(field_name='area_id')
    assigned_to = filters.NumberFilter(field_name='assigned_to_id')
    due_before  = filters.DateFilter(field_name='due_date', lookup_expr='lte')
    due_after   = filters.DateFilter(field_name='due_date', lookup_expr='gte')
    mine        = filters.BooleanFilter(method='filter_mine')

    class Meta:
        model  = AreaTask
        fields = ['status', 'priority', 'area', 'assigned_to', 'mine']

    def filter_mine(self, queryset, name, value):
        if value:
            return queryset.filter(assigned_to=self.request.user)
        return queryset


class AreaTaskViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """
    Task di area. Lettura: tutte le aree, a chiunque sia autenticato (sola
    lettura sulle aree diverse dalla propria). Scrittura
    (create/update/delete/restore): solo sui task della propria area
    (`request.user.profile.leave_area`); il superuser può sempre.

    Nella lista i task completati da più di `AreaTask.HIDE_COMPLETED_AFTER_DAYS`
    giorni sono nascosti (restano in DB): `?include_hidden=1` li mostra.
    Vale solo per `action == 'list'`, così un task completato da tempo resta
    apribile per id e ripristinabile.

    Soft-delete/restore/audit: mixin standard di `core/mixins.py`
    (`?include_deleted=1`, `?only_deleted=1`, `restore`, `bulk_restore`).
    """
    # RestoreActionMixin: AreaTask ha updated_by, nessun genitore da
    # controllare, risposta 204 (default).
    restore_use_block_check = False
    restore_use_split       = False

    serializer_class   = AreaTaskSerializer
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class    = AreaTaskFilter
    search_fields      = ['title', 'description']
    ordering           = ['status', 'due_date', '-created_at', 'id']
    ordering_fields    = [
        'created_at', 'updated_at', 'due_date', 'priority', 'status', 'title',
        'completed_at', 'deleted_at',
    ]

    def get_queryset(self):
        qs = AreaTask.objects.select_related('area', 'created_by', 'assigned_to')
        if getattr(self, 'action', None) in ('list', 'retrieve'):
            qs = qs.annotate(comments_count=Count('comments'))
        if getattr(self, 'action', None) in ('list', 'retrieve', 'restore', 'bulk_restore'):
            qs = apply_soft_delete_filters(
                qs, request=self.request, action_name=getattr(self, 'action', ''),
            )
        else:
            qs = qs.filter(deleted_at__isnull=True)
        params = self.request.query_params
        in_trash = str(params.get('only_deleted', '')).strip().lower() in TRUTHY
        if getattr(self, 'action', None) == 'list' and params.get('include_hidden') != '1' and not in_trash:
            hide_before = timezone.now() - timedelta(days=AreaTask.HIDE_COMPLETED_AFTER_DAYS)
            qs = qs.exclude(status=AreaTask.STATUS_COMPLETATO, completed_at__lt=hide_before)
        return qs

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ('restore', 'bulk_restore'):
            # RestoreActionMixin sostituisce permission_classes su queste
            # action: riaggiungiamo la barriera Portal/Archie.
            perms.append(IsInternalOrPortalDedicatedApp())
        return perms

    def _get_scoped_trash_queryset(self):
        qs = super()._get_scoped_trash_queryset()
        user = self.request.user
        if getattr(user, 'is_superuser', False):
            return qs
        return qs.filter(area_id=self._user_area_id(user))

    def _restore_obj(self, obj, request):
        self._check_own_area(obj.area_id)
        super()._restore_obj(obj, request)

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

    def _visible_file_ids(self, task):
        return sorted(
            filter_accessible_files(
                task.drive_files.filter(deleted_at__isnull=True), self.request.user,
            ).values_list('pk', flat=True)
        )

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
        else:
            # Utenti normali: sempre e solo la propria area, a prescindere
            # da cosa venga eventualmente inviato dal client.
            if not user_area_id:
                raise PermissionDenied(
                    "Nessuna area assegnata al tuo profilo: contatta un amministratore."
                )
            area_id = user_area_id

        instance = serializer.save(created_by=user, updated_by=user, area_id=area_id)

        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
            if k != 'drive_files'
        }
        if 'area' in changes:
            changes['area'] = {"from": None, "to": to_change_value_for_field('area', instance.area)}
        file_ids = self._visible_file_ids(instance)
        if file_ids:
            changes['drive_files'] = {"from": [], "to": file_ids}
        log_event(
            actor=user, action="create", instance=instance,
            changes=changes, request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        self._check_own_area(instance.area_id)
        validated = {k: v for k, v in serializer.validated_data.items() if k != 'drive_files'}
        changes = self._changes_from_validated(instance, validated)
        files_before = self._visible_file_ids(instance)

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
        files_after = self._visible_file_ids(saved)
        if files_before != files_after:
            changes['drive_files'] = {"from": files_before, "to": files_after}
        log_event(
            actor=self.request.user, action="update", instance=saved,
            changes=changes or None, request=self.request,
        )

    def perform_destroy(self, instance):
        self._check_own_area(instance.area_id)
        super().perform_destroy(instance)

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

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        task = self.get_object()

        if request.method == 'GET':
            qs = task.comments.select_related('author').order_by('created_at')
            return Response(AreaTaskCommentSerializer(qs, many=True).data)

        self._check_own_area(task.area_id)
        serializer = AreaTaskCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(task=task, author=request.user)
        log_event(
            actor=request.user, action="update", instance=task,
            changes={"comment_added": {"from": None, "to": comment.id}},
            request=request,
        )
        return Response(AreaTaskCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'comments/(?P<comment_pk>\d+)')
    def comment_detail(self, request, pk=None, comment_pk=None):
        task = self.get_object()
        try:
            comment = task.comments.select_related('author').get(pk=comment_pk)
        except AreaTaskComment.DoesNotExist:
            return Response({'detail': 'Commento non trovato.'}, status=status.HTTP_404_NOT_FOUND)

        if comment.author_id != request.user.id and not getattr(request.user, 'is_superuser', False):
            return Response({'detail': 'Non autorizzato.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'DELETE':
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = AreaTaskCommentSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


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
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp]
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
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp]

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


class DefaultDashboardLayoutSerializer(serializers.ModelSerializer):
    widget_key = serializers.CharField(source='widget.key', read_only=True)

    class Meta:
        model  = DefaultDashboardLayout
        fields = ['widget_key', 'x', 'y', 'w', 'h', 'visible']


class DefaultDashboardLayoutViewSet(viewsets.ReadOnlyModelViewSet):
    """Layout predefinito applicato solo ai nuovi utenti (nessuna riga
    UserDashboardLayout ancora salvata). Lettura aperta a chiunque sia
    autenticato — serve al frontend per il fallback al primo accesso; la
    scrittura passa solo dall'azione `set_mine`, riservata ai superuser.
    """
    serializer_class   = DefaultDashboardLayoutSerializer
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp]
    queryset            = DefaultDashboardLayout.objects.select_related('widget')

    @action(detail=False, methods=['post'])
    def set_mine(self, request):
        """Sostituisce l'intero layout predefinito con quello ATTUALE
        dell'utente che chiama (deve essere superuser). Istantanea presa
        on-demand, non una sincronizzazione continua: chi ha già
        personalizzato la propria dashboard non viene mai toccato, il
        default si applica solo ai nuovi utenti da questo momento in poi.
        """
        if not request.user.is_superuser:
            return Response(
                {'detail': 'Solo un superuser può impostare il layout predefinito.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        my_layout = UserDashboardLayout.objects.filter(user=request.user).select_related('widget')
        if not my_layout.exists():
            return Response(
                {'detail': 'Non hai ancora nessun layout personalizzato da salvare come predefinito.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            DefaultDashboardLayout.objects.all().delete()
            DefaultDashboardLayout.objects.bulk_create([
                DefaultDashboardLayout(widget=it.widget, x=it.x, y=it.y, w=it.w, h=it.h, visible=it.visible)
                for it in my_layout
            ])

        qs = self.get_queryset()
        return Response(DefaultDashboardLayoutSerializer(qs, many=True).data)


# ─── Sticky note (nota personale, widget dashboard 'sticky-note') ────────────
# Endpoint singleton (get-or-create + update), stesso pattern di /api/me/:
# non è un ViewSet perché non esiste una lista/CRUD multiplo, ogni utente ha
# esattamente una nota.

class StickyNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = StickyNote
        fields = ['text', 'updated_at']
        read_only_fields = ['updated_at']


class StickyNoteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        note, _ = StickyNote.objects.get_or_create(user=request.user)
        return Response(StickyNoteSerializer(note).data)

    def patch(self, request):
        note, _ = StickyNote.objects.get_or_create(user=request.user)
        serializer = StickyNoteSerializer(note, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─── Compleanni (widget dashboard 'birthdays') ────────────────────────────────
# Stesso pattern di WikiStatsView.monthly_contributor: un solo "prossimo
# evento" featured (non un elenco), coerente con ContributorCard che il
# widget riprende come stile visivo. Se più utenti condividono la stessa
# data più vicina, sono restituiti tutti insieme in `people`.

class BirthdaysView(APIView):
    """Compleanni di oggi tra gli utenti attivi (widget dashboard 'birthdays').

    Solo il giorno corrente: niente fallback sul "prossimo compleanno" se
    oggi non festeggia nessuno — il widget deve mostrare solo eventi del
    giorno, non un conto alla rovescia.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        profiles = (
            UserProfile.objects
            .filter(
                birth_date__month=today.month,
                birth_date__day=today.day,
                user__is_active=True,
            )
            .select_related('user')
        )

        def _avatar_url(profile):
            if not profile.avatar:
                return None
            try:
                return profile.avatar.url
            except Exception:
                return None

        people = [
            {
                'user_id': p.user_id,
                'name': f"{p.user.first_name} {p.user.last_name}".strip() or p.user.username,
                'avatar': _avatar_url(p),
            }
            for p in profiles
        ]
        return Response({'day': today.day, 'month': today.month, 'people': people})
