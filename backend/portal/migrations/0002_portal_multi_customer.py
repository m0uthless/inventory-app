from __future__ import annotations

from django.db import migrations, models


def populate_customers_from_default(apps, schema_editor):
    """Ogni profilo esistente aveva un solo customer (FK diretta): lo aggiunge
    anche alla nuova M2M 'customers', così nessun utente perde l'accesso al
    proprio cliente col passaggio al modello multi-cliente."""
    PortalUserProfile = apps.get_model("portal", "PortalUserProfile")
    for profile in PortalUserProfile.objects.all():
        profile.customers.add(profile.customer_id)


def reverse_noop(apps, schema_editor):
    # Nessuna azione: il rollback dello schema (RemoveField) elimina già
    # la tabella M2M con tutti i suoi dati.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0008_customer_vpn_access"),
        ("portal", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="portaluserprofile",
            name="customers",
            field=models.ManyToManyField(
                blank=True,
                help_text="Tutti i clienti che questo utente può selezionare nel "
                          "portale (0.9.0: multi-cliente). Deve includere 'customer'.",
                related_name="portal_users_assigned",
                to="crm.customer",
                verbose_name="Clienti assegnati",
            ),
        ),
        migrations.AlterField(
            model_name="portaluserprofile",
            name="customer",
            field=models.ForeignKey(
                help_text="Cliente mostrato al login e usato come fallback se la "
                          "sessione non ha ancora un cliente attivo. Deve sempre far "
                          "parte di 'customers'.",
                on_delete=models.deletion.PROTECT,
                related_name="portal_users",
                to="crm.customer",
                verbose_name="Cliente di default",
            ),
        ),
        migrations.RunPython(populate_customers_from_default, reverse_noop),
    ]
