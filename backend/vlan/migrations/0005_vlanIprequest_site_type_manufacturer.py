from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('device', '0001_initial'),
        ('vlan', '0004_vlanIprequest_modalita_freetext'),
    ]

    operations = [
        migrations.AddField(
            model_name='vlanIprequest',
            name='site',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='vlan_ip_requests',
                to='crm.site',
                verbose_name='Sede',
            ),
        ),
        migrations.AddField(
            model_name='vlanIprequest',
            name='device_type',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='vlan_ip_requests',
                to='device.devicetype',
                verbose_name='Tipo Device',
            ),
        ),
        migrations.AddField(
            model_name='vlanIprequest',
            name='manufacturer',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='vlan_ip_requests',
                to='device.devicemanufacturer',
                verbose_name='Produttore',
            ),
        ),
    ]
