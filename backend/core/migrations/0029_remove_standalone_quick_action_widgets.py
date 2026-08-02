from django.db import migrations

# Rimuove dal catalogo i due widget standalone 'new-issue' e
# 'new-triage-case', sostituiti da 'quick-actions-pair' (widget combinato
# 2x1, vedi 0028_seed_quick_actions_pair_widget.py). L'eliminazione delle
# righe DashboardWidget fa CASCADE su eventuali UserDashboardLayout che le
# referenziano (FK on_delete=CASCADE su UserDashboardLayout.widget): chi li
# aveva già aggiunti alla propria dashboard li perde silenziosamente, non
# resta un riferimento pendente che romperebbe il frontend.
WIDGET_KEYS = ['new-issue', 'new-triage-case']

# Definizioni complete per il reverse (stesse di 0027_seed_quick_action_widgets.py).
WIDGETS = [
    dict(key='new-issue', label='Nuova Issue',
         allowed_sizes=[[1, 1]], default_w=1, default_h=1, sort_order=100),
    dict(key='new-triage-case', label='Nuovo Caso Triage',
         allowed_sizes=[[1, 1]], default_w=1, default_h=1, sort_order=110),
]


def remove_widgets(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.filter(key__in=WIDGET_KEYS).delete()


def restore_widgets(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    for w in WIDGETS:
        DashboardWidget.objects.update_or_create(key=w['key'], defaults=w)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0028_seed_quick_actions_pair_widget'),
    ]

    operations = [
        migrations.RunPython(remove_widgets, restore_widgets),
    ]
