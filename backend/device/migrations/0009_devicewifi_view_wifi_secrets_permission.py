from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('device', '0008_devicewifi_mac_address'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='devicewifi',
            options={
                'verbose_name': 'WiFi device',
                'verbose_name_plural': 'WiFi device',
                'permissions': [
                    ('view_wifi_secrets', 'Può visualizzare/modificare la password del certificato WiFi'),
                ],
            },
        ),
    ]
