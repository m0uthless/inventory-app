from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_inventorytype_is_hw'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Announcement',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255, verbose_name='Titolo')),
                ('body', models.TextField(verbose_name='Testo')),
                ('category', models.CharField(
                    choices=[('news', 'News'), ('warning', 'Avviso'), ('maintenance', 'Manutenzione')],
                    default='news', max_length=20, verbose_name='Categoria',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='announcements',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Comunicazione',
                'verbose_name_plural': 'Comunicazioni',
                'ordering': ['-created_at'],
            },
        ),
    ]
