"""maintenance/api/ — API package per il modulo manutenzione.

Espone tutte le classi pubbliche necessarie a config/urls.py in un unico
namespace, mantenendo la backward compatibility con l'import originale:

    from maintenance.api import TechViewSet, MaintenancePlanViewSet, ...
"""
from maintenance.api.helpers import _add_months, compute_next_due_date  # noqa: F401
from maintenance.api.techs import TechSerializer, TechViewSet  # noqa: F401
from maintenance.api.plans import (  # noqa: F401
    MaintenancePlanSerializer,
    MaintenancePlanViewSet,
)
from maintenance.api.events import (  # noqa: F401
    MaintenanceEventSerializer,
    MaintenanceEventViewSet,
)
from maintenance.api.notifications import (  # noqa: F401
    MaintenanceNotificationSerializer,
    MaintenanceNotificationViewSet,
)
