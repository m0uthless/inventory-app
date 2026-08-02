from django.db import migrations

# 'sticky-note' (creato in 0024_seed_sticky_note_widget.py come formato
# fisso 2x2) diventa ridimensionabile: tutte le combinazioni cartesiane
# larghezza 1-6 colonne × altezza 1-5 righe (il contenuto — header + area di
# testo che riempie lo spazio disponibile — si adatta a qualsiasi
# dimensione, non ci sono vincoli di layout interno come per il meteo).
ALLOWED_SIZES = [[w, h] for w in range(1, 7) for h in range(1, 6)]

OLD_SIZE = dict(allowed_sizes=[[2, 2]], default_w=2, default_h=2)
NEW_SIZE = dict(allowed_sizes=ALLOWED_SIZES, default_w=2, default_h=2)


def resize_forward(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.filter(key='sticky-note').update(**NEW_SIZE)


def resize_backward(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    DashboardWidget.objects.filter(key='sticky-note').update(**OLD_SIZE)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0030_fix_quick_actions_pair_widget_size'),
    ]

    operations = [
        migrations.RunPython(resize_forward, resize_backward),
    ]
