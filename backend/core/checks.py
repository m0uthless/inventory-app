"""Django system checks custom del progetto.

Fix 2.12 (audit 2026-07): i frontend ARCHIE e AUSL BO possono autenticare su
un dominio e redirigere all'altro. Senza SESSION_COOKIE_DOMAIN impostato su
un dominio condiviso (es. .biotron.it), la sessione resta host-only e
l'utente perde l'autenticazione passando da un frontend all'altro.

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

    if not settings.SESSION_COOKIE_DOMAIN:
        warnings.append(
            Warning(
                "SESSION_COOKIE_DOMAIN non impostato in produzione.",
                hint=(
                    "Se ARCHIE e il portale AUSL BO girano su sottodomini diversi "
                    "(es. archie.biotron.it e auslbo.biotron.it) e condividono "
                    "l'autenticazione, imposta DJANGO_SESSION_COOKIE_DOMAIN=.biotron.it "
                    "nell'env di produzione, altrimenti la sessione resta host-only "
                    "e un redirect tra i due domini perde il login. Se i due "
                    "frontend NON condividono sessione, questo warning è "
                    "atteso e puoi ignorarlo."
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
