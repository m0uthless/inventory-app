from __future__ import annotations

from django.conf import settings
from django.db import models


AUSLBO_GROUP_NAME = "user_auslbo"  # gruppo base portal; editor: editor_auslbo; admin: admin_auslbo


class AuslBoUserProfile(models.Model):
    """Profilo aggiuntivo per utenti con accesso al portal AUSL BO.

    Relazione:
        User (1) ──OneToOne──> AuslBoUserProfile
        AuslBoUserProfile (N) ──FK──> Customer

    Un utente portal vede esclusivamente i dati del cliente associato.
    La presenza di questo record NON implica automaticamente l'accesso
    al portal: l'utente deve anche appartenere a uno dei Group auslbo (admin_auslbo, editor_auslbo, user_auslbo).

    Separare il profilo dal Group consente di:
    - pre-configurare l'associazione cliente prima di abilitare l'accesso
    - revocare temporaneamente l'accesso rimuovendo dal Group senza perdere
      la configurazione del cliente
    - estendere in futuro con campi dedicati (es. notifiche, preferenze)
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="auslbo_profile",
        verbose_name="Utente",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="auslbo_users",
        verbose_name="Cliente associato",
        help_text="Il cliente i cui dati sono visibili a questo utente portal.",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Note",
        help_text="Note interne sull'utente portal (non visibili al portal stesso).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Profilo AUSL BO"
        verbose_name_plural = "Profili AUSL BO"
        ordering = ["user__username"]

    def __str__(self) -> str:
        return f"Portal({self.user_id}) → {self.customer_id}"

    @property
    def is_active(self) -> bool:
        """True se l'utente è in almeno un gruppo AUSL BO (incluso auslbo_users legacy)
        E il customer non è eliminato."""
        try:
            from auslbo.permissions import AUSLBO_GROUPS
            in_group = self.user.groups.filter(name__in=AUSLBO_GROUPS).exists()
            customer_active = self.customer.deleted_at is None
            return in_group and customer_active
        except Exception:
            return False
