
from __future__ import annotations

from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

from audit.utils import log_event


@receiver(user_logged_in)
def audit_login(sender, request, user, **kwargs):
    # Registra login utente come evento audit
    # (Non deve mai bloccare l'autenticazione)
    try:
        subject = (user.get_full_name() or user.username or str(user)).strip()
        log_event(
            actor=user,
            action="login",
            instance=user,
            changes=None,
            request=request,
            subject=subject,
        )
    except Exception:
        pass
