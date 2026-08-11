from django.db import migrations

# Ampliamento formati ammessi per 5 widget dashboard (richiesta Fede, punto 3
# della minor release). I default restano invariati per tutti (già dentro i
# nuovi range): non serve toccare default_w/default_h.
#
# - announcements: h passa da 1-2 a 2-3 (w invariato 2-4)
# - todo, area-tasks, maintenance, issues: h passa da 2-3 a 2-4 (w invariato 2-4)
NEW_ALLOWED_SIZES = {
    'announcements': [[w, h] for w in range(2, 5) for h in range(2, 4)],
    'todo':          [[w, h] for w in range(2, 5) for h in range(2, 5)],
    'area-tasks':    [[w, h] for w in range(2, 5) for h in range(2, 5)],
    'maintenance':   [[w, h] for w in range(2, 5) for h in range(2, 5)],
    'issues':        [[w, h] for w in range(2, 5) for h in range(2, 5)],
}

# Valori precedenti, per il reverse.
OLD_ALLOWED_SIZES = {
    'announcements': [[2, 1], [2, 2], [3, 1], [3, 2], [4, 1], [4, 2]],
    'todo':          [[2, 2], [2, 3], [3, 2], [3, 3], [4, 2], [4, 3]],
    'area-tasks':    [[2, 2], [2, 3], [3, 2], [3, 3], [4, 2], [4, 3]],
    'maintenance':   [[2, 2], [2, 3], [3, 2], [3, 3], [4, 2], [4, 3]],
    'issues':        [[2, 2], [2, 3], [3, 2], [3, 3], [4, 2], [4, 3]],
}


def _apply(apps, schema_editor, sizes_by_key):
    DashboardWidget = apps.get_model('core', 'DashboardWidget')
    UserDashboardLayout = apps.get_model('core', 'UserDashboardLayout')

    for key, sizes in sizes_by_key.items():
        DashboardWidget.objects.filter(key=key).update(allowed_sizes=sizes)

    # Layout utente già salvati con una coppia (w,h) non più tra quelle
    # ammesse (rilevante solo per announcements, che perde le combinazioni
    # h=1): snap alla coppia ammessa più vicina in distanza Manhattan, stesso
    # criterio già usato in 0021/0022.
    for widget in DashboardWidget.objects.filter(key__in=sizes_by_key.keys()):
        allowed = widget.allowed_sizes
        for row in UserDashboardLayout.objects.filter(widget=widget):
            if [row.w, row.h] in allowed:
                continue
            nearest = min(allowed, key=lambda p: abs(p[0] - row.w) + abs(p[1] - row.h))
            row.w, row.h = nearest
            row.save(update_fields=['w', 'h'])


def resize_forward(apps, schema_editor):
    _apply(apps, schema_editor, NEW_ALLOWED_SIZES)


def resize_backward(apps, schema_editor):
    _apply(apps, schema_editor, OLD_ALLOWED_SIZES)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0034_userprofile_gender'),
    ]

    operations = [
        migrations.RunPython(resize_forward, resize_backward),
    ]
