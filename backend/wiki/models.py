from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.contrib.postgres.fields import ArrayField
from core.models import TimeStampedModel


class WikiCategory(TimeStampedModel):
    name = models.CharField(max_length=128)
    description = models.TextField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    emoji = models.CharField(max_length=8, blank=True, default="📄")
    color = models.CharField(max_length=16, blank=True, default="#0f766e")

    class Meta:
        verbose_name = "Categoria"
        verbose_name_plural = "Categorie"
        constraints = [
            models.UniqueConstraint(
                fields=["name"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_wiki_categories_name_active",
            )
        ]

    def __str__(self):
        return self.name


class WikiPage(TimeStampedModel):
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    kb_code = models.CharField(max_length=16, blank=True, default="")
    view_count = models.PositiveBigIntegerField(default=0)
    category = models.ForeignKey(
        WikiCategory, on_delete=models.PROTECT, null=True, blank=True, related_name="pages"
    )
    parent = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="children"
    )

    summary = models.TextField(null=True, blank=True)
    tags = ArrayField(models.TextField(), null=True, blank=True)

    content_markdown = models.TextField()
    is_published = models.BooleanField(default=True)

    custom_fields = models.JSONField(null=True, blank=True)

    pdf_template_key = models.CharField(max_length=64, default="default")
    pdf_options = models.JSONField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        verbose_name = "Pagina"
        verbose_name_plural = "Pagine"
        constraints = [
            models.UniqueConstraint(
                fields=["slug"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_wiki_pages_slug_active",
            )
        ]

    def __str__(self):
        return self.title


class WikiPageRevision(models.Model):
    """Snapshot immutabile di una WikiPage ad ogni salvataggio."""
    page = models.ForeignKey(
        WikiPage,
        on_delete=models.CASCADE,
        related_name="revisions",
    )
    revision_number = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    summary = models.TextField(null=True, blank=True)
    tags = ArrayField(models.TextField(), null=True, blank=True)
    content_markdown = models.TextField()
    saved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Revisione"
        verbose_name_plural = "Revisioni"
        ordering = ["-revision_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["page", "revision_number"],
                name="ux_wiki_revision_page_num",
            )
        ]

    def __str__(self):
        return f"{self.page.title} — rev {self.revision_number}"


class WikiPageRating(models.Model):
    page = models.ForeignKey(
        WikiPage,
        on_delete=models.CASCADE,
        related_name="ratings",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="+",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Valutazione pagina"
        verbose_name_plural = "Valutazioni pagina"
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["page", "user"],
                name="ux_wiki_page_rating_page_user",
            )
        ]

    def __str__(self):
        return f"{self.page.title} — {self.user} ({self.rating})"


class WikiAttachment(TimeStampedModel):
    page = models.ForeignKey(WikiPage, on_delete=models.PROTECT, related_name="attachments")
    filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=128, null=True, blank=True)
    storage_key = models.CharField(max_length=512, blank=True, default="")
    size_bytes = models.BigIntegerField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    file = models.FileField(upload_to="wiki_attachments/", null=True, blank=True)

    class Meta:
        verbose_name = "Allegato"
        verbose_name_plural = "Allegati"

    def __str__(self):
        return self.filename


class WikiEntityType(models.TextChoices):
    CUSTOMER = "customer", "Customer"
    SITE = "site", "Site"
    INVENTORY = "inventory", "Inventory"


class WikiLink(TimeStampedModel):
    page = models.ForeignKey(WikiPage, on_delete=models.PROTECT, related_name="links")
    entity_type = models.CharField(max_length=16, choices=WikiEntityType.choices)
    entity_id = models.BigIntegerField()
    notes = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = "Link"
        verbose_name_plural = "Links"
        indexes = [
            models.Index(fields=["entity_type", "entity_id"], name="ix_wiki_links_entity"),
        ]

    def __str__(self):
        return f"{self.page_id} -> {self.entity_type}:{self.entity_id}"


class WikiQueryLanguage(TimeStampedModel):
    """
    Lookup table per i linguaggi disponibili nelle Query Wiki.
    Gestibile dall'admin senza toccare il codice.
    Eredita da TimeStampedModel (con soft-delete) come tutte le lookup dell'app.
    """
    key = models.CharField(max_length=64, verbose_name="Chiave")
    label = models.CharField(max_length=128, verbose_name="Label")
    color = models.CharField(
        max_length=32,
        default="#e2e8f0",
        verbose_name="Colore sfondo chip (hex)",
        help_text="Colore pastello HEX usato nel chip nella UI (es. #d1fae5).",
    )
    text_color = models.CharField(
        max_length=32,
        default="#0f172a",
        verbose_name="Colore testo chip (hex)",
    )
    sort_order = models.IntegerField(default=0, verbose_name="Ordinamento")
    is_active = models.BooleanField(default=True, verbose_name="Attivo")

    class Meta:
        verbose_name = "Linguaggio query"
        verbose_name_plural = "Linguaggi query"
        ordering = ["sort_order", "label"]
        constraints = [
            models.UniqueConstraint(
                fields=["key"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_wiki_query_language_key_active",
            )
        ]

    def __str__(self):
        return self.label


class WikiQuery(TimeStampedModel):
    """
    Raccolta di query utili (SQL, PowerShell, ecc.) da eseguire sui sistemi.
    """
    title = models.CharField(max_length=255, verbose_name="Titolo")
    language = models.ForeignKey(
        WikiQueryLanguage,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="queries",
        verbose_name="Linguaggio",
    )
    body = models.TextField(verbose_name="Query")
    description = models.TextField(null=True, blank=True, verbose_name="Descrizione")
    tags = ArrayField(models.TextField(), null=True, blank=True, verbose_name="Tag")

    use_count = models.PositiveIntegerField(default=0, verbose_name="Utilizzi")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        verbose_name = "Query"
        verbose_name_plural = "Query"
        ordering = ["title"]

    def __str__(self):
        lang = self.language.label if self.language else "?"
        return f"[{lang}] {self.title}"
