from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.emails import send_templated_email
from core.models import AreaTask, ScheduledJobRun
from issues.models import Issue, IssueStatus

User = get_user_model()

JOB_NAME = "send_deadline_digest"
SEND_HOUR = 8  # ora locale (TIME_ZONE=Europe/Rome), non UTC
DEADLINE_WINDOW_DAYS = 3


class Command(BaseCommand):
    """Invia un'unica email giornaliera per utente con le scadenze nei
    prossimi 3 giorni: task della sua area (`core.AreaTask`, stessa logica
    di `refresh_notifications`) e issue a lui assegnate (`Issue.due_date`).

    Pensato per girare via il loop shell del container `cron` (ogni 15
    minuti, docker-compose.yml) — ma esegue solo se sono le 8:00 locali
    (Europe/Rome) e non ha già girato oggi (vedi `ScheduledJobRun`), così il
    loop può chiamarlo spesso senza generare invii duplicati.

    Nessuna email per un utente senza scadenze nei prossimi 3 giorni.
    """

    help = "Invia l'email giornaliera con le scadenze (task area + issue) nei prossimi 3 giorni."

    def handle(self, *args, **options):
        now_local = timezone.localtime()
        today = now_local.date()

        if now_local.hour != SEND_HOUR:
            self.stdout.write(f"[deadline_digest] Fuori orario (ore locali: {now_local.hour}), nessuna azione.")
            return

        job_run, _ = ScheduledJobRun.objects.get_or_create(
            job_name=JOB_NAME, defaults={"last_run_date": today - timedelta(days=1)},
        )
        if job_run.last_run_date >= today:
            self.stdout.write("[deadline_digest] Già eseguito oggi, nessuna azione.")
            return

        in_3 = today + timedelta(days=DEADLINE_WINDOW_DAYS)
        recipients = list(User.objects.filter(is_active=True, portal_profile__isnull=True))

        area_tasks_by_area: dict = {}
        for task in (
            AreaTask.objects
            .filter(due_date__isnull=False, due_date__gte=today, due_date__lte=in_3, deleted_at__isnull=True)
            .exclude(status=AreaTask.STATUS_COMPLETATO)
        ):
            area_tasks_by_area.setdefault(task.area_id, []).append(task)

        issues_by_assignee: dict = {}
        for issue in (
            Issue.objects
            .filter(due_date__isnull=False, due_date__gte=today, due_date__lte=in_3, deleted_at__isnull=True)
            .exclude(status=IssueStatus.CLOSED)
            .exclude(assigned_to__isnull=True)
        ):
            issues_by_assignee.setdefault(issue.assigned_to_id, []).append(issue)

        sent = 0
        for user in recipients:
            area_id = getattr(getattr(user, "profile", None), "leave_area_id", None)
            area_items = area_tasks_by_area.get(area_id, []) if area_id else []
            issue_items = issues_by_assignee.get(user.id, [])

            if not area_items and not issue_items:
                continue
            if not user.email:
                continue

            ok, error = send_templated_email(
                template_name="emails/deadline_digest.html",
                context={
                    "nome_utente": user.first_name or user.username,
                    "area_task_items": area_items,
                    "issue_items": issue_items,
                },
                subject="ARCHIE — Scadenze nei prossimi 3 giorni",
                recipient_list=[user.email],
            )
            if ok:
                sent += 1
            else:
                self.stderr.write(self.style.WARNING(
                    f"[deadline_digest] Invio a {user.email} fallito: {error}"
                ))

        job_run.last_run_date = today
        job_run.save(update_fields=["last_run_date"])

        self.stdout.write(self.style.SUCCESS(f"[deadline_digest] {sent} email inviate."))
