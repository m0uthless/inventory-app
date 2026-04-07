from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('vlan', '0005_vlanIprequest_site_type_manufacturer'),
    ]

    operations = [
        migrations.AddField(
            model_name='vlanIprequest',
            name='reparto',
            field=models.CharField(
                blank=True, max_length=128, null=True, verbose_name='Reparto'
            ),
        ),
    ]
