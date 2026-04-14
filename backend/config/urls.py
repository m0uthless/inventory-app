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

from config.search_api import SearchAPIView
from config.system_stats_api import HealthAPIView, SystemStatsView

from auslbo.api import AuslBoMeView, AuslBoConfigView

from core.api import (
    CustomerStatusViewSet,
    SiteStatusViewSet,
    InventoryStatusViewSet,
    InventoryTypeViewSet,
    UserViewSet,
    AnnouncementViewSet,
    UserTaskViewSet,
)
from core.permissions import CanRestoreModelPermission, IsStaffOrAdminGroup
from crm.api import ContactViewSet, CustomerViewSet, SiteViewSet, CustomerVpnAccessViewSet
from custom_fields.api import CustomFieldDefinitionViewSet
from drive.api import DriveFileUploadView, DriveFileViewSet, DriveFolderViewSet
from inventory.api import InventoryViewSet, MonitorViewSet
from maintenance.api import (
    MaintenanceEventViewSet,
    MaintenanceNotificationViewSet,
    MaintenancePlanViewSet,
    MaintenancePlanInventoryViewSet,
    TechViewSet,
)
from wiki.api import WikiCategoryViewSet, WikiPageViewSet, WikiAttachmentViewSet, WikiLinkViewSet, WikiPageRevisionViewSet, WikiStatsView, WikiQueryViewSet, WikiQueryLanguageViewSet
from issues.api import IssueViewSet, IssueCategoryViewSet
from feedback.api import ReportRequestViewSet
from device.api import (
    DeviceViewSet,
    DeviceManufacturerViewSet,
    DeviceStatusViewSet,
    DeviceTypeViewSet,
    DeviceRispacsViewSet,
    DeviceWifiViewSet,
    RispacsViewSet,
)
from vlan.api import VlanViewSet, VlanIpRequestViewSet, CustomerRispacsViewSet

router = DefaultRouter()
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"sites", SiteViewSet, basename="site")
router.register(r"contacts", ContactViewSet, basename="contact")
router.register(r"inventories", InventoryViewSet, basename="inventory")
router.register(r"monitors", MonitorViewSet, basename="monitor")
router.register(r"audit-events", AuditEventViewSet, basename="audit-event")
router.register(
    r"custom-field-definitions",
    CustomFieldDefinitionViewSet,
    basename="custom-field-definition",
)
router.register(r"maintenance-plans", MaintenancePlanViewSet, basename="maintenance-plan")
router.register(r"maintenance-plan-inventories", MaintenancePlanInventoryViewSet, basename="maintenance-plan-inventory")
router.register(r"maintenance-events", MaintenanceEventViewSet, basename="maintenance-event")
router.register(
    r"maintenance-notifications",
    MaintenanceNotificationViewSet,
    basename="maintenance-notification",
)
router.register(r"techs", TechViewSet, basename="tech")
router.register(r"wiki-categories", WikiCategoryViewSet, basename="wiki-category")
router.register(r"wiki-pages", WikiPageViewSet, basename="wiki-page")
router.register(r"wiki-attachments", WikiAttachmentViewSet, basename="wiki-attachment")
router.register(r"wiki-links", WikiLinkViewSet, basename="wiki-link")
router.register(r"wiki-revisions", WikiPageRevisionViewSet, basename="wiki-revision")
router.register(r"wiki-queries", WikiQueryViewSet, basename="wiki-query")
router.register(r"wiki-query-languages", WikiQueryLanguageViewSet, basename="wiki-query-language")
router.register(r"drive-folders", DriveFolderViewSet, basename="drive-folder")
router.register(r"announcements", AnnouncementViewSet, basename="announcement")
router.register(r"user-tasks", UserTaskViewSet, basename="user-task")
router.register(r"drive-files", DriveFileViewSet, basename="drive-file")

# Issues
router.register(r"issues",           IssueViewSet,         basename="issue")
router.register(r"issue-categories", IssueCategoryViewSet, basename="issue-category")
router.register(r"feedback-items", ReportRequestViewSet, basename="feedback-item")

# Device
router.register(r"devices", DeviceViewSet, basename="device")
router.register(r"device-manufacturers", DeviceManufacturerViewSet, basename="device-manufacturer")
router.register(r"device-statuses", DeviceStatusViewSet, basename="device-status")
router.register(r"device-types", DeviceTypeViewSet, basename="device-type")
router.register(r"device-rispacs", DeviceRispacsViewSet, basename="device-rispacs")
router.register(r"device-wifi", DeviceWifiViewSet, basename="device-wifi")
router.register(r"rispacs", RispacsViewSet, basename="rispacs")

# VLAN
router.register(r"vlans", VlanViewSet, basename="vlan")
router.register(r"vlan-ip-requests", VlanIpRequestViewSet, basename="vlan-ip-request")
router.register(r"customer-rispacs", CustomerRispacsViewSet, basename="customer-rispacs")

# Lookups (core)
router.register(r"customer-statuses", CustomerStatusViewSet, basename="customer-status")
router.register(r"site-statuses", SiteStatusViewSet, basename="site-status")
router.register(r"inventory-statuses", InventoryStatusViewSet, basename="inventory-status")
router.register(r"inventory-types", InventoryTypeViewSet, basename="inventory-type")
router.register(r"users", UserViewSet, basename="user")


def legacy_restore_alias(pattern: str, viewset, action: str):
    """Temporary shim for older clients/tests using pre-router restore paths."""
    return path(
        pattern,
        viewset.as_view({"post": action}, permission_classes=[CanRestoreModelPermission]),
    )

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

    # AUSL BO
    path("api/auslbo/me/", AuslBoMeView.as_view(), name="auslbo-me"),
    path("api/auslbo/config/", AuslBoConfigView.as_view(), name="auslbo-config"),

    # Public status endpoints
    path("api/health/", HealthAPIView.as_view()),
    path("api/system-stats/", SystemStatsView.as_view()),

    # Global search (aggregated)
    path("api/search/", SearchAPIView.as_view()),

    path("api/wiki-stats/", WikiStatsView.as_view()),

    # File upload (multipart)
    path("api/drive-files/upload/", DriveFileUploadView.as_view()),

    # Backward-compatible restore aliases used by older tests/clients.
    # Keep them only as temporary shims; canonical endpoints remain the router ones
    # (`/api/inventories/...`, `/api/custom-field-definitions/...`).
    legacy_restore_alias("api/inventory/bulk_restore/", InventoryViewSet, "bulk_restore"),
    legacy_restore_alias("api/inventory/<int:pk>/restore/", InventoryViewSet, "restore"),
    legacy_restore_alias(
        "api/custom-fields/bulk_restore/",
        CustomFieldDefinitionViewSet,
        "bulk_restore",
    ),
    legacy_restore_alias(
        "api/custom-fields/<int:pk>/restore/",
        CustomFieldDefinitionViewSet,
        "restore",
    ),

    # API router
    path("api/", include(router.urls)),

    # VPN access nested under customers
    path("api/customers/<int:customer_pk>/vpn/", CustomerVpnAccessViewSet.as_view({
        "get": "retrieve",
        "post": "create",
        "patch": "partial_update",
        "delete": "destroy",
    })),

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
