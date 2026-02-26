from django.db import models
from django.contrib.postgres.fields import ArrayField
from core.models import TimeStampedModel

class WikiCategory(TimeStampedModel):
    name = models.CharField(max_length=128)
    description = models.TextField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
        
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
    category = models.ForeignKey(WikiCategory, on_delete=models.PROTECT, null=True, blank=True, related_name="pages")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")

    summary = models.TextField(null=True, blank=True)
    tags = ArrayField(models.TextField(), null=True, blank=True)

    content_markdown = models.TextField()
    is_published = models.BooleanField(default=True)

    custom_fields = models.JSONField(null=True, blank=True)

    pdf_template_key = models.CharField(max_length=64, default="default")
    pdf_options = models.JSONField(null=True, blank=True)
        
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

class WikiAttachment(TimeStampedModel):
    page = models.ForeignKey(WikiPage, on_delete=models.PROTECT, related_name="attachments")
    filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=128, null=True, blank=True)
    storage_key = models.CharField(max_length=512)
    size_bytes = models.BigIntegerField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

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
