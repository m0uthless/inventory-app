from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone

import django_filters as filters

from rest_framework import serializers, viewsets, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from audit.utils import log_event, to_change_value_for_field
from core.emails import send_templated_email
from core.technicians import eligible_issue_assignee_q, is_eligible_issue_assignee
from core.permissions import CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, RestoreActionMixin
from core.soft_delete import apply_soft_delete_filters
from issues.models import Issue, IssueCategory, IssueComment, IssueStatus, get_placeholder_customer
from issues.visibility import own_area_q, user_area_id, visible_issues_q
from servicenow.models import ServiceNowCase
from rest_framework.permissions import IsAuthenticated
from portal.permissions import IsInternalOrPortalDedicatedApp

User = get_user_model()


def _issue_customer_display(issue) -> str:
    if issue.customer_placeholder:
        return issue.customer_placeholder
    return issue.customer.name if issue.customer_id else "—"


# ─── Lookup: IssueCategory ───────────────────────────────────────────────────

class IssueCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = IssueCategory
        fields = ["id", "key", "label", "sort_order", "is_active"]


class IssueCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = IssueCategorySerializer
    pagination_class = None

    def get_queryset(self):
        return IssueCategory.objects.filter(
            is_active=True, deleted_at__isnull=True
        ).order_by("sort_order", "label")


# ─── Serializers ─────────────────────────────────────────────────────────────

class IssueCommentSerializer(serializers.ModelSerializer):
    author_username     = serializers.CharField(source="author.username",   read_only=True)
    author_first_name   = serializers.CharField(source="author.first_name", read_only=True)
    author_last_name    = serializers.CharField(source="author.last_name",  read_only=True)

    class Meta:
        model   = IssueComment
        fields  = [
            "id", "issue", "author", "author_username",
            "author_first_name", "author_last_name",
            "body", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "issue", "author", "created_at", "updated_at"]


def can_edit_issue(user, issue) -> bool:
    """Una issue senza area la modifica chiunque abbia i permessi delle issue;
    con un'area solo i membri di quell'area (o il superuser)."""
    if issue.area_id is None or getattr(user, "is_superuser", False):
        return True
    uid = user_area_id(user)
    return uid is not None and uid == issue.area_id


class IssueSerializer(serializers.ModelSerializer):
    customer_name           = serializers.SerializerMethodField()
    customer_code           = serializers.CharField(source="customer.code",              read_only=True)
    is_customer_placeholder = serializers.SerializerMethodField()
    site_name               = serializers.CharField(source="site.name",                  read_only=True)
    inventory_name          = serializers.CharField(source="inventory.name",             read_only=True)
    inventory_knumber       = serializers.CharField(source="inventory.knumber",          read_only=True)
    inventory_serial_number = serializers.CharField(source="inventory.serial_number",    read_only=True)
    inventory_hostname      = serializers.CharField(source="inventory.hostname",         read_only=True)
    category_label          = serializers.CharField(source="category.label",             read_only=True)
    assigned_to_username    = serializers.CharField(source="assigned_to.username",       read_only=True)
    assigned_to_full_name   = serializers.SerializerMethodField()
    assigned_to_avatar      = serializers.SerializerMethodField()
    created_by_username     = serializers.CharField(source="created_by.username",        read_only=True)
    created_by_full_name    = serializers.SerializerMethodField()
    priority_label          = serializers.CharField(source="get_priority_display",       read_only=True)
    status_label            = serializers.CharField(source="get_status_display",         read_only=True)
    waiting_reason_label    = serializers.CharField(source="get_waiting_reason_display", read_only=True)
    comments_count          = serializers.SerializerMethodField()
    days_open               = serializers.SerializerMethodField()
    servicenow_external_url = serializers.SerializerMethodField()
    area_label              = serializers.CharField(source="area.label", read_only=True, default=None)
    can_edit                = serializers.SerializerMethodField()

    def get_can_edit(self, obj):
        request = self.context.get("request")
        return bool(request) and can_edit_issue(request.user, obj)

    def get_customer_name(self, obj):
        if obj.customer_placeholder:
            return obj.customer_placeholder
        return obj.customer.name if obj.customer_id else None

    def get_is_customer_placeholder(self, obj):
        return bool(obj.customer_placeholder)

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

    def get_created_by_full_name(self, obj):
        u = obj.created_by
        if not u:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_assigned_to_avatar(self, obj):
        return self._get_user_avatar(obj.assigned_to)

    def get_comments_count(self, obj):
        return getattr(obj, "comments_count", 0)

    def get_servicenow_external_url(self, obj):
        # Valorizzato via annotazione (Subquery) sul queryset del ViewSet;
        # fallback a None per contesti in cui il serializer è usato senza
        # quell'annotazione (es. save() interni, test unitari isolati).
        return getattr(obj, "servicenow_external_url", None)

    def get_days_open(self, obj):
        from datetime import date
        ref = obj.opened_at or obj.created_at.date()
        return max(0, (date.today() - ref).days)

    def _sync_closed_at(self, status_value, current_closed_at=None):
        if status_value in {IssueStatus.RESOLVED, IssueStatus.CLOSED}:
            return current_closed_at or timezone.localdate()
        return None

    def _auto_close_at(self, closed_at):
        """Restituisce la data di auto-chiusura: 48h (2 giorni) dopo closed_at."""
        if closed_at is None:
            return None
        import datetime
        return closed_at + datetime.timedelta(hours=48)

    def create(self, validated_data):
        status_value = validated_data.get("status", IssueStatus.OPEN)
        validated_data["closed_at"] = self._sync_closed_at(status_value)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        status_value = validated_data.get("status", instance.status)
        validated_data["closed_at"] = self._sync_closed_at(status_value, instance.closed_at)
        return super().update(instance, validated_data)

    def validate(self, attrs):
        # ── Blocca qualsiasi modifica a issue già chiuse ──────────────────────
        if self.instance is not None and self.instance.status == IssueStatus.CLOSED:
            raise serializers.ValidationError(
                "Questa issue è chiusa e non può essere modificata."
            )

        # ── Blocca l'impostazione manuale dello stato 'closed' ────────────────
        if attrs.get("status") == IssueStatus.CLOSED:
            raise serializers.ValidationError(
                {"status": "Lo stato «Chiusa» viene impostato automaticamente dal sistema."}
            )

        # ── Stato "In attesa": causale obbligatoria; altrimenti va svuotata ───
        status_value = attrs.get("status", getattr(self.instance, "status", None))
        if "waiting_reason" in attrs:
            waiting_reason = attrs["waiting_reason"]
        else:
            waiting_reason = getattr(self.instance, "waiting_reason", "")
        if status_value == IssueStatus.WAITING:
            if not waiting_reason:
                raise serializers.ValidationError(
                    {"waiting_reason": "La causale è obbligatoria quando lo stato è «In attesa»."}
                )
        else:
            attrs["waiting_reason"] = ""

        customer  = attrs.get("customer")  if "customer"  in attrs else getattr(self.instance, "customer",  None)
        site      = attrs.get("site")      if "site"      in attrs else getattr(self.instance, "site",      None)
        inventory = attrs.get("inventory") if "inventory" in attrs else getattr(self.instance, "inventory", None)

        errors = {}

        # ── Cliente non presente in anagrafica: testo libero al posto del FK ──
        placeholder_text = attrs.get("customer_placeholder", "").strip() if "customer_placeholder" in attrs else None
        if placeholder_text:
            if site is not None or inventory is not None:
                errors["customer_placeholder"] = (
                    "Non è possibile indicare sito o inventory quando il cliente è un testo libero."
                )
            else:
                attrs["customer_placeholder"] = placeholder_text
                attrs["customer"] = get_placeholder_customer()
                customer = attrs["customer"]
        elif placeholder_text == "" and "customer_placeholder" in attrs:
            # L'utente ha rimosso il placeholder: deve selezionare un cliente reale.
            if customer is None:
                errors["customer"] = "Il cliente è obbligatorio."

        if customer is None and not placeholder_text:
            errors.setdefault(
                "customer",
                "Il cliente è obbligatorio, oppure spunta \"Cliente non presente in DB\" e inserisci un nome.",
            )

        # ── Assegnazione: solo chi ha il permesso di gruppo `issues.be_assignee` ──
        # Controllato solo se l'assegnatario cambia davvero: le issue con un
        # assegnatario che nel frattempo ha perso il permesso restano modificabili
        # (il modulo completo rimanda sempre `assigned_to`).
        current_assignee_id = getattr(self.instance, "assigned_to_id", None)
        assignee_changed = "assigned_to" in attrs and getattr(attrs["assigned_to"], "pk", None) != current_assignee_id
        if assignee_changed and attrs["assigned_to"] is not None:
            if not is_eligible_issue_assignee(attrs["assigned_to"]):
                errors["assigned_to"] = "L'utente selezionato non è assegnabile alle issue."

        # ── Assegnatario membro dell'area della issue ──
        # Si ricontrolla solo se area o assegnatario cambiano davvero (le issue
        # con dati preesistenti restano modificabili); il superuser è esente,
        # come per i task di area.
        current_area_id = getattr(self.instance, "area_id", None)
        area_changed = "area" in attrs and getattr(attrs["area"], "pk", None) != current_area_id
        # Un'area disattivata o nel cestino non si sceglie più; le issue che ci
        # stanno già restano modificabili.
        new_area = attrs.get("area") if area_changed else None
        if new_area is not None and (not new_area.is_active or new_area.deleted_at is not None):
            errors["area"] = f"L'area «{new_area.label}» non è più attiva."
        if (area_changed or assignee_changed) and "assigned_to" not in errors:
            area = attrs["area"] if "area" in attrs else getattr(self.instance, "area", None)
            assignee = attrs["assigned_to"] if "assigned_to" in attrs else getattr(self.instance, "assigned_to", None)
            request = self.context.get("request")
            actor_is_superuser = bool(request and getattr(request.user, "is_superuser", False))
            if area is not None and assignee is not None and not actor_is_superuser:
                if user_area_id(assignee) != area.pk:
                    errors["assigned_to"] = f"L'assegnatario deve far parte dell'area «{area.label}»."

        if site is not None and customer is not None and site.customer_id != customer.id:
            errors["site"] = "Il sito selezionato non appartiene al cliente della issue."

        if inventory is not None and customer is not None and inventory.customer_id != customer.id:
            errors["inventory"] = "L'inventory selezionato non appartiene al cliente della issue."

        if inventory is not None and site is not None and inventory.site_id and inventory.site_id != site.id:
            errors["inventory"] = "L'inventory selezionato non appartiene al sito indicato nella issue."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    class Meta:
        model   = Issue
        fields  = [
            "id",
            "title", "description", "servicenow_id",
            "customer", "customer_name", "customer_code",
            "customer_placeholder", "is_customer_placeholder",
            "site", "site_name",
            "inventory", "inventory_name", "inventory_knumber", "inventory_serial_number", "inventory_hostname",
            "category", "category_label",
            "area", "area_label", "can_edit",
            "assigned_to", "assigned_to_username", "assigned_to_full_name", "assigned_to_avatar",
            "created_by", "created_by_username", "created_by_full_name",
            "priority", "priority_label",
            "status", "status_label",
            "waiting_reason", "waiting_reason_label",
            "opened_at", "closed_at", "days_open",
            "due_date",
            "comments_count",
            "servicenow_external_url",
            "created_at", "updated_at", "deleted_at",
        ]
        read_only_fields = [
            "id", "created_by", "created_at", "updated_at", "deleted_at",
            "customer_name", "customer_code", "is_customer_placeholder", "site_name", "category_label",
            "inventory_name", "inventory_knumber", "inventory_serial_number", "inventory_hostname",
            "assigned_to_username", "assigned_to_full_name", "assigned_to_avatar",
            "created_by_username", "created_by_full_name",
            "priority_label", "status_label", "waiting_reason_label",
            "comments_count", "days_open", "closed_at", "servicenow_external_url",
            "area_label", "can_edit",
        ]
        extra_kwargs = {
            # Obbligatorio a livello di modello (FK non-null): qui diventa
            # facoltativo perché può essere sostituito da customer_placeholder
            # (vedi validate()), che risolve comunque un customer reale
            # (il record sentinella) prima del salvataggio.
            "customer": {"required": False},
        }


# ─── Filters ─────────────────────────────────────────────────────────────────

class IssueFilter(filters.FilterSet):
    status      = filters.MultipleChoiceFilter(choices=Issue.status.field.choices)
    priority    = filters.MultipleChoiceFilter(choices=Issue.priority.field.choices)
    customer    = filters.NumberFilter(field_name="customer_id")
    site        = filters.NumberFilter(field_name="site_id")
    inventory   = filters.NumberFilter(field_name="inventory_id")
    category    = filters.NumberFilter(field_name="category_id")
    assigned_to = filters.NumberFilter(field_name="assigned_to_id")
    area        = filters.NumberFilter(field_name="area_id")
    no_area     = filters.BooleanFilter(field_name="area", lookup_expr="isnull")
    due_before  = filters.DateFilter(field_name="due_date", lookup_expr="lte")
    due_after   = filters.DateFilter(field_name="due_date", lookup_expr="gte")
    hide_closed = filters.BooleanFilter(method="filter_hide_closed")
    only_closed = filters.BooleanFilter(method="filter_only_closed")
    # Ricerca per singola colonna (riga di ricerca sotto le intestazioni).
    id_q        = filters.CharFilter(method="filter_id_q")
    title_q     = filters.CharFilter(field_name="title", lookup_expr="icontains")
    customer_q  = filters.CharFilter(method="filter_customer_q")
    servicenow_q = filters.CharFilter(field_name="servicenow_id", lookup_expr="icontains")
    assigned_q  = filters.CharFilter(method="filter_assigned_q")
    has_due     = filters.BooleanFilter(field_name="due_date", lookup_expr="isnull", exclude=True)

    class Meta:
        model  = Issue
        fields = ["status", "priority", "customer", "site", "inventory", "category", "assigned_to", "hide_closed", "only_closed"]

    def filter_id_q(self, queryset, name, value):
        digits = (value or "").strip().lstrip("#")
        if not digits:
            return queryset
        if not digits.isdigit():
            return queryset.none()
        return queryset.filter(id=int(digits))

    def filter_customer_q(self, queryset, name, value):
        v = (value or "").strip()
        if not v:
            return queryset
        return queryset.filter(
            Q(customer__name__icontains=v) | Q(customer__display_name__icontains=v) | Q(customer_placeholder__icontains=v) | Q(site__name__icontains=v)
        )

    def filter_assigned_q(self, queryset, name, value):
        v = (value or "").strip()
        if not v:
            return queryset
        return queryset.filter(
            Q(assigned_to__first_name__icontains=v) | Q(assigned_to__last_name__icontains=v) | Q(assigned_to__username__icontains=v)
        )

    def filter_hide_closed(self, queryset, name, value):
        if value:
            return queryset.filter(status__in=[IssueStatus.OPEN, IssueStatus.IN_PROGRESS, IssueStatus.WAITING])
        return queryset

    def filter_only_closed(self, queryset, name, value):
        # Stesso raggruppamento "Risolte/Chiuse" già usato in /issues/summary/
        # e nel widget grafico: risolta e chiusa sono entrambe considerate
        # "chiuse" agli occhi dell'utente (solo "chiusa" è terminale/immutabile).
        if value:
            return queryset.filter(status__in=[IssueStatus.RESOLVED, IssueStatus.CLOSED])
        return queryset


def notify_issue_created(user, issue):
    """Broadcast a tutti gli assegnatari issue (stessa regola di assigned_to)."""
    technicians = User.objects.filter(eligible_issue_assignee_q(), is_active=True).exclude(email="")
    for recipient in technicians:
        send_templated_email(
            template_name="emails/issue_created.html",
            context={
                "nome_utente": recipient.first_name or recipient.username,
                "issue_id": issue.id,
                "issue_title": issue.title,
                "customer_name": _issue_customer_display(issue),
                "site_name": (issue.site.display_name or issue.site.name) if issue.site_id else "",
                "priority_label": issue.get_priority_display(),
                "description": issue.description,
                "due_date": issue.due_date,
                "creato_da": (user.get_full_name() or user.get_username()) if user else "Archie",
            },
            subject=f"ARCHIE — Nuova issue: {issue.title}",
            recipient_list=[recipient.email],
        )


def notify_issue_assignment_change(user, *, old_assigned_to_id, issue):
    """Email solo tra due utenti reali: niente email su disassegnazione
    (assigned_to svuotato), sì su primo assegnamento e su riassegnazione."""
    new_assigned_to_id = issue.assigned_to_id
    if old_assigned_to_id == new_assigned_to_id or new_assigned_to_id is None:
        return

    recipient_ids = {new_assigned_to_id}
    if old_assigned_to_id is not None:
        recipient_ids.add(old_assigned_to_id)

    for recipient in User.objects.filter(id__in=recipient_ids).exclude(email=""):
        send_templated_email(
            template_name="emails/issue_assigned.html",
            context={
                "nome_utente": recipient.first_name or recipient.username,
                "issue_id": issue.id,
                "issue_title": issue.title,
                "customer_name": _issue_customer_display(issue),
                "priority_label": issue.get_priority_display(),
                "due_date": issue.due_date,
                "is_new_owner": recipient.id == new_assigned_to_id,
            },
            subject=(
                f"ARCHIE — Issue assegnata a te: {issue.title}"
                if recipient.id == new_assigned_to_id
                else f"ARCHIE — Issue riassegnata: {issue.title}"
            ),
            recipient_list=[recipient.email],
        )


# ─── ViewSet ─────────────────────────────────────────────────────────────────

class IssueViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """ViewSet per Issue.

    Eredita da:
    - RestoreActionMixin  → action `restore` standard (response con serializer)
    - SoftDeleteAuditMixin → perform_destroy (soft-delete), perform_create, perform_update

    Override specifici:
    - perform_create: passa solo created_by (Issue non ha updated_by); audit
      changes include title per la leggibilità nel log.
    - perform_update: audit diff limitato a status/priority (i campi chiave
      che interessano nelle notifiche e nei report).
    - get_queryset: usa apply_soft_delete_filters standard + annotazione
      comments_count.
    """

    # RestoreActionMixin config:
    # Issue non ha updated_by → no userstamp al restore.
    # Risponde con il serializer dell'oggetto ripristinato (coerente con CRM).
    restore_has_updated_by  = False
    restore_response_204    = False
    restore_use_split       = False
    restore_use_block_check = False

    serializer_class    = IssueSerializer
    filter_backends     = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class     = IssueFilter
    search_fields       = [
        "title", "description", "servicenow_id", "customer__name", "customer_placeholder",
        "inventory__name", "inventory__knumber", "inventory__serial_number", "inventory__hostname",
    ]
    ordering_fields     = [
        "created_at", "updated_at", "due_date", "closed_at",
        "priority", "status", "title", "servicenow_id",
        "opened_at", "customer__name", "category__label",
        "assigned_to__last_name", "comments_count",
        "deleted_at",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        from django.db.models import Count, OuterRef, Subquery
        # servicenow_id è testo libero (non FK): il match con ServiceNowCase
        # avviene per numero caso. Subquery invece di una join per evitare
        # duplicazione righe issue in caso di più case con lo stesso numero
        # (non dovrebbe accadere per case attivi, ma restiamo difensivi).
        external_url_sq = ServiceNowCase.objects.filter(
            number=OuterRef("servicenow_id"), deleted_at__isnull=True,
        ).order_by("-created_at").values("external_url")[:1]

        qs = Issue.objects.select_related(
            "customer", "site", "inventory", "category", "area",
            "assigned_to", "assigned_to__profile", "created_by",
        ).annotate(
            comments_count=Count("comments"),
            servicenow_external_url=Subquery(external_url_sq),
        )
        # Visibilità per area: chi non ha `issues.view_all_areas` vede solo la
        # propria area e le issue senza area (le altre rispondono 404).
        qs = qs.filter(visible_issues_q(self.request.user))
        # `?scope=mine`: la pagina Issue, a interruttore «Tutte le aree» spento.
        if self.request.query_params.get("scope") == "mine":
            qs = qs.filter(own_area_q(self.request.user))
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    # ── perform_create override ───────────────────────────────────────────────

    def perform_create(self, serializer):
        """Issue ha solo created_by, non updated_by: override minimo del mixin."""
        issue = serializer.save(created_by=self.request.user)
        log_event(
            self.request.user,
            action="create",
            instance=issue,
            changes={"title": {"from": None, "to": to_change_value_for_field("title", issue.title)}},
            request=self.request,
        )
        self._notify_issue_created(issue)
        self._notify_assignment_change(old_assigned_to_id=None, issue=issue)

    # ── perform_update override ───────────────────────────────────────────────

    def perform_update(self, serializer):
        """Audit diff limitato a status, priority, assegnatario e area — i campi chiave per i report."""
        old = serializer.instance
        old_status       = old.status
        old_priority     = old.priority
        old_assigned_to_id = old.assigned_to_id
        old_assigned_to    = old.assigned_to
        old_area_id        = old.area_id
        old_area           = old.area
        issue = serializer.save()
        changes = {}
        if old_status   != issue.status:   changes["status"]   = {"from": old_status,   "to": issue.status}
        if old_priority != issue.priority: changes["priority"] = {"from": old_priority, "to": issue.priority}
        # La riassegnazione fa partire un'email: deve restare traccia anche nell'audit.
        if old_assigned_to_id != issue.assigned_to_id:
            changes["assigned_to"] = {
                "from": to_change_value_for_field("assigned_to", old_assigned_to),
                "to":   to_change_value_for_field("assigned_to", issue.assigned_to),
            }
        # Il passaggio da un'area all'altra cambia chi può modificare la issue.
        if old_area_id != issue.area_id:
            changes["area"] = {
                "from": to_change_value_for_field("area", old_area),
                "to":   to_change_value_for_field("area", issue.area),
            }
        log_event(
            self.request.user,
            action="update",
            instance=issue,
            changes=changes or None,
            request=self.request,
        )
        self._notify_assignment_change(old_assigned_to_id=old_assigned_to_id, issue=issue)

    # ── Sola lettura per le altre aree ──────────────────────────────────────

    def _check_issue_area(self, issue):
        """Le issue con un'area le modificano solo i membri di quell'area (o il
        superuser): vale per ogni scrittura, commenti e Wiki compresi. Si guarda
        l'area attuale, prima della modifica."""
        if not can_edit_issue(self.request.user, issue):
            raise PermissionDenied("Puoi modificare solo le issue della tua area.")

    def update(self, request, *args, **kwargs):
        # Come UpdateModelMixin.update, ma la issue si carica una volta sola:
        # serve prima per il controllo d'area, poi per il salvataggio.
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        self._check_issue_area(instance)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        if getattr(instance, "_prefetched_objects_cache", None):
            instance._prefetched_objects_cache = {}
        return Response(serializer.data)

    def perform_destroy(self, instance):
        self._check_issue_area(instance)
        super().perform_destroy(instance)

    def _restore_obj(self, obj, request):
        self._check_issue_area(obj)
        super()._restore_obj(obj, request)

    def _get_scoped_trash_queryset(self):
        qs = super()._get_scoped_trash_queryset()
        if getattr(self.request.user, "is_superuser", False):
            return qs
        uid = user_area_id(self.request.user)
        return qs.filter(Q(area__isnull=True) | Q(area_id=uid)) if uid is not None else qs.filter(area__isnull=True)

    # ── email: nuova issue / riassegnazione ─────────────────────────────────

    def _notify_issue_created(self, issue):
        notify_issue_created(self.request.user, issue)

    def _notify_assignment_change(self, *, old_assigned_to_id, issue):
        notify_issue_assignment_change(self.request.user, old_assigned_to_id=old_assigned_to_id, issue=issue)

    # ── summary ──────────────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Conteggi per stato, avg chiusura e bucket grafico — globali, senza filtri.

        `?area=mine`: solo le issue della propria area più quelle senza area
        (contatore della barra laterale); chi non ha un'area vede i numeri
        complessivi."""
        from django.db.models import Count, Q, Avg, F, ExpressionWrapper, fields as dj_fields
        from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
        from django.utils.timezone import now
        import datetime

        scope = visible_issues_q(request.user)
        # `area`: `mine` (propria area + senza area), `none` (senza area) o l'id
        # di un'area — lo stesso perimetro del menu «Area» della pagina Issue.
        area_param = request.query_params.get("area")
        if area_param == "mine":
            scope &= own_area_q(request.user)
        elif area_param == "none":
            scope &= Q(area__isnull=True)
        elif area_param and area_param.isdigit():
            scope &= Q(area_id=int(area_param))

        qs = Issue.objects.filter(scope, deleted_at__isnull=True)
        counts = qs.aggregate(
            open_count=Count("id", filter=Q(status=IssueStatus.OPEN)),
            in_progress_count=Count("id", filter=Q(status=IssueStatus.IN_PROGRESS)),
            waiting_count=Count("id", filter=Q(status=IssueStatus.WAITING)),
            resolved_count=Count("id", filter=Q(status=IssueStatus.RESOLVED)),
            closed_count=Count("id", filter=Q(status=IssueStatus.CLOSED)),
        )
        counts["active_count"] = (
            (counts["open_count"] or 0) + (counts["in_progress_count"] or 0) + (counts["waiting_count"] or 0)
        )

        # Tempo medio di chiusura
        avg_row = (
            Issue.objects
            .filter(
                scope,
                deleted_at__isnull=True,
                status__in=(IssueStatus.RESOLVED, IssueStatus.CLOSED),
                opened_at__isnull=False,
                closed_at__isnull=False,
            )
            .annotate(days=ExpressionWrapper(F("closed_at") - F("opened_at"), output_field=dj_fields.DurationField()))
            .aggregate(avg=Avg("days"))
        )
        avg_duration = avg_row["avg"]
        counts["avg_days_to_close"] = (
            round(avg_duration.days + avg_duration.seconds / 86400, 1)
            if avg_duration is not None else None
        )

        # Bucket grafico: usa opened_at se presente, altrimenti created_at (come il serializer)
        granularity = (request.query_params.get("granularity") or "day").strip().lower()
        today = now().date()

        from django.db.models.functions import Coalesce, Cast
        from django.db.models import DateField as DjDateField

        # Campo data effettiva: opened_at ?? cast(created_at as date)
        effective_date = Coalesce(
            F("opened_at"),
            Cast(F("created_at"), output_field=DjDateField()),
        )

        if granularity == "week":
            trunc_fn = TruncWeek(effective_date, output_field=dj_fields.DateField())
            # Allinea il cutoff al lunedì della settimana più vecchia (11 settimane fa)
            oldest = today - datetime.timedelta(weeks=11)
            cutoff = oldest - datetime.timedelta(days=oldest.weekday())  # lunedì della settimana
        elif granularity == "month":
            trunc_fn = TruncMonth(effective_date, output_field=dj_fields.DateField())
            # Primo giorno del mese di 11 mesi fa
            y, m = today.year, today.month - 11
            if m <= 0:
                y, m = y - 1, m + 12
            cutoff = datetime.date(y, m, 1)
        else:
            trunc_fn = TruncDate(effective_date)
            cutoff = today - datetime.timedelta(days=29)

        buckets_qs = (
            Issue.objects
            .filter(scope, deleted_at__isnull=True)
            .annotate(eff_date=effective_date)
            .filter(eff_date__gte=cutoff)
            .annotate(period=trunc_fn)
            .values("period")
            .annotate(count=Count("id"))
            .order_by("period")
        )
        counts["chart_buckets"] = [
            {"date": b["period"].isoformat() if b["period"] else None, "count": b["count"]}
            for b in buckets_qs
        ]

        # Bucket issue chiuse/risolte — usa closed_at come data pivot
        if granularity == "week":
            closed_trunc = TruncWeek("closed_at", output_field=dj_fields.DateField())
        elif granularity == "month":
            closed_trunc = TruncMonth("closed_at", output_field=dj_fields.DateField())
        else:
            closed_trunc = TruncDate("closed_at")

        closed_qs = (
            Issue.objects
            .filter(
                scope,
                deleted_at__isnull=True,
                status__in=(IssueStatus.RESOLVED, IssueStatus.CLOSED),
                closed_at__isnull=False,
                closed_at__gte=cutoff,
            )
            .annotate(period=closed_trunc)
            .values("period")
            .annotate(count=Count("id"))
            .order_by("period")
        )
        counts["closed_buckets"] = [
            {"date": b["period"].isoformat() if b["period"] else None, "count": b["count"]}
            for b in closed_qs
        ]

        return Response(counts)

    # ── Articoli Wiki collegati e procedura ──────────────────────────────────
    # Il collegamento è un WikiLink(entity_type="issue"); le spunte dei passi
    # stanno sul collegamento (checked_steps). Lettura: vedere la issue e la Wiki.
    # Scrittura: modificare la issue (le spunte fanno parte del lavoro sulla issue).

    def _wiki_guard(self, request, write: bool):
        if not request.user.has_perm("wiki.view_wikipage"):
            return Response({"detail": "Non hai i permessi per vedere la Wiki."}, status=403)
        if write and not request.user.has_perm("issues.change_issue"):
            return Response({"detail": "Non hai i permessi per modificare la issue."}, status=403)
        return None

    @staticmethod
    def _wiki_link_payload(link):
        from wiki.procedure import procedure_steps

        steps = procedure_steps(link.page.content_markdown)
        checked = set(link.checked_steps or [])
        return {
            "id": link.id,
            "page": link.page_id,
            "page_title": link.page.title,
            "page_slug": link.page.slug,
            "kb_code": link.page.kb_code,
            "page_available": link.page.deleted_at is None and link.page.is_published,
            "steps": [{"text": t, "checked": t in checked} for t in steps],
            "created_at": link.created_at,
        }

    @action(
        detail=True, methods=["get", "post"], url_path="wiki",
        permission_classes=[IsAuthenticated, IsInternalOrPortalDedicatedApp],
    )
    def wiki(self, request, pk=None):
        from wiki.models import WikiEntityType, WikiLink, WikiPage

        denied = self._wiki_guard(request, write=request.method != "GET")
        if denied:
            return denied
        if not request.user.has_perm("issues.view_issue"):
            return Response({"detail": "Non autorizzato."}, status=403)
        issue = self.get_object()
        links = WikiLink.objects.select_related("page").filter(
            entity_type=WikiEntityType.ISSUE, entity_id=issue.id, deleted_at__isnull=True,
        )

        if request.method == "GET":
            return Response([self._wiki_link_payload(link) for link in links.order_by("created_at")])

        self._check_issue_area(issue)
        try:
            page_id = int(request.data.get("page"))
        except (TypeError, ValueError):
            return Response({"page": "Indica l'articolo da collegare."}, status=400)
        page = WikiPage.objects.filter(pk=page_id, deleted_at__isnull=True, is_published=True).first()
        if page is None:
            return Response({"page": "Articolo non trovato o non pubblicato."}, status=400)
        existing = links.filter(page=page).first()
        if existing:
            return Response(self._wiki_link_payload(existing), status=200)
        link = WikiLink.objects.create(page=page, entity_type=WikiEntityType.ISSUE, entity_id=issue.id)
        log_event(
            request.user, action="update", instance=issue,
            changes={"wiki_linked": {"from": None, "to": page.title}}, request=request,
        )
        return Response(self._wiki_link_payload(link), status=status.HTTP_201_CREATED)

    @action(
        detail=True, methods=["patch", "delete"], url_path=r"wiki/(?P<link_pk>\d+)",
        permission_classes=[IsAuthenticated, IsInternalOrPortalDedicatedApp],
    )
    def wiki_detail(self, request, pk=None, link_pk=None):
        from wiki.models import WikiEntityType, WikiLink
        from wiki.procedure import procedure_steps

        denied = self._wiki_guard(request, write=True)
        if denied:
            return denied
        issue = self.get_object()
        self._check_issue_area(issue)
        link = WikiLink.objects.select_related("page").filter(
            pk=link_pk, entity_type=WikiEntityType.ISSUE, entity_id=issue.id, deleted_at__isnull=True,
        ).first()
        if link is None:
            return Response({"detail": "Collegamento non trovato."}, status=404)

        if request.method == "DELETE":
            link.deleted_at = timezone.now()
            link.save(update_fields=["deleted_at", "updated_at"])
            log_event(
                request.user, action="update", instance=issue,
                changes={"wiki_unlinked": {"from": link.page.title, "to": None}}, request=request,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        step = request.data.get("step")
        checked = request.data.get("checked")
        if not isinstance(step, str) or not isinstance(checked, bool):
            return Response({"detail": "Indica il passo e se è fatto."}, status=400)
        if step not in procedure_steps(link.page.content_markdown):
            return Response({"step": "Questo passo non è nella procedura dell'articolo."}, status=400)
        done = [s for s in (link.checked_steps or []) if s != step]
        if checked:
            done.append(step)
        link.checked_steps = done
        link.save(update_fields=["checked_steps", "updated_at"])
        log_event(
            request.user, action="update", instance=issue,
            changes={"procedure_step": {"from": None if checked else step, "to": step if checked else None}},
            request=request,
        )
        return Response(self._wiki_link_payload(link))

    # ── Comments nested endpoint ──────────────────────────────────────────────

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        issue = self.get_object()

        if request.method == "GET":
            qs = issue.comments.select_related("author").order_by("created_at")
            return Response(IssueCommentSerializer(qs, many=True).data)

        self._check_issue_area(issue)
        serializer = IssueCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(issue=issue, author=request.user)
        log_event(
            request.user,
            action="update",
            instance=issue,
            changes={"comment_added": {"from": None, "to": comment.id}},
            request=request,
        )
        return Response(IssueCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"comments/(?P<comment_pk>\d+)")
    def comment_detail(self, request, pk=None, comment_pk=None):
        issue = self.get_object()
        self._check_issue_area(issue)
        try:
            comment = issue.comments.get(pk=comment_pk)
        except IssueComment.DoesNotExist:
            return Response({"detail": "Commento non trovato."}, status=404)

        if comment.author != request.user and not getattr(request.user, "is_superuser", False) and not request.user.has_perm("core.access_archie"):
            return Response({"detail": "Non autorizzato."}, status=403)

        if request.method == "DELETE":
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = IssueCommentSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
