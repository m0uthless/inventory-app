"""core/emails.py — Helper condiviso per l'invio di email HTML brandizzate.

Vedi docs/superpowers/specs/2026-08-25-email-templates-design.md per il
design completo. Il brand (Archie vs Portal) viene rilevato
automaticamente in base al modulo Python da cui viene chiamato
`send_templated_email`, così i moduli applicativi non devono passare
nessun parametro di branding esplicito.
"""
from __future__ import annotations


def _brand_for_module(module_name: str) -> str:
    """Ritorna "portal" se `module_name` appartiene al package `portal`
    (cioè è "portal" o inizia per "portal."), altrimenti "archie"
    (default per tutti gli altri moduli applicativi).
    """
    if module_name == "portal" or module_name.startswith("portal."):
        return "portal"
    return "archie"
