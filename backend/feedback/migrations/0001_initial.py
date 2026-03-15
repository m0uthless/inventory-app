from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ReportRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('kind', models.CharField(choices=[('bug', 'Report a bug'), ('feature', 'Request feature')], default='bug', max_length=16)),
                ('section', models.CharField(choices=[('dashboard', 'Dashboard'), ('site_repository', 'Site Repository'), ('customers', 'Customers'), ('sites', 'Sites'), ('contacts', 'Contacts'), ('inventory', 'Inventory'), ('issues', 'Issues'), ('audit', 'Audit'), ('maintenance', 'Maintenance'), ('drive', 'Drive'), ('wiki', 'Wiki'), ('search', 'Ricerca'), ('profile', 'Profilo'), ('trash', 'Cestino'), ('other', 'Altro')], default='other', max_length=32)),
                ('description', models.TextField(verbose_name='Descrizione')),
                ('screenshot', models.FileField(blank=True, null=True, upload_to='report_request_screenshots/')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='report_requests', to=settings.AUTH_USER_MODEL, verbose_name='Creato da')),
            ],
            options={
                'verbose_name': 'Report / Request',
                'verbose_name_plural': 'Report / Request',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='reportrequest',
            index=models.Index(fields=['kind'], name='reportrequest_kind_idx'),
        ),
        migrations.AddIndex(
            model_name='reportrequest',
            index=models.Index(fields=['section'], name='reportrequest_section_idx'),
        ),
        migrations.AddIndex(
            model_name='reportrequest',
            index=models.Index(fields=['created_by'], name='reportrequest_created_by_idx'),
        ),
        migrations.AddIndex(
            model_name='reportrequest',
            index=models.Index(fields=['-created_at'], name='reportrequest_created_at_idx'),
        ),
    ]
