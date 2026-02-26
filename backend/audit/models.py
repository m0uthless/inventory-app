from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db import models


class AuditEvent(models.Model):
    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        RESTORE = "restore", "Restore"
        LOGIN = "login", "Login"
        LOGIN_FAILED = "login_failed", "Login Failed"
        LOGOUT = "logout", "Logout"

    created_at = models.DateTimeField(auto_now_add=True)

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    action = models.CharField(max_length=16, choices=Action.choices)

    # Generic target
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    object_id = models.CharField(max_length=64)
    object_repr = models.CharField(max_length=255, blank=True, default="")
    subject = models.CharField(max_length=512, blank=True, default="")

    # Optional diff / metadata
    changes = models.JSONField(null=True, blank=True)

    metadata = models.JSONField(default=dict, blank=True)

    path = models.CharField(max_length=255, null=True, blank=True)
    method = models.CharField(max_length=8, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action} {self.content_type.app_label}.{self.content_type.model}#{self.object_id}"


class AuthAttempt(models.Model):
    """Track authentication attempts (success/failure).

    Used by audit.utils.log_auth_attempt().
    """

    created_at = models.DateTimeField(auto_now_add=True)

    username = models.CharField(max_length=150)
    success = models.BooleanField(default=False)

    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["username", "created_at"]),
            models.Index(fields=["success", "created_at"]),
        ]

    def __str__(self):
        status = "OK" if self.success else "FAIL"
        return f"{self.created_at:%Y-%m-%d %H:%M} {status} {self.username}"
