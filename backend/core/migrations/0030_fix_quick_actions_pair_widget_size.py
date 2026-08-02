from django.db import migrations

# 'quick-actions-pair' (creato in 0028_seed_quick_actions_pair_widget.py come
# 2x1) ridotto a 1x1: le due tile quadrate restano ~112x112 (vincolate
# dall'altezza della riga via aspect-ratio, non dalla larghezza della
# colonna, vedi QuickActionTile fit="square"), quindi stanno comunque
# affiancate anche in una cella larga una sola colonna.
OLD_SIZE = dict(allowed_sizes=[[2, 1]], default_w=2, default_h=1)
NEW_SIZE = dict(allowed_sizes=[[1, 1]], default_w=1, default_h=1)


def resize_forward(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    UserDashboardLayout = apps.get_model('core', 'UserDashboardLayout')
    DashboardWidget.objects.filter(key='quick-actions-pair').update(**NEW_SIZE)
    UserDashboardLayout.objects.filter(widget__key='quick-actions-pair').update(w=1, h=1)


def resize_backward(apps, schema_editor):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    UserDashboardLayout = apps.get_model('core', 'UserDashboardLayout')
    DashboardWidget.objects.filter(key='quick-actions-pair').update(**OLD_SIZE)
    UserDashboardLayout.objects.filter(widget__key='quick-actions-pair').update(w=2, h=1)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0029_remove_standalone_quick_action_widgets'),
    ]

    operations = [
        migrations.RunPython(resize_forward, resize_backward),
    ]
