from django.db import migrations

# Terza opzione nel catalogo widget dashboard, accanto a 'new-issue' e
# 'new-triage-case' (che restano invariati): un unico widget 2x1 con
# entrambe le scorciatoie affiancate come due quadrati. `key` deve
# corrispondere esattamente a WIDGET_REGISTRY in
# frontend/src/features/dashboard/dashboardTypes.tsx.
WIDGET = dict(
    key='quick-actions-pair', label='Azioni rapide',
    allowed_sizes=[[2, 1]], default_w=2, default_h=1, sort_order=120,
)


def seed_widget(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.update_or_create(key=WIDGET['key'], defaults=WIDGET)


def unseed_widget(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.filter(key=WIDGET['key']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0027_seed_quick_action_widgets'),
    ]

    operations = [
        migrations.RunPython(seed_widget, unseed_widget),
    ]
