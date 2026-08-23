from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from core.models import AreaTask
from maintenance.api.plans import MaintenancePlanViewSet
from notifications.models import Notification, NotificationType

User = get_user_model()


class Command(BaseCommand):
    """Rigenera le notifiche in-app persistite (`notifications.Notification`)
    a partire dalle stesse due sorgenti già usate dalla precedente campanella
    "live" in header:

      - manutenzioni in scadenza entro 30 giorni (`MaintenancePlanViewSet.todo`,
        riusato via APIRequestFactory per non duplicare la logica di calcolo
        cicli/override, complessa e già testata altrove) — notificato a tutti
        gli utenti attivi non-Portal, come faceva la vecchia campanella
        (nessun filtro per permesso specifico sul modulo Manutenzione, è il
        comportamento preesistente);
      - task di area in scadenza domani o già scaduti (stessa query di
        `AreaTaskViewSet.due`) — notificato solo agli utenti della relativa
        area (`profile.leave_area`).

    Le notifiche non lette diventate non più valide (scadenza rientrata, task
    completato...) vengono cancellate. Quelle già lette restano come storico.

    Pensato per girare periodicamente via il servizio `cron` in
    docker-compose (ogni 15 minuti, vedi entrypoint).
    """

    help = "Rigenera le notifiche in-app persistite dalle sorgenti (manutenzioni, task di area)."

    def handle(self, *args, **options):
        today = timezone.localdate()
        in_30 = today + timedelta(days=30)

        recipients = list(
            User.objects.filter(is_active=True, portal_profile__isnull=True)
        )

        maint_keys = self._sync_maintenance_due(recipients, today, in_30)
        area_keys = self._sync_area_tasks_due(recipients)

        stale_maint = Notification.objects.filter(
            is_read=False, notification_type=NotificationType.MAINTENANCE_DUE,
        ).exclude(source_key__in=maint_keys)
        stale_area = Notification.objects.filter(
            is_read=False, notification_type=NotificationType.AREA_TASK_DUE,
        ).exclude(source_key__in=area_keys)
        removed = stale_maint.count() + stale_area.count()
        stale_maint.delete()
        stale_area.delete()

        self.stdout.write(self.style.SUCCESS(
            f"[notifications] manutenzione: {len(maint_keys)} attive · "
            f"task area: {len(area_keys)} attive · "
            f"{removed} notifiche non lette rimosse (non più valide)."
        ))

    def _sync_maintenance_due(self, recipients, today, in_30):
        factory = APIRequestFactory()
        view = MaintenancePlanViewSet.as_view({"get": "todo"})
        request = factory.get("/api/maintenance-plans/todo/", {
            "due_from": today.isoformat(),
            "due_to": in_30.isoformat(),
            "page_size": "200",
        })
        response = view(request)
        rows = response.data.get("results", []) if hasattr(response, "data") else []

        seen_keys = set()
        for row in rows:
            source_key = f"{row['plan_id']}:{row['inventory_id']}"
            seen_keys.add(source_key)
            title = row.get("inventory_name") or row.get("hostname") or f"Inventory #{row['inventory_id']}"
            subtitle = " · ".join(
                part for part in [
                    row.get("customer_name"),
                    row.get("type_label"),
                    row.get("knumber") or row.get("hostname"),
                ] if part
            )
            event_date = row.get("next_due_date")
            if not event_date:
                continue
            for user in recipients:
                Notification.objects.update_or_create(
                    recipient=user,
                    notification_type=NotificationType.MAINTENANCE_DUE,
                    source_key=source_key,
                    defaults={
                        "title": title,
                        "subtitle": subtitle,
                        "link": "/maintenance",
                        "event_date": event_date,
                    },
                )
        return seen_keys

    def _sync_area_tasks_due(self, recipients):
        tomorrow = timezone.localdate() + timedelta(days=1)
        tasks = (
            AreaTask.objects
            .filter(due_date__isnull=False, due_date__lte=tomorrow, deleted_at__isnull=True)
            .exclude(status=AreaTask.STATUS_COMPLETATO)
            .select_related("area")
        )
        tasks_by_area: dict = {}
        for task in tasks:
            tasks_by_area.setdefault(task.area_id, []).append(task)

        seen_keys = set()
        for user in recipients:
            area_id = getattr(getattr(user, "profile", None), "leave_area_id", None)
            if not area_id:
                continue
            for task in tasks_by_area.get(area_id, []):
                source_key = str(task.id)
                seen_keys.add(source_key)
                Notification.objects.update_or_create(
                    recipient=user,
                    notification_type=NotificationType.AREA_TASK_DUE,
                    source_key=source_key,
                    defaults={
                        "title": task.title,
                        "subtitle": f"Area {task.area.label}" if task.area_id else "",
                        "link": "/",
                        "event_date": task.due_date,
                    },
                )
        return seen_keys
