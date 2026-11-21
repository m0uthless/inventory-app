from django.db import migrations

# Widget «Issue ancora aperte» (anteprima design-previews/dbw-base.html, variante B scelta
# da Fede il 21/11): arretrato nel tempo da `/api/issues/trend/`. Non entra nei layout
# esistenti: ognuno lo aggiunge da «Personalizza».
TREND = dict(
    key='issue-trend', label='Issue ancora aperte',
    allowed_sizes=[[2, 2], [3, 2], [4, 2], [2, 3], [3, 3]],
    default_w=3, default_h=2, sort_order=35,
)


def forward(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.update_or_create(key=TREND['key'], defaults=TREND)


def backward(apps, schema_editor):
    apps.get_model('core', 'DashboardWidget').objects.filter(key=TREND['key']).delete()


class Migration(migrations.Migration):
    dependencies = [('core', '0051_areatask_waiting_reason')]
    operations = [migrations.RunPython(forward, backward)]
