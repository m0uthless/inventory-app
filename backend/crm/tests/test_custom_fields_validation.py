import pytest

from core.models import CustomerStatus
from custom_fields.models import CustomFieldDefinition


@pytest.mark.django_db
def test_customer_custom_fields_invalid_type_returns_400(api_client, superuser):
    """If a custom field is defined as number, sending a string should 400."""
    CustomFieldDefinition.objects.create(
        entity=CustomFieldDefinition.Entity.CUSTOMER,
        key="vat_number",
        label="P.IVA",
        field_type=CustomFieldDefinition.FieldType.NUMBER,
        required=False,
    )

    api_client.force_authenticate(user=superuser)
    status_obj = CustomerStatus.objects.create(key="active", label="Attivo")
    payload = {
        "name": "ACME",
        "status": status_obj.id,
        "custom_fields": {"vat_number": "NOT_A_NUMBER"},
    }
    resp = api_client.post("/api/customers/", payload, format="json")
    assert resp.status_code == 400
