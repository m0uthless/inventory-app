from __future__ import annotations


def create_auslbo_group(sender, **kwargs):
    """Rinomina i gruppi legacy dopo ogni migrate. Idempotente.

    Non crea gruppi con nomi fissi: i gruppi sono gestiti liberamente
    tramite Django Admin. Vengono solo rinominati i gruppi legacy
    creati nelle versioni precedenti di ARCHIE.
    """
    try:
        from django.contrib.auth.models import Group

        renames = {
            "viewer":       "user",
            "auslbo_users": "user_auslbo",
        }
        for old_name, new_name in renames.items():
            if Group.objects.filter(name=old_name).exists() and \
               not Group.objects.filter(name=new_name).exists():
                Group.objects.filter(name=old_name).update(name=new_name)

    except Exception:
        pass
