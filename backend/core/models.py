from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def soft_delete(self):
        self.deleted_at = timezone.now()
        # updated_at deve essere esplicitato quando si usa update_fields,
        # altrimenti auto_now=True non viene attivato da Django.
        update_fields = ["deleted_at"]
        if hasattr(self, "updated_at"):
            update_fields.append("updated_at")
        self.save(update_fields=update_fields)

class TimeStampedModel(SoftDeleteModel):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class LookupBase(TimeStampedModel):
    key = models.CharField(max_length=64)
    label = models.CharField(max_length=128)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.label

class CustomerStatus(LookupBase):
    class Meta:
        verbose_name = "Customer status"
        verbose_name_plural = "Customer Statuses"
        constraints = [
            models.UniqueConstraint(
                fields=["key"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_customer_statuses_key_active",
            )
        ]

class SiteStatus(LookupBase):
    class Meta:
        verbose_name = "Site status"
        verbose_name_plural = "Site Statuses"
        constraints = [
            models.UniqueConstraint(
                fields=["key"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_site_statuses_key_active",
            )
        ]

class InventoryStatus(LookupBase):
    class Meta:
        verbose_name = "Inventory status"
        verbose_name_plural = "Inventory Statuses"
        constraints = [
            models.UniqueConstraint(
                fields=["key"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_inventory_statuses_key_active",
            )
        ]

class InventoryType(LookupBase):
    is_hw = models.BooleanField(
        default=False,
        verbose_name="Hardware",
        help_text="Indica se questo tipo di inventory è un dispositivo hardware (Y) o software/altro (N).",
    )

    class Meta:
        verbose_name = "Inventory type"
        verbose_name_plural = "Inventory types"
        constraints = [
            models.UniqueConstraint(
                fields=["key"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_inventory_types_key_active",
            )
        ]

class AppSetting(TimeStampedModel):
    key = models.CharField(max_length=128, unique=True)
    value = models.TextField()

    def __str__(self):
        return self.key
class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    preferred_customer = models.ForeignKey(
        "crm.Customer",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="preferred_by_users",
    )
    is_philips = models.BooleanField(
        default=False, verbose_name="Philips",
        help_text="Utente assegnabile ai case ServiceNow di categoria Philips (se falso: Biotron). Impostabile solo da admin.",
    )
    is_servicenow_technician = models.BooleanField(
        default=True, verbose_name="Tecnico ServiceNow",
        help_text="Se disattivato, l'utente non è assegnabile a nessun case ServiceNow "
                   "(né Philips né Biotron) e non compare nel Triage / Statistiche. "
                   "Impostabile solo da admin.",
    )
    is_functional_account = models.BooleanField(
        default=False, verbose_name="Account funzionale",
        help_text="Utente di servizio (es. ac.philips, ris.philips, cdd.biotron, jolly.philips) "
                   "usato solo come assegnatario automatico di fallback per i case ServiceNow "
                   "senza un tecnico reale disponibile: resta assegnabile normalmente, ma non "
                   "compare nel pannello Triage né nella vista settimanale assenze, dato che non "
                   "è una persona. Impostabile solo da admin.",
    )
    is_leave_coordinator = models.BooleanField(
        default=False, verbose_name="Coordinatore piano ferie",
        help_text="Se attivo, l'utente può validare/rifiutare le proposte di ferie e "
                   "inserire attività (training/104/malattia/…) per chiunque nel Piano Ferie. "
                   "Impostabile solo da admin.",
    )
    leave_area = models.ForeignKey(
        "attendance.LeaveArea",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
        verbose_name="Area piano ferie",
        help_text="Area organizzativa usata per raggruppare le righe del Piano Ferie.",
    )
    is_expense_secretary = models.BooleanField(
        default=False, verbose_name="Segreteria rimborsi spese",
        help_text="Se attivo, l'utente può vedere tutte le note spese dei dipendenti e "
                   "validarle/rifiutarle. Impostabile solo da admin.",
    )
    birth_date = models.DateField(
        null=True, blank=True, verbose_name="Data di nascita",
        help_text="Usata dal widget dashboard 'Compleanni'. Impostabile solo da admin.",
    )

    class Gender(models.TextChoices):
        MALE = "M", "Uomo"
        FEMALE = "F", "Donna"

    gender = models.CharField(
        max_length=1, choices=Gender.choices, null=True, blank=True,
        verbose_name="Genere",
        help_text="Usato per personalizzare i saluti (es. widget Meteo). Impostabile solo da admin.",
    )

    class Theme(models.TextChoices):
        DEFAULT = "default", "Predefinito (teal)"

    theme = models.CharField(
        max_length=16, choices=Theme.choices, default=Theme.DEFAULT,
        verbose_name="Tema interfaccia",
        help_text="Tema grafico del frontend Archie. Preferenza personale, modificabile "
                   "dall'utente stesso dal proprio profilo (a differenza degli altri campi "
                   "di questo modello). Persiste cross-device essendo salvato lato server.",
    )

    last_seen_changelog = models.ForeignKey(
        "core.ChangelogEntry",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        verbose_name="Ultima voce changelog vista",
        help_text="Impostato automaticamente quando l'utente conferma di aver letto il changelog.",
    )

    def __str__(self):
        return f"Profile({self.user_id})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


class Announcement(models.Model):
    CATEGORY_CHOICES = [
        ('news',        'News'),
        ('warning',     'Avviso'),
        ('maintenance', 'Manutenzione'),
    ]
    title       = models.CharField(max_length=255, verbose_name='Titolo')
    body        = models.TextField(verbose_name='Testo')
    category    = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='news', verbose_name='Categoria')
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='announcements',
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Comunicazione'
        verbose_name_plural = 'Comunicazioni'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ChangelogEntry(models.Model):
    """Voce di changelog applicativo, mostrata agli utenti al login (fino a
    dismissal via checkbox) e consultabile in qualsiasi momento dal menu
    utente. Contenuto in Markdown, renderizzato lato frontend (nessun HTML
    salvato/eseguito lato server).
    """
    version     = models.CharField(max_length=32, blank=True, verbose_name='Versione')
    title       = models.CharField(max_length=255, verbose_name='Titolo')
    body        = models.TextField(verbose_name='Testo (Markdown)')
    date        = models.DateField(default=timezone.localdate, verbose_name='Data rilascio')
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='changelog_entries',
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Voce changelog'
        verbose_name_plural = 'Changelog'
        # Ordinamento di lettura per data rilascio; il controllo "letto/non
        # letto" per utente si basa invece sull'id (ordine di inserimento),
        # vedi core.api.ChangelogUnseenView.
        ordering = ['-date', '-id']

    def __str__(self):
        return f"{self.version + ' — ' if self.version else ''}{self.title}"


class ArchieAccess(models.Model):
    """Modello dummy (managed=False) usato esclusivamente per registrare
    il permesso custom `core.access_archie`.

    Non crea nessuna tabella nel DB. Assegna il permesso a un gruppo via
    Django Admin per controllare l'accesso al frontend Archie principale,
    senza vincolarsi a nomi di gruppi hardcoded.
    """

    class Meta:
        managed = False
        default_permissions = ()
        permissions = [
            ("access_archie", "Può accedere al frontend Archie"),
        ]


class UserManagementAccess(models.Model):
    """Modello dummy (managed=False) usato esclusivamente per registrare
    il permesso custom `core.manage_users`.

    Non crea nessuna tabella nel DB. Assegna il permesso a un gruppo o a un
    utente per abilitare l'accesso al pannello "Utenti e Gruppi" (gestione
    utenti, gruppi, permessi RWD per modulo, reset password).
    """

    class Meta:
        managed = False
        default_permissions = ()
        permissions = [
            ("manage_users", "Può gestire utenti, gruppi e permessi"),
        ]


class UserTask(models.Model):
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tasks',
    )
    text       = models.CharField(max_length=500, verbose_name='Testo')
    done       = models.BooleanField(default=False, verbose_name='Completato')
    created_at = models.DateTimeField(auto_now_add=True)
    done_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Task'
        verbose_name_plural = 'Task'
        ordering = ['done', '-created_at']

    def __str__(self):
        return f"{self.user} — {self.text[:40]}"


class AreaTask(TimeStampedModel):
    """Task specifico di un'area organizzativa (stessa `attendance.LeaveArea`
    già usata come area del profilo utente — vedi `UserProfile.leave_area`).

    Chiunque appartenga all'area può creare/modificare/chiudere i task della
    propria area; le altre aree sono visibili in sola lettura. I task
    completati vengono nascosti dalle liste 3 giorni dopo il completamento
    (filtro in `get_queryset` della viewset), ma restano in DB.

    Soft-delete + audit: eredita `deleted_at` da TimeStampedModel (stesso
    pattern di `SoftDeleteAuditMixin` usato nel resto del progetto — vedi
    `core/mixins.py`). Per ora il ripristino non è esposto in UI: il
    soft-delete serve come salvaguardia/audit trail, non come cestino
    consultabile dall'utente.
    """

    STATUS_DA_FARE    = 'da_fare'
    STATUS_IN_CORSO   = 'in_corso'
    STATUS_COMPLETATO = 'completato'
    STATUS_CHOICES = [
        (STATUS_DA_FARE, 'Da fare'),
        (STATUS_IN_CORSO, 'In corso'),
        (STATUS_COMPLETATO, 'Completato'),
    ]

    # Nascondi i task completati dalle liste dopo N giorni dal completamento.
    HIDE_COMPLETED_AFTER_DAYS = 3

    area = models.ForeignKey(
        'attendance.LeaveArea',
        on_delete=models.CASCADE,
        related_name='tasks',
        verbose_name='Area',
    )
    title       = models.CharField(max_length=200, verbose_name='Titolo')
    description = models.TextField(blank=True, verbose_name='Descrizione')
    status      = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_DA_FARE, verbose_name='Stato',
    )
    due_date = models.DateField(null=True, blank=True, verbose_name='Scadenza')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_area_tasks',
        verbose_name='Creato da',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='updated_area_tasks',
        verbose_name='Ultima modifica di',
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Task di area'
        verbose_name_plural = 'Task di area'
        ordering = ['status', 'due_date', '-created_at']
        indexes = [
            models.Index(fields=['deleted_at'], name='areatask_deleted_at_idx'),
            models.Index(fields=['area', 'deleted_at'], name='areatask_area_del_idx'),
        ]

    def __str__(self):
        return f"[{self.area}] {self.title[:40]}"


# ─── Dashboard dinamica ───────────────────────────────────────────────────────
# Catalogo statico dei widget disponibili (seed via data migration, non
# editabile da UI) + layout personalizzato per utente (posizione/dimensioni
# su griglia a 6 colonne, salvato via bulk upsert da DashboardGrid.tsx).

class DashboardWidget(models.Model):
    """Catalogo dei widget disponibili nella dashboard.

    `key` è l'identificativo stabile usato anche nel frontend
    (WIDGET_REGISTRY in features/dashboard/dashboardTypes.ts) per mappare
    la riga al componente React da renderizzare. `allowed_sizes` è una lista
    di coppie [w, h] ammesse (non due assi indipendenti: alcuni widget hanno
    combinazioni specifiche, es. il meteo può essere 5x2 ma non 5x1) usata
    per vincolare lo snap del resize libero al widget corrispondente.
    """
    key           = models.CharField(max_length=64, unique=True, verbose_name='Chiave')
    label         = models.CharField(max_length=128, verbose_name='Etichetta')
    allowed_sizes = models.JSONField(default=list, verbose_name='Formati ammessi (coppie w,h)')
    default_w   = models.PositiveSmallIntegerField(verbose_name='Larghezza predefinita')
    default_h   = models.PositiveSmallIntegerField(verbose_name='Altezza predefinita')
    sort_order  = models.IntegerField(default=0, verbose_name='Ordine')
    is_active   = models.BooleanField(default=True, verbose_name='Attivo')

    class Meta:
        verbose_name = 'Widget dashboard'
        verbose_name_plural = 'Widget dashboard'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.label


class UserDashboardLayout(models.Model):
    """Posizione/dimensione di un widget nella dashboard di un utente.

    Una riga per (user, widget). Se un utente non ha ancora personalizzato
    la dashboard, il frontend usa i default del DashboardWidget e crea le
    righe alla prima modifica (upsert via bulk endpoint, vedi
    UserDashboardLayoutViewSet.bulk).
    """
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='dashboard_layout_items',
    )
    widget     = models.ForeignKey(
        DashboardWidget,
        on_delete=models.CASCADE,
        related_name='user_layouts',
    )
    x          = models.PositiveSmallIntegerField(default=0)
    y          = models.PositiveSmallIntegerField(default=0)
    w          = models.PositiveSmallIntegerField()
    h          = models.PositiveSmallIntegerField()
    visible    = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Layout dashboard utente'
        verbose_name_plural = 'Layout dashboard utente'
        constraints = [
            models.UniqueConstraint(fields=['user', 'widget'], name='uniq_user_dashboard_widget'),
        ]


class DefaultDashboardLayout(models.Model):
    """Layout predefinito applicato SOLO agli utenti che non hanno ancora
    mai personalizzato la propria dashboard (nessuna riga
    UserDashboardLayout salvata) — il frontend lo usa come seed per
    l'auto-posizionamento al primo accesso, al posto dello shelf-packing
    riga-per-riga usato in assenza di un default. Chi ha già personalizzato
    non viene mai toccato.

    Gestito da un superuser tramite l'azione `set_mine` (vedi
    DefaultDashboardLayoutViewSet): un'istantanea presa on-demand, non una
    sincronizzazione continua col layout di chi lo imposta.
    """
    widget  = models.ForeignKey(
        DashboardWidget,
        on_delete=models.CASCADE,
        related_name='default_layout',
    )
    x       = models.PositiveSmallIntegerField(default=0)
    y       = models.PositiveSmallIntegerField(default=0)
    w       = models.PositiveSmallIntegerField()
    h       = models.PositiveSmallIntegerField()
    visible = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Layout predefinito dashboard'
        verbose_name_plural = 'Layout predefinito dashboard'
        constraints = [
            models.UniqueConstraint(fields=['widget'], name='uniq_default_dashboard_widget'),
        ]


class StickyNote(models.Model):
    """Nota personale dell'utente (widget dashboard 'sticky-note').

    Una sola nota per utente (OneToOne): il frontend fa sempre
    get-or-create sull'endpoint singleton `/api/sticky-note/`, non c'è un
    ViewSet con lista/CRUD multiplo perché non serve — è un caso analogo a
    UserProfile/MeAPIView, non al catalogo widget/layout.
    """
    user       = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sticky_note',
    )
    text       = models.TextField(blank=True, default='', verbose_name='Testo')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Nota personale'
        verbose_name_plural = 'Note personali'

    def __str__(self):
        return f"Nota di {self.user}"

    def __str__(self):
        return f"{self.user} — {self.widget.key} ({self.x},{self.y} {self.w}x{self.h})"

