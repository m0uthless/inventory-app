from __future__ import annotations

from django.conf import settings
from django.db import models




class AuslBoUserProfile(models.Model):
    """Profilo aggiuntivo per utenti con accesso al portal AUSL BO.

    Relazione:
        User (1) ──OneToOne──> AuslBoUserProfile
        AuslBoUserProfile (N) ──FK──> Customer

    Un utente portal vede esclusivamente i dati del cliente associato.
    La presenza di questo record NON implica automaticamente l'accesso
    al portal: è sufficiente che esista un AuslBoUserProfile associato all'utente.

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
        """True se il customer non è eliminato.

        L'accesso al portal è controllato dalla sola esistenza del profilo:
        i gruppi Django gestiscono i permessi sui modelli, non il gate di accesso.
        """
        try:
            return self.customer.deleted_at is None
        except Exception:
            return False
