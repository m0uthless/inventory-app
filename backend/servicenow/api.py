import calendar
import io
import re
from datetime import date

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models.functions import ExtractMonth, ExtractWeek, ExtractIsoYear, ExtractDay
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

import django_filters as filters

from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.media import build_action_url, protected_media_response
from core.mixins import SoftDeleteAuditMixin, RestoreActionMixin
from core.soft_delete import apply_soft_delete_filters
from servicenow.models import (
    ServiceNowCase, ServiceNowCaseType, ServiceNowCaseCategory,
)
from servicenow.notifications import notify_teams_new_case

# Le assenze sono ora gestite dal modulo condiviso `attendance` (mezza giornata
# MAT/POM, workflow proposta→validata). Triage e Statistiche le importano da qui.
from attendance.models import Absence, AbsenceReason, AbsenceStatus, DayPart
from attendance.bridge import day_part_covers_now

User = get_user_model()

MONTH_LABELS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']


# ─── Serializer ──────────────────────────────────────────────────────────────

class ServiceNowCaseSerializer(serializers.ModelSerializer):
    priority_label        = serializers.CharField(source="get_priority_display", read_only=True)
    category_label         = serializers.CharField(source="get_category_display", read_only=True)
    case_type_label       = serializers.SerializerMethodField()
    status_label           = serializers.CharField(source="get_status_display",   read_only=True)
    assigned_to_username   = serializers.CharField(source="assigned_to.username", read_only=True)
    assigned_to_full_name  = serializers.SerializerMethodField()
    assigned_to_avatar     = serializers.SerializerMethodField()
    screenshot_url         = serializers.SerializerMethodField()

    class Meta:
        model  = ServiceNowCase
        fields = [
            "id",
            "number", "account", "short_description",
            "priority", "priority_label",
            "category", "category_label",
            "case_type", "case_type_label",
            "opened_date", "opened_time",
            "screenshot", "screenshot_url",
            "status", "status_label",
            "assigned_to", "assigned_to_username", "assigned_to_full_name", "assigned_to_avatar",
            "external_url",
            "created_at", "updated_at", "deleted_at",
        ]
        read_only_fields = [
            "id", "created_at", "updated_at", "deleted_at",
            "priority_label", "status_label", "case_type_label", "category_label",
            "assigned_to_username", "assigned_to_full_name", "assigned_to_avatar",
            "screenshot_url",
        ]
        extra_kwargs = {
            "screenshot": {"write_only": True, "required": False, "allow_null": True},
        }

    def validate(self, attrs):
        # Verifichiamo solo se la richiesta tocca opened_date/opened_time: un
        # PATCH che modifica altri campi non deve rompersi su un case storico
        # che ha già opened_date senza opened_time (dato pre-esistente a questa
        # funzionalità).
        if "opened_date" in attrs or "opened_time" in attrs:
            opened_date = attrs.get("opened_date", getattr(self.instance, "opened_date", None))
            opened_time = attrs.get("opened_time", getattr(self.instance, "opened_time", None))
            if opened_date and not opened_time:
                raise serializers.ValidationError({"opened_time": "Indicare l'ora di apertura del caso."})
        return attrs

    def get_case_type_label(self, obj):
        return obj.case_type.name if obj.case_type_id else None

    def get_assigned_to_full_name(self, obj):
        u = obj.assigned_to
        if not u:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def _get_user_avatar(self, user):
        if not user:
            return None
        try:
            profile = user.profile
        except Exception:
            return None
        if not profile or not profile.avatar:
            return None
        try:
            return profile.avatar.url
        except Exception:
            return None

    def get_assigned_to_avatar(self, obj):
        return self._get_user_avatar(obj.assigned_to)

    def get_screenshot_url(self, obj):
        """URL dell'action autenticata, NON il path pubblico di MEDIA_URL.

        `obj.screenshot.url` puntava a /api/media/servicenow_cases/... che nginx
        serve senza autenticazione: chiunque conoscesse il nome file poteva
        scaricare lo screenshot del case. Ora l'immagine passa da
        /api/servicenow-cases/{id}/screenshot/, protetta dai permessi del ViewSet
        e servita via X-Accel-Redirect (stesso pattern di wiki/drive/maintenance).
        """
        if not obj.screenshot:
            return None
        request = self.context.get("request")
        return build_action_url(
            request=request,
            relative_path=f"/api/servicenow-cases/{obj.pk}/screenshot/",
        )


# ─── Serializer Type ────────────────────────────────────────────────────────

class ServiceNowCaseTypeSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model  = ServiceNowCaseType
        fields = ["id", "category", "category_label", "name", "order"]


# ─── (Assenze) ───────────────────────────────────────────────────────────────
# Serializer/permessi/ViewSet delle assenze vivono ora in `attendance.api`
# (endpoint /api/absences/). Qui restano solo Triage e Statistiche che le leggono.


# ─── Filters ─────────────────────────────────────────────────────────────────

class ServiceNowCaseFilter(filters.FilterSet):
    status      = filters.MultipleChoiceFilter(choices=ServiceNowCase.status.field.choices)
    priority    = filters.MultipleChoiceFilter(choices=ServiceNowCase.priority.field.choices)
    category    = filters.MultipleChoiceFilter(choices=ServiceNowCase.category.field.choices)
    case_type   = filters.ModelMultipleChoiceFilter(queryset=ServiceNowCaseType.objects.all())
    assigned_to = filters.NumberFilter(field_name="assigned_to_id")
    number      = filters.CharFilter(field_name="number", lookup_expr="iexact")

    class Meta:
        model  = ServiceNowCase
        fields = ["status", "priority", "category", "case_type", "assigned_to", "number"]


# ─── ViewSet Type (sola lettura, popolato da admin) ──────────────────────────

class ServiceNowCaseTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """Elenco dei type disponibili per categoria (Philips/Biotron), usato dal
    drawer di inserimento e dalla pagina statistiche per popolare le opzioni.
    Gestione (aggiunta/disattivazione type) esclusivamente da Django admin.
    """
    serializer_class = ServiceNowCaseTypeSerializer
    queryset = ServiceNowCaseType.objects.filter(active=True).order_by("category", "order", "name")
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["category"]
    pagination_class = None


# ─── ViewSet ─────────────────────────────────────────────────────────────────

class ServiceNowCaseViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """CRUD ServiceNowCase.

    ServiceNowCase non ha created_by/updated_by (come Monitor) → il mixin
    generico SoftDeleteAuditMixin funziona senza override.

    Endpoint extra:
    - POST /servicenow-cases/extract/ → estrae i campi da uno screenshot
      via OCR e li ritorna SENZA salvare nulla (l'utente conferma/corregge
      prima di creare il case tramite la POST standard).
    """

    restore_has_updated_by = False

    serializer_class = ServiceNowCaseSerializer
    parser_classes   = [MultiPartParser, FormParser, JSONParser]
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class  = ServiceNowCaseFilter
    search_fields    = ["number", "account", "short_description"]
    ordering_fields  = [
        "number", "account", "priority", "status", "category", "case_type__name",
        "opened_date", "assigned_to__last_name",
        "created_at", "updated_at", "deleted_at",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = ServiceNowCase.objects.select_related("assigned_to", "assigned_to__profile", "case_type")
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def perform_create(self, serializer):
        super().perform_create(serializer)
        # Best-effort: un fallimento della notifica non deve mai far fallire
        # la creazione del case (vedi servicenow/notifications.py).
        notify_teams_new_case(serializer.instance)

    # ── screenshot (media protetta) ───────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="screenshot")
    def screenshot(self, request, pk=None):
        """Serve lo screenshot del case dietro autenticazione.

        Sostituisce l'accesso diretto a /api/media/servicenow_cases/..., che era
        pubblico. Il file resta dov'è su disco: viene servito da nginx tramite
        X-Accel-Redirect sulla location interna /protected_media/, quindi Django
        non fa da proxy ai byte.

        `disposition="inline"` perché il frontend lo mostra in un <img> (drawer
        dettaglio e anteprima del form): essendo same-origin, il cookie di
        sessione viene inviato automaticamente e non serve modificare il client.

        Il lookup NON usa self.get_object(): quello applica i filtri di
        soft-delete e restituirebbe 404 sullo screenshot di un case nel cestino,
        che invece resta visibile nella vista "eliminati". Chi può vedere il case
        può vederne lo screenshot, quindi si interroga il queryset completo e si
        richiamano comunque i controlli di permesso a oggetto.
        """
        case = get_object_or_404(ServiceNowCase.objects.all(), pk=pk)
        self.check_object_permissions(request, case)

        if not case.screenshot:
            return Response(
                {"detail": "Nessuno screenshot associato a questo case."},
                status=status.HTTP_404_NOT_FOUND,
            )

        filename = case.screenshot.name.rsplit("/", 1)[-1] or "screenshot"
        return protected_media_response(
            file_field=case.screenshot,
            disposition="inline",
            filename=filename,
        )

    # ── extract (OCR, non salva) ──────────────────────────────────────────────

    @action(
        detail=False, methods=["post"], url_path="extract",
        parser_classes=[MultiPartParser, FormParser],
    )
    def extract(self, request):
        upload = request.FILES.get("screenshot")
        if not upload:
            return Response(
                {"detail": "Nessuno screenshot caricato (campo 'screenshot' mancante)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from PIL import Image
        from servicenow.ocr import extract_servicenow_fields

        try:
            pil_image = Image.open(upload)
            pil_image.load()
        except Exception:
            return Response(
                {"detail": "Il file caricato non è un'immagine valida."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = extract_servicenow_fields(pil_image)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "number": result.number,
            "account": result.account,
            "priority": result.priority,
            "priority_raw": result.priority_raw,
            "opened_date": result.opened_date,
            "short_description": result.short_description,
            "warnings": result.warnings,
        })

    # ── triage (riepilogo casi di oggi per categoria/tecnico) ─────────────────

    @action(detail=False, methods=["get"], url_path="triage")
    def triage(self, request):
        """Riepilogo rapido dei case aperti *oggi*, raggruppati per categoria
        (Philips/Biotron) e tecnico, ordinati per numero di casi decrescente.
        Include SEMPRE tutti i tecnici attivi della categoria, anche a 0 casi
        oggi, così il pannello 'Triage' mostra a colpo d'occhio chi è scarico.

        Lo stato 'assente' è sensibile all'ora corrente: un'assenza a giornata
        intera (ferie/malattia/trasferta/altro senza orario) copre tutto il
        giorno; un permesso orario segnala il tecnico assente solo mentre
        l'orario corrente rientra nella fascia registrata.
        """
        today = date.today()
        qs = self.get_queryset().filter(opened_date=today)

        counts_map = {}       # (category, assigned_to_id) -> count
        unassigned_counts = {}  # category -> count dei case senza assegnatario
        for r in qs.values("category", "assigned_to_id").annotate(count=Count("id")):
            cat, uid = r["category"], r["assigned_to_id"]
            if uid is None:
                unassigned_counts[cat] = unassigned_counts.get(cat, 0) + r["count"]
            else:
                counts_map[(cat, uid)] = r["count"]

        # Assenza "adesso": una voce a mezza giornata (MAT/POM) copre la fascia
        # corrispondente all'istante corrente (split sulla soglia 13:00); un
        # permesso orario segnala assente solo mentre l'orario corrente rientra
        # nella fascia time_from–time_to. Le proposte non ancora validate
        # contano comunque come tentativo di assenza (come nel vecchio sistema);
        # le voci rifiutate no.
        now_time = timezone.localtime().time()
        today_absences = list(
            Absence.objects
                .filter(date=today, deleted_at__isnull=True)
                .exclude(status=AbsenceStatus.RIFIUTATA)
                .values_list("user_id", "reason", "day_part", "time_from", "time_to")
        )
        reason_labels = dict(AbsenceReason.choices)
        absent_map = {}
        for uid, reason, day_part, time_from, time_to in today_absences:
            if time_from and time_to:
                covers = time_from <= now_time <= time_to
            else:
                covers = day_part_covers_now(day_part, now_time)
            if covers and uid not in absent_map:
                absent_map[uid] = reason_labels.get(reason, reason)

        technicians = list(
            User.objects.select_related("profile")
                .filter(is_active=True)
                .order_by("first_name", "last_name", "username")
        )

        categories = {}
        for value, _ in ServiceNowCaseCategory.choices:
            techs = []
            total = 0
            for u in technicians:
                try:
                    if not bool(u.profile.is_servicenow_technician):
                        continue
                    u_is_philips = bool(u.profile.is_philips)
                except Exception:
                    u_is_philips = False
                if u_is_philips != (value == ServiceNowCaseCategory.PHILIPS):
                    continue
                count = counts_map.get((value, u.id), 0)
                name = f"{u.first_name} {u.last_name}".strip() or u.username
                absence_reason = absent_map.get(u.id)
                techs.append({
                    "id": u.id, "name": name, "count": count,
                    "absent": absence_reason is not None,
                    "absence_reason": absence_reason,
                })
                total += count

            unassigned = unassigned_counts.get(value, 0)
            if unassigned:
                techs.append({"id": None, "name": "Non assegnato", "count": unassigned, "absent": False, "absence_reason": None})
                total += unassigned

            # I tecnici assenti finiscono sempre in fondo, indipendentemente dal count.
            # Disponibili in ordine crescente per numero di casi (i più liberi
            # in cima, così si vede subito a chi assegnare il prossimo case);
            # gli assenti restano sempre in fondo, indipendentemente dal count.
            techs.sort(key=lambda t: (t["absent"], t["count"], t["name"]))
            categories[value] = {"total": total, "technicians": techs}

        return Response({"date": today.isoformat(), "categories": categories})

    # ── stats (aggregazione casi per tecnico/periodo) ─────────────────────────

    def _compute_stats(self, request):
        """Aggregazione casi gestiti per tecnico, raggruppati per mese o
        settimana ISO dell'anno indicato. Filtrabile per Type e tecnico.
        Riusata sia da stats() (JSON, pagina Statistiche) sia da
        stats_export_pdf() (report PDF), stessi filtri/query params.
        """
        today = date.today()
        try:
            year = int(request.query_params.get("year", today.year))
        except (TypeError, ValueError):
            year = today.year

        granularity = request.query_params.get("granularity", "month")
        if granularity not in ("day", "week", "month"):
            granularity = "month"

        qs = self.get_queryset().filter(opened_date__isnull=False)

        categories = request.query_params.getlist("category")
        if categories:
            qs = qs.filter(category__in=categories)

        case_type_ids = request.query_params.getlist("case_type")
        if case_type_ids:
            qs = qs.filter(case_type_id__in=case_type_ids)

        assigned_to_ids = request.query_params.getlist("assigned_to")
        if assigned_to_ids:
            qs = qs.filter(assigned_to_id__in=assigned_to_ids)

        month = None
        if granularity == "day":
            # Richiede un mese specifico: mostrare 365 colonne non è utile.
            try:
                month = int(request.query_params.get("month", today.month))
            except (TypeError, ValueError):
                month = today.month
            month = min(max(month, 1), 12)

            qs = qs.annotate(period=ExtractDay("opened_date"))
            qs = qs.filter(opened_date__year=year, opened_date__month=month)
            days_in_month = calendar.monthrange(year, month)[1]
            periods = [{"key": i, "label": str(i)} for i in range(1, days_in_month + 1)]

        elif granularity == "week":
            qs = qs.annotate(iso_year=ExtractIsoYear("opened_date"), period=ExtractWeek("opened_date"))
            qs = qs.filter(iso_year=year)
            week_param = request.query_params.get("week")
            if week_param:
                try:
                    week_n = int(week_param)
                    qs = qs.filter(period=week_n)
                    periods = [{"key": week_n, "label": f"W{week_n}"}]
                except (TypeError, ValueError):
                    periods = [{"key": i, "label": f"W{i}"} for i in range(1, 54)]
            else:
                periods = [{"key": i, "label": f"W{i}"} for i in range(1, 54)]

        else:  # month
            qs = qs.annotate(period=ExtractMonth("opened_date"))
            qs = qs.filter(opened_date__year=year)
            periods = [{"key": i, "label": MONTH_LABELS_IT[i - 1]} for i in range(1, 13)]

        rows = (
            qs.values("assigned_to_id", "assigned_to__first_name", "assigned_to__last_name", "assigned_to__username", "period")
              .annotate(count=Count("id"))
        )

        series_map = {}
        for r in rows:
            uid = r["assigned_to_id"]
            key = uid if uid is not None else "unassigned"
            if key not in series_map:
                if uid is None:
                    name = "Non assegnato"
                else:
                    full_name = f'{r["assigned_to__first_name"]} {r["assigned_to__last_name"]}'.strip()
                    name = full_name or r["assigned_to__username"]
                series_map[key] = {"user_id": uid, "name": name, "counts_by_period": {}}
            series_map[key]["counts_by_period"][r["period"]] = r["count"]

        series = []
        for s in series_map.values():
            counts = [s["counts_by_period"].get(p["key"], 0) for p in periods]
            series.append({"user_id": s["user_id"], "name": s["name"], "counts": counts})
        series.sort(key=lambda s: sum(s["counts"]), reverse=True)

        # ── Overlay assenze: solo in vista giornaliera per ora (per settimana/
        # mese una singola colonna aggrega più giorni e marcarla come "assente"
        # sarebbe fuorviante). Calcolo l'intervallo di date di ogni periodo e
        # associo a ogni cella tecnico×periodo il motivo (reason) dell'assenza
        # a giornata intera che la copre, se presente — usato dalla heatmap
        # per colorare la cella (H=Ferie blu, I=Malattia rosso, T=Trasferta/
        # Altro grigio). I permessi orari (poche ore) NON influenzano la
        # cella giornaliera: un tecnico con 2 ore di permesso ha comunque
        # lavorato il resto della giornata.
        if granularity == "day":
            def period_date_range(key):
                d = date(year, month, key)
                return d, d

            period_ranges = [period_date_range(p["key"]) for p in periods]

            # Priorità se, per lo stesso tecnico/giorno, esistono più fasce con
            # motivi diversi: la più "grave" vince nella visualizzazione.
            reason_priority = {
                AbsenceReason.MALATTIA: 0,
                AbsenceReason.FERIE: 1,
                AbsenceReason.PERMESSO_104: 1,
                AbsenceReason.TRAINING: 2,
                AbsenceReason.TRASFERTA: 2,
                AbsenceReason.ALTRO: 2,
            }

            # {user_id: {date: reason}} — solo voci a fascia (NON orarie): un
            # permesso di poche ore non colora la cella giornaliera. Le voci
            # rifiutate sono escluse.
            absences_by_user = {}
            if period_ranges:
                overall_start = min(s for s, _ in period_ranges)
                overall_end   = max(e for _, e in period_ranges)
                day_absences = (
                    Absence.objects
                        .filter(
                            date__gte=overall_start, date__lte=overall_end,
                            time_from__isnull=True, time_to__isnull=True,
                            deleted_at__isnull=True,
                        )
                        .exclude(status=AbsenceStatus.RIFIUTATA)
                        .values_list("user_id", "date", "reason")
                )
                for uid, d, reason in day_absences:
                    by_date = absences_by_user.setdefault(uid, {})
                    prev = by_date.get(d)
                    if prev is None or reason_priority.get(reason, 99) < reason_priority.get(prev, 99):
                        by_date[d] = reason

            for s in series:
                by_date = absences_by_user.get(s["user_id"], {})
                s["absence_periods"] = [by_date.get(pstart) for pstart, _ in period_ranges]

        total = sum(sum(s["counts"]) for s in series)

        top_technician = None
        if series and sum(series[0]["counts"]) > 0:
            top_technician = {"id": series[0]["user_id"], "name": series[0]["name"], "count": sum(series[0]["counts"])}

        type_counts = list(
            qs.values("case_type_id", "case_type__name", "case_type__category")
              .annotate(count=Count("id")).order_by("-count")
        )
        top_type = None
        if type_counts:
            t = type_counts[0]
            category_labels = dict(ServiceNowCaseCategory.choices)
            cat_label = category_labels.get(t["case_type__category"], t["case_type__category"])
            top_type = {
                "value": t["case_type_id"],
                "label": f'{cat_label} · {t["case_type__name"]}',
                "count": t["count"],
            }

        type_breakdown = [
            {"id": t["case_type_id"], "name": t["case_type__name"], "count": t["count"]}
            for t in type_counts
        ]

        return {
            "granularity": granularity,
            "year": year,
            "periods": periods,
            "series": series,
            "kpi": {"total": total, "top_technician": top_technician, "top_type": top_type},
            "type_breakdown": type_breakdown,
        }

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Aggregazione casi gestiti per tecnico, raggruppati per mese o
        settimana ISO dell'anno indicato. Filtrabile per Type e tecnico.
        Usato dalla pagina Statistiche ServiceNow (grafico a barre / matrice).
        """
        return Response(self._compute_stats(request))

    # ── stats export PDF (stesso filtro di stats, output stampabile) ──────────

    @action(detail=False, methods=["get"], url_path="stats-export-pdf")
    def stats_export_pdf(self, request):
        """Report PDF sintetico (KPI + breakdown Type + totali per tecnico)
        per i filtri correnti della pagina Statistiche. Stessi query params
        di stats/, generato server-side con reportlab (stesso pattern di
        wiki/api/pages.py:export_pdf).
        """
        payload = self._compute_stats(request)

        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.units import cm
            from reportlab.pdfgen import canvas
        except Exception as e:
            return Response({"detail": f"PDF export dependency missing: {e}"}, status=status.HTTP_501_NOT_IMPLEMENTED)

        category_param = request.query_params.getlist("category")
        category_labels = dict(ServiceNowCaseCategory.choices)
        if len(category_param) == 1:
            category_title = category_labels.get(category_param[0], category_param[0])
        elif category_param:
            category_title = " / ".join(category_labels.get(c, c) for c in category_param)
        else:
            category_title = "Tutte le categorie"

        granularity_labels = {"month": "Mensile", "week": "Settimanale", "day": "Giornaliera"}

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4
        left, right, top, bottom = 2 * cm, 2 * cm, 2 * cm, 2 * cm
        max_w = width - left - right

        y = height - top
        c.setFont("Helvetica-Bold", 16)
        c.drawString(left, y, "Statistiche ServiceNow")
        y -= 20

        c.setFont("Helvetica", 10)
        c.setFillGray(0.35)
        subtitle = f'{category_title} · Anno {payload["year"]} · {granularity_labels.get(payload["granularity"], payload["granularity"])}'
        c.drawString(left, y, subtitle)
        c.setFillGray(0)
        y -= 26

        def ensure_space(min_y: float):
            nonlocal y
            if y <= min_y:
                c.showPage()
                y = height - top

        # ── KPI ──────────────────────────────────────────────────────────────
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left, y, "Riepilogo")
        y -= 16
        c.setFont("Helvetica", 10)

        kpi = payload["kpi"]
        c.drawString(left, y, f'Casi totali: {kpi["total"]}')
        y -= 14
        if kpi["top_technician"]:
            c.drawString(left, y, f'Tecnico più attivo: {kpi["top_technician"]["name"]} ({kpi["top_technician"]["count"]} casi)')
            y -= 14
        if kpi["top_type"]:
            c.drawString(left, y, f'Type più frequente: {kpi["top_type"]["label"]} ({kpi["top_type"]["count"]} casi)')
            y -= 14
        y -= 12

        # ── Breakdown per Type ───────────────────────────────────────────────
        ensure_space(bottom + 60)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left, y, "Casi per Type")
        y -= 16
        c.setFont("Helvetica-Bold", 9)
        col_type_x, col_count_x = left, left + max_w - 3 * cm
        c.drawString(col_type_x, y, "Type")
        c.drawString(col_count_x, y, "Casi")
        y -= 4
        c.line(left, y, left + max_w, y)
        y -= 12
        c.setFont("Helvetica", 9)
        if payload["type_breakdown"]:
            for row in payload["type_breakdown"]:
                ensure_space(bottom + 20)
                c.drawString(col_type_x, y, str(row["name"])[:70])
                c.drawRightString(col_count_x + 2 * cm, y, str(row["count"]))
                y -= 13
        else:
            c.drawString(left, y, "Nessun dato per il periodo selezionato.")
            y -= 13
        y -= 12

        # ── Totali per tecnico (somma sull'intero periodo filtrato) ──────────
        ensure_space(bottom + 60)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left, y, "Casi per tecnico")
        y -= 16
        c.setFont("Helvetica-Bold", 9)
        c.drawString(col_type_x, y, "Tecnico")
        c.drawString(col_count_x, y, "Casi")
        y -= 4
        c.line(left, y, left + max_w, y)
        y -= 12
        c.setFont("Helvetica", 9)
        if payload["series"]:
            for s in payload["series"]:
                ensure_space(bottom + 20)
                c.drawString(col_type_x, y, str(s["name"])[:70])
                c.drawRightString(col_count_x + 2 * cm, y, str(sum(s["counts"])))
                y -= 13
        else:
            c.drawString(left, y, "Nessun dato per il periodo selezionato.")
            y -= 13

        c.save()
        buf.seek(0)

        filename = f'servicenow_stats_{"-".join(category_param) or "tutte"}_{payload["year"]}.pdf'
        filename = re.sub(r"[^A-Za-z0-9._-]+", "_", filename)
        resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp
