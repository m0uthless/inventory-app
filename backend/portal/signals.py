from __future__ import annotations


def create_portal_group(sender, **kwargs):
    """Rinomina i gruppi legacy dopo ogni migrate. Idempotente.

    Non crea gruppi con nomi fissi: i gruppi sono gestiti liberamente
    tramite Django Admin. Vengono solo rinominati i gruppi legacy
    creati nelle versioni precedenti di ARCHIE (incluso il nome usato
    prima del rename del modulo AUSL BO → Portal in 0.9.0).
    """
    try:
        from django.contrib.auth.models import Group

        renames = {
            "viewer":       "user",
            "auslbo_users": "user_portal",  # nome legacy pre-0.8.x
            "user_auslbo":  "user_portal",  # nome intermedio pre-rename 0.9.0
        }
        for old_name, new_name in renames.items():
            if Group.objects.filter(name=old_name).exists() and \
               not Group.objects.filter(name=new_name).exists():
                Group.objects.filter(name=old_name).update(name=new_name)

    except Exception:
        pass
