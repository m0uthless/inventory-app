from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0007_customer_custom_fields_gin_index"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomerVpnAccess",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("applicativo", models.CharField(blank=True, max_length=128, null=True)),
                ("utenza", models.CharField(blank=True, max_length=255, null=True)),
                ("password", models.CharField(blank=True, max_length=512, null=True)),
                ("remote_address", models.CharField(blank=True, max_length=255, null=True)),
                ("porta", models.CharField(blank=True, max_length=16, null=True)),
                ("note", models.TextField(blank=True, null=True)),
                (
                    "customer",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vpn_access",
                        to="crm.customer",
                        verbose_name="Cliente",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+", to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+", to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Accesso VPN Cliente",
                "verbose_name_plural": "Accessi VPN Clienti",
                "permissions": [("view_vpn_secrets", "Can view VPN secrets (password)")],
            },
        ),
    ]
