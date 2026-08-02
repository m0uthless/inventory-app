from django.db import migrations

# Due nuove voci nel catalogo widget dashboard: scorciatoie di creazione
# rapida. `key` deve corrispondere esattamente a WIDGET_REGISTRY in
# frontend/src/features/dashboard/dashboardTypes.tsx.
# Formato fisso 1x1: sono semplici tile cliccabili (icona + etichetta), non
# hanno contenuto dinamico da visualizzare — al click aprono direttamente il
# form di creazione della pagina di destinazione (stesso meccanismo già
# usato da SpeedDial/mobile nav: navigate(path, { state: { openCreate: true } })).
WIDGETS = [
    dict(key='new-issue', label='Nuova Issue',
         allowed_sizes=[[1, 1]], default_w=1, default_h=1, sort_order=100),
    dict(key='new-triage-case', label='Nuovo Caso Triage',
         allowed_sizes=[[1, 1]], default_w=1, default_h=1, sort_order=110),
]


def seed_widgets(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    for w in WIDGETS:
        DashboardWidget.objects.update_or_create(key=w['key'], defaults=w)


def unseed_widgets(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.filter(key__in=[w['key'] for w in WIDGETS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0026_seed_birthdays_widget'),
    ]

    operations = [
        migrations.RunPython(seed_widgets, unseed_widgets),
    ]
