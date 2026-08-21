"""Django system checks custom del progetto.

Fix 2.12 (audit 2026-07): il check nasceva per segnalare l'assenza di
SESSION_COOKIE_DOMAIN quando ARCHIE e Portal condividono l'autenticazione
tra sottodomini. Quella premessa non vale più: dal 2026-08-13 (vedi nota in
config/settings.py accanto a SESSION_COOKIE_DOMAIN) è stato deciso il
contrario — un cookie di sessione CONDIVISO tra i sottodomini rompe il
meccanismo di ambito multi-customer del Portal (l'ambito riflette da quale
frontend è stato fatto login, e con un cookie condiviso quell'informazione
non è più affidabile). Il check ora fa l'opposto di prima: segnala se
SESSION_COOKIE_DOMAIN risulta impostato in produzione, perché è quello il
caso da evitare (ARCH-001, audit 2026-08-19, Fase 6).

Questi check girano SEMPRE (anche in `manage.py check` senza `--deploy`) ma
segnalano solo in produzione (DEBUG=False), e sono WARNING non ERROR: non
bloccano l'avvio, danno solo visibilità nei log di deploy/CI.
"""
from django.conf import settings
from django.core.checks import Warning, register


@register()
def check_cross_subdomain_session_config(app_configs, **kwargs):
    if settings.DEBUG:
        return []

    warnings = []

    if settings.SESSION_COOKIE_DOMAIN:
        warnings.append(
            Warning(
                "SESSION_COOKIE_DOMAIN è impostato in produzione.",
                hint=(
                    "Decisione del 2026-08-13: ARCHIE e il Portal NON devono "
                    "condividere il cookie di sessione tra sottodomini, perché "
                    "l'ambito multi-customer del Portal dipende dal frontend "
                    "da cui è stato fatto login (vedi portal/permissions.py, "
                    "_bypasses_portal_scope). Un DJANGO_SESSION_COOKIE_DOMAIN "
                    "condiviso (es. .biotron.it) rompe questo meccanismo. "
                    "Lascia la variabile vuota/non impostata, salvo un nuovo "
                    "cambio di decisione esplicito su come gestire l'ambito."
                ),
                id="core.W001",
            )
        )

    if not settings.SECURE_SSL_REDIRECT:
        warnings.append(
            Warning(
                "SECURE_SSL_REDIRECT è disattivato in produzione.",
                hint=(
                    "Se Caddy/il reverse proxy termina già TLS e forza il redirect "
                    "HTTPS a monte, questo warning è atteso e puoi ignorarlo. "
                    "Altrimenti imposta DJANGO_SECURE_SSL_REDIRECT=1."
                ),
                id="core.W002",
            )
        )

    return warnings
