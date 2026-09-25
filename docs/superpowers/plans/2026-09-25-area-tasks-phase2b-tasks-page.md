# Task di area, fase 2b (pagina `/tasks`): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere la pagina elenco `/tasks` con ricerca, filtri, creazione e dettaglio dei task di area, come la pagina Issues, e togliere le query per riga dall'elenco lato API.

**Architecture:** Nuova pagina `frontend/src/pages/AreaTasks.tsx` costruita sulla stessa infrastruttura delle altre liste (`useServerGrid`, `useDrfList`, `EntityListCard`), che riusa il drawer/dialog della fase 2a (`AreaTaskDetail`, `AreaTaskDialog`). Un piccolo lavoro backend rende costante il numero di query dell'elenco (allegati Drive). Voce di menu, route e link "Vedi tutti" dal widget.

**Tech Stack:** React 19, TypeScript, Vite, MUI v7 (`@mui/x-data-grid`), vitest + Testing Library; Django/DRF/pytest.

**Spec:** `docs/superpowers/specs/2026-09-24-area-tasks-issue-parity-design.md` (fase 2). Stato: fasi 1, 2a e 3 già in `develop` (`f82103f8`, `3562704c`, `c88c7bbc`).

## Scope e decisioni prese

- **Niente vista cestino nella pagina.** Nell'app il cestino/restore vive nella pagina globale `Trash.tsx` (con permessi per risorsa) e la pagina Issues non ha una vista cestino: `/tasks` fa lo stesso. Il restore dei task via API resta com'è (richiede `core.change_areatask`); portarlo in `Trash.tsx` e decidere chi può farlo è un lavoro a parte, non in questo piano.
- **Niente tab "Attività" (audit) nel drawer:** l'audit ha già la sua pagina (`/audit`). Rimandato.
- **Nessun permesso di modello per la pagina:** come il widget e Piano Ferie, basta essere autenticati (`RequireAuth`); i permessi di scrittura restano `task.can_edit` (stessa area o superuser), applicati dal server.
- La pagina passa sempre `include_hidden=1` (mostra anche i completati da più di 3 giorni). Il filtro area parte dalla propria area.

## Global Constraints

- Solo `frontend/` per la UI (mai `frontend-portal/`); componenti condivisi con alias `@shared/...`. Mai `import { theme } from '../theme'` statico: usare `useTheme()`/`sx` con token e gli hook esistenti (`useDataGridZebraSx`).
- Riusare `AreaTaskDetail` (props `task`, `onClose`, `onChanged`, `onDeleted`) e `AreaTaskDialog` (creazione con `task = null`) senza cambiarne le props. Nel backend `drive_files` è di sola scrittura; in lettura `drive_files_detail`.
- L'array di filtro `status` si invia come parametri ripetuti (`status=a&status=b`): il client axios lo fa già (`paramsSerializer: { indexes: null }`).
- Ordinamenti supportati dal backend: `due_date`, `priority`, `status`, `title`, `created_at`, `updated_at` (la priorità ordina alfabeticamente, non per gravità: non renderla ordinabile).
- Verifica prima di dichiarare finito: `tsc -b --force` → `npm run build` → `npm run lint` (baseline **27 problemi**, 0 errori, non deve salire) → `npx vitest run` (baseline **101** test, tutti devono passare più i nuovi). Backend: `manage.py check` → `makemigrations --check --dry-run`.
- Nessun commit, push o rilascio se Fede non lo chiede esplicitamente; ogni task termina con un Checkpoint (`git status`).
- Changelog solo sotto `## [Unreleased]`, intestazioni inglesi.

## Dev loop

Frontend, dalla cartella `frontend/`: `npx vitest run <file>`, `npx tsc -b --force`, `npm run lint`, `npm run build`.

Backend (il container non monta il codice), dalla root del repo:

```bash
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
sync() { for f in "$@"; do $DC cp "backend/$f" "backend:/app/$f" || return 1; done; }
```

Per vedere la UI: `COMPOSE_BAKE=false $DC build frontend` poi `$DC up -d --no-build frontend` (`up --build frontend` fallisce per un problema pre-esistente del percorso "bake" di compose) e `$DC up -d --build backend cron` per il backend.

## File Structure

| File | Ruolo |
|---|---|
| `backend/core/api.py` | Modifica: allegati Drive senza query per riga in lista; `due` senza query per riga |
| `backend/core/tests/test_area_tasks_api.py` | Modifica: test sul numero di query |
| `frontend/src/pages/AreaTasks.tsx` | Nuovo: pagina elenco |
| `frontend/src/pages/AreaTasks.test.tsx` | Nuovo |
| `frontend/src/App.tsx` | Modifica: route `/tasks` |
| `frontend/src/layout/appLayoutNav.tsx` | Modifica: voce di menu e titolo header |
| `frontend/src/ui/AreaTaskCard.tsx` + `AreaTaskCard.test.tsx` | Modifica: link "Vedi tutti"; il test passa sotto un router |
| `CHANGELOG.md` | Modifica |

---

### Task 1: Backend, elenco senza query per riga

**Files:**
- Modify: `backend/core/api.py` (`AreaTaskSerializer.get_drive_files_detail`, `AreaTaskViewSet.get_queryset`, azione `due`)
- Test: `backend/core/tests/test_area_tasks_api.py`

**Interfaces:**
- Produces: per `GET /api/area-tasks/` (paginato) e `GET /api/area-tasks/due/`, il numero di query non dipende dal numero di task o di file collegati. Il contenuto delle risposte non cambia (`drive_files_detail` resta filtrato per ACL e cestino di Drive).

- [ ] **Step 1: Scrivere i test (falliscono)**

Aggiungere in fondo a `backend/core/tests/test_area_tasks_api.py` (i helper `_area`, `_user`, `_client`, `_drive_file`, `_results`, `_ids` ed il fixture del `MEDIA_ROOT` temporaneo esistono già):

```python
# ── numero di query costante sull'elenco ──────────────────────────────────────

from django.db import connection  # noqa: E402
from django.test.utils import CaptureQueriesContext  # noqa: E402


def _queries_for(client, url, params=None):
    with CaptureQueriesContext(connection) as ctx:
        resp = client.get(url, params or {})
    assert resp.status_code == 200, resp.data
    return len(ctx)


def _make_tasks(area, creator, count, *, files_per_task=2):
    files = [_drive_file(f"f{i}.pdf") for i in range(files_per_task)]
    tasks = []
    for i in range(count):
        t = AreaTask.objects.create(area=area, title=f"T{i}", created_by=creator, assigned_to=creator,
                                    due_date=timezone.localdate())
        t.drive_files.add(*files)
        tasks.append(t)
    return tasks


def test_list_query_count_does_not_grow_with_the_number_of_tasks():
    area = _area()
    user = _user(area)
    client = _client(user)
    _make_tasks(area, user, 1)
    few = _queries_for(client, URL, {"page_size": 50})
    _make_tasks(area, user, 7)
    many = _queries_for(client, URL, {"page_size": 50})
    assert many == few


def test_due_query_count_does_not_grow_with_the_number_of_tasks():
    area = _area()
    user = _user(area)
    client = _client(user)
    _make_tasks(area, user, 1)
    few = _queries_for(client, f"{URL}due/")
    _make_tasks(area, user, 7)
    many = _queries_for(client, f"{URL}due/")
    assert many == few


def test_list_still_hides_restricted_and_deleted_files_per_task():
    area = _area()
    group = Group.objects.create(name="riservato-q")
    user = _user(area)
    public = _drive_file("pubblico.pdf")
    secret = _drive_file("segreto.pdf", group=group)
    trashed = _drive_file("cestino.pdf")
    task = AreaTask.objects.create(area=area, title="T", created_by=user)
    task.drive_files.add(public, secret, trashed)
    trashed.soft_delete()
    rows = _results(_client(user).get(URL))
    row = next(r for r in rows if r["id"] == task.id)
    assert [d["id"] for d in row["drive_files_detail"]] == [public.id]
```

- [ ] **Step 2: Verificare che falliscano**

```bash
cd /home/fede/inventory-app
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
sync() { for f in "$@"; do $DC cp "backend/$f" "backend:/app/$f" || return 1; done; }
sync core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py -q -k "query_count or hides_restricted_and_deleted_files_per_task"
```

Atteso: i due test sul numero di query falliscono (`many` maggiore di `few`); il terzo passa già.

- [ ] **Step 3: Implementare**

In `backend/core/api.py`, in `AreaTaskSerializer`, sostituire `get_drive_files_detail` con:

```python
    def _accessible_file_ids(self, user):
        """Id dei file Drive accessibili all'utente tra quelli collegati ai task
        che questo serializer sta rappresentando (la pagina intera in lista):
        un'unica query ACL per richiesta invece di una per riga."""
        cache = self.context.setdefault('_area_task_acl_ids', {})
        if 'ids' not in cache:
            parent = self.parent
            if isinstance(parent, serializers.ListSerializer):
                objs = parent.instance
            else:
                objs = self.instance
            if objs is None:
                objs = []
            elif not isinstance(objs, (list, tuple)) and not hasattr(objs, '__iter__'):
                objs = [objs]
            task_ids = [o.pk for o in objs]
            files = DriveFile.objects.filter(area_tasks__in=task_ids, deleted_at__isnull=True)
            cache['ids'] = set(filter_accessible_files(files, user).values_list('pk', flat=True))
        return cache['ids']

    def get_drive_files_detail(self, obj):
        user = self._request_user()
        if user is None:
            return []
        allowed = self._accessible_file_ids(user)
        return [
            {'id': f.id, 'name': f.name, 'mime_type': f.mime_type, 'size': f.size, 'folder': f.folder_id}
            for f in obj.drive_files.all()
            if f.deleted_at is None and f.id in allowed
        ]
```

Nota: `obj.drive_files.all()` usa la cache di `prefetch_related('drive_files')` quando presente (lista), altrimenti fa una query per oggetto singolo. DRF svuota `_prefetched_objects_cache` dopo un `update`, quindi la risposta di PATCH non usa dati vecchi.

In `AreaTaskViewSet.get_queryset`, dopo il `select_related(...)` iniziale aggiungere `.prefetch_related('drive_files')`; il blocco deve diventare:

```python
        qs = AreaTask.objects.select_related(
            'area', 'created_by', 'assigned_to',
        ).prefetch_related('drive_files')
        if getattr(self, 'action', None) in ('list', 'retrieve'):
            qs = qs.annotate(comments_count=Count('comments'))
```

(lasciare invariato tutto il resto di `get_queryset`: filtri soft-delete, nascondere i completati, ecc. Se la forma esistente dell'annotate è diversa, mantenerla e aggiungere solo `.prefetch_related('drive_files')`.)

Nell'azione `due`, sostituire la costruzione del queryset con:

```python
        qs = (
            AreaTask.objects
            .filter(area_id=user_area_id, due_date__isnull=False, due_date__lte=tomorrow, deleted_at__isnull=True)
            .exclude(status=AreaTask.STATUS_COMPLETATO)
            .select_related('area', 'created_by', 'assigned_to')
            .prefetch_related('drive_files')
            .annotate(comments_count=Count('comments'))
            .order_by('due_date')
        )
```

- [ ] **Step 4: Verificare**

```bash
sync core/api.py core/tests/test_area_tasks_api.py
$DC exec backend pytest core/tests/test_area_tasks_api.py -q
$DC exec backend pytest core/tests notifications/tests issues/tests -q
$DC exec backend python manage.py check
```

Atteso: tutto PASS. Se un test esistente sull'allegato dopo `PATCH` fallisce perché mostra dati vecchi, verificare che `perform_update`/`update` non riutilizzino un'istanza con cache di prefetch obsoleta e correggere azzerando `instance._prefetched_objects_cache` dopo il `.set()` in `AreaTaskSerializer.update`.

- [ ] **Step 5: Checkpoint**

```bash
git status --short && git diff --stat
```

---

### Task 2: Pagina `AreaTasks`

**Files:**
- Create: `frontend/src/pages/AreaTasks.tsx`
- Test: `frontend/src/pages/AreaTasks.test.tsx`
- (solo se serve) Modify: `shared/src/api/drf.ts` — vedi la nota sul tipo `DrfParams`.

**Interfaces:**
- Consumes: `AreaTaskDetail`, `AreaTaskDialog` e i tipi/helper di `features/areatasks/types.ts` (`AreaTaskRow`, `STATUS_META`, `PRIORITY_META`, `PRIORITY_ORDER`, `TaskFormData`, `TaskPriority`, `TaskStatus`, `AreaUser`, `createEmptyTaskForm`, `formToPayload`, `extractFieldErrors`, `fmtTaskDate`).
- Produces: `default export function AreaTasks()`. Comportamento:
  - Elenco `GET /area-tasks/` con `include_hidden=1`, paginato lato server, ricerca, ordinamento per `due_date` (default), `status`, `title`, `created_at`.
  - Filtri: area (default la propria; "Tutte" = nessun filtro), priorità, "Assegnati a me" (`mine=true`), vista stato: "Aperti" (`status` = da_fare, in_corso, in_attesa; default), "Completati" (`completato`), "Tutti".
  - Click su una riga apre `AreaTaskDetail`; dopo modifiche/eliminazione l'elenco si ricarica.
  - "Nuovo task" apre `AreaTaskDialog` in creazione: area = per un utente normale la propria (il server la impone comunque), per un superuser l'area del filtro (o la propria). Gli assegnabili si caricano da `/users/?leave_area=<area>&page_size=200`. Senza area disponibile il pulsante è disabilitato.
- Nota `DrfParams`: il valore `status` è un array. Se `DrfParamValue` in `shared/src/api/drf.ts` non ammette array, ampliarlo minimamente (es. aggiungere `readonly (string | number)[]`) e dirlo nel report.

- [ ] **Step 1: Scrivere il test (fallisce)**

Creare `frontend/src/pages/AreaTasks.test.tsx`:

```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaTasks from './AreaTasks'
import type { AreaTaskRow } from '../features/areatasks/types'

const apiGet = vi.fn()
const apiPost = vi.fn()
vi.mock('@shared/api/client', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Errore' }))
const toast = { error: vi.fn(), success: vi.fn() }
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))

const auth = {
  me: { id: 1, username: 'fede', is_superuser: false, profile: { leave_area: 3, leave_area_label: 'Ufficio' } },
  hasPerm: () => true,
  inGroup: () => true,
}
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }))
vi.mock('../features/areatasks/AreaTaskDetail', () => ({
  default: (p: { task: AreaTaskRow | null }) => (p.task ? <div data-testid="detail">{p.task.title}</div> : null),
}))

function row(over: Partial<AreaTaskRow>): AreaTaskRow {
  return {
    id: 1, area: 3, area_label: 'Ufficio', title: 'Task', description: '', status: 'da_fare', priority: 'medium',
    due_date: null, assigned_to: null, assigned_to_name: null, created_by: 1, created_by_name: 'Fede',
    created_at: '2026-09-24T10:00:00Z', updated_at: '2026-09-24T10:00:00Z', completed_at: null,
    comments_count: 0, can_edit: true, drive_files_detail: [], ...over,
  }
}

const rows = [
  row({ id: 1, title: 'Ordine toner', priority: 'high', assigned_to_name: 'Anna Rossi', comments_count: 2 }),
  row({ id: 2, title: 'Rapporto mensile', status: 'in_attesa' }),
]

function listCalls() {
  return apiGet.mock.calls.filter((c) => c[0] === '/area-tasks/')
}

function renderPage() {
  return render(<MemoryRouter><AreaTasks /></MemoryRouter>)
}

beforeEach(() => {
  ;[apiGet, apiPost, toast.error, toast.success].forEach((m) => m.mockReset())
  apiGet.mockImplementation((url: string) => {
    if (url === '/area-tasks/') return Promise.resolve({ data: { count: rows.length, results: rows } })
    if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }, { id: 4, label: 'Romagna' }] } })
    if (url === '/users/') return Promise.resolve({ data: [{ id: 12, full_name: 'Anna Rossi', username: 'anna' }] })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
})

describe('AreaTasks page', () => {
  it('lists the tasks of the own area by default, open tasks only, including old completed ones', async () => {
    renderPage()
    expect(await screen.findByText('Ordine toner')).toBeInTheDocument()
    expect(screen.getByText('Rapporto mensile')).toBeInTheDocument()
    const params = listCalls()[0]![1].params
    expect(params).toMatchObject({ include_hidden: 1, area: 3, status: ['da_fare', 'in_corso', 'in_attesa'] })
  })

  it('shows priority, status, assignee and due information per row', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('In attesa')).toBeInTheDocument()
    expect(screen.getByText('Anna Rossi')).toBeInTheDocument()
  })

  it('switches the status view to "Completati" and reloads with that filter', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('button', { name: 'Completati' }))
    await waitFor(() => expect(listCalls().some((c) => c[1].params.status === 'completato')).toBe(true))
  })

  it('applies "Assegnati a me" as mine=true', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByLabelText('Assegnati a me'))
    await waitFor(() => expect(listCalls().some((c) => c[1].params.mine === 'true')).toBe(true))
  })

  it('removes the area filter when "Tutte le aree" is chosen', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.mouseDown(screen.getByLabelText('Area'))
    fireEvent.click(await screen.findByRole('option', { name: 'Tutte le aree' }))
    await waitFor(() => expect(listCalls().some((c) => c[1].params.area === undefined)).toBe(true))
  })

  it('opens the detail when a row is clicked', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('Ordine toner'))
    expect(await screen.findByTestId('detail')).toHaveTextContent('Ordine toner')
  })

  it('creates a task in the own area from the "Nuovo task" dialog', async () => {
    apiPost.mockResolvedValue({ data: row({ id: 9, title: 'Nuovo' }) })
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('button', { name: /Nuovo task/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Titolo/), { target: { value: 'Nuovo' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crea task' }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/area-tasks/', expect.objectContaining({ title: 'Nuovo', area: 3 })))
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(1)) // ricarica dopo la creazione
  })

  it('loads the assignable users of the area for the create dialog', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('button', { name: /Nuovo task/ }))
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith('/users/', expect.objectContaining({ params: expect.objectContaining({ leave_area: 3 }) })),
    )
  })
})
```

- [ ] **Step 2: Verificare che fallisca**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/pages/AreaTasks.test.tsx
```

Atteso: FAIL (`Failed to resolve import "./AreaTasks"`).

- [ ] **Step 3: Implementare la pagina**

Creare `frontend/src/pages/AreaTasks.tsx`:

```tsx
import * as React from 'react'
import {
  Box, Button, Checkbox, Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Select,
  Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import type { GridColDef } from '@mui/x-data-grid'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { buildDrfListParams, type DrfParams } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import { useAuth } from '../auth/AuthProvider'
import { useDataGridZebraSx } from '../theme/AppThemeProvider'
import AreaTaskDetail from '../features/areatasks/AreaTaskDetail'
import AreaTaskDialog from '../features/areatasks/AreaTaskDialog'
import {
  PRIORITY_META, PRIORITY_ORDER, STATUS_META,
  createEmptyTaskForm, extractFieldErrors, fmtTaskDate, formToPayload,
  type AreaTaskRow, type AreaUser, type TaskFormData, type TaskPriority, type TaskStatus,
} from '../features/areatasks/types'

type AreaOption = { id: number; label: string }
type RawUser = { id: number; full_name?: string; username?: string }
type StatusView = 'open' | 'done' | 'all'

const OPEN_STATUSES: TaskStatus[] = ['da_fare', 'in_corso', 'in_attesa']

function priorityColor(p: TaskPriority): 'error' | 'warning' | 'default' {
  if (p === 'critical') return 'error'
  if (p === 'high') return 'warning'
  return 'default'
}

function statusColor(s: TaskStatus): 'success' | 'warning' | 'info' | 'default' {
  if (s === 'completato') return 'success'
  if (s === 'in_corso') return 'warning'
  if (s === 'in_attesa') return 'info'
  return 'default'
}

export default function AreaTasks() {
  const zebraSx = useDataGridZebraSx()
  const { me } = useAuth()
  const toast = useToast()

  const myAreaId = me?.profile?.leave_area ?? null
  const myAreaLabel = me?.profile?.leave_area_label ?? null
  const isSuperuser = Boolean(me?.is_superuser)

  const grid = useServerGrid({
    defaultOrdering: 'due_date',
    allowedOrderingFields: ['due_date', 'status', 'title', 'created_at', 'updated_at'],
  })

  // ── Filtri ────────────────────────────────────────────────────────────────
  const [areas, setAreas] = React.useState<AreaOption[]>([])
  const [areaFilter, setAreaFilter] = React.useState<number | ''>(myAreaId ?? '')
  const [priorityFilter, setPriorityFilter] = React.useState<TaskPriority | ''>('')
  const [onlyMine, setOnlyMine] = React.useState(false)
  const [statusView, setStatusView] = React.useState<StatusView>('open')

  React.useEffect(() => {
    api.get<{ results: AreaOption[] } | AreaOption[]>('/leave-areas/', { params: { page_size: 100 } })
      .then((r) => setAreas(Array.isArray(r.data) ? r.data : r.data.results))
      .catch(() => {})
  }, [])

  const activeFilterCount = [
    areaFilter !== (myAreaId ?? '') ? 'area' : '',
    priorityFilter,
    onlyMine ? 'mine' : '',
    statusView !== 'open' ? statusView : '',
  ].filter(Boolean).length

  const resetFilters = () => {
    setAreaFilter(myAreaId ?? '')
    setPriorityFilter('')
    setOnlyMine(false)
    setStatusView('open')
  }

  const extra = React.useMemo(() => {
    const p: DrfParams = { include_hidden: 1 }
    if (areaFilter !== '') p.area = areaFilter
    if (priorityFilter) p.priority = priorityFilter
    if (onlyMine) p.mine = 'true'
    if (statusView === 'open') p.status = OPEN_STATUSES
    if (statusView === 'done') p.status = 'completato'
    return p
  }, [areaFilter, priorityFilter, onlyMine, statusView])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        ordering: grid.ordering,
        search: grid.search,
        extra,
      }),
    [grid.paginationModel, grid.ordering, grid.search, extra],
  )

  const { rows, rowCount, loading, reload } = useDrfList<AreaTaskRow>('/area-tasks/', listParams, (e) =>
    toast.error(apiErrorToMessage(e)),
  )

  // ── Dettaglio ─────────────────────────────────────────────────────────────
  const [openTask, setOpenTask] = React.useState<AreaTaskRow | null>(null)

  // ── Creazione ─────────────────────────────────────────────────────────────
  const createAreaId: number | null = isSuperuser ? (areaFilter !== '' ? areaFilter : myAreaId) : myAreaId
  const createAreaLabel =
    areas.find((a) => a.id === createAreaId)?.label ?? (createAreaId === myAreaId ? myAreaLabel : null) ?? ''

  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState<TaskFormData>(createEmptyTaskForm)
  const [users, setUsers] = React.useState<AreaUser[]>([])
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const openCreate = async () => {
    if (createAreaId === null) return
    setForm(createEmptyTaskForm())
    setErrors({})
    setUsers([])
    setCreateOpen(true)
    try {
      const r = await api.get<RawUser[]>('/users/', { params: { leave_area: createAreaId, page_size: 200 } })
      const list = Array.isArray(r.data) ? r.data : []
      setUsers(list.map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) })))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const saveCreate = async () => {
    if (createAreaId === null || saving) return
    setSaving(true)
    setErrors({})
    try {
      await api.post<AreaTaskRow>('/area-tasks/', { ...formToPayload(form), area: createAreaId })
      setCreateOpen(false)
      toast.success('Task creato.')
      reload()
    } catch (e) {
      const fields = extractFieldErrors(e)
      if (Object.keys(fields).length > 0) setErrors(fields)
      else toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Colonne ───────────────────────────────────────────────────────────────
  const columns: GridColDef<AreaTaskRow>[] = [
    {
      field: 'priority',
      headerName: 'Priorità',
      width: 100,
      sortable: false,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          label={PRIORITY_META[row.priority].label}
          color={priorityColor(row.priority)}
          variant={row.priority === 'high' || row.priority === 'critical' ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Stato',
      width: 130,
      renderCell: ({ row }) => (
        <Chip size="small" label={STATUS_META[row.status].label} color={statusColor(row.status)} variant="outlined" />
      ),
    },
    {
      field: 'title',
      headerName: 'Titolo',
      flex: 1,
      minWidth: 220,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%', minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ textDecoration: row.status === 'completato' ? 'line-through' : 'none' }}>
            {row.title}
          </Typography>
          {row.comments_count > 0 ? (
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: 'text.disabled', flexShrink: 0 }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption">{row.comments_count}</Typography>
            </Stack>
          ) : null}
          {row.drive_files_detail.length > 0 ? (
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: 'text.disabled', flexShrink: 0 }}>
              <AttachFileIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption">{row.drive_files_detail.length}</Typography>
            </Stack>
          ) : null}
        </Box>
      ),
    },
    { field: 'area_label', headerName: 'Area', width: 150, sortable: false },
    {
      field: 'assigned_to_name',
      headerName: 'Assegnato a',
      width: 170,
      sortable: false,
      valueGetter: (_value, row) => row.assigned_to_name ?? '',
    },
    {
      field: 'due_date',
      headerName: 'Scadenza',
      width: 120,
      renderCell: ({ row }) => {
        const label = fmtTaskDate(row.due_date)
        const overdue = row.due_date && row.status !== 'completato' && new Date(`${row.due_date}T00:00:00`) < new Date(new Date().setHours(0, 0, 0, 0))
        return (
          <Typography variant="body2" sx={{ color: overdue ? 'error.main' : 'text.primary', fontWeight: overdue ? 600 : 400 }}>
            {label ?? '—'}
          </Typography>
        )
      },
    },
  ]

  const emptyState = React.useMemo(
    () =>
      grid.search.trim() || activeFilterCount > 0
        ? { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o filtri.' }
        : { title: 'Nessun task', subtitle: 'Non ci sono task per questa area.' },
    [grid.search, activeFilterCount],
  )

  const canCreate = createAreaId !== null

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <EntityListCard
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          alignRightActions: true,
          onReset: activeFilterCount > 0 || grid.search.trim() ? () => { grid.reset(); resetFilters() } : undefined,
          rightActions: (
            <Tooltip title={canCreate ? '' : 'Nessuna area assegnata al tuo profilo'}>
              <span>
                <Button startIcon={<AddIcon />} variant="contained" disabled={!canCreate} onClick={() => { void openCreate() }}>
                  Nuovo task
                </Button>
              </span>
            </Tooltip>
          ),
        }}
        grid={{
          pageKey: 'area-tasks',
          username: me?.username,
          rows,
          emptyState,
          rowCount,
          loading,
          columns,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: (id) => {
            const found = rows.find((r) => r.id === id)
            if (found) setOpenTask(found)
          },
          getRowClassName: (r) => (r.status === 'completato' ? 'row-done-task' : undefined),
          sx: {
            cursor: 'pointer',
            ...zebraSx,
            '& .row-done-task': { opacity: 0.55 },
            '& .row-done-task:hover': { opacity: 0.85 },
          },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ px: 0.5, py: 1 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="area-filter-label">Area</InputLabel>
            <Select
              labelId="area-filter-label"
              label="Area"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <MenuItem value="">Tutte le aree</MenuItem>
              {areas.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.label}{a.id === myAreaId ? ' (mia)' : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="priority-filter-label">Priorità</InputLabel>
            <Select
              labelId="priority-filter-label"
              label="Priorità"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
            >
              <MenuItem value="">Tutte</MenuItem>
              {PRIORITY_ORDER.map((p) => (
                <MenuItem key={p} value={p}>{PRIORITY_META[p].label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Checkbox size="small" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />}
            label="Assegnati a me"
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={statusView}
            onChange={(_, v: StatusView | null) => { if (v) setStatusView(v) }}
            aria-label="Vista stato"
          >
            <ToggleButton value="open">Aperti</ToggleButton>
            <ToggleButton value="done">Completati</ToggleButton>
            <ToggleButton value="all">Tutti</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </EntityListCard>

      <AreaTaskDetail
        task={openTask}
        onClose={() => setOpenTask(null)}
        onChanged={(next) => { setOpenTask(next); reload() }}
        onDeleted={() => { setOpenTask(null); reload() }}
      />

      <AreaTaskDialog
        open={createOpen}
        task={null}
        areaLabel={createAreaLabel}
        form={form}
        users={users}
        saving={saving}
        errors={errors}
        onFormChange={setForm}
        onSave={() => { void saveCreate() }}
        onClose={() => setCreateOpen(false)}
      />
    </Stack>
  )
}
```

- [ ] **Step 4: Verificare**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/pages/AreaTasks.test.tsx && npx tsc -b --force && npm run lint 2>&1 | tail -3
```

Atteso: 8 test PASS, `tsc` pulito, lint non oltre 27. Aggiustamenti ammessi al TEST (non al comportamento) se un selettore non combacia con il DOM reale (es. il `Select` MUI espone `Area` come `combobox`/label; il `DataGrid` in jsdom potrebbe virtualizzare le righe: in tal caso usare le opzioni di `EntityListCard`/`ServerDataGrid` già impiegate da altri test di pagina, come `Drive.test.tsx`, o simulare con `disableVirtualization` se il componente lo supporta) e va riportato. Se `DrfParams` rifiuta l'array di `status`, ampliare `DrfParamValue` come indicato in Interfaces.

- [ ] **Step 5: Checkpoint**

```bash
cd /home/fede/inventory-app && git status --short
```

---

### Task 3: Route, menu, titolo e link "Vedi tutti"

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/layout/appLayoutNav.tsx`, `frontend/src/ui/AreaTaskCard.tsx`, `frontend/src/ui/AreaTaskCard.test.tsx`

**Interfaces:**
- Consumes: `pages/AreaTasks.tsx` (Task 2).
- Produces: route `/tasks` (autenticato, senza permessi di modello), voce di menu "Task" nella sezione principale, titolo header `TASK DI AREA`, e nel widget un pulsante "Vedi tutti" verso `/tasks`.

- [ ] **Step 1: Aggiornare il test del widget (fallisce)**

In `frontend/src/ui/AreaTaskCard.test.tsx` importare `MemoryRouter` (`import { MemoryRouter } from 'react-router-dom'`), sostituire ogni `render(<AreaTaskCard />)` con `render(<MemoryRouter><AreaTaskCard /></MemoryRouter>)` e aggiungere:

```tsx
  it('links to the full tasks page', async () => {
    render(<MemoryRouter><AreaTaskCard /></MemoryRouter>)
    const link = await screen.findByRole('link', { name: /Vedi tutti/ })
    expect(link).toHaveAttribute('href', '/tasks')
  })
```

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/ui/AreaTaskCard.test.tsx
```

Atteso: il nuovo test FAIL (nessun link), gli altri passano.

- [ ] **Step 2: Link nel widget**

In `frontend/src/ui/AreaTaskCard.tsx` aggiungere l'import `import { Link as RouterLink } from 'react-router-dom'` e, nell'intestazione del `Card` accanto al `Select` dell'area, avvolgere il `Select` insieme al link:

```tsx
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button component={RouterLink} to="/tasks" size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Vedi tutti
          </Button>
          <Select
            /* ... il Select dell'area esistente, invariato ... */
          />
        </Stack>
```

(aggiungere `Button` all'import da `@mui/material`; non cambiare altro nel widget).

- [ ] **Step 3: Route, menu e titolo**

In `frontend/src/App.tsx`, accanto agli altri `lazy(...)` aggiungere:

```tsx
const AreaTasks = lazy(() => import('./pages/AreaTasks'))
```

e, accanto alla route `piano-ferie` (autenticata senza permessi), aggiungere:

```tsx
      {
        path: 'tasks',
        element: <RequireAuth>{lazyEl(<AreaTasks />)}</RequireAuth>,
      },
```

In `frontend/src/layout/appLayoutNav.tsx` aggiungere l'import `import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'`, la voce dopo Issues:

```tsx
  { label: 'Task', path: '/tasks', icon: <TaskAltOutlinedIcon />, section: 'principale' },
```

e nella mappa dei titoli (accanto a `['/issues', 'ISSUES']`):

```tsx
  ['/tasks',                  'TASK DI AREA'],
```

Nota: la mappa dei titoli è ordinata per prefisso più specifico prima: `'/tasks'` non confligge con altre voci.

- [ ] **Step 4: Verificare**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run && npx tsc -b --force && npm run build 2>&1 | tail -3 && npm run lint 2>&1 | tail -3
```

Atteso: tutti i test PASS (101 + i nuovi), build OK, lint non oltre 27.

- [ ] **Step 5: Checkpoint**

```bash
cd /home/fede/inventory-app && git status --short
```

---

### Task 4: Changelog, verifica finale e ricostruzione

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Changelog**

Sotto `## [Unreleased]` / `### Added`:

```markdown
- Nuova pagina "Task" (`/tasks`) con l'elenco dei task di area: ricerca, filtri per area, priorità, "assegnati a me" e stato (aperti, completati, tutti), creazione di un nuovo task con assegnatario e scadenza e apertura del dettaglio con commenti e allegati Drive. Nel widget della dashboard è disponibile il link "Vedi tutti".
```

E sotto `### Changed`, se la sezione non esiste crearla subito prima di `### Fixed`:

```markdown
- L'elenco dei task di area carica gli allegati Drive con un numero di query costante, indipendente dal numero di task.
```

- [ ] **Step 2: Verifica completa**

```bash
cd /home/fede/inventory-app/frontend
npx tsc -b --force
npm run build 2>&1 | tail -3
npm run lint 2>&1 | tail -3
npx vitest run 2>&1 | grep -E "Test Files|Tests "
cd /home/fede/inventory-app
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
$DC exec backend pytest -q
$DC exec backend python manage.py check
$DC exec backend python manage.py makemigrations --check --dry-run
```

Atteso: tutto verde; lint non oltre 27; vitest 101 + i nuovi test.

- [ ] **Step 3: Ricostruire dev**

```bash
COMPOSE_BAKE=false $DC build frontend
$DC up -d --no-build frontend
$DC up -d --build backend cron
$DC ps --format '{{.Service}} {{.State}} {{.Health}}' | grep -E "^(backend|cron|frontend) "
$DC exec -T frontend sh -c "grep -rl 'Assegnati a me' /usr/share/nginx/html | head -1"
```

Atteso: servizi sani; il bundle contiene la pagina nuova. Se nessuno può usare un browser, dichiararlo esplicitamente: la prova manuale della pagina `/tasks` (filtri, creazione, dettaglio, ordinamento, mobile) non è stata eseguita.

- [ ] **Step 4: Checkpoint finale**

```bash
git status --short && git diff --stat
```

---

## Self-Review (spec → task)

| Requisito della spec (fase 2) | Task |
|---|---|
| Pagina elenco `/tasks` con filtri e ricerca, come le issue | 2 |
| Creazione con assegnatario/priorità/stato/scadenza (dialog) | 2 (riusa `AreaTaskDialog`) |
| Apertura del drawer (commenti, allegati) dalla riga | 2 (riusa `AreaTaskDetail`) |
| Altre aree in sola lettura | 2: filtro area libero; scrittura governata da `can_edit` nel drawer e dal server |
| Voce di menu e route | 3 |
| Link "Vedi tutti" dal widget | 3 |
| La pagina passa `include_hidden=1` | 2 |
| N+1 sulla lista (allegati Drive per riga) | 1 |
| Cestino con restore nella pagina | Escluso di proposito (vedi Scope): la convenzione dell'app è la pagina `Trash.tsx` |
| Tab "Attività" (audit) nel drawer | Rimandato: l'audit ha già una pagina |
| `npm run gen:api` | Non serve: `generated.ts` non contiene `area-tasks`; tipi a mano |

Nomi coerenti: `AreaTasks` (Task 2, importata da `App.tsx` nel Task 3), `AreaTaskDetail`/`AreaTaskDialog` con le props della fase 2a, `_accessible_file_ids` (Task 1) usato solo da `get_drive_files_detail`.
