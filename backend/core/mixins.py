"""
core/mixins.py — Mixin riutilizzabili per i ViewSet dell'applicazione.

SoftDeleteAuditMixin
    Centralizza perform_destroy (soft-delete + audit log) e i metodi
    perform_create / perform_update con tracking dei cambiamenti.
    Sostituisce le copie identiche presenti in crm, inventory e altri moduli.

CustomFieldsValidationMixin
    Centralizza la validazione/normalizzazione di custom_fields nei serializer.
    Richiede di impostare l'attributo di classe `custom_fields_entity`.
"""
from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from audit.utils import log_event, to_change_value_for_field, to_primitive


# ─────────────────────────────────────────────────────────────────────────────
# ViewSet mixin
# ─────────────────────────────────────────────────────────────────────────────

class SoftDeleteAuditMixin:
    """Mixin per ViewSet con soft-delete e audit logging.

    Fornisce:
    - perform_destroy: soft-delete (deleted_at + updated_by) + log audit
    - perform_create:  salva con created_by/updated_by + log audit con changes
    - perform_update:  salva con updated_by + log audit con diff changes
    - _changes_from_validated: calcola il diff prima/dopo tra instance e validated_data

    ViewSet con logica extra (es. ContactViewSet._enforce_primary) devono
    sovrascrivere solo il metodo che necessitano e chiamare super() se vogliono
    mantenere il comportamento base.
    """

    # ── helpers ───────────────────────────────────────────────────────────────

    def _changes_from_validated(self, instance, validated: dict) -> dict:
        """Calcola il diff {campo: {from, to}} tra l'istanza corrente e i dati validati."""
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

    # ── DRF hooks ─────────────────────────────────────────────────────────────

    def perform_destroy(self, instance):
        """Soft-delete: imposta deleted_at, aggiorna updated_by e logga l'evento."""
        before = getattr(instance, "deleted_at", None)
        instance.deleted_at = timezone.now()

        # updated_by è presente su tutti i modelli CRM/inventory/maintenance.
        # Su modelli che non ce l'hanno (es. custom fields) il setattr è no-op.
        if hasattr(instance, "updated_by_id") or hasattr(instance, "updated_by"):
            instance.updated_by = self.request.user  # type: ignore[attr-defined]
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
            actor=self.request.user,  # type: ignore[attr-defined]
            action="delete",
            instance=instance,
            changes=changes,
            request=self.request,  # type: ignore[attr-defined]
        )

    def perform_create(self, serializer):
        """Salva con userstamp (se presenti sul modello) + logga creazione."""
        # Passa created_by/updated_by solo se il modello li supporta.
        # I modelli senza questi campi (es. Tech, MaintenancePlan, WikiCategory)
        # devono sovrascrivere perform_create con serializer.save() senza kwargs.
        model = getattr(getattr(serializer, 'Meta', None), 'model', None) or                 (serializer.child.Meta.model if hasattr(serializer, 'child') else None)
        has_userstamps = model is not None and (
            hasattr(model, 'created_by') or hasattr(model._meta, 'get_field') and
            any(f.name == 'created_by' for f in model._meta.get_fields())
        )
        save_kwargs = {}
        if has_userstamps:
            save_kwargs = {
                'created_by': self.request.user,  # type: ignore[attr-defined]
                'updated_by': self.request.user,  # type: ignore[attr-defined]
            }
        instance = serializer.save(**save_kwargs)
        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(
            actor=self.request.user,  # type: ignore[attr-defined]
            action="create",
            instance=instance,
            changes=changes,
            request=self.request,  # type: ignore[attr-defined]
        )

    def perform_update(self, serializer):
        """Salva con userstamp (se presente sul modello) + logga i campi cambiati."""
        instance_before = serializer.instance
        changes = self._changes_from_validated(instance_before, serializer.validated_data)
        save_kwargs = {}
        if hasattr(instance_before, 'updated_by_id') or hasattr(instance_before, 'updated_by'):
            save_kwargs['updated_by'] = self.request.user  # type: ignore[attr-defined]
        instance = serializer.save(**save_kwargs)
        log_event(
            actor=self.request.user,  # type: ignore[attr-defined]
            action="update",
            instance=instance,
            changes=changes or None,
            request=self.request,  # type: ignore[attr-defined]
        )


# ─────────────────────────────────────────────────────────────────────────────
# Serializer mixin
# ─────────────────────────────────────────────────────────────────────────────

class CustomFieldsValidationMixin:
    """Mixin per serializer con campo custom_fields.

    Richiede di dichiarare nella sottoclasse:
        custom_fields_entity: str  # es. "customer", "site", "inventory"

    Implementa validate() che normalizza e valida custom_fields.
    Se il serializer ha logica aggiuntiva, sovrascrivere validate() e
    chiamare super().validate(attrs) prima di aggiungere i propri check.
    """

    custom_fields_entity: str = ""

    def validate(self, attrs):
        from custom_fields.validation import normalize_and_validate_custom_fields

        if not self.custom_fields_entity:  # type: ignore[truthy-bool]
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
                existing=getattr(self.instance, "custom_fields", None) or {},  # type: ignore[attr-defined]
                partial=bool(getattr(self, "partial", False)),
            )
            attrs["custom_fields"] = normalized

        return attrs
