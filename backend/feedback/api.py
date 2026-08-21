from django.db.models import Count, Q
from django.utils import timezone
from django_filters import rest_framework as filters
from rest_framework import mixins, permissions, serializers, status, viewsets
from PIL import Image
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from audit.utils import log_event
from portal.permissions import IsInternalOrPortalDedicatedApp
from core.media import build_action_url, protected_media_response
from core.permissions import user_has_model_perm
from core.uploads import validate_upload
from .models import ReportRequest, ReportStatus



SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024
SCREENSHOT_ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
SCREENSHOT_ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}


def _validate_screenshot_contents(uploaded_file):
    try:
        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
        img.verify()
    except Exception as exc:
        raise serializers.ValidationError("Il file caricato non è un'immagine valida.") from exc
    finally:
        try:
            uploaded_file.seek(0)
        except Exception:
            pass


class ReportRequestSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    section_label = serializers.CharField(source='get_section_display', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    created_by_full_name = serializers.SerializerMethodField()
    resolved_by_username = serializers.CharField(source='resolved_by.username', read_only=True)
    resolved_by_full_name = serializers.SerializerMethodField()
    rejected_by_username = serializers.CharField(source='rejected_by.username', read_only=True)
    rejected_by_full_name = serializers.SerializerMethodField()
    screenshot_url = serializers.SerializerMethodField()
    can_upload_screenshot = serializers.SerializerMethodField()
    can_resolve = serializers.SerializerMethodField()

    class Meta:
        model = ReportRequest
        fields = [
            'id',
            'kind',
            'kind_label',
            'status',
            'status_label',
            'section',
            'section_label',
            'description',
            'screenshot',
            'screenshot_url',
            'can_upload_screenshot',
            'can_resolve',
            'created_by',
            'created_by_username',
            'created_by_full_name',
            'created_at',
            'updated_at',
            'resolved_at',
            'resolved_by',
            'resolved_by_username',
            'resolved_by_full_name',
            'rejection_reason',
            'rejected_at',
            'rejected_by',
            'rejected_by_username',
            'rejected_by_full_name',
        ]
        read_only_fields = [
            'id',
            'kind_label',
            'status_label',
            'section_label',
            'created_by',
            'created_by_username',
            'created_by_full_name',
            'created_at',
            'updated_at',
            'resolved_at',
            'resolved_by',
            'resolved_by_username',
            'resolved_by_full_name',
            'rejected_at',
            'rejected_by',
            'rejected_by_username',
            'rejected_by_full_name',
            'screenshot_url',
            'can_upload_screenshot',
            'can_resolve',
        ]

    def validate(self, attrs):
        # Il motivo del rifiuto è obbligatorio quando si transita a "rejected"
        # (sia in creazione della richiesta di update, sia sull'istanza già
        # rifiutata se non viene inviato un nuovo motivo).
        target_status = attrs.get('status', getattr(self.instance, 'status', None))
        if target_status == ReportStatus.REJECTED:
            reason = attrs.get('rejection_reason')
            if reason is None and self.instance is not None:
                reason = self.instance.rejection_reason
            if not reason or not reason.strip():
                raise serializers.ValidationError(
                    {'rejection_reason': 'La motivazione del rifiuto è obbligatoria.'}
                )
        return attrs

    def validate_screenshot(self, value):
        return validate_upload(
            value,
            label="screenshot",
            max_bytes=SCREENSHOT_MAX_BYTES,
            allowed_extensions=SCREENSHOT_ALLOWED_EXTENSIONS,
            allowed_content_types=SCREENSHOT_ALLOWED_CONTENT_TYPES,
            strict_real_mime=True,
            content_validator=_validate_screenshot_contents,
        )

    def get_created_by_full_name(self, obj):
        user = obj.created_by
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username

    def get_resolved_by_full_name(self, obj):
        user = obj.resolved_by
        if user is None:
            return None
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username

    def get_rejected_by_full_name(self, obj):
        user = obj.rejected_by
        if user is None:
            return None
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username

    def get_screenshot_url(self, obj):
        if not obj.screenshot:
            return None
        request = self.context.get('request')
        return build_action_url(request=request, relative_path=f"/api/feedback-items/{obj.pk}/screenshot/")

    def _request_user(self):
        request = self.context.get('request')
        return getattr(request, 'user', None)

    def get_can_upload_screenshot(self, obj):
        if bool(obj.screenshot):
            return False
        user = self._request_user()
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        if user_has_model_perm(user, ReportRequest, 'change'):
            return True
        return obj.created_by_id == user.id

    def get_can_resolve(self, obj):
        user = self._request_user()
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        return user_has_model_perm(user, ReportRequest, 'change')


class ReportRequestFilter(filters.FilterSet):
    kind = filters.CharFilter(field_name='kind')
    status = filters.CharFilter(method='filter_status')
    section = filters.CharFilter(field_name='section')
    created_by = filters.NumberFilter(field_name='created_by_id')
    has_screenshot = filters.BooleanFilter(method='filter_has_screenshot')

    class Meta:
        model = ReportRequest
        fields = ['kind', 'status', 'section', 'created_by', 'has_screenshot']

    def filter_status(self, queryset, _name, value):
        # Supporta valori multipli separati da virgola (es. "resolved,rejected")
        # per la vista "Risolte" che raggruppa gli esiti chiusi.
        statuses = [item.strip() for item in value.split(',') if item.strip()]
        if not statuses:
            return queryset
        return queryset.filter(status__in=statuses)

    def filter_has_screenshot(self, queryset, _name, value):
        if value is True:
            return queryset.exclude(Q(screenshot='') | Q(screenshot__isnull=True))
        if value is False:
            return queryset.filter(Q(screenshot='') | Q(screenshot__isnull=True))
        return queryset


class ReportRequestViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ReportRequestSerializer
    # 0.9.1 (WP-03): permission_classes esplicite -> il default globale
    # non si applica, va esteso qui esplicitamente.
    permission_classes = [permissions.IsAuthenticated, IsInternalOrPortalDedicatedApp]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = ReportRequest.objects.select_related('created_by', 'resolved_by').order_by('-created_at')
    filterset_class = ReportRequestFilter
    filter_backends = [filters.DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['description', 'created_by__username', 'created_by__first_name', 'created_by__last_name']
    ordering_fields = ['created_at', 'updated_at', 'kind', 'status', 'section', 'resolved_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return self.queryset

    def _can_change_item(self, user) -> bool:
        return user_has_model_perm(user, ReportRequest, 'change')

    def _is_creator_screenshot_only_update(self, request, instance) -> bool:
        if instance.created_by_id != getattr(request.user, 'id', None):
            return False
        if bool(instance.screenshot):
            return False
        data_keys = set(request.data.keys())
        if not data_keys:
            return False
        if data_keys - {'screenshot'}:
            return False
        return bool(request.FILES.get('screenshot'))

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        if self._can_change_item(request.user):
            return super().update(request, partial=partial, *args, **kwargs)
        if self._is_creator_screenshot_only_update(request, instance):
            return super().update(request, partial=True, *args, **kwargs)
        return Response({'detail': 'Non hai i permessi per modificare questa segnalazione.'}, status=status.HTTP_403_FORBIDDEN)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='screenshot')
    def screenshot(self, request, pk=None):
        item = self.get_object()
        return protected_media_response(file_field=item.screenshot, disposition='inline')

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        base_qs = self.filter_queryset(self.get_queryset())
        user = request.user
        counts = base_qs.aggregate(
            total_count=Count('id'),
            open_count=Count('id', filter=Q(status=ReportStatus.OPEN)),
            resolved_count=Count('id', filter=Q(status=ReportStatus.RESOLVED)),
            rejected_count=Count('id', filter=Q(status=ReportStatus.REJECTED)),
            mine_open_count=Count('id', filter=Q(status=ReportStatus.OPEN, created_by=user)),
            mine_resolved_count=Count('id', filter=Q(status=ReportStatus.RESOLVED, created_by=user)),
            mine_rejected_count=Count('id', filter=Q(status=ReportStatus.REJECTED, created_by=user)),
            open_missing_screenshot_count=Count(
                'id',
                filter=Q(status=ReportStatus.OPEN) & (Q(screenshot='') | Q(screenshot__isnull=True)),
            ),
            resolved_missing_screenshot_count=Count(
                'id',
                filter=Q(status=ReportStatus.RESOLVED) & (Q(screenshot='') | Q(screenshot__isnull=True)),
            ),
            bug_open_count=Count('id', filter=Q(status=ReportStatus.OPEN, kind='bug')),
            feature_open_count=Count('id', filter=Q(status=ReportStatus.OPEN, kind='feature')),
            bug_resolved_count=Count('id', filter=Q(status=ReportStatus.RESOLVED, kind='bug')),
            feature_resolved_count=Count('id', filter=Q(status=ReportStatus.RESOLVED, kind='feature')),
        )
        return Response(counts)

    def perform_create(self, serializer):
        item = serializer.save(created_by=self.request.user, status=ReportStatus.OPEN, resolved_at=None, resolved_by=None)
        log_event(
            self.request.user,
            action='create',
            instance=item,
            changes={
                'kind': [None, item.kind],
                'status': [None, item.status],
                'section': [None, item.section],
            },
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        old_kind = instance.kind
        old_status = instance.status
        old_section = instance.section
        old_has_screenshot = bool(instance.screenshot)
        old_rejection_reason = instance.rejection_reason

        new_status = serializer.validated_data.get('status')

        if new_status == ReportStatus.RESOLVED and instance.status != ReportStatus.RESOLVED:
            item = serializer.save(
                resolved_at=timezone.now(), resolved_by=self.request.user,
                rejected_at=None, rejected_by=None, rejection_reason='',
            )
        elif new_status == ReportStatus.REJECTED and instance.status != ReportStatus.REJECTED:
            reason = serializer.validated_data.get('rejection_reason', instance.rejection_reason)
            item = serializer.save(
                rejected_at=timezone.now(), rejected_by=self.request.user, rejection_reason=reason,
                resolved_at=None, resolved_by=None,
            )
        elif new_status == ReportStatus.OPEN and instance.status != ReportStatus.OPEN:
            item = serializer.save(
                resolved_at=None, resolved_by=None,
                rejected_at=None, rejected_by=None, rejection_reason='',
            )
        else:
            item = serializer.save()

        changes = {}
        if old_kind != item.kind:
            changes['kind'] = [old_kind, item.kind]
        if old_status != item.status:
            changes['status'] = [old_status, item.status]
        if old_section != item.section:
            changes['section'] = [old_section, item.section]
        if old_has_screenshot != bool(item.screenshot):
            changes['screenshot'] = [old_has_screenshot, bool(item.screenshot)]
        if old_rejection_reason != item.rejection_reason:
            changes['rejection_reason'] = [old_rejection_reason, item.rejection_reason]

        if changes:
            log_event(
                self.request.user,
                action='update',
                instance=item,
                changes=changes,
                request=self.request,
            )
