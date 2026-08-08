from django.db import migrations, models

# Chiavi possibili trovate storicamente nei custom_fields per "provincia"
# (stesso approccio difensivo già usato per "city" in crm/api.py: i dati
# più vecchi possono non essere passati dalla normalizzazione dell'API,
# es. import diretti via management command).
PROVINCE_KEYS = ["provincia", "Provincia", "PROVINCIA", "prov"]


def backfill_province(apps, schema_editor):
    Customer = apps.get_model('crm', 'Customer')

    qs = Customer.objects.exclude(custom_fields__isnull=True)
    for customer in qs.iterator():
        cf = customer.custom_fields
        if not isinstance(cf, dict):
            continue

        found_key = None
        value = None
        for key in PROVINCE_KEYS:
            if key in cf and isinstance(cf[key], str) and cf[key].strip():
                found_key = key
                value = cf[key].strip()
                break

        if found_key is None:
            continue

        # Rimuove la chiave dai custom_fields: ora è colonna strutturata,
        # non deve restare duplicata nel JSON (fonte di verità unica).
        new_cf = dict(cf)
        for key in PROVINCE_KEYS:
            new_cf.pop(key, None)

        customer.province = value
        customer.custom_fields = new_cf
        customer.save(update_fields=['province', 'custom_fields'])


def restore_custom_field_value(apps, schema_editor):
    """Reverse: riscrive il valore nei custom_fields (chiave canonica
    'provincia') prima che la colonna venga rimossa. Non riattiva la
    CustomFieldDefinition: quello lo fa il RunPython dedicato più sotto."""
    Customer = apps.get_model('crm', 'Customer')

    qs = Customer.objects.exclude(province__isnull=True).exclude(province='')
    for customer in qs.iterator():
        cf = customer.custom_fields if isinstance(customer.custom_fields, dict) else {}
        new_cf = dict(cf)
        new_cf['provincia'] = customer.province
        customer.custom_fields = new_cf
        customer.save(update_fields=['custom_fields'])


def deactivate_definition(apps, schema_editor):
    """La CustomFieldDefinition('customer', 'provincia') non serve più: il
    campo è ora strutturato. Soft delete (is_active=False + deleted_at),
    non hard delete, per non perdere lo storico/audit."""
    from django.utils import timezone

    CustomFieldDefinition = apps.get_model('custom_fields', 'CustomFieldDefinition')
    CustomFieldDefinition.objects.filter(entity='customer', key='provincia').update(
        is_active=False, deleted_at=timezone.now(),
    )


def reactivate_definition(apps, schema_editor):
    CustomFieldDefinition = apps.get_model('custom_fields', 'CustomFieldDefinition')
    CustomFieldDefinition.objects.filter(entity='customer', key='provincia').update(
        is_active=True, deleted_at=None,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0009_alter_customervpnaccess_options'),
        ('custom_fields', '0002_alter_customfielddefinition_entity'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='province',
            field=models.CharField(blank=True, max_length=32, null=True, verbose_name='Provincia'),
        ),
        migrations.RunPython(backfill_province, restore_custom_field_value),
        migrations.RunPython(deactivate_definition, reactivate_definition),
    ]
