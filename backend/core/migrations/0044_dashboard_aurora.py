from django.db import migrations

# Dashboard "Aurora" (anteprima design-previews/db-base.html, variante F, approvata da Fede):
# saluto, meteo e azioni rapide passano nella fascia in testa alla pagina, quindi i widget
# "weather" e "quick-actions-pair" escono dal catalogo (restano nel database, disattivati).
# Il Contributor del mese diventa grande la metà (1×2) per far posto al compleanno di oggi;
# i layout che lo avevano 2×2 vengono dimezzati. Nessun formato ammesso viene tolto.
HIDDEN = ('weather', 'quick-actions-pair')


def forward(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    UserDashboardLayout = apps.get_model('core', 'UserDashboardLayout')
    DefaultDashboardLayout = apps.get_model('core', 'DefaultDashboardLayout')
    DashboardWidget.objects.filter(key__in=HIDDEN).update(is_active=False)
    DashboardWidget.objects.filter(key='contributor').update(default_w=1, default_h=2)
    DashboardWidget.objects.filter(key='birthdays').update(default_w=1, default_h=2)
    for Layout in (UserDashboardLayout, DefaultDashboardLayout):
        Layout.objects.filter(widget__key='contributor', w=2, h=2).update(w=1)


def backward(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.filter(key__in=HIDDEN).update(is_active=True)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0043_dashboard_tinte_widgets'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
