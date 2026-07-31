from django.db import migrations

# Il widget "Contributor del mese" (trofeo + testo) non ci sta in 1 riga (140px):
# il contenuto veniva tagliato/sovrapposto al widget sottostante. Diventa un
# formato fisso 1x2 (non ridimensionabile, come nell'idea originale) invece
# di 1x1.
WIDGET_KEY = 'contributor'
NEW_ALLOWED_W = [1]
NEW_ALLOWED_H = [2]
NEW_DEFAULT_W = 1
NEW_DEFAULT_H = 2


def fix_contributor_size(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    UserDashboardLayout = apps.get_model('core', 'UserDashboardLayout')

    try:
        widget = DashboardWidget.objects.get(key=WIDGET_KEY)
    except DashboardWidget.DoesNotExist:
        return

    widget.allowed_w = NEW_ALLOWED_W
    widget.allowed_h = NEW_ALLOWED_H
    widget.default_w = NEW_DEFAULT_W
    widget.default_h = NEW_DEFAULT_H
    widget.save(update_fields=['allowed_w', 'allowed_h', 'default_w', 'default_h'])

    # Righe già salvate da utenti che avevano personalizzato la dashboard
    # prima di questa correzione: adeguo l'altezza al nuovo formato fisso
    # per evitare che restino con un valore ora non più ammesso (il bulk
    # endpoint rifiuterebbe un futuro salvataggio con h=1 per questo widget).
    UserDashboardLayout.objects.filter(widget=widget).update(h=NEW_DEFAULT_H, w=NEW_DEFAULT_W)


def noop_reverse(apps, schema_editor):
    # Non ripristiniamo il formato 1x1: era un bug, non un valore voluto.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_seed_dashboard_widgets'),
    ]

    operations = [
        migrations.RunPython(fix_contributor_size, noop_reverse),
    ]
