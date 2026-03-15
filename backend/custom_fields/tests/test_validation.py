import pytest

from rest_framework import serializers

from custom_fields.models import CustomFieldDefinition
from custom_fields.validation import normalize_and_validate_custom_fields


pytestmark = pytest.mark.django_db


def _mk_def(
    *,
    entity: str = CustomFieldDefinition.Entity.CUSTOMER,
    key: str,
    label: str,
    field_type: str = CustomFieldDefinition.FieldType.TEXT,
    required: bool = False,
    aliases=None,
    options=None,
    is_sensitive: bool = False,
) -> CustomFieldDefinition:
    return CustomFieldDefinition.objects.create(
        entity=entity,
        key=key,
        label=label,
        field_type=field_type,
        required=required,
        aliases=aliases,
        options=options,
        is_sensitive=is_sensitive,
        is_active=True,
    )


def test_alias_is_canonicalized_and_unknown_keys_preserved():
    _mk_def(
        key="vat_number",
        label="Partita IVA",
        field_type=CustomFieldDefinition.FieldType.TEXT,
        aliases=["P.IVA", "Partita Iva", "vat"],
    )

    out = normalize_and_validate_custom_fields(
        entity=CustomFieldDefinition.Entity.CUSTOMER,
        incoming={"P.IVA": "IT123", "legacyKey": "legacy"},
        existing=None,
        partial=False,
    )

    assert out is not None
    assert out["vat_number"] == "IT123"
    # Unknown keys should remain as-is
    assert out["legacyKey"] == "legacy"


def test_coercions_number_bool_date_select():
    _mk_def(key="employees", label="Dipendenti", field_type=CustomFieldDefinition.FieldType.NUMBER)
    _mk_def(key="active", label="Attivo", field_type=CustomFieldDefinition.FieldType.BOOLEAN)
    _mk_def(key="go_live", label="Go Live", field_type=CustomFieldDefinition.FieldType.DATE)
    _mk_def(
        key="tier",
        label="Tier",
        field_type=CustomFieldDefinition.FieldType.SELECT,
        options=["A", "B", "C"],
    )

    out = normalize_and_validate_custom_fields(
        entity=CustomFieldDefinition.Entity.CUSTOMER,
        incoming={
            "employees": "10",
            "active": "yes",
            "go_live": "2026-03-03",
            "tier": "B",
        },
        existing=None,
        partial=False,
    )

    assert out == {
        "employees": 10,
        "active": True,
        "go_live": "2026-03-03",
        "tier": "B",
    }


def test_required_respected_with_partial_merge():
    _mk_def(key="code", label="Codice", field_type=CustomFieldDefinition.FieldType.TEXT, required=True)

    # Existing already has required field -> partial update without it should pass
    out = normalize_and_validate_custom_fields(
        entity=CustomFieldDefinition.Entity.CUSTOMER,
        incoming={"some": "x"},
        existing={"code": "ABC"},
        partial=True,
    )
    assert out is not None
    assert out["code"] == "ABC"
    assert out["some"] == "x"

    # Existing missing required field and incoming doesn't provide it -> should raise
    with pytest.raises(serializers.ValidationError) as exc:
        normalize_and_validate_custom_fields(
            entity=CustomFieldDefinition.Entity.CUSTOMER,
            incoming={"some": "x"},
            existing={},
            partial=True,
        )
    detail = exc.value.detail
    assert "custom_fields" in detail
    assert "code" in detail["custom_fields"]


def test_invalid_values_raise_errors():
    _mk_def(key="n", label="Numero", field_type=CustomFieldDefinition.FieldType.NUMBER)
    _mk_def(key="d", label="Data", field_type=CustomFieldDefinition.FieldType.DATE)
    _mk_def(key="b", label="Bool", field_type=CustomFieldDefinition.FieldType.BOOLEAN)
    _mk_def(key="s", label="Select", field_type=CustomFieldDefinition.FieldType.SELECT, options={"A": "Alpha"})

    with pytest.raises(serializers.ValidationError) as exc:
        normalize_and_validate_custom_fields(
            entity=CustomFieldDefinition.Entity.CUSTOMER,
            incoming={"n": "abc", "d": "03/03/2026", "b": "maybe", "s": "B"},
            existing=None,
            partial=False,
        )

    errs = exc.value.detail["custom_fields"]
    assert "Numero non valido" in str(errs["n"])
    assert "Data non valida" in str(errs["d"])
    assert "boolean" in str(errs["b"]).lower()
    assert "Valore non ammesso" in str(errs["s"])


def test_cleanup_drops_empty_for_non_required_known_keys_and_returns_none_when_empty():
    _mk_def(key="note", label="Note", field_type=CustomFieldDefinition.FieldType.TEXT, required=False)

    out = normalize_and_validate_custom_fields(
        entity=CustomFieldDefinition.Entity.CUSTOMER,
        incoming={"note": ""},
        existing=None,
        partial=False,
    )
    assert out is None
