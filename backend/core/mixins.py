"""
core/mixins.py — Mixin riutilizzabili per i ViewSet dell'applicazione.

SoftDeleteAuditMixin
    Centralizza perform_destroy (soft-delete + audit log) e i metodi
    perform_create / perform_update con tracking dei cambiamenti.

RestoreActionMixin
    Fornisce le action DRF `restore` e `bulk_restore` standard.
    Configurabile tramite attributi di classe:

        restore_use_block_check = True   # chiama get_restore_block_reason()
        restore_has_updated_by  = True   # imposta updated_by al restore
        restore_response_204    = True   # 204 vs serializer nella risposta
        restore_use_split       = True   # usa split_restorable() nel bulk

PurgeActionMixin
    Fornisce le action DRF `purge` e `bulk_purge` standard.

CustomFieldsValidationMixin
    Centralizza la validazione/normalizzazione di custom_fields nei serializer.
"""
from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from audit.utils import log_event, to_change_value_for_field, to_primitive
from core.permissions import CanRestoreModelPermission, CanPurgeModelPermission


# ─────────────────────────────────────────────────────────────────────────────
# ViewSet mixin — soft delete + audit
# ─────────────────────────────────────────────────────────────────────────────

class SoftDeleteAuditMixin:
    """Mixin per ViewSet con soft-delete e audit logging."""

    def _changes_from_validated(self, instance, validated: dict) -> dict:
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

    def perform_destroy(self, instance):
        before = getattr(instance, "deleted_at", None)
        instance.deleted_at = timezone.now()
        if hasattr(instance, "updated_by_id") or hasattr(instance, "updated_by"):
            instance.updated_by = self.request.user
            instance.save(update_fields=["deleted_at", "updated_by", "updated_at"])
        else:
            instance.save(update_fields=["deleted_at", "updated_at"])
        changes = {
            "deleted_at": {
                "from": to_change_value_for_field("deleted_at", before),
                "to":   to_change_value_for_field("deleted_at", instance.deleted_at),
            }
        }
        log_event(
            actor=self.request.user,
            action="delete",
            instance=instance,
            changes=changes,
            request=self.request,
        )

    def perform_create(self, serializer):
        model = getattr(getattr(serializer, 'Meta', None), 'model', None) or \
                (serializer.child.Meta.model if hasattr(serializer, 'child') else None)
        has_userstamps = model is not None and (
            hasattr(model, 'created_by') or (
                hasattr(model._meta, 'get_field') and
                any(f.name == 'created_by' for f in model._meta.get_fields())
            )
        )
        save_kwargs = {}
        if has_userstamps:
            save_kwargs = {
                'created_by': self.request.user,
                'updated_by': self.request.user,
            }
        instance = serializer.save(**save_kwargs)
        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(
            actor=self.request.user,
            action="create",
            instance=instance,
            changes=changes,
            request=self.request,
        )

    def perform_update(self, serializer):
        instance_before = serializer.instance
        changes = self._changes_from_validated(instance_before, serializer.validated_data)
        save_kwargs = {}
        if hasattr(instance_before, 'updated_by_id') or hasattr(instance_before, 'updated_by'):
            save_kwargs['updated_by'] = self.request.user
        instance = serializer.save(**save_kwargs)
        log_event(
            actor=self.request.user,
            action="update",
            instance=instance,
            changes=changes or None,
            request=self.request,
        )


# ─────────────────────────────────────────────────────────────────────────────
# ViewSet mixin — restore actions
# ─────────────────────────────────────────────────────────────────────────────

class RestoreActionMixin:
    """Mixin che aggiunge `restore` e `bulk_restore` a un ViewSet.

    Attributi configurabili (tutti con default):

        restore_use_block_check = True
        restore_has_updated_by  = True
        restore_response_204    = True
        restore_use_split       = True

    Esempio senza updated_by e con risposta serializer (es. WikiCategory):

        class WikiCategoryViewSet(RestoreActionMixin, ...):
            restore_has_updated_by = False
            restore_response_204   = False
            restore_use_split      = False
    """

    restore_use_block_check: bool = True
    restore_has_updated_by: bool = True
    restore_response_204: bool = True
    restore_use_split: bool = True

    def _get_scoped_trash_queryset(self):
        qs = self.filter_queryset(self.get_queryset())
        return qs.filter(deleted_at__isnull=False)

    def _restore_obj(self, obj, request):
        before = getattr(obj, "deleted_at", None)
        obj.deleted_at = None
        if self.restore_has_updated_by:
            obj.updated_by = request.user
            obj.save(update_fields=["deleted_at", "updated_by", "updated_at"])
        else:
            obj.save(update_fields=["deleted_at", "updated_at"])
        log_event(
            actor=request.user,
            action="restore",
            instance=obj,
            changes={"deleted_at": {"from": to_change_value_for_field("deleted_at", before), "to": None}},
            request=request,
        )

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()

        if self.restore_use_block_check:
            from core.restore_policy import get_restore_block_reason
            reason = get_restore_block_reason(obj)
            if reason:
                return Response({"detail": reason}, status=status.HTTP_409_CONFLICT)

        self._restore_obj(obj, request)

        if self.restore_response_204:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        """Ripristina più oggetti. Body: {"ids": [1, 2, 3]} o lista diretta."""
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        scoped_qs = self._get_scoped_trash_queryset()
        model = scoped_qs.model
        model_name = model.__name__
        qs = list(scoped_qs.filter(id__in=ids))
        blocked: list = []

        if self.restore_use_split:
            from core.restore_policy import split_restorable
            qs, blocked = split_restorable(qs)

        restored_ids = [obj.id for obj in qs]
        if restored_ids:
            now = timezone.now()
            update_kwargs: dict = {"deleted_at": None, "updated_at": now}
            if self.restore_has_updated_by:
                update_kwargs["updated_by"] = request.user
            scoped_qs.filter(id__in=restored_ids).update(**update_kwargs)

        log_event(
            actor=request.user,
            action="restore",
            instance=None,
            changes={"ids": restored_ids},
            request=request,
            subject=f"bulk restore {model_name}: {restored_ids}",
        )
        return Response(
            {"restored": restored_ids, "count": len(restored_ids),
             "blocked": blocked, "blocked_count": len(blocked)},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# ViewSet mixin — purge actions
# ─────────────────────────────────────────────────────────────────────────────

class PurgeActionMixin:
    """Mixin che aggiunge `purge` e `bulk_purge` a un ViewSet."""

    def _get_scoped_trash_queryset(self):
        qs = self.filter_queryset(self.get_queryset())
        return qs.filter(deleted_at__isnull=False)

    @action(detail=True, methods=["post"], permission_classes=[CanPurgeModelPermission])
    def purge(self, request, pk=None):
        from core.purge_policy import try_purge_instance
        scoped_qs = self._get_scoped_trash_queryset()
        model = scoped_qs.model
        obj = scoped_qs.filter(pk=pk).first()
        if obj is None:
            return Response({"detail": "Elemento non trovato nel cestino."}, status=status.HTTP_404_NOT_FOUND)
        ok, reason, blockers = try_purge_instance(obj)
        if not ok:
            return Response({"detail": reason, "blocked": blockers}, status=status.HTTP_409_CONFLICT)
        log_event(
            actor=request.user, action="delete", instance=None, request=request,
            metadata={"purge": True}, subject=f"purge {model.__name__} #{pk}",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], permission_classes=[CanPurgeModelPermission])
    def bulk_purge(self, request):
        from core.purge_policy import try_purge_instance
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        scoped_qs = self._get_scoped_trash_queryset()
        model = scoped_qs.model
        model_name = model.__name__
        purged: list = []
        blocked: list = []

        for obj in scoped_qs.filter(id__in=ids):
            obj_id = obj.id
            ok, reason, blockers = try_purge_instance(obj)
            if ok:
                purged.append(obj_id)
            else:
                blocked.append({"id": obj_id, "reason": reason, "blocked": blockers})

        log_event(
            actor=request.user, action="delete", instance=None,
            changes={"ids": purged}, request=request,
            metadata={"purge": True, "blocked_count": len(blocked)},
            subject=f"bulk purge {model_name}: {purged}",
        )
        return Response(
            {"purged": purged, "count": len(purged), "blocked": blocked, "blocked_count": len(blocked)},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Serializer mixin
# ─────────────────────────────────────────────────────────────────────────────

class CustomFieldsValidationMixin:
    """Mixin per serializer con campo custom_fields.

    Richiede di dichiarare nella sottoclasse:
        custom_fields_entity: str  # es. "customer", "site", "inventory"
    """

    custom_fields_entity: str = ""

    def validate(self, attrs):
        from custom_fields.validation import normalize_and_validate_custom_fields

        if not self.custom_fields_entity:
            raise NotImplementedError(
                f"{self.__class__.__name__} deve definire custom_fields_entity."
            )

        is_create = getattr(self, "instance", None) is None

        if is_create:
            incoming = attrs.get("custom_fields", {})
            normalized = normalize_and_validate_custom_fields(
                entity=self.custom_fields_entity,
                incoming=incoming if incoming is not None else {},
                existing=None,
                partial=False,
            )
            attrs["custom_fields"] = normalized
        elif "custom_fields" in attrs:
            incoming = attrs.get("custom_fields")
            normalized = normalize_and_validate_custom_fields(
                entity=self.custom_fields_entity,
                incoming=incoming if incoming is not None else {},
                existing=getattr(self.instance, "custom_fields", None) or {},
                partial=bool(getattr(self, "partial", False)),
            )
            attrs["custom_fields"] = normalized

        return attrs
