from django.middleware.csrf import CsrfViewMiddleware


class CsrfAllowAllOriginsMiddleware(CsrfViewMiddleware):
    """CSRF middleware che accetta qualsiasi Origin/Referer.

    Utile in LAN/dev quando apri l'admin da IP/host diversi e non vuoi
    mantenere aggiornata CSRF_TRUSTED_ORIGINS.

    ATTENZIONE: abilitalo solo in ambienti di sviluppo/rete interna.
    """

    def _origin_verified(self, request):
        return True

    def _check_referer(self, request):
        return

    def process_view(self, request, callback, callback_args, callback_kwargs):
        # Aggiungiamo il flag che Django controlla prima di tutto il resto:
        # se presente, salta completamente la verifica CSRF.
        request._dont_enforce_csrf_checks = True
        return super().process_view(request, callback, callback_args, callback_kwargs)
