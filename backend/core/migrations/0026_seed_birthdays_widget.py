from django.db import migrations

# Nuova voce nel catalogo widget dashboard: prossimo compleanno.
# `key` deve corrispondere esattamente a WIDGET_REGISTRY in
# frontend/src/features/dashboard/dashboardTypes.tsx.
# Formato fisso 1x2, stesso ingombro di "contributor" (stesso stile hero
# a singolo elemento featured).
WIDGET = dict(
    key='birthdays', label='Compleanni',
    allowed_sizes=[[1, 2]], default_w=1, default_h=2, sort_order=90,
)


def seed_widget(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.update_or_create(key=WIDGET['key'], defaults=WIDGET)


def unseed_widget(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.filter(key=WIDGET['key']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0025_userprofile_birth_date'),
    ]

    operations = [
        migrations.RunPython(seed_widget, unseed_widget),
    ]
