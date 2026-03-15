from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='reportrequest',
            name='resolved_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Risolto il'),
        ),
        migrations.AddField(
            model_name='reportrequest',
            name='resolved_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='resolved_report_requests',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Risolto da',
            ),
        ),
        migrations.AddField(
            model_name='reportrequest',
            name='status',
            field=models.CharField(
                choices=[('open', 'Open'), ('resolved', 'Resolved')],
                default='open',
                max_length=16,
            ),
        ),
        migrations.AddIndex(
            model_name='reportrequest',
            index=models.Index(fields=['status'], name='reportrequest_status_idx'),
        ),
        migrations.AddIndex(
            model_name='reportrequest',
            index=models.Index(fields=['resolved_by'], name='reportrequest_resolved_by_idx'),
        ),
        migrations.AddIndex(
            model_name='reportrequest',
            index=models.Index(fields=['-resolved_at'], name='reportrequest_resolved_at_idx'),
        ),
    ]
