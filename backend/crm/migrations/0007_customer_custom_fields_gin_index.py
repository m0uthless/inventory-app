from django.contrib.postgres.indexes import GinIndex
from django.db import migrations


class Migration(migrations.Migration):
    """
    Performance: aggiunge un indice GIN su Customer.custom_fields.

    CustomerFilter.filter_city esegue una ricerca __icontains sul campo JSON
    (via Cast a TextField). Con molti clienti la query fa un full-table scan;
    il GIN index velocizza le ricerche sul contenuto del JSONField.
    """

    dependencies = [
        ("crm", "0006_add_indexes"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="customer",
            index=GinIndex(
                fields=["custom_fields"],
                name="cust_custom_fields_gin",
            ),
        ),
    ]
