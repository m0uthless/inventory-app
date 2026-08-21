from django.db import migrations, models

# 0.9.1 (WP-05, archie-dataconstraints — audit 2026-08-19, DATA-003):
# "un solo contatto primario per customer/site" era garantito solo in
# application code (ContactViewSet._enforce_primary, eseguito DOPO il
# save, query separata non atomica) — una classica race condition sotto
# richieste concorrenti. Prima di aggiungere il vincolo DB vero e proprio,
# bonifichiamo eventuali violazioni già presenti nei dati (altrimenti la
# migration fallirebbe): per ogni gruppo (customer, site) con più di un
# contatto attivo primario, ne teniamo uno (il più recentemente
# aggiornato) e demuoviamo gli altri.


def dedupe_primary_contacts(apps, schema_editor):
    Contact = apps.get_model("crm", "Contact")

    active_primaries = Contact.objects.filter(is_primary=True, deleted_at__isnull=True)

    groups: dict[tuple, list] = {}
    for c in active_primaries.only("id", "customer_id", "site_id", "updated_at").iterator():
        key = (c.customer_id, c.site_id)
        groups.setdefault(key, []).append(c)

    demoted_ids = []
    for key, contacts in groups.items():
        if len(contacts) <= 1:
            continue
        # Tiene il più recentemente aggiornato, demuove gli altri.
        contacts.sort(key=lambda c: c.updated_at, reverse=True)
        keep, *rest = contacts
        demoted_ids.extend(c.id for c in rest)

    if demoted_ids:
        Contact.objects.filter(id__in=demoted_ids).update(is_primary=False)


def noop_reverse(apps, schema_editor):
    """Reverse intenzionalmente no-op: non c'è modo di sapere quali
    contatti erano primari prima della bonifica, e non ha senso
    reintrodurre uno stato con primari duplicati al downgrade."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0010_customer_province"),
    ]

    operations = [
        migrations.RunPython(dedupe_primary_contacts, noop_reverse),
        migrations.AddConstraint(
            model_name="contact",
            constraint=models.UniqueConstraint(
                fields=["customer"],
                condition=models.Q(is_primary=True, deleted_at__isnull=True, site__isnull=True),
                name="ux_contact_one_primary_per_customer_no_site",
            ),
        ),
        migrations.AddConstraint(
            model_name="contact",
            constraint=models.UniqueConstraint(
                fields=["customer", "site"],
                condition=models.Q(is_primary=True, deleted_at__isnull=True, site__isnull=False),
                name="ux_contact_one_primary_per_customer_site",
            ),
        ),
    ]
