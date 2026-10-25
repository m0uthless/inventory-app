# Task di area, fase 1 (modello e API): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare `AreaTask` a una gestione simile alle issue lato backend: assegnatario, priorità, stato "In attesa", commenti, allegati Drive, filtri, restore.

**Architecture:** `AreaTask` resta un modello separato in `core`. Si aggiungono campi e un modello commenti con una migrazione. `AreaTaskViewSet` passa ai mixin standard (`SoftDeleteAuditMixin`, `RestoreActionMixin`), mantenendo la regola "scrittura solo nella propria area". Gli allegati sono un M2M verso `drive.DriveFile`, filtrato con l'ACL di `drive/access.py`.

**Tech Stack:** Django 5, DRF, django-filter, pytest, PostgreSQL, Docker Compose (dev).

**Spec:** `docs/superpowers/specs/2026-09-24-area-tasks-issue-parity-design.md`

**Fuori da questo piano:** fase 2 (UI in `frontend/`) e fase 3 (email di assegnazione/commento). Ognuna avrà un piano proprio, scritto dopo che questa fase è in dev, perché usano lo schema API generato qui.

## Global Constraints

- Container backend sempre `backend`, sempre con `docker compose -f docker-compose.yml -f docker-compose.dev.yml` (mai `web`, mai un solo file).
- Mai modificare migrazioni già applicate: solo nuove migrazioni (l'ultima di `core` è `0039_scheduledjobrun`).
- La `permission_classes` di `AreaTaskViewSet` resta `[IsAuthenticated, IsInternalOrPortalDedicatedApp]`.
- Scrittura solo sulla propria area (`profile.leave_area`); le altre aree sono in sola lettura, commenti inclusi. Superuser sempre abilitato.
- Un file Drive si può collegare solo con `drive.access.has_file_access`; in lettura si mostrano solo i file di `filter_accessible_files`. Nessun accesso diretto ai media.
- Nessun commit, push o rilascio se Fede non lo chiede esplicitamente (regola del CLAUDE.md). Ogni task termina con un "Checkpoint" (`git status`/`git diff --stat`), non con un commit.
- Le email esistenti (`issues/tests/test_issue_notification_emails.py`, `notifications/tests/`) devono continuare a passare. `refresh_notifications` e `send_deadline_digest` leggono `AreaTask.due_date/status/area`: non cambiare quei campi.
- Changelog: solo sotto `## [Unreleased]`, intestazioni in inglese (`Added`/`Changed`/`Fixed`).

## Dev loop (il container `backend` non monta il codice)

Il codice è nell'immagine. Per iterare sui test si copia il file nel container (pytest parte da un processo nuovo a ogni run, quindi vede la modifica). Da eseguire dalla root del repo:

```bash
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
sync() { for f in "$@"; do $DC cp "backend/$f" "backend:/app/$f" || return 1; done; }
```

Ogni comando `sync` nei task usa questa funzione. `docker cp` NON aggiorna i worker gunicorn già avviati: per provare l'API dal browser (fase 2) serve `$DC up -d --build backend cron`.

## File Structure

| File | Ruolo |
|---|---|
| `backend/core/models.py` | Modifica: `AreaTaskPriority`, nuovi campi di `AreaTask`, nuovo `AreaTaskComment` |
| `backend/core/migrations/0040_areatask_assignee_priority_comments.py` | Nuova migrazione (generata) |
| `backend/core/api.py` | Modifica: serializer, filtro, viewset, commenti (sezione "Task di area") |
| `backend/core/tests/test_area_task_model.py` | Nuovo: test del modello |
| `backend/core/tests/test_area_tasks_api.py` | Nuovo: test dell'API (caratterizzazione, filtri, restore, assegnatario, commenti, allegati) |
| `CHANGELOG.md` | Modifica: voci sotto `[Unreleased]` |

---

### Task 1: Modello, migrazione e test del modello

**Files:**
- Modify: `backend/core/models.py` (classe `AreaTask`, righe ~305-372; nuova classe dopo di essa)
- Create: `backend/core/migrations/0040_areatask_assignee_priority_comments.py` (generato)
- Test: `backend/core/tests/test_area_task_model.py`

**Interfaces:**
- Produces: `core.models.AreaTaskPriority` (`LOW='low'`, `MEDIUM='medium'`, `HIGH='high'`, `CRITICAL='critical'`); `AreaTask.STATUS_IN_ATTESA = 'in_attesa'`; campi `AreaTask.priority`, `AreaTask.assigned_to`, `AreaTask.drive_files`; modello `AreaTaskComment(task, author, body, created_at, updated_at)` con `related_name='comments'` su `task`.

`IssuePriority` non si può importare in `core.models` (`issues.models` importa già `core.models`, sarebbe un import circolare): si definisce `AreaTaskPriority` con gli stessi valori.

- [ ] **Step 1: Scrivere il test del modello (fallisce)**

Creare `backend/core/tests/test_area_task_model.py`:

```python
import uuid

import pytest
from django.contrib.auth import get_user_model

from attendance.models import LeaveArea
from core.models import AreaTask, AreaTaskComment, AreaTaskPriority
from drive.models import DriveFile

pytestmark = pytest.mark.django_db

User = get_user_model()


def _area():
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label="Area Test")


def test_new_fields_have_expected_defaults():
    task = AreaTask.objects.create(area=_area(), title="T")
    assert task.priority == AreaTaskPriority.MEDIUM
    assert task.assigned_to is None
    assert task.drive_files.count() == 0


def test_in_attesa_is_a_valid_status_choice():
    values = [value for value, _label in AreaTask.STATUS_CHOICES]
    assert AreaTask.STATUS_IN_ATTESA == "in_attesa"
    assert values == ["da_fare", "in_corso", "in_attesa", "completato"]


def test_assigned_to_is_nulled_when_user_is_deleted():
    user = User.objects.create_user(username="assignee", password="pw")
    task = AreaTask.objects.create(area=_area(), title="T", assigned_to=user)
    user.delete()
    task.refresh_from_db()
    assert task.assigned_to is None


def test_drive_files_link_and_related_name():
    task = AreaTask.objects.create(area=_area(), title="T")
    f = DriveFile.objects.create(name="a.pdf", file="drive/x/a.pdf")
    task.drive_files.add(f)
    assert list(f.area_tasks.all()) == [task]


def test_comments_are_ordered_and_cascade_with_task():
    area = _area()
    author = User.objects.create_user(username="author", password="pw")
    task = AreaTask.objects.create(area=area, title="T")
    AreaTaskComment.objects.create(task=task, author=author, body="primo")
    AreaTaskComment.objects.create(task=task, author=author, body="secondo")
    assert [c.body for c in task.comments.all()] == ["primo", "secondo"]
    task.delete()
    assert AreaTaskComment.objects.count() == 0
```

- [ ] **Step 2: Verificare che fallisca**

```bash
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
sync() { for f in "$@"; do $DC cp "backend/$f" "backend:/app/$f" || return 1; done; }
sync core/tests/test_area_task_model.py
$DC exec backend pytest core/tests/test_area_task_model.py -q
```

Atteso: errore di collezione `ImportError: cannot import name 'AreaTaskComment' from 'core.models'`.

- [ ] **Step 3: Modificare il modello**

In `backend/core/models.py`, subito prima di `class AreaTask(TimeStampedModel):` aggiungere:

```python
class AreaTaskPriority(models.TextChoices):
    LOW      = 'low',      'Bassa'
    MEDIUM   = 'medium',   'Media'
    HIGH     = 'high',     'Alta'
    CRITICAL = 'critical', 'Critica'


```

Dentro `AreaTask`, sostituire il blocco degli stati:

```python
    STATUS_DA_FARE    = 'da_fare'
    STATUS_IN_CORSO   = 'in_corso'
    STATUS_COMPLETATO = 'completato'
    STATUS_CHOICES = [
        (STATUS_DA_FARE, 'Da fare'),
        (STATUS_IN_CORSO, 'In corso'),
        (STATUS_COMPLETATO, 'Completato'),
    ]
```

con:

```python
    STATUS_DA_FARE    = 'da_fare'
    STATUS_IN_CORSO   = 'in_corso'
    STATUS_IN_ATTESA  = 'in_attesa'
    STATUS_COMPLETATO = 'completato'
    STATUS_CHOICES = [
        (STATUS_DA_FARE, 'Da fare'),
        (STATUS_IN_CORSO, 'In corso'),
        (STATUS_IN_ATTESA, 'In attesa'),
        (STATUS_COMPLETATO, 'Completato'),
    ]
```

Sempre in `AreaTask`, dopo il campo `due_date = ...` aggiungere:

```python
    priority = models.CharField(
        max_length=20, choices=AreaTaskPriority.choices,
        default=AreaTaskPriority.MEDIUM, verbose_name='Priorità',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='assigned_area_tasks',
        verbose_name='Assegnato a',
    )
    drive_files = models.ManyToManyField(
        'drive.DriveFile',
        blank=True,
        related_name='area_tasks',
        verbose_name='Allegati Drive',
    )
```

Dopo `AreaTask.__str__` (prima del commento `# ─── Dashboard dinamica`) aggiungere:

```python
class AreaTaskComment(models.Model):
    task = models.ForeignKey(
        AreaTask, on_delete=models.CASCADE,
        related_name='comments', verbose_name='Task',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='area_task_comments', verbose_name='Autore',
    )
    body       = models.TextField(verbose_name='Testo')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Commento task di area'
        verbose_name_plural = 'Commenti task di area'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['task', 'created_at'], name='areataskcomment_task_idx'),
        ]

    def __str__(self):
        return f"Comment by {self.author_id} on AreaTask #{self.task_id}"


```

- [ ] **Step 4: Generare, estrarre e applicare la migrazione**

```bash
sync core/models.py
$DC exec backend python manage.py makemigrations core -n areatask_assignee_priority_comments
$DC cp backend:/app/core/migrations/0040_areatask_assignee_priority_comments.py backend/core/migrations/
$DC exec backend python manage.py migrate core
```

Atteso: la migrazione elenca `AddField priority`, `AddField assigned_to`, `AddField drive_files`, `AlterField status`, `CreateModel AreaTaskComment` (+ `AddIndex`), poi `Applying core.0040... OK`. Aprire il file estratto e verificare che dipenda da una migrazione `drive` esistente e da `core.0039_scheduledjobrun`, senza dipendenze circolari.

- [ ] **Step 5: Verificare che i test passino**

```bash
sync core/tests/test_area_task_model.py
$DC exec backend pytest core/tests/test_area_task_model.py -q
$DC exec backend python manage.py makemigrations --check --dry-run
```

Atteso: 5 passed; `No changes detected`.

- [ ] **Step 6: Checkpoint**

```bash
git status --short && git diff --stat
```

Atteso: `core/models.py` modificato; nuovi `0040_...py` e `test_area_task_model.py`. Nessun commit (vedi Global Constraints).

---

### Task 2: Viewset sui mixin, filtri, restore (test di caratterizzazione prima)

**Files:**
- Modify: `backend/core/api.py` (import in testa; sezione `AreaTaskViewSet`, righe ~338-450)
- Test: `backend/core/tests/test_area_tasks_api.py`

**Interfaces:**
- Consumes: `AreaTask`, `AreaTaskPriority` (Task 1).
- Produces: `AreaTaskFilter` (parametri `status`, `priority` multipli, `area`, `assigned_to`, `due_before`, `due_after`, `mine`); `AreaTaskViewSet` con `restore`, `bulk_restore`, `?only_deleted=1`, `?include_deleted=1`, ricerca (`?search=`) e ordinamento (`?ordering=`). `_check_own_area(area_id)` e `_user_area_id(user)` restano invariati. Il nascondere i completati > 3 giorni vale solo per `action == 'list'` e si disattiva con `?include_hidden=1` (invariato per il widget della dashboard).

Deviazione consapevole dalla spec: invece di invertire il default di `include_hidden` (che cambierebbe il widget esistente), si tiene il default attuale e la pagina `/tasks` della fase 2 passerà `include_hidden=1`. Il nascondere non si applica più a retrieve/update/restore, così un task completato da più di 3 giorni resta apribile per id e ripristinabile.

- [ ] **Step 1: Scrivere i test di caratterizzazione (comportamento attuale)**

Creare `backend/core/tests/test_area_tasks_api.py`:

```python
import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import AreaTask, UserProfile

pytestmark = pytest.mark.django_db

User = get_user_model()
URL = "/api/area-tasks/"


def _area(label="Area"):
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label=label)


def _user(area=None, *, superuser=False, username=None):
    username = username or f"u_{uuid.uuid4().hex[:6]}"
    if superuser:
        user = User.objects.create_superuser(username=username, password="pw", email=f"{username}@example.com")
    else:
        user = User.objects.create_user(username=username, password="pw", email=f"{username}@example.com")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return user


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _results(resp):
    data = resp.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


def _ids(resp):
    return {row["id"] for row in _results(resp)}


# ── caratterizzazione del comportamento esistente ─────────────────────────────

def test_user_creates_task_in_own_area_regardless_of_payload():
    mine, other = _area("Mia"), _area("Altra")
    user = _user(mine)
    resp = _client(user).post(URL, {"title": "T", "area": other.id}, format="json")
    assert resp.status_code == 201, resp.data
    task = AreaTask.objects.get(pk=resp.data["id"])
    assert task.area_id == mine.id
    assert task.created_by_id == user.id


def test_user_without_area_cannot_create():
    user = _user(None)
    resp = _client(user).post(URL, {"title": "T"}, format="json")
    assert resp.status_code == 403


def test_superuser_can_create_in_chosen_area():
    area = _area()
    resp = _client(_user(None, superuser=True)).post(URL, {"title": "T", "area": area.id}, format="json")
    assert resp.status_code == 201, resp.data
    assert AreaTask.objects.get(pk=resp.data["id"]).area_id == area.id


def test_cannot_update_or_delete_task_of_other_area_but_can_read_it():
    mine, other = _area(), _area()
    task = AreaTask.objects.create(area=other, title="Altrui")
    client = _client(_user(mine))
    assert task.id in _ids(client.get(URL))
    assert client.patch(f"{URL}{task.id}/", {"title": "X"}, format="json").status_code == 403
    assert client.delete(f"{URL}{task.id}/").status_code == 403


def test_completing_sets_completed_at_and_reopening_clears_it():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    client = _client(_user(area))
    client.patch(f"{URL}{task.id}/", {"status": "completato"}, format="json")
    task.refresh_from_db()
    assert task.completed_at is not None
    client.patch(f"{URL}{task.id}/", {"status": "da_fare"}, format="json")
    task.refresh_from_db()
    assert task.completed_at is None


def test_completed_tasks_older_than_3_days_hidden_from_list_unless_include_hidden():
    area = _area()
    old = AreaTask.objects.create(area=area, title="Vecchio", status="completato",
                                  completed_at=timezone.now() - timedelta(days=4))
    recent = AreaTask.objects.create(area=area, title="Recente", status="completato",
                                     completed_at=timezone.now() - timedelta(days=1))
    client = _client(_user(area))
    assert old.id not in _ids(client.get(URL))
    assert recent.id in _ids(client.get(URL))
    assert old.id in _ids(client.get(URL, {"include_hidden": "1"}))


def test_delete_is_soft_and_task_leaves_the_list():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    client = _client(_user(area))
    assert client.delete(f"{URL}{task.id}/").status_code == 204
    task.refresh_from_db()
    assert task.deleted_at is not None
    assert task.id not in _ids(client.get(URL))


def test_due_returns_only_own_area_open_tasks_due_by_tomorrow():
    mine, other = _area(), _area()
    today = timezone.localdate()
    due = AreaTask.objects.create(area=mine, title="Scade", due_date=today)
    waiting = AreaTask.objects.create(area=mine, title="In attesa", due_date=today, status="in_attesa")
    AreaTask.objects.create(area=mine, title="Fatto", due_date=today, status="completato")
    AreaTask.objects.create(area=other, title="Altra area", due_date=today)
    AreaTask.objects.create(area=mine, title="Lontano", due_date=today + timedelta(days=10))
    resp = _client(_user(mine)).get(f"{URL}due/")
    assert {row["id"] for row in resp.data} == {due.id, waiting.id}
```

- [ ] **Step 2: Eseguire i test di caratterizzazione sul codice attuale**

```bash
sync core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py -q
```

Atteso: tutti PASS sul codice non ancora modificato (`in_attesa` è già una choice valida grazie al Task 1). Se un test fallisce, il test descrive male il comportamento attuale: correggere il test, non il codice, prima di procedere.

- [ ] **Step 3: Scrivere i test nuovi (falliscono)**

Aggiungere in fondo a `backend/core/tests/test_area_tasks_api.py`:

```python
# ── nuovi: restore, trash, filtri, ricerca ────────────────────────────────────

def _grant_change(user):
    user.user_permissions.add(Permission.objects.get(codename="change_areatask"))


def test_restore_requires_change_permission_and_own_area():
    mine, other = _area(), _area()
    task = AreaTask.objects.create(area=mine, title="T")
    task.soft_delete()
    url = f"{URL}{task.id}/restore/"

    no_perm = _user(mine)
    assert _client(no_perm).post(url).status_code == 403

    wrong_area = _user(other)
    _grant_change(wrong_area)
    assert _client(wrong_area).post(url).status_code == 403

    ok = _user(mine)
    _grant_change(ok)
    assert _client(ok).post(url).status_code == 204
    task.refresh_from_db()
    assert task.deleted_at is None
    assert task.updated_by_id == ok.id


def test_restore_works_for_completed_task_older_than_3_days():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T", status="completato",
                                   completed_at=timezone.now() - timedelta(days=10))
    task.soft_delete()
    user = _user(area)
    _grant_change(user)
    assert _client(user).post(f"{URL}{task.id}/restore/").status_code == 204


def test_bulk_restore_only_restores_own_area():
    mine, other = _area(), _area()
    a = AreaTask.objects.create(area=mine, title="A")
    b = AreaTask.objects.create(area=other, title="B")
    a.soft_delete()
    b.soft_delete()
    user = _user(mine)
    _grant_change(user)
    resp = _client(user).post(f"{URL}bulk_restore/", {"ids": [a.id, b.id]}, format="json")
    assert resp.status_code == 200
    assert resp.data["restored"] == [a.id]
    b.refresh_from_db()
    assert b.deleted_at is not None


def test_only_deleted_lists_trash_and_include_deleted_lists_both():
    area = _area()
    live = AreaTask.objects.create(area=area, title="Live")
    gone = AreaTask.objects.create(area=area, title="Gone")
    gone.soft_delete()
    client = _client(_user(area))
    assert _ids(client.get(URL, {"only_deleted": "1"})) == {gone.id}
    assert _ids(client.get(URL, {"include_deleted": "1"})) == {live.id, gone.id}


def test_filters_status_priority_assignee_area_due_and_mine():
    a1, a2 = _area(), _area()
    me = _user(a1)
    colleague = _user(a1)
    today = timezone.localdate()
    t1 = AreaTask.objects.create(area=a1, title="t1", status="in_corso", priority="high",
                                 assigned_to=me, due_date=today)
    t2 = AreaTask.objects.create(area=a1, title="t2", status="da_fare", priority="low",
                                 assigned_to=colleague, due_date=today + timedelta(days=5))
    t3 = AreaTask.objects.create(area=a2, title="t3", status="in_attesa", priority="high")
    client = _client(me)

    assert _ids(client.get(URL, {"status": "in_corso"})) == {t1.id}
    assert _ids(client.get(URL, {"status": ["da_fare", "in_attesa"]})) == {t2.id, t3.id}
    assert _ids(client.get(URL, {"priority": "high"})) == {t1.id, t3.id}
    assert _ids(client.get(URL, {"assigned_to": colleague.id})) == {t2.id}
    assert _ids(client.get(URL, {"area": a2.id})) == {t3.id}
    assert _ids(client.get(URL, {"due_before": str(today)})) == {t1.id}
    assert _ids(client.get(URL, {"due_after": str(today + timedelta(days=1))})) == {t2.id}
    assert _ids(client.get(URL, {"mine": "true"})) == {t1.id}


def test_search_matches_title_and_description():
    area = _area()
    a = AreaTask.objects.create(area=area, title="Ordine toner", description="")
    b = AreaTask.objects.create(area=area, title="Altro", description="chiamare il fornitore")
    client = _client(_user(area))
    assert _ids(client.get(URL, {"search": "toner"})) == {a.id}
    assert _ids(client.get(URL, {"search": "fornitore"})) == {b.id}
```

- [ ] **Step 4: Verificare che i nuovi test falliscano**

```bash
sync core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py -q
```

Atteso: falliscono i test di restore (404/405: l'azione non esiste), trash (`only_deleted` ignorato), filtri e ricerca. I test di caratterizzazione restano verdi.

- [ ] **Step 5: Aggiornare gli import in `backend/core/api.py`**

Sostituire:

```python
from rest_framework.filters import OrderingFilter
```

con:

```python
import django_filters as filters
from rest_framework.filters import OrderingFilter, SearchFilter
```

Sostituire:

```python
from portal.permissions import IsInternalOrPortalDedicatedApp
```

con:

```python
from core.mixins import RestoreActionMixin, SoftDeleteAuditMixin
from core.soft_delete import TRUTHY, apply_soft_delete_filters
from portal.permissions import IsInternalOrPortalDedicatedApp
```

- [ ] **Step 6: Aggiungere il filtro e riscrivere la testata della viewset**

In `backend/core/api.py` inserire, subito prima di `class AreaTaskViewSet(viewsets.ModelViewSet):`:

```python
class AreaTaskFilter(filters.FilterSet):
    status      = filters.MultipleChoiceFilter(choices=AreaTask.STATUS_CHOICES)
    priority    = filters.MultipleChoiceFilter(choices=AreaTask._meta.get_field('priority').choices)
    area        = filters.NumberFilter(field_name='area_id')
    assigned_to = filters.NumberFilter(field_name='assigned_to_id')
    due_before  = filters.DateFilter(field_name='due_date', lookup_expr='lte')
    due_after   = filters.DateFilter(field_name='due_date', lookup_expr='gte')
    mine        = filters.BooleanFilter(method='filter_mine')

    class Meta:
        model  = AreaTask
        fields = ['status', 'priority', 'area', 'assigned_to', 'mine']

    def filter_mine(self, queryset, name, value):
        if value:
            return queryset.filter(assigned_to=self.request.user)
        return queryset


```

Sostituire la dichiarazione della classe e il suo docstring/attributi/`get_queryset` (da `class AreaTaskViewSet(viewsets.ModelViewSet):` fino alla fine di `get_queryset`, cioè fino a `return qs` incluso) con:

```python
class AreaTaskViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """
    Task di area. Lettura: tutte le aree, a chiunque sia autenticato (sola
    lettura sulle aree diverse dalla propria). Scrittura
    (create/update/delete/restore): solo sui task della propria area
    (`request.user.profile.leave_area`); il superuser può sempre.

    Nella lista i task completati da più di `AreaTask.HIDE_COMPLETED_AFTER_DAYS`
    giorni sono nascosti (restano in DB): `?include_hidden=1` li mostra.
    Vale solo per `action == 'list'`, così un task completato da tempo resta
    apribile per id e ripristinabile.

    Soft-delete/restore/audit: mixin standard di `core/mixins.py`
    (`?include_deleted=1`, `?only_deleted=1`, `restore`, `bulk_restore`).
    """
    # RestoreActionMixin: AreaTask ha updated_by, nessun genitore da
    # controllare, risposta 204 (default).
    restore_use_block_check = False
    restore_use_split       = False

    serializer_class   = AreaTaskSerializer
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class    = AreaTaskFilter
    search_fields      = ['title', 'description']
    ordering_fields    = [
        'created_at', 'updated_at', 'due_date', 'priority', 'status', 'title',
        'completed_at', 'deleted_at',
    ]

    def get_queryset(self):
        qs = AreaTask.objects.select_related('area', 'created_by')
        qs = apply_soft_delete_filters(
            qs, request=self.request, action_name=getattr(self, 'action', ''),
        )
        params = self.request.query_params
        in_trash = str(params.get('only_deleted', '')).strip().lower() in TRUTHY
        if getattr(self, 'action', None) == 'list' and params.get('include_hidden') != '1' and not in_trash:
            hide_before = timezone.now() - timedelta(days=AreaTask.HIDE_COMPLETED_AFTER_DAYS)
            qs = qs.exclude(status=AreaTask.STATUS_COMPLETATO, completed_at__lt=hide_before)
        return qs

    def _get_scoped_trash_queryset(self):
        qs = super()._get_scoped_trash_queryset()
        user = self.request.user
        if getattr(user, 'is_superuser', False):
            return qs
        return qs.filter(area_id=self._user_area_id(user))

    def _restore_obj(self, obj, request):
        self._check_own_area(obj.area_id)
        super()._restore_obj(obj, request)
```

Nota: `_get_scoped_trash_queryset` passa da `filter_queryset(get_queryset())` con `action='bulk_restore'`: `apply_soft_delete_filters` include già gli eliminati per quell'azione, e l'`include_hidden` non serve perché l'esclusione vale solo per `list`.

- [ ] **Step 7: Rimuovere il codice duplicato dalla viewset**

Nella stessa viewset:

1. Eliminare per intero il metodo statico `_changes_from_validated` (con il suo decorator `@staticmethod` e docstring): ora si usa quello di `SoftDeleteAuditMixin` (stessa firma, chiamato come `self._changes_from_validated(...)`, già così in `perform_update`).
2. Sostituire l'intero `perform_destroy` con:

```python
    def perform_destroy(self, instance):
        self._check_own_area(instance.area_id)
        super().perform_destroy(instance)
```

Lasciare invariati `_user_area_id`, `_check_own_area`, `perform_create`, `perform_update` e l'azione `due`.

- [ ] **Step 8: Eseguire tutti i test dell'API**

```bash
sync core/api.py core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py core/tests/test_area_task_model.py -q
```

Atteso: tutti PASS (caratterizzazione + nuovi). Se `test_filters...` fallisce sul parametro `priority`, verificare che `AreaTask._meta.get_field('priority').choices` restituisca le coppie di `AreaTaskPriority`.

- [ ] **Step 9: Regressione sui moduli vicini**

```bash
$DC exec backend pytest core/tests notifications/tests issues/tests -q
$DC exec backend python manage.py check
```

Atteso: tutto verde (in particolare `notifications/tests/test_refresh_notifications_email.py`, `test_send_deadline_digest.py`, `core/tests/test_restore_*`).

- [ ] **Step 10: Checkpoint**

```bash
git status --short && git diff --stat
```

---

### Task 3: Serializer con assegnatario, priorità e validazione

**Files:**
- Modify: `backend/core/api.py` (`AreaTaskSerializer`, righe ~300-335)
- Test: `backend/core/tests/test_area_tasks_api.py`

**Interfaces:**
- Consumes: `AreaTask.priority`, `AreaTask.assigned_to` (Task 1); viewset del Task 2.
- Produces: campi API `priority`, `assigned_to` (id, nullable, scrivibile), `assigned_to_name` (read-only), `comments_count` (read-only, int). Regola: un assegnatario deve avere `profile.leave_area_id == area del task`; l'utente che scrive, se superuser, è esente. Errore `400` con chiave `assigned_to`.

- [ ] **Step 1: Scrivere i test (falliscono)**

Aggiungere in fondo a `backend/core/tests/test_area_tasks_api.py`:

```python
# ── assegnatario e priorità ───────────────────────────────────────────────────

def test_create_with_priority_and_assignee_from_same_area():
    area = _area()
    creator = _user(area)
    assignee = _user(area, username="mario")
    resp = _client(creator).post(
        URL, {"title": "T", "priority": "high", "assigned_to": assignee.id}, format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["priority"] == "high"
    assert resp.data["assigned_to"] == assignee.id
    assert resp.data["assigned_to_name"] == "mario"
    assert resp.data["comments_count"] == 0


def test_priority_defaults_to_medium_and_rejects_unknown_values():
    area = _area()
    client = _client(_user(area))
    assert client.post(URL, {"title": "T"}, format="json").data["priority"] == "medium"
    assert client.post(URL, {"title": "T", "priority": "urgentissima"}, format="json").status_code == 400


def test_assignee_from_other_area_rejected_on_create_and_update():
    mine, other = _area(), _area()
    outsider = _user(other)
    client = _client(_user(mine))
    resp = client.post(URL, {"title": "T", "assigned_to": outsider.id}, format="json")
    assert resp.status_code == 400
    assert "assigned_to" in resp.data

    task = AreaTask.objects.create(area=mine, title="T")
    resp = client.patch(f"{URL}{task.id}/", {"assigned_to": outsider.id}, format="json")
    assert resp.status_code == 400


def test_assignee_without_area_or_inactive_rejected():
    area = _area()
    client = _client(_user(area))
    no_area = _user(None)
    assert client.post(URL, {"title": "T", "assigned_to": no_area.id}, format="json").status_code == 400
    inactive = _user(area)
    inactive.is_active = False
    inactive.save(update_fields=["is_active"])
    assert client.post(URL, {"title": "T", "assigned_to": inactive.id}, format="json").status_code == 400


def test_assignee_can_be_cleared_with_null():
    area = _area()
    assignee = _user(area)
    task = AreaTask.objects.create(area=area, title="T", assigned_to=assignee)
    resp = _client(_user(area)).patch(f"{URL}{task.id}/", {"assigned_to": None}, format="json")
    assert resp.status_code == 200
    task.refresh_from_db()
    assert task.assigned_to is None


def test_superuser_may_assign_to_user_of_other_area_when_creating_in_chosen_area():
    a1, a2 = _area(), _area()
    outsider = _user(a2)
    resp = _client(_user(None, superuser=True)).post(
        URL, {"title": "T", "area": a1.id, "assigned_to": outsider.id}, format="json",
    )
    assert resp.status_code == 201, resp.data


def test_status_in_attesa_accepted_and_does_not_set_completed_at():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    resp = _client(_user(area)).patch(f"{URL}{task.id}/", {"status": "in_attesa"}, format="json")
    assert resp.status_code == 200
    task.refresh_from_db()
    assert task.status == "in_attesa"
    assert task.completed_at is None
```

- [ ] **Step 2: Verificare che falliscano**

```bash
sync core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py -q -k "priority or assignee or in_attesa"
```

Atteso: falliscono (campi `priority`/`assigned_to` assenti dal serializer: `KeyError`/status inattesi).

- [ ] **Step 3: Aggiornare il serializer**

In `backend/core/api.py`, sostituire l'intera `AreaTaskSerializer` con:

```python
class AreaTaskSerializer(serializers.ModelSerializer):
    # Scrivibile (necessario per permettere ai superuser di creare un task
    # in un'area diversa dalla propria): la validazione di CHI può
    # effettivamente scegliere l'area è nella view (perform_create), non qui.
    area = serializers.PrimaryKeyRelatedField(
        queryset=LeaveArea.objects.filter(deleted_at__isnull=True, is_active=True),
        required=False,
    )
    area_label       = serializers.CharField(source='area.label', read_only=True)
    created_by_name  = serializers.SerializerMethodField()
    assigned_to      = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        allow_null=True, required=False,
    )
    assigned_to_name = serializers.SerializerMethodField()
    comments_count   = serializers.SerializerMethodField()
    can_edit         = serializers.SerializerMethodField()

    class Meta:
        model  = AreaTask
        fields = [
            'id', 'area', 'area_label', 'title', 'description', 'status',
            'priority', 'due_date', 'assigned_to', 'assigned_to_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'completed_at', 'comments_count', 'can_edit',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'completed_at']

    @staticmethod
    def _display_name(user):
        return f"{user.first_name} {user.last_name}".strip() or user.username

    def get_created_by_name(self, obj):
        return self._display_name(obj.created_by) if obj.created_by_id else None

    def get_assigned_to_name(self, obj):
        return self._display_name(obj.assigned_to) if obj.assigned_to_id else None

    def get_comments_count(self, obj):
        annotated = getattr(obj, 'comments_count', None)
        return annotated if annotated is not None else obj.comments.count()

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        user = request.user
        if getattr(user, 'is_superuser', False):
            return True
        user_area_id = getattr(getattr(user, 'profile', None), 'leave_area_id', None)
        return user_area_id is not None and user_area_id == obj.area_id

    def validate(self, attrs):
        attrs = super().validate(attrs)
        assignee = attrs.get('assigned_to')
        if assignee is None:
            return attrs
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        if getattr(actor, 'is_superuser', False):
            return attrs
        if self.instance is not None:
            area_id = self.instance.area_id
        else:
            area_id = getattr(getattr(actor, 'profile', None), 'leave_area_id', None)
        assignee_area_id = getattr(getattr(assignee, 'profile', None), 'leave_area_id', None)
        if area_id is None or assignee_area_id != area_id:
            raise serializers.ValidationError(
                {'assigned_to': "L'assegnatario deve appartenere all'area del task."}
            )
        return attrs
```

Aggiungere l'annotazione a `get_queryset` della viewset (Task 2), sostituendo la riga `qs = AreaTask.objects.select_related('area', 'created_by')` con:

```python
        qs = AreaTask.objects.select_related(
            'area', 'created_by', 'assigned_to',
        ).annotate(comments_count=Count('comments'))
```

e aggiungendo `Count` agli import di `backend/core/api.py`:

```python
from django.db.models import Count
```

Nota: per un non-superuser la validazione usa l'area del suo profilo in creazione (perform_create forza comunque quell'area). Per il superuser è esente perché può già gestire qualunque area.

- [ ] **Step 4: Verificare che passino**

```bash
sync core/api.py core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py core/tests/test_area_task_model.py -q
$DC exec backend pytest notifications/tests -q
```

Atteso: tutto PASS.

- [ ] **Step 5: Checkpoint**

```bash
git status --short && git diff --stat
```

---

### Task 4: Commenti

**Files:**
- Modify: `backend/core/api.py` (nuovo serializer commenti + azioni `comments` e `comment_detail` sulla viewset; import di `AreaTaskComment`)
- Test: `backend/core/tests/test_area_tasks_api.py`

**Interfaces:**
- Consumes: `AreaTaskComment` (Task 1), `_check_own_area` (Task 2).
- Produces: `GET/POST /api/area-tasks/{id}/comments/`; `PATCH/DELETE /api/area-tasks/{id}/comments/{comment_id}/`. Il commento serializzato ha `id, task, author, author_name, body, created_at, updated_at`. Lettura per ogni utente autenticato; POST solo nella propria area (superuser sempre); PATCH/DELETE solo autore o superuser (403 altrimenti); 404 se il commento non è del task. L'aggiunta di un commento scrive un evento audit `update` sul task con `comment_added`.

- [ ] **Step 1: Scrivere i test (falliscono)**

Aggiungere in fondo a `backend/core/tests/test_area_tasks_api.py`:

```python
# ── commenti ──────────────────────────────────────────────────────────────────

def test_comment_create_list_and_count():
    area = _area()
    author = _user(area, username="anna")
    task = AreaTask.objects.create(area=area, title="T")
    client = _client(author)

    resp = client.post(f"{URL}{task.id}/comments/", {"body": "Fatto il primo passo"}, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["author"] == author.id
    assert resp.data["author_name"] == "anna"

    listing = client.get(f"{URL}{task.id}/comments/")
    assert [c["body"] for c in listing.data] == ["Fatto il primo passo"]
    assert client.get(f"{URL}{task.id}/").data["comments_count"] == 1


def test_comment_body_required():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    assert _client(_user(area)).post(f"{URL}{task.id}/comments/", {"body": ""}, format="json").status_code == 400


def test_other_area_can_read_comments_but_not_post():
    mine, other = _area(), _area()
    task = AreaTask.objects.create(area=other, title="T")
    client = _client(_user(mine))
    assert client.get(f"{URL}{task.id}/comments/").status_code == 200
    assert client.post(f"{URL}{task.id}/comments/", {"body": "x"}, format="json").status_code == 403


def test_comment_edit_and_delete_only_by_author_or_superuser():
    area = _area()
    author = _user(area)
    colleague = _user(area)
    task = AreaTask.objects.create(area=area, title="T")
    comment = AreaTaskComment.objects.create(task=task, author=author, body="originale")
    url = f"{URL}{task.id}/comments/{comment.id}/"

    assert _client(colleague).patch(url, {"body": "x"}, format="json").status_code == 403
    assert _client(colleague).delete(url).status_code == 403

    assert _client(author).patch(url, {"body": "corretto"}, format="json").status_code == 200
    comment.refresh_from_db()
    assert comment.body == "corretto"

    assert _client(_user(None, superuser=True)).delete(url).status_code == 204
    assert not AreaTaskComment.objects.filter(pk=comment.pk).exists()


def test_comment_of_another_task_is_404():
    area = _area()
    author = _user(area)
    t1 = AreaTask.objects.create(area=area, title="1")
    t2 = AreaTask.objects.create(area=area, title="2")
    comment = AreaTaskComment.objects.create(task=t1, author=author, body="x")
    assert _client(author).patch(f"{URL}{t2.id}/comments/{comment.id}/", {"body": "y"}, format="json").status_code == 404


def test_adding_comment_writes_audit_event():
    from audit.models import AuditEvent

    area = _area()
    author = _user(area)
    task = AreaTask.objects.create(area=area, title="T")
    before = AuditEvent.objects.count()
    _client(author).post(f"{URL}{task.id}/comments/", {"body": "nota"}, format="json")
    assert AuditEvent.objects.count() == before + 1
```

E aggiungere `AreaTaskComment` all'import in testa al file:

```python
from core.models import AreaTask, AreaTaskComment, UserProfile
```

- [ ] **Step 2: Verificare che falliscano**

```bash
sync core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py -q -k comment
```

Atteso: falliscono con 404 (le route `comments` non esistono).

- [ ] **Step 3: Implementare serializer e azioni**

In `backend/core/api.py` aggiungere `AreaTaskComment` all'import da `core.models`:

```python
from core.models import (
    AreaTask, AreaTaskComment, Announcement, ChangelogEntry, CustomerStatus, SiteStatus, InventoryStatus,
    InventoryType, UserProfile, UserTask, DashboardWidget, UserDashboardLayout, StickyNote,
    DefaultDashboardLayout,
)
```

Subito dopo `AreaTaskSerializer` aggiungere:

```python
class AreaTaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model  = AreaTaskComment
        fields = ['id', 'task', 'author', 'author_name', 'body', 'created_at', 'updated_at']
        read_only_fields = ['id', 'task', 'author', 'created_at', 'updated_at']

    def get_author_name(self, obj):
        u = obj.author
        return f"{u.first_name} {u.last_name}".strip() or u.username
```

Nella viewset, dopo l'azione `due`, aggiungere:

```python
    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        task = self.get_object()

        if request.method == 'GET':
            qs = task.comments.select_related('author').order_by('created_at')
            return Response(AreaTaskCommentSerializer(qs, many=True).data)

        self._check_own_area(task.area_id)
        serializer = AreaTaskCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(task=task, author=request.user)
        log_event(
            actor=request.user, action="update", instance=task,
            changes={"comment_added": {"from": None, "to": comment.id}},
            request=request,
        )
        return Response(AreaTaskCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'comments/(?P<comment_pk>\d+)')
    def comment_detail(self, request, pk=None, comment_pk=None):
        task = self.get_object()
        try:
            comment = task.comments.select_related('author').get(pk=comment_pk)
        except AreaTaskComment.DoesNotExist:
            return Response({'detail': 'Commento non trovato.'}, status=status.HTTP_404_NOT_FOUND)

        if comment.author_id != request.user.id and not getattr(request.user, 'is_superuser', False):
            return Response({'detail': 'Non autorizzato.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'DELETE':
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = AreaTaskCommentSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
```

- [ ] **Step 4: Verificare che passino**

```bash
sync core/api.py core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py -q
```

Atteso: tutto PASS.

- [ ] **Step 5: Checkpoint**

```bash
git status --short && git diff --stat
```

---

### Task 5: Allegati Drive

**Files:**
- Modify: `backend/core/api.py` (`AreaTaskSerializer`, `perform_create`/`perform_update` della viewset, import)
- Test: `backend/core/tests/test_area_tasks_api.py`

**Interfaces:**
- Consumes: `AreaTask.drive_files` (Task 1); `drive.access.has_file_access(user, file) -> bool`, `drive.access.filter_accessible_files(qs, user) -> QuerySet`.
- Produces: campo scrivibile `drive_files` (lista di id di `DriveFile`, opzionale) e campo di sola lettura `drive_files_detail` (lista di `{id, name, mime_type, size, folder}` dei soli file vivi e accessibili all'utente). In scrittura: id di file non accessibili o inesistenti/eliminati → `400` su `drive_files`. In `update` i collegamenti a file che l'utente non vede (ACL o soft-deleted) vengono preservati. Audit: `drive_files` compare in `changes` come `{from: [ids], to: [ids]}` (solo id dei file visibili all'utente).

Per i test serve un file Drive con ACL: `DriveFile.objects.create(name=..., file="drive/x/a.pdf")` (nessun upload reale necessario, `FileField` accetta il percorso) e `allowed_groups.add(group)` per restringere.

- [ ] **Step 1: Scrivere i test (falliscono)**

Aggiungere in fondo a `backend/core/tests/test_area_tasks_api.py`:

```python
# ── allegati Drive ────────────────────────────────────────────────────────────

from django.contrib.auth.models import Group  # noqa: E402

from drive.models import DriveFile  # noqa: E402


def _drive_file(name="a.pdf", *, group=None):
    f = DriveFile.objects.create(name=name, file=f"drive/x/{name}")
    if group is not None:
        f.allowed_groups.add(group)
    return f


def _in_group(user, group):
    user.groups.add(group)
    return user


def test_link_accessible_files_and_read_detail():
    area = _area()
    f = _drive_file("verbale.pdf")
    resp = _client(_user(area)).post(URL, {"title": "T", "drive_files": [f.id]}, format="json")
    assert resp.status_code == 201, resp.data
    detail = resp.data["drive_files_detail"]
    assert [d["id"] for d in detail] == [f.id]
    assert detail[0]["name"] == "verbale.pdf"
    assert set(detail[0]) == {"id", "name", "mime_type", "size", "folder"}


def test_cannot_link_file_without_access():
    area = _area()
    group = Group.objects.create(name="riservato")
    secret = _drive_file("segreto.pdf", group=group)
    client = _client(_user(area))
    resp = client.post(URL, {"title": "T", "drive_files": [secret.id]}, format="json")
    assert resp.status_code == 400
    assert "drive_files" in resp.data
    assert AreaTask.objects.count() == 0


def test_cannot_link_missing_or_soft_deleted_file():
    area = _area()
    gone = _drive_file("gone.pdf")
    gone.soft_delete()
    client = _client(_user(area))
    assert client.post(URL, {"title": "T", "drive_files": [gone.id]}, format="json").status_code == 400
    assert client.post(URL, {"title": "T", "drive_files": [999999]}, format="json").status_code == 400


def test_restricted_file_is_hidden_from_users_without_access():
    area = _area()
    group = Group.objects.create(name="riservato")
    secret = _drive_file("segreto.pdf", group=group)
    public = _drive_file("pubblico.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    task.drive_files.add(secret, public)

    allowed = _in_group(_user(area), group)
    outsider = _user(area)

    seen_by_allowed = _client(allowed).get(f"{URL}{task.id}/").data["drive_files_detail"]
    seen_by_outsider = _client(outsider).get(f"{URL}{task.id}/").data["drive_files_detail"]
    assert {d["id"] for d in seen_by_allowed} == {secret.id, public.id}
    assert {d["id"] for d in seen_by_outsider} == {public.id}
    # anche nella lista, senza rivelare l'esistenza del file riservato
    row = next(r for r in _results(_client(outsider).get(URL)) if r["id"] == task.id)
    assert {d["id"] for d in row["drive_files_detail"]} == {public.id}
    assert "segreto" not in str(row)


def test_soft_deleted_drive_file_disappears_and_reappears_on_restore():
    area = _area()
    f = _drive_file("a.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    task.drive_files.add(f)
    client = _client(_user(area))

    f.soft_delete()
    assert client.get(f"{URL}{task.id}/").data["drive_files_detail"] == []
    f.deleted_at = None
    f.save(update_fields=["deleted_at"])
    assert [d["id"] for d in client.get(f"{URL}{task.id}/").data["drive_files_detail"]] == [f.id]


def test_update_replaces_visible_links_but_preserves_hidden_ones():
    area = _area()
    group = Group.objects.create(name="riservato")
    secret = _drive_file("segreto.pdf", group=group)
    old_public = _drive_file("vecchio.pdf")
    new_public = _drive_file("nuovo.pdf")
    trashed = _drive_file("cestino.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    task.drive_files.add(secret, old_public, trashed)
    trashed.soft_delete()

    outsider = _user(area)
    resp = _client(outsider).patch(f"{URL}{task.id}/", {"drive_files": [new_public.id]}, format="json")
    assert resp.status_code == 200, resp.data
    assert set(task.drive_files.values_list("pk", flat=True)) == {secret.id, trashed.id, new_public.id}
    assert [d["id"] for d in resp.data["drive_files_detail"]] == [new_public.id]


def test_update_without_drive_files_key_leaves_links_untouched_and_empty_list_clears_visible():
    area = _area()
    f = _drive_file("a.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    task.drive_files.add(f)
    client = _client(_user(area))

    client.patch(f"{URL}{task.id}/", {"title": "Nuovo titolo"}, format="json")
    assert task.drive_files.count() == 1
    client.patch(f"{URL}{task.id}/", {"drive_files": []}, format="json")
    assert task.drive_files.count() == 0


def test_link_and_unlink_are_audited():
    from audit.models import AuditEvent

    area = _area()
    f = _drive_file("a.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    client = _client(_user(area))

    before = AuditEvent.objects.count()
    client.patch(f"{URL}{task.id}/", {"drive_files": [f.id]}, format="json")
    client.patch(f"{URL}{task.id}/", {"drive_files": []}, format="json")
    assert AuditEvent.objects.count() == before + 2
    last = AuditEvent.objects.order_by("-id").first()
    assert "drive_files" in str(last.changes)
```

- [ ] **Step 2: Verificare che falliscano**

```bash
sync core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py -q -k "drive or link or restricted"
```

Atteso: falliscono (`drive_files` non è un campo del serializer, `KeyError: 'drive_files_detail'`).

- [ ] **Step 3: Estendere il serializer**

In `backend/core/api.py` aggiungere agli import:

```python
from drive.access import filter_accessible_files, has_file_access
from drive.models import DriveFile
```

In `AreaTaskSerializer` aggiungere, accanto agli altri campi dichiarati:

```python
    drive_files = serializers.PrimaryKeyRelatedField(
        queryset=DriveFile.objects.filter(deleted_at__isnull=True),
        many=True, required=False,
    )
    drive_files_detail = serializers.SerializerMethodField()
```

Aggiungere `'drive_files', 'drive_files_detail',` a `Meta.fields` (dopo `'assigned_to_name',`).

Aggiungere questi metodi alla classe (dopo `get_comments_count`):

```python
    def _request_user(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return user if user is not None and getattr(user, 'is_authenticated', False) else None

    def get_drive_files_detail(self, obj):
        user = self._request_user()
        if user is None:
            return []
        files = filter_accessible_files(obj.drive_files.filter(deleted_at__isnull=True), user)
        return [
            {'id': f.id, 'name': f.name, 'mime_type': f.mime_type, 'size': f.size, 'folder': f.folder_id}
            for f in files
        ]

    def validate_drive_files(self, files):
        user = self._request_user()
        denied = [f.id for f in files if user is None or not has_file_access(user, f)]
        if denied:
            raise serializers.ValidationError(
                f"File non disponibili o non accessibili: {sorted(denied)}"
            )
        return files

    def update(self, instance, validated_data):
        files = validated_data.pop('drive_files', None)
        instance = super().update(instance, validated_data)
        if files is not None:
            user = self._request_user()
            visible_ids = set(
                filter_accessible_files(
                    instance.drive_files.filter(deleted_at__isnull=True), user,
                ).values_list('pk', flat=True)
            ) if user is not None else set()
            preserved = [f.pk for f in instance.drive_files.all() if f.pk not in visible_ids]
            instance.drive_files.set([f.pk for f in files] + preserved)
        return instance
```

La preservazione impedisce che una modifica di chi non vede alcuni allegati (ACL) o di un file nel cestino cancelli quei collegamenti.

- [ ] **Step 4: Audit dei collegamenti nella viewset**

Nella viewset sostituire `perform_create` e `perform_update` con:

```python
    def _visible_file_ids(self, task):
        return sorted(
            filter_accessible_files(
                task.drive_files.filter(deleted_at__isnull=True), self.request.user,
            ).values_list('pk', flat=True)
        )

    def perform_create(self, serializer):
        user = self.request.user
        user_area_id = self._user_area_id(user)

        if getattr(user, 'is_superuser', False):
            # Il superuser può creare in una qualunque area: usa quella
            # inviata dal client (il selettore area del widget), con
            # fallback alla propria se non specificata.
            chosen_area = serializer.validated_data.get('area')
            area_id = chosen_area.id if chosen_area is not None else user_area_id
            if not area_id:
                raise PermissionDenied(
                    "Specifica un'area: il tuo profilo non ne ha una assegnata."
                )
        else:
            # Utenti normali: sempre e solo la propria area, a prescindere
            # da cosa venga eventualmente inviato dal client.
            if not user_area_id:
                raise PermissionDenied(
                    "Nessuna area assegnata al tuo profilo: contatta un amministratore."
                )
            area_id = user_area_id

        instance = serializer.save(created_by=user, updated_by=user, area_id=area_id)

        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
            if k != 'drive_files'
        }
        file_ids = self._visible_file_ids(instance)
        if file_ids:
            changes['drive_files'] = {"from": [], "to": file_ids}
        log_event(
            actor=user, action="create", instance=instance,
            changes=changes, request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        self._check_own_area(instance.area_id)
        validated = {k: v for k, v in serializer.validated_data.items() if k != 'drive_files'}
        changes = self._changes_from_validated(instance, validated)
        files_before = self._visible_file_ids(instance)

        new_status = serializer.validated_data.get('status', instance.status)
        if new_status == AreaTask.STATUS_COMPLETATO and instance.status != AreaTask.STATUS_COMPLETATO:
            completed_at = timezone.now()
        elif new_status != AreaTask.STATUS_COMPLETATO:
            completed_at = None
        else:
            completed_at = instance.completed_at

        # L'area di un task non si cambia mai in modifica (nemmeno per il
        # superuser): resta quella di creazione, a prescindere da cosa
        # venga eventualmente inviato dal client.
        saved = serializer.save(
            completed_at=completed_at, area_id=instance.area_id, updated_by=self.request.user,
        )
        files_after = self._visible_file_ids(saved)
        if files_before != files_after:
            changes['drive_files'] = {"from": files_before, "to": files_after}
        log_event(
            actor=self.request.user, action="update", instance=saved,
            changes=changes or None, request=self.request,
        )
```

Nota per chi esegue: `serializer.save(...)` è chiamato con `area_id=...` come nel codice originale. L'audit di `create` è invariato per gli altri campi; la sola differenza è l'esclusione di `drive_files` e l'aggiunta della lista degli id visibili.

- [ ] **Step 5: Verificare che passino**

```bash
sync core/api.py core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py core/tests/test_area_task_model.py -q
```

Atteso: tutto PASS. Se `test_link_and_unlink_are_audited` fallisce perché `AuditEvent` non ha il campo `changes`, leggere `backend/audit/models.py` e adattare l'assert al nome reale del campo (il resto del test non cambia).

- [ ] **Step 6: Checkpoint**

```bash
git status --short && git diff --stat
```

---

### Task 6: Regressione completa, changelog e verifica finale

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Aggiungere le voci di changelog**

In `CHANGELOG.md`, sotto `## [Unreleased]`, nella sezione `### Added` esistente (dopo l'ultima voce), aggiungere:

```markdown
- I task di area hanno ora un assegnatario (scelto tra gli utenti della stessa area), una priorità (bassa, media, alta, critica), un nuovo stato "In attesa", commenti e allegati collegati da Drive. Gli allegati mostrano solo i file a cui l'utente ha accesso, con le stesse regole di Drive.
- I task di area eliminati si possono ora ripristinare (singolarmente o in blocco) e l'elenco supporta filtri per stato, priorità, assegnatario, area e scadenza, oltre a ricerca e ordinamento.
```

Non aggiungere intestazioni di versione (solo `[Unreleased]`).

- [ ] **Step 2: Sincronizzare tutto e lanciare la suite completa**

```bash
sync core/api.py core/models.py core/tests/test_area_task_model.py core/tests/test_area_tasks_api.py
$DC exec backend pytest -q
```

Atteso: nessun test in più fallito rispetto al baseline. Se falliscono test non collegati ai task di area, controllare con `git stash` se falliscono anche senza queste modifiche prima di intervenire (baseline).

- [ ] **Step 3: Verifiche del CLAUDE.md per il backend**

```bash
$DC exec backend python manage.py check
$DC exec backend python manage.py makemigrations --check --dry-run
$DC exec backend python -m mypy --config-file mypy.ini .
$DC exec backend python manage.py migrate --check
```

Atteso: `System check identified no issues`, `No changes detected`, mypy senza errori nuovi rispetto al baseline, `migrate --check` pulito (la `0040` è già applicata dal Task 1).

- [ ] **Step 4: Verifica end-to-end con immagine ricostruita**

I `docker cp` non aggiornano i worker gunicorn, quindi si ricostruisce per provare l'API reale:

```bash
$DC up -d --build backend cron
$DC exec backend python manage.py check
```

Poi, da un utente con area, verificare a mano con `curl` (o dal browser già loggato) `GET /api/area-tasks/?priority=high` e `POST /api/area-tasks/{id}/comments/`. Atteso: risposte coerenti con i test. `backend` e `cron` si ricostruiscono insieme perché `cron` esegue `refresh_notifications` sullo stesso codice.

- [ ] **Step 5: Checkpoint finale**

```bash
git status --short && git diff --stat
```

Atteso: modificati `CHANGELOG.md`, `backend/core/models.py`, `backend/core/api.py`; nuovi `backend/core/migrations/0040_...py`, `backend/core/tests/test_area_task_model.py`, `backend/core/tests/test_area_tasks_api.py`, oltre a spec e piano in `docs/superpowers/`. Riferire a Fede il risultato di ogni verifica e chiedere se vuole commit e `release-save`.

---

## Self-Review (spec → task)

| Requisito della spec | Task |
|---|---|
| Stato `in_attesa`, nessun `waiting_reason` | 1, 3 (test `in_attesa`) |
| `priority` con default media | 1, 3 |
| `assigned_to`, solo stessa area, superuser esente | 1, 3 |
| `AreaTaskComment` con schema di `IssueComment` | 1, 4 |
| Viewset su `SoftDeleteAuditMixin` + `RestoreActionMixin`, rimozione codice duplicato | 2 |
| `restore`, `bulk_restore`, `include_deleted`, `only_deleted` | 2 |
| `IsInternalOrPortalDedicatedApp` invariato | Global Constraints, 2 |
| `AreaTaskFilter` (stato, assegnatario, priorità, scadenza, area, "miei") | 2 |
| Azione `comments` e `comments/<id>`; scrittura solo nella propria area; edit/delete autore o superuser | 4 |
| Nascondere i completati solo per la vista compatta | 2 (deviazione dichiarata: si mantiene `include_hidden`) |
| Collegare solo con `has_file_access`; lettura con `filter_accessible_files` | 5 |
| File soft-deleted spariscono e riappaiono al restore | 5 |
| Audit di collegamento/scollegamento | 5 |
| Test dei permessi, restore, filtri, commenti, allegati, regressione completati | 2, 3, 4, 5 |
| Email/scadenze non regrediscono | 2 (step 9), 6 |
| Changelog `[Unreleased]`, intestazioni inglesi | 6 |
| Fase 2 (UI) e fase 3 (notifiche) | Fuori da questo piano: piani separati |

Tipi e nomi coerenti tra i task: `AreaTaskPriority`, `STATUS_IN_ATTESA`, `AreaTaskComment` (Task 1) sono quelli usati in 2-5; `_check_own_area`/`_user_area_id` restano quelli esistenti; i campi `drive_files` (write) e `drive_files_detail` (read) sono definiti nel Task 5 e non compaiono prima.
