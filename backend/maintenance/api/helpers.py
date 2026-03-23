"""maintenance/api/helpers.py — funzioni di calcolo date condivise.

compute_next_due_date: calcola next_due_date da schedule_type + parametri.
_add_months: helper per sommare mesi rispettando i giorni di fine mese.
"""
# mypy: disable-error-code=annotation-unchecked
import calendar
from datetime import date, timedelta

from django.db.models import OuterRef, Subquery, Count
from django.utils import timezone

from rest_framework import serializers, viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.models import InventoryType
from core.permissions import CanRestoreModelPermission, CanPurgeModelPermission
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin
from core.soft_delete import apply_soft_delete_filters
from core.purge_policy import try_purge_instance
from core.restore_policy import get_restore_block_reason, split_restorable
from audit.utils import log_event
from maintenance.models import (
    Tech,
    MaintenancePlan,
    MaintenanceEvent,
    MaintenanceNotification,
)


def _add_months(d: date, months: int) -> date:
    """Aggiunge `months` mesi a una data, clampando al last day del mese."""
    total_months = d.month - 1 + months
    year  = d.year + total_months // 12
    month = total_months % 12 + 1
    day   = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def compute_next_due_date(
    schedule_type: str,
    interval_value: int | None,
    interval_unit: str | None,
    fixed_month: int | None,
    fixed_day: int | None,
    reference_year: int | None = None,
) -> date | None:
    """
    Calcola la data prevista automaticamente.

    - interval: 01/01/<year> + interval - 1 giorno
      es. 6 mesi → 30/06  |  1 anno → 31/12  |  3 mesi → 31/03
    - fixed_date: fixed_day/fixed_month/<year>
    """
    today = date.today()
    year  = reference_year or today.year

    if schedule_type == "interval":
        if not interval_value or not interval_unit:
            return None
        start = date(year, 1, 1)
        if interval_unit == "days":
            return start + timedelta(days=interval_value) - timedelta(days=1)
        if interval_unit == "weeks":
            return start + timedelta(weeks=interval_value) - timedelta(days=1)
        if interval_unit == "months":
            return _add_months(start, interval_value) - timedelta(days=1)
        if interval_unit == "years":
            return _add_months(start, interval_value * 12) - timedelta(days=1)
        return None

    if schedule_type == "fixed_date":
        if not fixed_month or not fixed_day:
            return None
        try:
            return date(year, fixed_month, fixed_day)
        except ValueError:
            return None

    return None


