from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models

import purchaseorders.models


class Migration(migrations.Migration):

    dependencies = [
        ('purchaseorders', '0003_purchaseorderentry_notes'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PurchaseOrderDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('offer', 'Offerta'), ('po', 'Purchase Order'), ('invoice', 'Fattura')], max_length=16)),
                ('file', models.FileField(upload_to=purchaseorders.models.purchase_order_document_upload_path)),
                ('original_filename', models.CharField(blank=True, max_length=255)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('entry', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='purchaseorders.purchaseorderentry')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Documento Purchase Order',
                'verbose_name_plural': 'Documenti Purchase Order',
                'ordering': ['-uploaded_at'],
            },
        ),
        migrations.AddIndex(
            model_name='purchaseorderdocument',
            index=models.Index(fields=['entry', 'kind'], name='po_doc_entry_kind_idx'),
        ),
    ]
