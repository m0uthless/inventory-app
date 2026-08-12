from __future__ import annotations

from django.conf import settings
from django.db import models




class PortalUserProfile(models.Model):
    """Profilo aggiuntivo per utenti con accesso al portale clienti (Portal).

    Relazione:
        User (1) ──OneToOne──> PortalUserProfile
        PortalUserProfile (N) ──FK──> Customer

    Un utente portale vede esclusivamente i dati del cliente associato.
    La presenza di questo record NON implica automaticamente l'accesso
    al portale: è sufficiente che esista un PortalUserProfile associato all'utente.

    Separare il profilo dal Group consente di:
    - pre-configurare l'associazione cliente prima di abilitare l'accesso
    - revocare temporaneamente l'accesso rimuovendo dal Group senza perdere
      la configurazione del cliente
    - estendere in futuro con campi dedicati (es. notifiche, preferenze)
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="portal_profile",
        verbose_name="Utente",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="portal_users",
        verbose_name="Cliente di default",
        help_text="Cliente mostrato al login e usato come fallback se la sessione non ha "
                   "ancora un cliente attivo. Deve sempre far parte di 'customers'.",
    )
    customers = models.ManyToManyField(
        "crm.Customer",
        related_name="portal_users_assigned",
        blank=True,
        verbose_name="Clienti assegnati",
        help_text="Tutti i clienti che questo utente può selezionare nel portale "
                   "(0.9.0: multi-cliente). Deve includere 'customer'.",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Note",
        help_text="Note interne sull'utente portale (non visibili al portale stesso).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Profilo Portal"
        verbose_name_plural = "Profili Portal"
        ordering = ["user__username"]

    def __str__(self) -> str:
        return f"Portal({self.user_id}) → {self.customer_id}"

    @property
    def is_active(self) -> bool:
        """True se il cliente di default esiste, non è eliminato, ED è ancora
        tra i clienti assegnati.

        0.9.0 (multi-cliente): se un admin disattiva/rimuove il cliente di
        default dagli assegnati, l'accesso si blocca esplicitamente (nessun
        fallback automatico su un altro cliente assegnato) finché un admin
        non riassegna un nuovo default — vedi PortalMeView per il messaggio
        mostrato al portale in questo caso.

        L'accesso al portale è controllato dalla sola esistenza di un profilo
        attivo: i gruppi Django gestiscono i permessi sui modelli, non il gate
        di accesso.
        """
        try:
            return (
                self.customer_id is not None
                and self.customer.deleted_at is None
                and self.customers.filter(pk=self.customer_id).exists()
            )
        except Exception:
            return False
