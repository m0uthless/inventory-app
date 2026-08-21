# 0.9.1 (WP-05, archie-dataconstraints — audit 2026-08-19, DATA-001):
# os_pwd/app_pwd/vnc_pwd salvano un valore CIFRATO (Fernet), non il
# plaintext. Con max_length=128, un plaintext di 32+ caratteri produce un
# token cifrato che supera 128 caratteri e fallisce il salvataggio.
# Allineati a 512, stesso dimensionamento già usato per
# CustomerVpnAccess.password e DeviceWifi.pass_certificato (entrambi
# cifrati con lo stesso meccanismo).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0011_inventory_location_telefono'),
    ]

    operations = [
        migrations.AlterField(
            model_name='inventory',
            name='os_pwd',
            field=models.CharField(blank=True, max_length=512, null=True),
        ),
        migrations.AlterField(
            model_name='inventory',
            name='app_pwd',
            field=models.CharField(blank=True, max_length=512, null=True),
        ),
        migrations.AlterField(
            model_name='inventory',
            name='vnc_pwd',
            field=models.CharField(blank=True, max_length=512, null=True),
        ),
    ]
