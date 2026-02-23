from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework.permissions import AllowAny
from config.auth_api import csrf, login_view, logout_view
from core.me_api import MeAPIView, ChangePasswordView
from crm.api import CustomerViewSet, SiteViewSet, ContactViewSet
from inventory.api import InventoryViewSet
from core.api import (
    CustomerStatusViewSet,
    SiteStatusViewSet,
    InventoryStatusViewSet,
    InventoryTypeViewSet,
)
from maintenance.api import (
    TechViewSet,
    MaintenancePlanViewSet,
    MaintenanceEventViewSet,
    MaintenanceNotificationViewSet,
)
from wiki.api import (
    WikiCategoryViewSet,
    WikiPageViewSet,
    WikiAttachmentViewSet,
    WikiLinkViewSet,
)
from config.search_api import SearchAPIView
from drive.api import DriveFolderViewSet, DriveFileViewSet
from audit.api import AuditEventViewSet
from custom_fields.api import CustomFieldDefinitionViewSet

router = DefaultRouter()
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"sites", SiteViewSet, basename="site")
router.register(r"contacts", ContactViewSet, basename="contact")
router.register(r"inventories", InventoryViewSet, basename="inventory")
router.register(r"inventory-statuses", InventoryStatusViewSet, basename="inventory-status")
router.register(r"inventory-types", InventoryTypeViewSet, basename="inventory-type")
router.register(r"customer-statuses", CustomerStatusViewSet, basename="customer-status")
router.register(r"site-statuses", SiteStatusViewSet, basename="site-status")

router.register(r"techs", TechViewSet, basename="tech")
router.register(r"maintenance-plans", MaintenancePlanViewSet, basename="maintenance-plan")
router.register(r"maintenance-events", MaintenanceEventViewSet, basename="maintenance-event")
router.register(r"maintenance-notifications", MaintenanceNotificationViewSet, basename="maintenance-notification")

router.register(r"wiki-categories", WikiCategoryViewSet, basename="wiki-category")
router.register(r"wiki-pages", WikiPageViewSet, basename="wiki-page")
router.register(r"wiki-attachments", WikiAttachmentViewSet, basename="wiki-attachment")
router.register(r"wiki-links", WikiLinkViewSet, basename="wiki-link")
router.register(r"audit-events", AuditEventViewSet, basename="audit-event")
router.register(r"custom-field-definitions", CustomFieldDefinitionViewSet, basename="custom-field-definition")

router.register(r"drive-folders", DriveFolderViewSet, basename="drive-folder")
router.register(r"drive-files",   DriveFileViewSet,   basename="drive-file")


urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/schema/", SpectacularAPIView.as_view(permission_classes=[AllowAny]), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[AllowAny]), name="swagger-ui"),

    path("api/auth/csrf/", csrf, name="csrf"),
    path("api/auth/login/", login_view, name="login"),
    path("api/auth/logout/", logout_view, name="logout"),
    path("api/me/", MeAPIView.as_view(), name="me"),
    path("api/me/change-password/", ChangePasswordView.as_view(), name="me-change-password"),

    path("api/search/", SearchAPIView.as_view(), name="search"),
    path("api/", include(router.urls)),
]

# Serve media files (avatars) via Django. For production, prefer serving via nginx.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
