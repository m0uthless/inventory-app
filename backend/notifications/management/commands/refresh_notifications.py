from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.emails import send_templated_email
from core.models import AreaTask
from core.modules import is_module_enabled
from notifications.email_items import group_by_day, notification_item
from notifications.models import Notification, NotificationType

User = get_user_model()


class Command(BaseCommand):
    """Rigenera le notifiche in-app persistite (`notifications.Notification`)
    a partire dalle stesse due sorgenti già usate dalla precedente campanella
    "live" in header:

      - manutenzioni in scadenza entro 30 giorni (`maintenance.api.plans.todo_rows_for_jobs`,
        lo stesso calcolo di cicli/override della vista `todo`, senza passare
        dall'API) — notificato a tutti
        gli utenti attivi non-Portal, come faceva la vecchia campanella
        (nessun filtro per permesso specifico sul modulo Manutenzione, è il
        comportamento preesistente);
      - task di area in scadenza domani o già scaduti (stessa query di
        `AreaTaskViewSet.due`) — notificato solo agli utenti della relativa
        area (`profile.leave_area`).

    Le notifiche non lette diventate non più valide (scadenza rientrata, task
    completato...) vengono cancellate. Quelle già lette restano come storico.

    Oltre alla notifica in-app, per chi ha una email valorizzata viene inviata
    una email digest (via `core.emails.send_templated_email`, un'unica email
    per utente per run con l'elenco delle scadenze) quando una notifica è
    nuova o quando la sua `event_date` è cambiata rispetto all'ultima email
    già inviata (`last_emailed_event_date`) — così non si spamma a ogni
    refresh di 15 minuti sulla stessa scadenza invariata.

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

        # Un modulo spento dalla pagina «Moduli» non genera notifiche né email;
        # le sue notifiche già create restano, nascoste dall'API.
        maint_on = is_module_enabled("maintenance")
        area_on = is_module_enabled("area_tasks")
        maint_keys, maint_to_email = (
            self._sync_maintenance_due(recipients, today, in_30) if maint_on else (set(), [])
        )
        area_keys, area_to_email = self._sync_area_tasks_due(recipients) if area_on else (set(), [])

        removed = 0
        for on, ntype, keys in (
            (maint_on, NotificationType.MAINTENANCE_DUE, maint_keys),
            (area_on, NotificationType.AREA_TASK_DUE, area_keys),
        ):
            if not on:
                continue
            stale = Notification.objects.filter(is_read=False, notification_type=ntype).exclude(source_key__in=keys)
            removed += stale.count()
            stale.delete()

        # Le scadenze di manutenzione vanno per email solo all'ufficio (riepilogo delle 8:00,
        # notifications/maintenance_office.py): agli utenti resta la notifica in-app.
        emailed = self._send_digest_emails([], area_to_email)

        self.stdout.write(self.style.SUCCESS(
            f"[notifications] manutenzione: {len(maint_keys)} attive · "
            f"task area: {len(area_keys)} attive · "
            f"{removed} notifiche non lette rimosse (non più valide) · "
            f"{emailed} email digest inviate."
        ))

    def _sync_maintenance_due(self, recipients, today, in_30):
        # Calcolo diretto (la vista `todo` senza utente risponde 401: le notifiche non nascevano).
        from maintenance.api.plans import todo_rows_for_jobs

        lo, hi = today.isoformat(), in_30.isoformat()
        rows = [r for r in todo_rows_for_jobs() if r.get("next_due_date") and lo <= r["next_due_date"] <= hi]

        last_emailed = {
            (rid, key): sent for rid, key, sent in Notification.objects
            .filter(notification_type=NotificationType.MAINTENANCE_DUE)
            .values_list("recipient_id", "source_key", "last_emailed_event_date")
        }

        seen_keys = set()
        to_email = []
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
                notif, _ = Notification.objects.update_or_create(
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
                if last_emailed.get((user.id, source_key)) != notif.event_date:
                    to_email.append(notif)
        return seen_keys, to_email

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

        last_emailed = {
            (rid, key): sent for rid, key, sent in Notification.objects
            .filter(notification_type=NotificationType.AREA_TASK_DUE)
            .values_list("recipient_id", "source_key", "last_emailed_event_date")
        }

        seen_keys = set()
        to_email = []
        for user in recipients:
            area_id = getattr(getattr(user, "profile", None), "leave_area_id", None)
            if not area_id:
                continue
            for task in tasks_by_area.get(area_id, []):
                source_key = str(task.id)
                seen_keys.add(source_key)
                notif, _ = Notification.objects.update_or_create(
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
                if last_emailed.get((user.id, source_key)) != notif.event_date:
                    to_email.append(notif)
        return seen_keys, to_email

    def _send_digest_emails(self, maint_to_email, area_to_email) -> int:
        by_recipient: dict = {}
        for notif in maint_to_email:
            group = by_recipient.setdefault(
                notif.recipient_id, {"maintenance": [], "area_task": [], "all": []}
            )
            group["maintenance"].append(notif)
            group["all"].append(notif)
        for notif in area_to_email:
            group = by_recipient.setdefault(
                notif.recipient_id, {"maintenance": [], "area_task": [], "all": []}
            )
            group["area_task"].append(notif)
            group["all"].append(notif)

        if not by_recipient:
            return 0

        users = User.objects.in_bulk(by_recipient.keys())
        sent = 0
        for recipient_id, group in by_recipient.items():
            user = users.get(recipient_id)
            if not user or not user.email:
                continue
            ok, error = send_templated_email(
                template_name="emails/notifications_digest.html",
                context={
                    "nome_utente": user.first_name or user.username,
                    "maintenance_items": group["maintenance"],
                    "area_task_items": group["area_task"],
                    "scadenze": group_by_day([notification_item(n) for n in group["all"]]),
                },
                subject="ARCHIE — Nuove scadenze",
                recipient_list=[user.email],
            )
            if ok:
                sent += 1
                for notif in group["all"]:
                    notif.last_emailed_event_date = notif.event_date
                Notification.objects.bulk_update(group["all"], ["last_emailed_event_date"])
            else:
                self.stderr.write(self.style.WARNING(
                    f"[notifications] invio digest a {user.email} fallito: {error}"
                ))
        return sent
