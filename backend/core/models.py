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

    def __str__(self):
        return f"Profile({self.user_id})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)
