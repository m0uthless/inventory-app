from __future__ import annotations


def create_auslbo_group(sender, **kwargs):
    """Garantisce l'esistenza di tutti i gruppi Archie e AUSL BO dopo ogni migrate.

    Rinomina i gruppi legacy (viewer→user, auslbo_users→user_auslbo) e
    crea i nuovi gruppi se non esistono. Idempotente.
    """
    try:
        from django.contrib.auth.models import Group

        # Rinomina gruppi legacy
        renames = {
            "viewer":       "user",
            "auslbo_users": "user_auslbo",
        }
        for old_name, new_name in renames.items():
            if Group.objects.filter(name=old_name).exists() and \
               not Group.objects.filter(name=new_name).exists():
                Group.objects.filter(name=old_name).update(name=new_name)

        # Crea tutti i gruppi necessari
        for name in ["admin", "editor", "user",
                     "admin_auslbo", "editor_auslbo", "user_auslbo"]:
            Group.objects.get_or_create(name=name)

    except Exception:
        pass
