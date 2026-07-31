from django.db import migrations

WIDGET_KEY = 'weather'
NEW_ALLOWED_SIZES = [[2, 2], [3, 2], [4, 2], [5, 2]]
NEW_DEFAULT_W = 4
NEW_DEFAULT_H = 2


def fix_weather_size(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    UserDashboardLayout = apps.get_model('core', 'UserDashboardLayout')

    try:
        widget = DashboardWidget.objects.get(key=WIDGET_KEY)
    except DashboardWidget.DoesNotExist:
        return

    widget.allowed_sizes = NEW_ALLOWED_SIZES
    widget.default_w = NEW_DEFAULT_W
    widget.default_h = NEW_DEFAULT_H
    widget.save(update_fields=['allowed_sizes', 'default_w', 'default_h'])

    # Layout utente già salvati col meteo ad altezza 1 (ora non più ammessa):
    # forzo l'altezza a 2 mantenendo la larghezza già scelta dall'utente
    # (2-5, invariata rispetto a prima).
    for row in UserDashboardLayout.objects.filter(widget=widget):
        if [row.w, row.h] not in NEW_ALLOWED_SIZES:
            row.h = NEW_DEFAULT_H
            row.save(update_fields=['h'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0021_replace_allowed_wh_with_allowed_sizes'),
    ]

    operations = [
        migrations.RunPython(fix_weather_size, noop_reverse),
    ]
