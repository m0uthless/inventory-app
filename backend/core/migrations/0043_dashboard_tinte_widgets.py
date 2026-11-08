from django.db import migrations

# Restyle Dashboard "Tinte" (anteprima design-previews/db-base.html, approvata da
# Fede): nuovo widget "Il team oggi" (assenze di oggi dal Piano ferie) e formati
# in più per contributor, compleanni e azioni rapide. I formati esistenti restano
# ammessi, quindi i layout già salvati non cambiano.
ADD_SIZES = {
    'contributor':        [[1, 2], [2, 2]],
    'birthdays':          [[1, 2], [2, 1], [2, 2]],
    'quick-actions-pair': [[1, 1], [2, 1]],
}
OLD_SIZES = {
    'contributor':        [[1, 2]],
    'birthdays':          [[1, 2]],
    'quick-actions-pair': [[1, 1]],
}
TEAM = dict(
    key='team', label='Il team oggi',
    allowed_sizes=[[2, 1], [2, 2], [3, 1], [3, 2]],
    default_w=2, default_h=1, sort_order=95,
)


def forward(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    for key, sizes in ADD_SIZES.items():
        DashboardWidget.objects.filter(key=key).update(allowed_sizes=sizes)
    DashboardWidget.objects.update_or_create(key=TEAM['key'], defaults=TEAM)


def backward(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    UserDashboardLayout = apps.get_model('core', 'UserDashboardLayout')
    for key, sizes in OLD_SIZES.items():
        DashboardWidget.objects.filter(key=key).update(allowed_sizes=sizes)
        w, h = sizes[0]
        UserDashboardLayout.objects.filter(widget__key=key).update(w=w, h=h)
    DashboardWidget.objects.filter(key=TEAM['key']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0042_userprofile_color_mode_palettes'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
