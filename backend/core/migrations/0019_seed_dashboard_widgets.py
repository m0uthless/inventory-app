from django.db import migrations

# Catalogo iniziale dei widget dashboard. `key` deve corrispondere esattamente
# a WIDGET_REGISTRY in frontend/src/features/dashboard/dashboardTypes.ts.
WIDGETS = [
    dict(key='weather',        label='Meteo',                allowed_w=[2, 3, 4, 5],    allowed_h=[1],       default_w=4, default_h=1, sort_order=10),
    dict(key='contributor',    label='Contributor del mese',  allowed_w=[1],             allowed_h=[1],       default_w=1, default_h=1, sort_order=20),
    dict(key='issues',         label='Issues aperti',         allowed_w=[2, 3, 4],       allowed_h=[2, 3],    default_w=3, default_h=2, sort_order=30),
    dict(key='area-tasks',     label='Task di area',          allowed_w=[2, 3, 4],       allowed_h=[2, 3],    default_w=3, default_h=2, sort_order=40),
    dict(key='announcements',  label='Comunicazioni',         allowed_w=[2, 3, 4],       allowed_h=[1, 2],    default_w=3, default_h=2, sort_order=50),
    dict(key='todo',           label='I miei task',           allowed_w=[2, 3, 4],       allowed_h=[2, 3],    default_w=3, default_h=2, sort_order=60),
    dict(key='maintenance',    label='Manutenzioni',          allowed_w=[2, 3, 4],       allowed_h=[2, 3],    default_w=3, default_h=2, sort_order=70),
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
        ('core', '0018_dashboardwidget_userdashboardlayout'),
    ]

    operations = [
        migrations.RunPython(seed_widgets, unseed_widgets),
    ]
