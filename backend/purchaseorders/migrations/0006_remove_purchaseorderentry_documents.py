from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('purchaseorders', '0005_copy_documents_to_purchaseorderdocument'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='purchaseorderentry',
            name='offer_document',
        ),
        migrations.RemoveField(
            model_name='purchaseorderentry',
            name='po_document',
        ),
        migrations.RemoveField(
            model_name='purchaseorderentry',
            name='invoice_document',
        ),
    ]
