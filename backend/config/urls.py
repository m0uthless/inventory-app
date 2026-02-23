from __future__ import annotations

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from rest_framework.routers import DefaultRouter

from audit.api import AuditEventViewSet
from core.me_api import ChangePasswordView, MeAPIView

from core.api import (
    CustomerStatusViewSet,
    SiteStatusViewSet,
    InventoryStatusViewSet,
    InventoryTypeViewSet,
)
from core.permissions import IsStaffOrAdminGroup
from crm.api import ContactViewSet, CustomerViewSet, SiteViewSet
from custom_fields.api import CustomFieldDefinitionViewSet
from drive.api import DriveFileUploadView, DriveFileViewSet, DriveFolderViewSet
from inventory.api import InventoryViewSet
from maintenance.api import (
    MaintenanceEventViewSet,
    MaintenanceNotificationViewSet,
    MaintenancePlanViewSet,
    TechViewSet,
)
from wiki.api import WikiPageViewSet

router = DefaultRouter()
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"sites", SiteViewSet, basename="site")
router.register(r"contacts", ContactViewSet, basename="contact")
router.register(r"inventories", InventoryViewSet, basename="inventory")
router.register(r"audit-events", AuditEventViewSet, basename="audit-event")
router.register(
    r"custom-field-definitions",
    CustomFieldDefinitionViewSet,
    basename="custom-field-definition",
)
router.register(r"maintenance-plans", MaintenancePlanViewSet, basename="maintenance-plan")
router.register(r"maintenance-events", MaintenanceEventViewSet, basename="maintenance-event")
router.register(
    r"maintenance-notifications",
    MaintenanceNotificationViewSet,
    basename="maintenance-notification",
)
router.register(r"techs", TechViewSet, basename="tech")
router.register(r"wiki-pages", WikiPageViewSet, basename="wiki-page")
router.register(r"drive-folders", DriveFolderViewSet, basename="drive-folder")
router.register(r"drive-files", DriveFileViewSet, basename="drive-file")

# Lookups (core)
router.register(r"customer-statuses", CustomerStatusViewSet, basename="customer-status")
router.register(r"site-statuses", SiteStatusViewSet, basename="site-status")
router.register(r"inventory-statuses", InventoryStatusViewSet, basename="inventory-status")
router.register(r"inventory-types", InventoryTypeViewSet, basename="inventory-type")

# Schema/Docs permissions:
# - DEBUG: public (dev convenience)
# - Production: restricted to staff/superuser or users in `admin` group
_schema_permissions = [AllowAny] if settings.DEBUG else [IsStaffOrAdminGroup]

urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth (session-based)
    path("api/auth/", include("config.auth_urls")),

    # Me (profile + password)
    path("api/me/", MeAPIView.as_view()),
    path("api/me/change-password/", ChangePasswordView.as_view()),

    # File upload (multipart)
    path("api/drive-files/upload/", DriveFileUploadView.as_view()),

    # API router
    path("api/", include(router.urls)),

    # Schema + Docs
    path(
        "api/schema/",
        SpectacularAPIView.as_view(permission_classes=_schema_permissions),
        name="schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema",
            permission_classes=_schema_permissions,
        ),
        name="swagger-ui",
    ),
]

# Dev-only static/media serving (docker uses nginx)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
