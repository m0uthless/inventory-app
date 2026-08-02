from django.db import migrations

# Nuova voce nel catalogo widget dashboard: nota personale (sticky note).
# `key` deve corrispondere esattamente a WIDGET_REGISTRY in
# frontend/src/features/dashboard/dashboardTypes.tsx.
# Formato fisso 2x2 (nessun resize libero, coerente col widget "contributor"
# che è anch'esso a formato singolo fisso).
WIDGET = dict(
    key='sticky-note', label='Nota personale',
    allowed_sizes=[[2, 2]], default_w=2, default_h=2, sort_order=80,
)


def seed_widget(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.update_or_create(key=WIDGET['key'], defaults=WIDGET)


def unseed_widget(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.filter(key=WIDGET['key']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0023_stickynote'),
    ]

    operations = [
        migrations.RunPython(seed_widget, unseed_widget),
    ]
