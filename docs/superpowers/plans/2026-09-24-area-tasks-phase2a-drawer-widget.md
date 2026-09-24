# Task di area, fase 2a (drawer, dialog, allegati Drive, widget): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare alla UI dei task di area la stessa gestione delle issue: drawer di dettaglio con commenti e allegati Drive, dialog di modifica con assegnatario/priorità/stato, e widget della dashboard che li usa.

**Architecture:** Nuova cartella `frontend/src/features/areatasks/` con tipi condivisi, un selettore file Drive, un drawer e un dialog puramente presentazionali e un controller `AreaTaskDetail` che possiede lo stato (commenti, modifica, allegati, eliminazione). `AreaTaskCard` (il widget) viene riscritto per aprire il controller invece della modifica inline. Un piccolo cambio backend (`/api/users/?leave_area=`) permette di elencare gli assegnabili di un'area.

**Tech Stack:** React 19, TypeScript, Vite, MUI v7, axios (`@shared/api/client`), vitest + Testing Library; backend Django/DRF/pytest.

**Spec:** `docs/superpowers/specs/2026-09-24-area-tasks-issue-parity-design.md` (fase 2). Il backend è la fase 1, già in `develop` (commit `f82103f8`).

**Fuori da questo piano:** pagina elenco `/tasks` con filtri e cestino (fase 2b, con la decisione aperta su chi può fare restore) e le email (fase 3).

## Global Constraints

- Due frontend: modificare solo `frontend/` (mai `frontend-portal/`). Componenti condivisi con alias `@shared/...` (cartella `shared/src`).
- Tema: mai `import { theme } from '../theme'` a livello di modulo; usare `useTheme()`/`sx` con token del tema. I colori esadecimali di `pianoFerieShared.ts` non si toccano.
- Nel backend il campo `drive_files` è di sola scrittura (lista di id); in lettura la UI usa `drive_files_detail` (`{id, name, mime_type, size, folder}`), già filtrato per ACL e cestino. Per collegare/scollegare si fa `PATCH /area-tasks/{id}/` con la lista completa degli id **visibili** (`drive_files_detail`): il server preserva i link che l'utente non vede.
- Il download dei file Drive passa dall'API: `window.open('/api/drive-files/{id}/download/', '_blank')`. Nessun accesso diretto ai media.
- Regole di scrittura: `task.can_edit` (booleano dal backend) governa modifica, eliminazione, commenti e collegamento file. Le altre aree restano in sola lettura.
- I task non si assegnano a utenti di altre aree (il server rifiuta con 400 su `assigned_to`): la UI mostra solo gli utenti dell'area del task (`/api/users/?leave_area=<id>`).
- `GET /area-tasks/` è paginato (`page_size`) e nasconde di default i completati da più di 3 giorni.
- Verifica prima di dichiarare finito (mandatoria, dal CLAUDE.md): `tsc -b --force` → `npm run build` → `npm run lint` (baseline **27 problemi**, 0 errori: non deve salire) → `npx vitest run` (baseline **62/62**: devono passare tutti più i nuovi). Backend: `manage.py check` → `makemigrations --check --dry-run`.
- Nessun commit, push o rilascio se Fede non lo chiede esplicitamente; ogni task termina con un Checkpoint (`git status`), non con un commit.
- Changelog solo sotto `## [Unreleased]`, intestazioni inglesi (`Added`/`Changed`/`Fixed`).

## Dev loop

Frontend, dalla cartella `frontend/` sull'host: `npx vitest run <file>`, `npx tsc -b --force`, `npm run lint`, `npm run build`.

Backend (il container `backend` non monta il codice; sempre il pattern a due file compose). Dalla root del repo:

```bash
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
sync() { for f in "$@"; do $DC cp "backend/$f" "backend:/app/$f" || return 1; done; }
```

Per vedere la UI nel browser: `$DC up -d --build frontend` (e `backend cron` se cambia il backend).

## File Structure

| File | Ruolo |
|---|---|
| `backend/core/api.py` | Modifica: `UserListSerializer.leave_area`, filtro `?leave_area=` in `UserViewSet` |
| `backend/core/tests/test_users_list_area.py` | Nuovo: test del filtro utenti per area |
| `frontend/src/features/areatasks/types.ts` | Nuovo: tipi, etichette stato/priorità, helper di form, formattazione, errori di campo |
| `frontend/src/features/areatasks/types.test.ts` | Nuovo: test degli helper |
| `frontend/src/features/areatasks/DriveFilePickerDialog.tsx` | Nuovo: sfoglia Drive e seleziona file |
| `frontend/src/features/areatasks/DriveFilePickerDialog.test.tsx` | Nuovo |
| `frontend/src/features/areatasks/AreaTaskDrawer.tsx` | Nuovo: drawer (Dettagli, Commenti, Allegati), presentazionale |
| `frontend/src/features/areatasks/AreaTaskDialog.tsx` | Nuovo: form crea/modifica, presentazionale |
| `frontend/src/features/areatasks/AreaTaskDetail.tsx` | Nuovo: controller (stato, chiamate API) |
| `frontend/src/features/areatasks/AreaTaskDetail.test.tsx` | Nuovo |
| `frontend/src/ui/AreaTaskCard.tsx` | Riscrittura: widget che apre `AreaTaskDetail` |
| `frontend/src/ui/AreaTaskCard.test.tsx` | Nuovo |
| `CHANGELOG.md` | Modifica |

---

### Task 1: Backend, utenti filtrabili per area

**Files:**
- Modify: `backend/core/api.py` (`UserListSerializer`, `UserViewSet`, righe ~28-60)
- Test: `backend/core/tests/test_users_list_area.py`

**Interfaces:**
- Produces: `GET /api/users/?leave_area=<id>` restituisce solo gli utenti attivi il cui `profile.leave_area_id == id`; ogni utente ha il nuovo campo `leave_area` (id o `null`). Senza il parametro, o con un valore non numerico, il comportamento resta quello attuale (tutti gli attivi).

- [ ] **Step 1: Scrivere il test (fallisce)**

Creare `backend/core/tests/test_users_list_area.py`:

```python
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import UserProfile

pytestmark = pytest.mark.django_db

User = get_user_model()
URL = "/api/users/"


def _area(label="Area"):
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label=label)


def _user(area=None, *, active=True):
    username = f"u_{uuid.uuid4().hex[:6]}"
    user = User.objects.create_user(username=username, password="pw", is_active=active)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return User.objects.get(pk=user.pk)


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _ids(resp):
    data = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    return {row["id"] for row in data}


def test_users_expose_leave_area():
    area = _area()
    me = _user(area)
    resp = _client(me).get(URL)
    row = next(r for r in (resp.data["results"] if isinstance(resp.data, dict) else resp.data) if r["id"] == me.id)
    assert row["leave_area"] == area.id


def test_leave_area_filter_returns_only_that_area():
    a1, a2 = _area(), _area()
    u1, u2, nobody = _user(a1), _user(a2), _user(None)
    client = _client(u1)
    assert _ids(client.get(URL, {"leave_area": a1.id})) == {u1.id}
    assert _ids(client.get(URL, {"leave_area": a2.id})) == {u2.id}
    assert nobody.id in _ids(client.get(URL))


def test_leave_area_filter_excludes_inactive_and_ignores_garbage():
    area = _area()
    active = _user(area)
    _user(area, active=False)
    client = _client(active)
    assert _ids(client.get(URL, {"leave_area": area.id})) == {active.id}
    assert active.id in _ids(client.get(URL, {"leave_area": "abc"}))
```

- [ ] **Step 2: Verificare che fallisca**

```bash
cd /home/fede/inventory-app
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
sync() { for f in "$@"; do $DC cp "backend/$f" "backend:/app/$f" || return 1; done; }
sync core/tests/test_users_list_area.py
$DC exec backend pytest core/tests/test_users_list_area.py -q
```

Atteso: FAIL (`KeyError: 'leave_area'` e filtro ignorato).

- [ ] **Step 3: Implementare**

In `backend/core/api.py`, in `UserListSerializer` aggiungere il campo e includerlo in `Meta.fields`:

```python
class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    is_philips = serializers.SerializerMethodField()
    is_servicenow_technician = serializers.SerializerMethodField()
    leave_area = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_is_philips(self, obj):
        try:
            return obj.profile.is_philips
        except Exception:
            return False

    def get_is_servicenow_technician(self, obj):
        try:
            return obj.profile.is_servicenow_technician
        except Exception:
            return True

    def get_leave_area(self, obj):
        try:
            return obj.profile.leave_area_id
        except Exception:
            return None

    class Meta:
        model  = User
        fields = ["id", "username", "first_name", "last_name", "full_name", "is_active", "is_philips", "is_servicenow_technician", "leave_area"]
```

Sostituire `UserViewSet.get_queryset` con:

```python
    def get_queryset(self):
        qs = User.objects.select_related("profile").filter(is_active=True).order_by("first_name", "last_name", "username")
        leave_area = self.request.query_params.get("leave_area")
        if leave_area and leave_area.isdigit():
            qs = qs.filter(profile__leave_area_id=int(leave_area))
        return qs
```

- [ ] **Step 4: Verificare**

```bash
sync core/api.py core/tests/test_users_list_area.py
$DC exec backend pytest core/tests/test_users_list_area.py core/tests/test_area_tasks_api.py -q
$DC exec backend python manage.py check
```

Atteso: tutto PASS, `no issues`. Nessuna migrazione (nessun cambio di modello).

- [ ] **Step 5: Checkpoint**

```bash
git status --short && git diff --stat
```

---

### Task 2: Tipi e helper del feature

**Files:**
- Create: `frontend/src/features/areatasks/types.ts`
- Test: `frontend/src/features/areatasks/types.test.ts`

**Interfaces:**
- Produces (tutti esportati da `types.ts`):
  - `type TaskStatus = 'da_fare' | 'in_corso' | 'in_attesa' | 'completato'`, `type TaskPriority = 'low' | 'medium' | 'high' | 'critical'`
  - `type TaskDriveFile = { id: number; name: string; mime_type: string; size: number; folder: number | null }`
  - `type AreaTaskRow` (vedi codice), `type AreaTaskComment`, `type AreaUser = { id: number; label: string }`
  - `STATUS_ORDER: TaskStatus[]`, `STATUS_META: Record<TaskStatus, { label: string }>`, `PRIORITY_ORDER`, `PRIORITY_META`
  - `type TaskFormData = { title: string; description: string; status: TaskStatus; priority: TaskPriority; assigned_to_id: number | ''; due_date: string }`
  - `createEmptyTaskForm(): TaskFormData`, `taskToForm(task: AreaTaskRow): TaskFormData`, `formToPayload(form: TaskFormData)`
  - `fmtTaskDate(iso?: string | null): string | null`, `fmtTaskDateTime(iso?: string | null): string | null`, `personInitials(name?: string | null): string`, `formatBytes(size: number): string`, `extractFieldErrors(e: unknown): Record<string, string>`

- [ ] **Step 0: Registrare i baseline (una volta sola, prima di modificare il frontend)**

```bash
cd /home/fede/inventory-app/frontend
npx vitest run 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | tail -3
```

Atteso all'inizio: `Tests 62 passed (62)` e `27 problems (0 errors, 27 warnings)`. Annotarli nel report: sono il riferimento per il Task 7.

- [ ] **Step 1: Scrivere il test (fallisce)**

Creare `frontend/src/features/areatasks/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  STATUS_ORDER,
  createEmptyTaskForm,
  extractFieldErrors,
  fmtTaskDate,
  formToPayload,
  formatBytes,
  personInitials,
  taskToForm,
  type AreaTaskRow,
} from './types'

const row: AreaTaskRow = {
  id: 7,
  area: 3,
  area_label: 'Ufficio',
  title: 'Ordine toner',
  description: 'Chiamare il fornitore',
  status: 'in_attesa',
  priority: 'high',
  due_date: '2026-10-01',
  assigned_to: 12,
  assigned_to_name: 'Anna Rossi',
  created_by: 1,
  created_by_name: 'Fede M',
  created_at: '2026-09-24T10:00:00Z',
  updated_at: '2026-09-24T11:00:00Z',
  completed_at: null,
  comments_count: 2,
  can_edit: true,
  drive_files_detail: [],
}

describe('areatasks types', () => {
  it('lists the four statuses in workflow order', () => {
    expect(STATUS_ORDER).toEqual(['da_fare', 'in_corso', 'in_attesa', 'completato'])
  })

  it('creates an empty form with medium priority and no assignee', () => {
    expect(createEmptyTaskForm()).toEqual({
      title: '', description: '', status: 'da_fare', priority: 'medium', assigned_to_id: '', due_date: '',
    })
  })

  it('maps a task to form data and back to an API payload', () => {
    const form = taskToForm(row)
    expect(form).toEqual({
      title: 'Ordine toner', description: 'Chiamare il fornitore', status: 'in_attesa',
      priority: 'high', assigned_to_id: 12, due_date: '2026-10-01',
    })
    expect(formToPayload(form)).toEqual({
      title: 'Ordine toner', description: 'Chiamare il fornitore', status: 'in_attesa',
      priority: 'high', assigned_to: 12, due_date: '2026-10-01',
    })
  })

  it('sends null for an empty assignee and an empty due date, and trims the title', () => {
    const payload = formToPayload({ ...createEmptyTaskForm(), title: '  Titolo  ' })
    expect(payload.title).toBe('Titolo')
    expect(payload.assigned_to).toBeNull()
    expect(payload.due_date).toBeNull()
  })

  it('formats dates in italian and tolerates empty values', () => {
    expect(fmtTaskDate('2026-10-01')).toBe('01/10/2026')
    expect(fmtTaskDate(null)).toBeNull()
  })

  it('builds initials from a display name', () => {
    expect(personInitials('Anna Rossi')).toBe('AR')
    expect(personInitials('mario')).toBe('M')
    expect(personInitials(null)).toBe('?')
  })

  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('extracts DRF field errors from an axios-like error', () => {
    const err = { response: { data: { assigned_to: ["Non valido."], title: ['Obbligatorio.', 'Troppo corto.'] } } }
    expect(extractFieldErrors(err)).toEqual({ assigned_to: 'Non valido.', title: 'Obbligatorio. Troppo corto.' })
    expect(extractFieldErrors(new Error('x'))).toEqual({})
  })
})
```

- [ ] **Step 2: Verificare che fallisca**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/features/areatasks/types.test.ts
```

Atteso: FAIL (`Failed to resolve import "./types"`).

- [ ] **Step 3: Implementare `types.ts`**

Creare `frontend/src/features/areatasks/types.ts`:

```ts
import { isRecord } from '@shared/utils/guards'

export type TaskStatus = 'da_fare' | 'in_corso' | 'in_attesa' | 'completato'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export type TaskDriveFile = {
  id: number
  name: string
  mime_type: string
  size: number
  folder: number | null
}

export type AreaTaskRow = {
  id: number
  area: number
  area_label: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  created_by: number | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  comments_count: number
  can_edit: boolean
  drive_files_detail: TaskDriveFile[]
}

export type AreaTaskComment = {
  id: number
  task: number
  author: number
  author_name: string
  body: string
  created_at: string
  updated_at: string
}

export type AreaUser = { id: number; label: string }

export const STATUS_ORDER: TaskStatus[] = ['da_fare', 'in_corso', 'in_attesa', 'completato']

export const STATUS_META: Record<TaskStatus, { label: string }> = {
  da_fare: { label: 'Da fare' },
  in_corso: { label: 'In corso' },
  in_attesa: { label: 'In attesa' },
  completato: { label: 'Completato' },
}

export const PRIORITY_ORDER: TaskPriority[] = ['low', 'medium', 'high', 'critical']

export const PRIORITY_META: Record<TaskPriority, { label: string }> = {
  low: { label: 'Bassa' },
  medium: { label: 'Media' },
  high: { label: 'Alta' },
  critical: { label: 'Critica' },
}

export type TaskFormData = {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assigned_to_id: number | ''
  due_date: string
}

export function createEmptyTaskForm(): TaskFormData {
  return { title: '', description: '', status: 'da_fare', priority: 'medium', assigned_to_id: '', due_date: '' }
}

export function taskToForm(task: AreaTaskRow): TaskFormData {
  return {
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    assigned_to_id: task.assigned_to ?? '',
    due_date: task.due_date ?? '',
  }
}

export function formToPayload(form: TaskFormData) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    assigned_to: form.assigned_to_id === '' ? null : form.assigned_to_id,
    due_date: form.due_date || null,
  }
}

export function fmtTaskDate(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function fmtTaskDateTime(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function personInitials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

export function formatBytes(size: number): string {
  if (!size || size < 1024) return `${size || 0} B`
  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[i]}`
}

export function extractFieldErrors(e: unknown): Record<string, string> {
  const data = isRecord(e) && isRecord(e['response']) ? e['response']['data'] : undefined
  if (!isRecord(data)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    out[key] = Array.isArray(value) ? value.join(' ') : String(value)
  }
  return out
}
```

- [ ] **Step 4: Verificare**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/features/areatasks/types.test.ts && npx tsc -b --force
```

Atteso: 8 passed, `tsc` senza errori.

- [ ] **Step 5: Checkpoint**

```bash
cd /home/fede/inventory-app && git status --short
```

---

### Task 3: Selettore file Drive

**Files:**
- Create: `frontend/src/features/areatasks/DriveFilePickerDialog.tsx`
- Test: `frontend/src/features/areatasks/DriveFilePickerDialog.test.tsx`

**Interfaces:**
- Consumes: `formatBytes`, `TaskDriveFile` (Task 2).
- Produces: `default export function DriveFilePickerDialog(props: { open: boolean; excludeIds: number[]; busy?: boolean; onClose: () => void; onConfirm: (files: TaskDriveFile[]) => void })`. Carica la radice (`/drive-folders/?root=true` e `/drive-files/?root=true`, `page_size: 200`), entra nelle cartelle con `/drive-folders/{id}/children/` (risposta `{folder, folders, files}`) e mantiene il percorso (breadcrumb) in stato locale. Mostra checkbox sui file; quelli già collegati (`excludeIds`) sono disabilitati. La selezione sopravvive alla navigazione tra cartelle. `onConfirm` riceve i file selezionati; il pulsante è disabilitato senza selezione.
- I file di Drive dall'API hanno campi `id, name, folder, mime_type, size` (più altri: si usano solo questi).

- [ ] **Step 1: Scrivere il test (fallisce)**

Creare `frontend/src/features/areatasks/DriveFilePickerDialog.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DriveFilePickerDialog from './DriveFilePickerDialog'

const apiGet = vi.fn()
vi.mock('@shared/api/client', () => ({ api: { get: (...a: unknown[]) => apiGet(...a) } }))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Errore' }))
const toast = { error: vi.fn(), success: vi.fn() }
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))

const folder = { id: 5, name: 'Verbali', parent: null }
const fileRoot = { id: 1, name: 'root.pdf', folder: null, mime_type: 'application/pdf', size: 2048 }
const fileInFolder = { id: 2, name: 'dentro.pdf', folder: 5, mime_type: 'application/pdf', size: 1024 }

beforeEach(() => {
  apiGet.mockReset()
  apiGet.mockImplementation((url: string) => {
    if (url === '/drive-folders/') return Promise.resolve({ data: { results: [folder] } })
    if (url === '/drive-files/') return Promise.resolve({ data: { results: [fileRoot] } })
    if (url === '/drive-folders/5/children/')
      return Promise.resolve({ data: { folder, folders: [], files: [fileInFolder] } })
    if (url === '/drive-folders/5/breadcrumb/') return Promise.resolve({ data: [{ id: 5, name: 'Verbali' }] })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
})

describe('DriveFilePickerDialog', () => {
  it('lists root folders and files and confirms the selection', async () => {
    const onConfirm = vi.fn()
    render(<DriveFilePickerDialog open excludeIds={[]} onClose={() => {}} onConfirm={onConfirm} />)

    expect(await screen.findByText('Verbali')).toBeInTheDocument()
    expect(screen.getByText('root.pdf')).toBeInTheDocument()

    const confirm = screen.getByRole('button', { name: /Collega/ })
    expect(confirm).toBeDisabled()

    fireEvent.click(screen.getByLabelText('Seleziona root.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /Collega \(1\)/ }))

    expect(onConfirm).toHaveBeenCalledWith([
      { id: 1, name: 'root.pdf', mime_type: 'application/pdf', size: 2048, folder: null },
    ])
  })

  it('keeps the selection while navigating into a folder', async () => {
    const onConfirm = vi.fn()
    render(<DriveFilePickerDialog open excludeIds={[]} onClose={() => {}} onConfirm={onConfirm} />)

    fireEvent.click(await screen.findByLabelText('Seleziona root.pdf'))
    fireEvent.click(screen.getByText('Verbali'))
    fireEvent.click(await screen.findByLabelText('Seleziona dentro.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /Collega \(2\)/ }))

    const ids = onConfirm.mock.calls[0]![0].map((f: { id: number }) => f.id).sort()
    expect(ids).toEqual([1, 2])
  })

  it('disables files that are already linked', async () => {
    render(<DriveFilePickerDialog open excludeIds={[1]} onClose={() => {}} onConfirm={() => {}} />)
    const box = await screen.findByLabelText('Seleziona root.pdf')
    expect(box).toBeDisabled()
  })

  it('goes back to the root from the breadcrumb', async () => {
    render(<DriveFilePickerDialog open excludeIds={[]} onClose={() => {}} onConfirm={() => {}} />)
    fireEvent.click(await screen.findByText('Verbali'))
    await screen.findByText('dentro.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Drive' }))
    await waitFor(() => expect(screen.getByText('root.pdf')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Verificare che fallisca**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/features/areatasks/DriveFilePickerDialog.test.tsx
```

Atteso: FAIL (modulo non trovato).

- [ ] **Step 3: Implementare il componente**

Creare `frontend/src/features/areatasks/DriveFilePickerDialog.tsx`:

```tsx
import * as React from 'react'
import {
  Box, Breadcrumbs, Button, Checkbox, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Link, Stack, Typography,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { formatBytes, type TaskDriveFile } from './types'

type PickerFolder = { id: number; name: string }
type Crumb = { id: number; name: string }

type Props = {
  open: boolean
  excludeIds: number[]
  busy?: boolean
  onClose: () => void
  onConfirm: (files: TaskDriveFile[]) => void
}

function toFile(raw: Record<string, unknown>): TaskDriveFile {
  return {
    id: raw.id as number,
    name: raw.name as string,
    mime_type: (raw.mime_type as string) ?? '',
    size: (raw.size as number) ?? 0,
    folder: (raw.folder as number | null) ?? null,
  }
}

export default function DriveFilePickerDialog({ open, excludeIds, busy = false, onClose, onConfirm }: Props) {
  const toast = useToast()
  const [folderId, setFolderId] = React.useState<number | null>(null)
  const [crumbs, setCrumbs] = React.useState<Crumb[]>([])
  const [folders, setFolders] = React.useState<PickerFolder[]>([])
  const [files, setFiles] = React.useState<TaskDriveFile[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<Map<number, TaskDriveFile>>(new Map())
  const requestId = React.useRef(0)

  // Reset ad ogni apertura.
  React.useEffect(() => {
    if (open) {
      setFolderId(null)
      setCrumbs([])
      setSelected(new Map())
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const id = ++requestId.current
    setLoading(true)
    const load = async () => {
      try {
        if (folderId === null) {
          const [fRes, fileRes] = await Promise.all([
            api.get('/drive-folders/', { params: { root: 'true', page_size: 200 } }),
            api.get('/drive-files/', { params: { root: 'true', page_size: 200 } }),
          ])
          if (id !== requestId.current) return
          setFolders((fRes.data?.results ?? fRes.data ?? []) as PickerFolder[])
          setFiles(((fileRes.data?.results ?? fileRes.data ?? []) as Record<string, unknown>[]).map(toFile))
          setCrumbs([])
        } else {
          const res = await api.get(`/drive-folders/${folderId}/children/`)
          if (id !== requestId.current) return
          setFolders((res.data?.folders ?? []) as PickerFolder[])
          setFiles(((res.data?.files ?? []) as Record<string, unknown>[]).map(toFile))
          const bc = await api.get(`/drive-folders/${folderId}/breadcrumb/`)
          if (id !== requestId.current) return
          setCrumbs((bc.data ?? []) as Crumb[])
        }
      } catch (e) {
        if (id === requestId.current) toast.error(apiErrorToMessage(e))
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }
    void load()
  }, [open, folderId, toast])

  const toggle = (file: TaskDriveFile) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(file.id)) next.delete(file.id)
      else next.set(file.id, file)
      return next
    })
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Collega file da Drive</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        <Breadcrumbs sx={{ mb: 1.5, fontSize: '0.85rem' }}>
          <Link component="button" type="button" underline="hover" onClick={() => setFolderId(null)}>
            Drive
          </Link>
          {crumbs.map((c) => (
            <Link key={c.id} component="button" type="button" underline="hover" onClick={() => setFolderId(c.id)}>
              {c.name}
            </Link>
          ))}
        </Breadcrumbs>

        {loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={24} /></Stack>
        ) : folders.length === 0 && files.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Nessun file in questa cartella.
          </Typography>
        ) : (
          <Stack spacing={0.25}>
            {folders.map((f) => (
              <Box
                key={f.id}
                onClick={() => setFolderId(f.id)}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <FolderIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{f.name}</Typography>
              </Box>
            ))}
            {files.map((file) => {
              const already = excludeIds.includes(file.id)
              return (
                <Box key={file.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, opacity: already ? 0.5 : 1 }}>
                  <Checkbox
                    size="small"
                    disabled={already}
                    checked={selected.has(file.id)}
                    onChange={() => toggle(file)}
                    inputProps={{ 'aria-label': `Seleziona ${file.name}` }}
                  />
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {already ? 'Già collegato' : formatBytes(file.size)}
                  </Typography>
                </Box>
              )
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="text" onClick={onClose} disabled={busy}>Annulla</Button>
        <Button
          variant="contained"
          disabled={selected.size === 0 || busy}
          onClick={() => onConfirm([...selected.values()])}
        >
          {busy ? <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} /> : null}
          {selected.size > 0 ? `Collega (${selected.size})` : 'Collega'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 4: Verificare**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/features/areatasks/DriveFilePickerDialog.test.tsx && npx tsc -b --force
```

Atteso: 4 passed, `tsc` pulito. Se una query `getByRole('button', { name: 'Drive' })` fallisce perché MUI rende `Link component="button"` con un altro ruolo accessibile, adattare il selettore del test (non il componente) e dirlo nel report.

- [ ] **Step 5: Checkpoint**

```bash
cd /home/fede/inventory-app && git status --short
```

---

### Task 4: Drawer e Dialog (presentazionali)

**Files:**
- Create: `frontend/src/features/areatasks/AreaTaskDrawer.tsx`
- Create: `frontend/src/features/areatasks/AreaTaskDialog.tsx`
- Test: coperti dal test del controller (Task 5); questo task termina con `tsc`/lint puliti.

**Interfaces:**
- Consumes: tipi e helper del Task 2; `DrawerShell`, `DrawerSection`, `DrawerFieldList` da `@shared/ui/...`.
- Produces:
  - `AreaTaskDrawer(props: AreaTaskDrawerProps)` con
    ```ts
    export type AreaTaskDrawerProps = {
      open: boolean
      task: AreaTaskRow | null
      tab: number
      comments: AreaTaskComment[]
      commentsLoading: boolean
      newComment: string
      sendingComment: boolean
      canLinkFiles: boolean
      unlinkingId: number | null
      onClose: () => void
      onEdit: () => void
      onDelete: () => void
      onTabChange: (value: number) => void
      onNewCommentChange: (value: string) => void
      onSendComment: () => void
      onLinkFiles: () => void
      onUnlinkFile: (fileId: number) => void
    }
    ```
    Tab: 0 Dettagli, 1 `Commenti (n)`, 2 `Allegati (n)`.
  - `AreaTaskDialog(props: AreaTaskDialogProps)` con
    ```ts
    export type AreaTaskDialogProps = {
      open: boolean
      task: AreaTaskRow | null      // null = creazione
      areaLabel: string
      form: TaskFormData
      users: AreaUser[]
      saving: boolean
      errors: Record<string, string>
      onFormChange: React.Dispatch<React.SetStateAction<TaskFormData>>
      onSave: () => void
      onClose: () => void
    }
    ```

- [ ] **Step 1: Creare `AreaTaskDrawer.tsx`**

```tsx
import {
  Avatar, Box, Button, CircularProgress, Divider, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import SendIcon from '@mui/icons-material/Send'
import { ActionIconButton } from '@shared/ui/ActionIconButton'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList } from '@shared/ui/DrawerParts'
import {
  PRIORITY_META, STATUS_META, fmtTaskDate, fmtTaskDateTime, formatBytes, personInitials,
  type AreaTaskComment, type AreaTaskRow,
} from './types'

export type AreaTaskDrawerProps = {
  open: boolean
  task: AreaTaskRow | null
  tab: number
  comments: AreaTaskComment[]
  commentsLoading: boolean
  newComment: string
  sendingComment: boolean
  canLinkFiles: boolean
  unlinkingId: number | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onTabChange: (value: number) => void
  onNewCommentChange: (value: string) => void
  onSendComment: () => void
  onLinkFiles: () => void
  onUnlinkFile: (fileId: number) => void
}

export default function AreaTaskDrawer({
  open, task, tab, comments, commentsLoading, newComment, sendingComment, canLinkFiles, unlinkingId,
  onClose, onEdit, onDelete, onTabChange, onNewCommentChange, onSendComment, onLinkFiles, onUnlinkFile,
}: AreaTaskDrawerProps) {
  const files = task?.drive_files_detail ?? []
  const canEdit = Boolean(task?.can_edit)

  const commentFooter = tab === 1 && canEdit ? (
    <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0, bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          size="small" fullWidth multiline maxRows={4}
          placeholder="Scrivi un commento… (Ctrl+Enter per inviare)"
          value={newComment}
          onChange={(e) => onNewCommentChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSendComment() }}
          disabled={sendingComment}
        />
        <ActionIconButton
          label="Invia (Ctrl+Enter)" color="primary"
          onClick={onSendComment} disabled={!newComment.trim() || sendingComment}
          sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 1.5, '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' } }}
        >
          {sendingComment ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : <SendIcon />}
        </ActionIconButton>
      </Stack>
    </Box>
  ) : null

  return (
    <DrawerShell
      open={open} onClose={onClose} width={420} gradient="teal"
      statusLabel={task ? `● ${STATUS_META[task.status]?.label ?? task.status}` : undefined}
      statusLabelSecondary={task ? (PRIORITY_META[task.priority]?.label ?? task.priority) : undefined}
      canChange={canEdit} canDelete={canEdit}
      onEdit={onEdit} onDelete={onDelete}
      title={task?.title ?? ''}
      subtitle={task?.area_label}
      loading={commentsLoading}
      tabs={['Dettagli', `Commenti (${comments.length})`, `Allegati (${files.length})`]}
      tabValue={tab} onTabChange={onTabChange}
      bodySx={{ minHeight: 0 }}
      bodyFooter={commentFooter}
    >
      {tab === 0 && task ? (
        <>
          <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14 }} />} title="Descrizione">
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {task.description || '—'}
            </Typography>
          </DrawerSection>

          <DrawerSection icon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />} title="Informazioni">
            <Stack divider={<Divider sx={{ borderColor: 'grey.100' }} />}>
              <DrawerFieldList rows={[
                { label: 'Area', value: task.area_label },
                { label: 'Assegnato a', value: task.assigned_to_name },
                { label: 'Scadenza', value: fmtTaskDate(task.due_date) },
                { label: 'Completato il', value: fmtTaskDateTime(task.completed_at) },
                { label: 'Creato da', value: task.created_by_name },
                { label: 'Creato il', value: fmtTaskDateTime(task.created_at) },
                { label: 'Aggiornato il', value: fmtTaskDateTime(task.updated_at) },
              ]} />
            </Stack>
          </DrawerSection>
        </>
      ) : null}

      {tab === 1 ? (
        <Stack spacing={0} sx={{ flex: 1 }}>
          {commentsLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={24} /></Stack>
          ) : comments.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nessun commento ancora.</Typography>
            </Box>
          ) : (
            comments.map((comment, index) => (
              <Box key={comment.id}>
                <Box sx={{ display: 'flex', gap: 1.5, py: 2 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.72rem', fontWeight: 700, bgcolor: 'primary.main', flexShrink: 0 }}>
                    {personInitials(comment.author_name)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{comment.author_name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtTaskDateTime(comment.created_at)}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{comment.body}</Typography>
                  </Box>
                </Box>
                {index < comments.length - 1 ? <Divider /> : null}
              </Box>
            ))
          )}
        </Stack>
      ) : null}

      {tab === 2 ? (
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          {canEdit && canLinkFiles ? (
            <Button variant="outlined" size="small" startIcon={<AttachFileIcon />} onClick={onLinkFiles} sx={{ alignSelf: 'flex-start' }}>
              Collega file da Drive
            </Button>
          ) : null}
          {files.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <AttachFileIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nessun allegato collegato.</Typography>
            </Box>
          ) : (
            files.map((file) => (
              <Stack key={file.id} direction="row" alignItems="center" spacing={1} sx={{ px: 1, py: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                <Box
                  role="link" tabIndex={0}
                  onClick={() => window.open(`/api/drive-files/${file.id}/download/`, '_blank')}
                  onKeyDown={(e) => { if (e.key === 'Enter') window.open(`/api/drive-files/${file.id}/download/`, '_blank') }}
                  sx={{ flex: 1, minWidth: 0, cursor: 'pointer', '&:hover .file-name': { textDecoration: 'underline' } }}
                >
                  <Typography className="file-name" variant="body2" sx={{ fontWeight: 600 }} noWrap>{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatBytes(file.size)}</Typography>
                </Box>
                {canEdit ? (
                  <Tooltip title="Scollega">
                    <span>
                      <IconButton
                        size="small" aria-label={`Scollega ${file.name}`}
                        disabled={unlinkingId === file.id}
                        onClick={() => onUnlinkFile(file.id)}
                      >
                        {unlinkingId === file.id ? <CircularProgress size={16} /> : <LinkOffIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null}
              </Stack>
            ))
          )}
        </Stack>
      ) : null}
    </DrawerShell>
  )
}
```

- [ ] **Step 2: Creare `AreaTaskDialog.tsx`**

```tsx
import * as React from 'react'
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material'
import {
  PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER,
  type AreaTaskRow, type AreaUser, type TaskFormData, type TaskPriority, type TaskStatus,
} from './types'

export type AreaTaskDialogProps = {
  open: boolean
  task: AreaTaskRow | null
  areaLabel: string
  form: TaskFormData
  users: AreaUser[]
  saving: boolean
  errors: Record<string, string>
  onFormChange: React.Dispatch<React.SetStateAction<TaskFormData>>
  onSave: () => void
  onClose: () => void
}

export default function AreaTaskDialog({
  open, task, areaLabel, form, users, saving, errors, onFormChange, onSave, onClose,
}: AreaTaskDialogProps) {
  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        {task ? `Modifica task #${task.id}` : 'Nuovo task'}
        <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
          · {areaLabel}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Titolo *" size="small" fullWidth
            value={form.title}
            onChange={(e) => onFormChange((f) => ({ ...f, title: e.target.value }))}
            error={Boolean(errors.title)} helperText={errors.title}
            inputProps={{ maxLength: 200 }}
          />

          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Stato</InputLabel>
              <Select
                value={form.status} label="Stato"
                onChange={(e) => onFormChange((f) => ({ ...f, status: e.target.value as TaskStatus }))}
              >
                {STATUS_ORDER.map((s) => (
                  <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Priorità</InputLabel>
              <Select
                value={form.priority} label="Priorità"
                onChange={(e) => onFormChange((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
              >
                {PRIORITY_ORDER.map((p) => (
                  <MenuItem key={p} value={p}>{PRIORITY_META[p].label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth error={Boolean(errors.assigned_to)}>
              <InputLabel>Assegnato a</InputLabel>
              <Select
                value={form.assigned_to_id} label="Assegnato a"
                onChange={(e) => onFormChange((f) => ({ ...f, assigned_to_id: e.target.value as number | '' }))}
              >
                <MenuItem value=""><em>Nessuno</em></MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.label}</MenuItem>
                ))}
              </Select>
              {errors.assigned_to ? (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.assigned_to}</Typography>
              ) : null}
            </FormControl>
            <TextField
              label="Scadenza" size="small" fullWidth type="date"
              value={form.due_date}
              onChange={(e) => onFormChange((f) => ({ ...f, due_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              error={Boolean(errors.due_date)} helperText={errors.due_date}
            />
          </Stack>

          <TextField
            label="Descrizione" size="small" fullWidth multiline rows={3}
            value={form.description}
            onChange={(e) => onFormChange((f) => ({ ...f, description: e.target.value }))}
          />

          {errors.non_field_errors || errors.detail ? (
            <Alert severity="error">{errors.non_field_errors || errors.detail}</Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="text" onClick={onClose} disabled={saving}>Annulla</Button>
        <Button variant="contained" onClick={onSave} disabled={saving || !form.title.trim()} sx={{ minWidth: 140 }}>
          {saving ? <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} /> : null}
          {task ? 'Salva modifiche' : 'Crea task'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 3: Verificare**

```bash
cd /home/fede/inventory-app/frontend && npx tsc -b --force && npm run lint 2>&1 | tail -3
```

Atteso: `tsc` senza errori; lint senza nuovi problemi rispetto al baseline (27). Se `DrawerFieldList` non accetta `value: string | null`, guardare `DrawerFieldRowProps` in `shared/src/ui/DrawerParts.tsx` e adattare (il drawer delle issue passa già valori `null`).

- [ ] **Step 4: Checkpoint**

```bash
cd /home/fede/inventory-app && git status --short
```

---

### Task 5: Controller `AreaTaskDetail`

**Files:**
- Create: `frontend/src/features/areatasks/AreaTaskDetail.tsx`
- Test: `frontend/src/features/areatasks/AreaTaskDetail.test.tsx`

**Interfaces:**
- Consumes: `AreaTaskDrawer`, `AreaTaskDialog`, `DriveFilePickerDialog`, tipi/helper (Task 2-4); `ConfirmDeleteDialog` da `@shared/ui/ConfirmDeleteDialog`; `useAuth` da `../../auth/AuthProvider`.
- Produces: `default export function AreaTaskDetail(props: { task: AreaTaskRow | null; onClose: () => void; onChanged: (task: AreaTaskRow) => void; onDeleted: (id: number) => void })`. `task` non nullo = drawer aperto su quel task. Il controller:
  - carica `GET /area-tasks/{id}/comments/` (array) quando cambia `task.id`, e riparte dalla tab 0;
  - invia commenti `POST /area-tasks/{id}/comments/ {body}`, li aggiunge in coda e aggiorna `comments_count` (chiama `onChanged`);
  - modifica: apre il dialog con `taskToForm`, carica gli assegnabili da `GET /users/?leave_area={task.area}&page_size=200`, salva con `PATCH /area-tasks/{id}/` (payload `formToPayload`), mappa gli errori DRF con `extractFieldErrors`, poi `onChanged`;
  - elimina: conferma con `ConfirmDeleteDialog`, `DELETE /area-tasks/{id}/`, poi `onDeleted(id)` e chiude;
  - allegati: "Collega" apre il selettore (`excludeIds` = id già collegati) e alla conferma fa `PATCH /area-tasks/{id}/ { drive_files: [...idVisibili, ...nuoviId] }`; "Scollega" fa `PATCH` con la lista senza quel file. La risposta (con `drive_files_detail` aggiornato) diventa il nuovo stato e va a `onChanged`;
  - `canLinkFiles = hasPerm('drive.view_drivefile')` (il superuser passa da `hasPerm`).
  - Ogni errore API → `toast.error(apiErrorToMessage(e))`; l'errore di validazione del dialog resta nel form.

- [ ] **Step 1: Scrivere il test (fallisce)**

Creare `frontend/src/features/areatasks/AreaTaskDetail.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaTaskDetail from './AreaTaskDetail'
import type { AreaTaskRow } from './types'

const apiGet = vi.fn()
const apiPost = vi.fn()
const apiPatch = vi.fn()
const apiDelete = vi.fn()
vi.mock('@shared/api/client', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    delete: (...a: unknown[]) => apiDelete(...a),
  },
}))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Errore' }))
const toast = { error: vi.fn(), success: vi.fn() }
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ me: { id: 1 }, hasPerm: () => true, inGroup: () => true }),
}))
// Il selettore Drive ha un test proprio: qui lo sostituiamo con un finto pulsante.
vi.mock('./DriveFilePickerDialog', () => ({
  default: (p: { open: boolean; onConfirm: (f: unknown[]) => void }) =>
    p.open ? (
      <button onClick={() => p.onConfirm([{ id: 99, name: 'nuovo.pdf', mime_type: '', size: 10, folder: null }])}>
        conferma-picker
      </button>
    ) : null,
}))

const baseTask: AreaTaskRow = {
  id: 7, area: 3, area_label: 'Ufficio', title: 'Ordine toner', description: 'desc',
  status: 'in_corso', priority: 'medium', due_date: null, assigned_to: null, assigned_to_name: null,
  created_by: 1, created_by_name: 'Fede', created_at: '2026-09-24T10:00:00Z', updated_at: '2026-09-24T10:00:00Z',
  completed_at: null, comments_count: 0, can_edit: true,
  drive_files_detail: [{ id: 5, name: 'verbale.pdf', mime_type: 'application/pdf', size: 2048, folder: null }],
}

function setup(task: AreaTaskRow = baseTask) {
  const onClose = vi.fn()
  const onChanged = vi.fn()
  const onDeleted = vi.fn()
  render(<AreaTaskDetail task={task} onClose={onClose} onChanged={onChanged} onDeleted={onDeleted} />)
  return { onClose, onChanged, onDeleted }
}

beforeEach(() => {
  ;[apiGet, apiPost, apiPatch, apiDelete].forEach((m) => m.mockReset())
  toast.error.mockReset()
  apiGet.mockImplementation((url: string) => {
    if (url === '/area-tasks/7/comments/') return Promise.resolve({ data: [] })
    if (url === '/users/') return Promise.resolve({ data: [{ id: 12, full_name: 'Anna Rossi', username: 'anna' }] })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
})

describe('AreaTaskDetail', () => {
  it('loads the comments of the task on open', async () => {
    apiGet.mockImplementation((url: string) =>
      url === '/area-tasks/7/comments/'
        ? Promise.resolve({ data: [{ id: 1, task: 7, author: 2, author_name: 'Anna', body: 'Primo commento', created_at: '2026-09-24T10:00:00Z', updated_at: '2026-09-24T10:00:00Z' }] })
        : Promise.resolve({ data: [] }),
    )
    setup()
    fireEvent.click(await screen.findByRole('tab', { name: /Commenti/ }))
    expect(await screen.findByText('Primo commento')).toBeInTheDocument()
  })

  it('posts a comment and updates the count', async () => {
    apiPost.mockResolvedValue({
      data: { id: 2, task: 7, author: 1, author_name: 'Fede', body: 'Fatto', created_at: '2026-09-24T12:00:00Z', updated_at: '2026-09-24T12:00:00Z' },
    })
    const { onChanged } = setup()
    fireEvent.click(await screen.findByRole('tab', { name: /Commenti/ }))
    fireEvent.change(await screen.findByPlaceholderText(/Scrivi un commento/), { target: { value: 'Fatto' } })
    fireEvent.click(screen.getByRole('button', { name: /Invia/ }))

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/area-tasks/7/comments/', { body: 'Fatto' }))
    expect(await screen.findByText('Fatto')).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 7, comments_count: 1 }))
  })

  it('unlinks a file by patching the remaining visible ids', async () => {
    apiPatch.mockResolvedValue({ data: { ...baseTask, drive_files_detail: [] } })
    const { onChanged } = setup()
    fireEvent.click(await screen.findByRole('tab', { name: /Allegati/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Scollega verbale.pdf' }))

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/area-tasks/7/', { drive_files: [] }))
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ drive_files_detail: [] }))
  })

  it('links new files keeping the ones already visible', async () => {
    apiPatch.mockResolvedValue({
      data: { ...baseTask, drive_files_detail: [...baseTask.drive_files_detail, { id: 99, name: 'nuovo.pdf', mime_type: '', size: 10, folder: null }] },
    })
    setup()
    fireEvent.click(await screen.findByRole('tab', { name: /Allegati/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Collega file da Drive/ }))
    fireEvent.click(await screen.findByText('conferma-picker'))

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/area-tasks/7/', { drive_files: [5, 99] }))
    expect(await screen.findByText('nuovo.pdf')).toBeInTheDocument()
  })

  it('edits the task with the assignable users of its area', async () => {
    apiPatch.mockResolvedValue({ data: { ...baseTask, title: 'Nuovo titolo', priority: 'high', assigned_to: 12, assigned_to_name: 'Anna Rossi' } })
    const { onChanged } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }))

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/users/', expect.objectContaining({ params: expect.objectContaining({ leave_area: 3 }) })))
    const title = await screen.findByLabelText(/Titolo/)
    fireEvent.change(title, { target: { value: 'Nuovo titolo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))

    await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1))
    const [url, payload] = apiPatch.mock.calls[0]!
    expect(url).toBe('/area-tasks/7/')
    expect(payload).toMatchObject({ title: 'Nuovo titolo', priority: 'medium', assigned_to: null })
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nuovo titolo' }))
  })

  it('shows the server validation error for the assignee and keeps the dialog open', async () => {
    apiPatch.mockRejectedValue({ response: { data: { assigned_to: ["L'assegnatario deve appartenere all'area del task."] } } })
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Salva modifiche' }))
    expect(await screen.findByText(/deve appartenere all'area/)).toBeInTheDocument()
  })

  it('deletes after confirmation', async () => {
    apiDelete.mockResolvedValue({})
    const { onDeleted, onClose } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina', hidden: false, description: undefined }))
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/area-tasks/7/'))
    expect(onDeleted).toHaveBeenCalledWith(7)
    expect(onClose).toHaveBeenCalled()
  })

  it('hides write actions on a read-only task', async () => {
    setup({ ...baseTask, can_edit: false })
    expect(screen.queryByRole('button', { name: 'Modifica' })).toBeNull()
    fireEvent.click(await screen.findByRole('tab', { name: /Allegati/ }))
    expect(screen.queryByRole('button', { name: /Collega file da Drive/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Scollega verbale.pdf' })).toBeNull()
  })
})
```

Nota per chi esegue: il test `deletes after confirmation` deve cliccare il pulsante di conferma dentro il dialog (non quello dell'hero). Se i due pulsanti "Elimina" risultano ambigui con `findByRole`, usare `within(screen.getByRole('dialog'))` per cliccare quello nel dialog di conferma; adattare il test, non il componente.

- [ ] **Step 2: Verificare che fallisca**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/features/areatasks/AreaTaskDetail.test.tsx
```

Atteso: FAIL (modulo `./AreaTaskDetail` non trovato).

- [ ] **Step 3: Implementare il controller**

Creare `frontend/src/features/areatasks/AreaTaskDetail.tsx`:

```tsx
import * as React from 'react'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useAuth } from '../../auth/AuthProvider'
import AreaTaskDrawer from './AreaTaskDrawer'
import AreaTaskDialog from './AreaTaskDialog'
import DriveFilePickerDialog from './DriveFilePickerDialog'
import {
  createEmptyTaskForm, extractFieldErrors, formToPayload, taskToForm,
  type AreaTaskComment, type AreaTaskRow, type AreaUser, type TaskDriveFile, type TaskFormData,
} from './types'

type Props = {
  task: AreaTaskRow | null
  onClose: () => void
  onChanged: (task: AreaTaskRow) => void
  onDeleted: (id: number) => void
}

type RawUser = { id: number; full_name?: string; username?: string }

export default function AreaTaskDetail({ task, onClose, onChanged, onDeleted }: Props) {
  const toast = useToast()
  const { hasPerm } = useAuth()

  const [current, setCurrent] = React.useState<AreaTaskRow | null>(task)
  const [tab, setTab] = React.useState(0)
  const [comments, setComments] = React.useState<AreaTaskComment[]>([])
  const [commentsLoading, setCommentsLoading] = React.useState(false)
  const [newComment, setNewComment] = React.useState('')
  const [sendingComment, setSendingComment] = React.useState(false)

  const [editOpen, setEditOpen] = React.useState(false)
  const [form, setForm] = React.useState<TaskFormData>(createEmptyTaskForm)
  const [users, setUsers] = React.useState<AreaUser[]>([])
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [linking, setLinking] = React.useState(false)
  const [unlinkingId, setUnlinkingId] = React.useState<number | null>(null)

  // Riparte da zero quando cambia il task mostrato.
  React.useEffect(() => {
    setCurrent(task)
    setTab(0)
    setNewComment('')
    setEditOpen(false)
    setPickerOpen(false)
    if (!task) { setComments([]); return }
    let alive = true
    setCommentsLoading(true)
    api.get<AreaTaskComment[]>(`/area-tasks/${task.id}/comments/`)
      .then((r) => { if (alive) setComments(Array.isArray(r.data) ? r.data : []) })
      .catch((e) => { if (alive) toast.error(apiErrorToMessage(e)) })
      .finally(() => { if (alive) setCommentsLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  const apply = React.useCallback((next: AreaTaskRow) => {
    setCurrent(next)
    onChanged(next)
  }, [onChanged])

  // ── Commenti ────────────────────────────────────────────────────────────────
  const sendComment = async () => {
    const body = newComment.trim()
    if (!current || !body || sendingComment) return
    setSendingComment(true)
    try {
      const r = await api.post<AreaTaskComment>(`/area-tasks/${current.id}/comments/`, { body })
      setComments((prev) => [...prev, r.data])
      setNewComment('')
      apply({ ...current, comments_count: current.comments_count + 1 })
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSendingComment(false)
    }
  }

  // ── Modifica ────────────────────────────────────────────────────────────────
  const openEdit = async () => {
    if (!current) return
    setForm(taskToForm(current))
    setErrors({})
    setEditOpen(true)
    try {
      const r = await api.get<RawUser[]>('/users/', { params: { leave_area: current.area, page_size: 200 } })
      const list = Array.isArray(r.data) ? r.data : []
      setUsers(list.map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) })))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const save = async () => {
    if (!current || saving) return
    setSaving(true)
    setErrors({})
    try {
      const r = await api.patch<AreaTaskRow>(`/area-tasks/${current.id}/`, formToPayload(form))
      apply(r.data)
      setEditOpen(false)
    } catch (e) {
      const fields = extractFieldErrors(e)
      if (Object.keys(fields).length > 0) setErrors(fields)
      else toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Eliminazione ────────────────────────────────────────────────────────────
  const remove = async () => {
    if (!current || deleting) return
    setDeleting(true)
    try {
      await api.delete(`/area-tasks/${current.id}/`)
      const id = current.id
      setConfirmDelete(false)
      onDeleted(id)
      onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  // ── Allegati Drive ──────────────────────────────────────────────────────────
  const visibleIds = (t: AreaTaskRow) => t.drive_files_detail.map((f) => f.id)

  const linkFiles = async (files: TaskDriveFile[]) => {
    if (!current || linking) return
    setLinking(true)
    try {
      const ids = [...visibleIds(current), ...files.map((f) => f.id)]
      const r = await api.patch<AreaTaskRow>(`/area-tasks/${current.id}/`, { drive_files: ids })
      apply(r.data)
      setPickerOpen(false)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLinking(false)
    }
  }

  const unlinkFile = async (fileId: number) => {
    if (!current || unlinkingId !== null) return
    setUnlinkingId(fileId)
    try {
      const ids = visibleIds(current).filter((id) => id !== fileId)
      const r = await api.patch<AreaTaskRow>(`/area-tasks/${current.id}/`, { drive_files: ids })
      apply(r.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setUnlinkingId(null)
    }
  }

  return (
    <>
      <AreaTaskDrawer
        open={Boolean(task)}
        task={current}
        tab={tab}
        comments={comments}
        commentsLoading={commentsLoading}
        newComment={newComment}
        sendingComment={sendingComment}
        canLinkFiles={hasPerm('drive.view_drivefile')}
        unlinkingId={unlinkingId}
        onClose={onClose}
        onEdit={() => { void openEdit() }}
        onDelete={() => setConfirmDelete(true)}
        onTabChange={setTab}
        onNewCommentChange={setNewComment}
        onSendComment={() => { void sendComment() }}
        onLinkFiles={() => setPickerOpen(true)}
        onUnlinkFile={(id) => { void unlinkFile(id) }}
      />
      <AreaTaskDialog
        open={editOpen}
        task={current}
        areaLabel={current?.area_label ?? ''}
        form={form}
        users={users}
        saving={saving}
        errors={errors}
        onFormChange={setForm}
        onSave={() => { void save() }}
        onClose={() => setEditOpen(false)}
      />
      <DriveFilePickerDialog
        open={pickerOpen}
        excludeIds={current ? visibleIds(current) : []}
        busy={linking}
        onClose={() => setPickerOpen(false)}
        onConfirm={(files) => { void linkFiles(files) }}
      />
      <ConfirmDeleteDialog
        open={confirmDelete}
        busy={deleting}
        title="Eliminare il task?"
        description={`Il task «${current?.title ?? ''}» verrà spostato nel cestino.`}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { void remove() }}
      />
    </>
  )
}
```

- [ ] **Step 4: Verificare**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/features/areatasks && npx tsc -b --force && npm run lint 2>&1 | tail -3
```

Atteso: tutti i test di `areatasks` PASS, `tsc` pulito, lint non oltre 27. Dettagli attesi dal test: nel test "edits the task" il PATCH ha `assigned_to: null` e `priority: 'medium'` perché il form parte dai valori del task (`baseTask`) e cambia solo il titolo.

- [ ] **Step 5: Checkpoint**

```bash
cd /home/fede/inventory-app && git status --short
```

---

### Task 6: Widget `AreaTaskCard`

**Files:**
- Modify (riscrittura completa): `frontend/src/ui/AreaTaskCard.tsx`
- Test: `frontend/src/ui/AreaTaskCard.test.tsx`

**Interfaces:**
- Consumes: `AreaTaskDetail` (Task 5), tipi/`STATUS_*`/`PRIORITY_META` (Task 2).
- Produces: stesso `default export function AreaTaskCard()` senza props. Comportamento: elenco raggruppato per stato (4 gruppi, incluso "In attesa"); aggiunta rapida (titolo + scadenza) invariata; il click sul titolo di un task apre `AreaTaskDetail`; l'icona di stato cicla `da_fare → in_corso → completato → da_fare` (salta "In attesa", che si imposta dal dialog); l'icona cestino elimina come prima. Ogni riga mostra: chip priorità solo per `high`/`critical`, iniziali dell'assegnatario, conteggio commenti e allegati se > 0, chip scadenza. L'evento `window.dispatchEvent(new Event('area-task-changed'))` continua a partire dopo ogni modifica, come oggi (lo ascolta la campanella delle scadenze).

- [ ] **Step 1: Scrivere il test (fallisce)**

Creare `frontend/src/ui/AreaTaskCard.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaTaskCard from './AreaTaskCard'
import type { AreaTaskRow } from '../features/areatasks/types'

const apiGet = vi.fn()
const apiPost = vi.fn()
const apiPatch = vi.fn()
const apiDelete = vi.fn()
vi.mock('@shared/api/client', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    delete: (...a: unknown[]) => apiDelete(...a),
  },
}))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Errore' }))
const toast = { error: vi.fn(), success: vi.fn() }
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    me: { id: 1, is_superuser: false, profile: { leave_area: 3, leave_area_label: 'Ufficio' } },
    hasPerm: () => true,
    inGroup: () => true,
  }),
}))
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

const tasks = [
  row({ id: 1, title: 'Da fare uno', status: 'da_fare' }),
  row({ id: 2, title: 'Bloccato', status: 'in_attesa', priority: 'critical', assigned_to_name: 'Anna Rossi', comments_count: 2 }),
  row({ id: 3, title: 'Finito', status: 'completato' }),
]

beforeEach(() => {
  ;[apiGet, apiPost, apiPatch, apiDelete].forEach((m) => m.mockReset())
  apiGet.mockImplementation((url: string) => {
    if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }] } })
    if (url === '/area-tasks/') return Promise.resolve({ data: { results: tasks } })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
})

describe('AreaTaskCard', () => {
  it('groups tasks by the four statuses, including "In attesa"', async () => {
    render(<AreaTaskCard />)
    expect(await screen.findByText('Bloccato')).toBeInTheDocument()
    expect(screen.getByText('In attesa')).toBeInTheDocument()
    expect(screen.getByText('Completato')).toBeInTheDocument()
  })

  it('shows priority, assignee initials and comment count for a task', async () => {
    render(<AreaTaskCard />)
    await screen.findByText('Bloccato')
    expect(screen.getByText('Critica')).toBeInTheDocument()
    expect(screen.getByText('AR')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('opens the detail when a task title is clicked', async () => {
    render(<AreaTaskCard />)
    fireEvent.click(await screen.findByText('Da fare uno'))
    expect(await screen.findByTestId('detail')).toHaveTextContent('Da fare uno')
  })

  it('cycles da_fare to in_corso from the status icon and skips in_attesa', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    render(<AreaTaskCard />)
    await screen.findByText('Da fare uno')
    fireEvent.click(screen.getAllByLabelText('Cambia stato')[0]!)
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/area-tasks/1/', { status: 'in_corso' }))
  })

  it('creates a task quickly with title and due date', async () => {
    apiPost.mockResolvedValue({ data: row({ id: 9, title: 'Nuovo' }) })
    render(<AreaTaskCard />)
    const input = await screen.findByPlaceholderText(/Aggiungi un task/)
    fireEvent.change(input, { target: { value: 'Nuovo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/area-tasks/', expect.objectContaining({ title: 'Nuovo', area: 3 })))
    expect(await screen.findByText('Nuovo')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Verificare che fallisca**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/ui/AreaTaskCard.test.tsx
```

Atteso: FAIL (non c'è il gruppo "In attesa", né `aria-label="Cambia stato"`, né il dettaglio).

- [ ] **Step 3: Riscrivere `AreaTaskCard.tsx`**

Sostituire l'intero contenuto di `frontend/src/ui/AreaTaskCard.tsx` con:

```tsx
import * as React from 'react'
import {
  Avatar, Box, Card, Chip, Divider, IconButton, InputBase, MenuItem, Select,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded'
import PauseCircleOutlineRoundedIcon from '@mui/icons-material/PauseCircleOutlineRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../auth/AuthProvider'
import AreaTaskDetail from '../features/areatasks/AreaTaskDetail'
import {
  PRIORITY_META, STATUS_META, STATUS_ORDER, personInitials,
  type AreaTaskRow, type TaskStatus,
} from '../features/areatasks/types'

type AreaOption = { id: number; label: string }

// Ciclo rapido dall'icona di stato: "In attesa" si imposta dal dialog di modifica.
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  da_fare: 'in_corso',
  in_corso: 'completato',
  in_attesa: 'in_corso',
  completato: 'da_fare',
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'completato') return <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
  if (status === 'in_corso') return <PlayCircleOutlineRoundedIcon sx={{ fontSize: 18, color: 'warning.main' }} />
  if (status === 'in_attesa') return <PauseCircleOutlineRoundedIcon sx={{ fontSize: 18, color: 'info.main' }} />
  return <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
}

function dueChip(due_date: string | null) {
  if (!due_date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(due_date + 'T00:00:00')
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  const label =
    days < 0 ? `${Math.abs(days)}gg fa`
    : days === 0 ? 'Oggi'
    : days === 1 ? 'Domani'
    : due.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  const color = days < 0 ? 'error' : days <= 1 ? 'warning' : 'default'
  return (
    <Chip
      size="small"
      label={label}
      color={color as 'error' | 'warning' | 'default'}
      variant={days <= 1 ? 'filled' : 'outlined'}
      sx={{ fontSize: '0.68rem', height: 20 }}
    />
  )
}

export default function AreaTaskCard() {
  const { me } = useAuth()
  const toast = useToast()

  const myAreaId = me?.profile?.leave_area ?? null
  const myAreaLabel = me?.profile?.leave_area_label ?? null

  const [areas, setAreas] = React.useState<AreaOption[]>([])
  const [selectedArea, setSelectedArea] = React.useState<number | null>(null)
  const [tasks, setTasks] = React.useState<AreaTaskRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [input, setInput] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [openId, setOpenId] = React.useState<number | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    api.get<{ results: AreaOption[] } | AreaOption[]>('/leave-areas/', { params: { page_size: 100 } })
      .then((r) => setAreas(Array.isArray(r.data) ? r.data : r.data.results))
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    if (myAreaId && selectedArea === null) setSelectedArea(myAreaId)
  }, [myAreaId, selectedArea])

  const load = React.useCallback((areaId: number | null) => {
    if (!areaId) { setTasks([]); setLoading(false); return }
    setLoading(true)
    api.get<{ results: AreaTaskRow[] } | AreaTaskRow[]>('/area-tasks/', { params: { area: areaId, page_size: 100 } })
      .then((r) => setTasks(Array.isArray(r.data) ? r.data : r.data.results))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load(selectedArea) }, [selectedArea, load])

  const notify = () => window.dispatchEvent(new Event('area-task-changed'))

  const isOwnArea = selectedArea !== null && selectedArea === myAreaId
  const isSuperuser = Boolean(me?.is_superuser)
  const readOnly = !isOwnArea && !isSuperuser

  const addTask = async () => {
    const title = input.trim()
    if (!title || saving || readOnly) return
    setSaving(true)
    try {
      const r = await api.post<AreaTaskRow>('/area-tasks/', {
        title,
        due_date: dueDate || null,
        // Rilevante solo per i superuser (possono creare in un'area diversa
        // dalla propria): per gli utenti normali il backend forza la propria area.
        area: selectedArea ?? undefined,
      })
      setTasks((prev) => [r.data, ...prev])
      setInput('')
      setDueDate('')
      inputRef.current?.focus()
      notify()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const cycleStatus = async (task: AreaTaskRow) => {
    if (readOnly || !task.can_edit) return
    const nextStatus = NEXT_STATUS[task.status]
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    try {
      await api.patch(`/area-tasks/${task.id}/`, { status: nextStatus })
      notify()
    } catch (e) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)))
      toast.error(apiErrorToMessage(e))
    }
  }

  const deleteTask = async (id: number) => {
    if (readOnly) return
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try { await api.delete(`/area-tasks/${id}/`); notify() }
    catch (e) { toast.error(apiErrorToMessage(e)); load(selectedArea) }
  }

  const grouped = STATUS_ORDER.map((status) => ({ status, items: tasks.filter((t) => t.status === status) }))
  const openTask = tasks.find((t) => t.id === openId) ?? null

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{
        px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <GroupsRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700} noWrap>Task di area</Typography>
        </Stack>
        <Select
          size="small"
          value={selectedArea ?? ''}
          onChange={(e) => setSelectedArea(e.target.value ? Number(e.target.value) : null)}
          displayEmpty
          sx={{ fontSize: '0.78rem', minWidth: 140, '& .MuiSelect-select': { py: 0.5 } }}
        >
          {areas.map((a) => (
            <MenuItem key={a.id} value={a.id} sx={{ fontSize: '0.82rem' }}>
              {a.label}{a.id === myAreaId ? ' (mia)' : ''}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {readOnly && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.disabled">Sola lettura — non fai parte di quest'area</Typography>
        </Box>
      )}

      {!myAreaId && !isSuperuser && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'warning.light', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'warning.dark' }}>
            Nessuna area assegnata al tuo profilo: contatta un amministratore per poter creare task.
          </Typography>
        </Box>
      )}

      {!readOnly && (
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 0.75,
          borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover',
        }}>
          <InputBase
            inputRef={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addTask() }}
            placeholder={`Aggiungi un task per ${isOwnArea ? (myAreaLabel ?? 'la tua area') : (areas.find((a) => a.id === selectedArea)?.label ?? 'quest\'area')}...`}
            sx={{ flex: 1, fontSize: '0.82rem', color: 'text.primary' }}
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            type="date" size="small" value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150, '& input': { fontSize: '0.78rem', py: 0.5 } }}
          />
          <IconButton size="small" onClick={() => void addTask()} disabled={!input.trim() || saving} sx={{ color: 'primary.main' }}>
            <AddRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">Caricamento...</Typography>
          </Box>
        ) : tasks.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <GroupsRoundedIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="caption" color="text.disabled" display="block">
              {selectedArea ? 'Nessun task per quest\'area' : 'Seleziona un\'area'}
            </Typography>
          </Box>
        ) : (
          <Stack>
            {grouped.map(({ status, items }, gi) => (
              items.length === 0 ? null : (
                <Box key={status}>
                  {gi > 0 && (
                    <Box sx={{ px: 2, py: 0.5, bgcolor: 'action.hover', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {STATUS_META[status].label}
                      </Typography>
                    </Box>
                  )}
                  {items.map((task, i) => (
                    <Box key={task.id}>
                      <TaskRow
                        task={task}
                        readOnly={readOnly}
                        onCycle={cycleStatus}
                        onDelete={deleteTask}
                        onOpen={(t) => setOpenId(t.id)}
                      />
                      {i < items.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              )
            ))}
          </Stack>
        )}
      </Box>

      <AreaTaskDetail
        task={openTask}
        onClose={() => setOpenId(null)}
        onChanged={(next) => { setTasks((prev) => prev.map((t) => (t.id === next.id ? next : t))); notify() }}
        onDeleted={(id) => { setTasks((prev) => prev.filter((t) => t.id !== id)); notify() }}
      />
    </Card>
  )
}

function TaskRow({
  task, readOnly, onCycle, onDelete, onOpen,
}: {
  task: AreaTaskRow
  readOnly: boolean
  onCycle: (t: AreaTaskRow) => void
  onDelete: (id: number) => void
  onOpen: (t: AreaTaskRow) => void
}) {
  const canAct = !readOnly && task.can_edit
  const showPriority = task.priority === 'high' || task.priority === 'critical'
  const filesCount = task.drive_files_detail.length
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{
        px: 2, py: 1,
        '&:hover .task-actions': { opacity: canAct ? 1 : 0 },
        transition: 'background 0.12s',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Tooltip title={canAct ? `Segna come "${STATUS_META[NEXT_STATUS[task.status]].label}"` : ''}>
        <Box
          role="button"
          aria-label="Cambia stato"
          onClick={() => onCycle(task)}
          sx={{ cursor: canAct ? 'pointer' : 'default', display: 'flex', flexShrink: 0 }}
        >
          <StatusIcon status={task.status} />
        </Box>
      </Tooltip>

      <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onOpen(task)}>
        <Typography
          variant="body2"
          noWrap
          sx={{
            fontWeight: 600, fontSize: '0.82rem',
            textDecoration: task.status === 'completato' ? 'line-through' : 'none',
            color: task.status === 'completato' ? 'text.disabled' : 'text.primary',
          }}
        >
          {task.title}
        </Typography>
        {task.description ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }} noWrap display="block">
            {task.description}
          </Typography>
        ) : null}
      </Box>

      {showPriority ? (
        <Chip
          size="small"
          label={PRIORITY_META[task.priority].label}
          color={task.priority === 'critical' ? 'error' : 'warning'}
          sx={{ fontSize: '0.66rem', height: 18 }}
        />
      ) : null}
      {task.comments_count > 0 ? (
        <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: 'text.disabled' }}>
          <ChatBubbleOutlineIcon sx={{ fontSize: 13 }} />
          <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{task.comments_count}</Typography>
        </Stack>
      ) : null}
      {filesCount > 0 ? (
        <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: 'text.disabled' }}>
          <AttachFileIcon sx={{ fontSize: 13 }} />
          <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{filesCount}</Typography>
        </Stack>
      ) : null}
      {task.assigned_to_name ? (
        <Tooltip title={task.assigned_to_name}>
          <Avatar sx={{ width: 20, height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'primary.main' }}>
            {personInitials(task.assigned_to_name)}
          </Avatar>
        </Tooltip>
      ) : null}

      {dueChip(task.due_date)}

      {canAct && (
        <Stack direction="row" className="task-actions" sx={{ opacity: 0, transition: 'opacity 0.12s' }}>
          <IconButton
            size="small"
            aria-label="Elimina task"
            onClick={() => onDelete(task.id)}
            sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
          >
            <DeleteRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Stack>
      )}
    </Stack>
  )
}
```

- [ ] **Step 4: Verificare**

```bash
cd /home/fede/inventory-app/frontend && npx vitest run src/ui/AreaTaskCard.test.tsx src/features/areatasks && npx tsc -b --force && npm run lint 2>&1 | tail -3
```

Atteso: tutti PASS, `tsc` pulito, lint non oltre 27. Nota sul test "cycles": il primo elemento `Cambia stato` è del task `Da fare uno` (id 1, `da_fare`), quindi il PATCH atteso è `{ status: 'in_corso' }`.

- [ ] **Step 5: Checkpoint**

```bash
cd /home/fede/inventory-app && git status --short
```

---

### Task 7: Verifica finale, changelog e prova nel browser

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Changelog**

In `CHANGELOG.md`, sotto `## [Unreleased]`, nella sezione `### Added` (dopo l'ultima voce) aggiungere:

```markdown
- Il widget "Task di area" della dashboard apre ora un drawer di dettaglio con commenti e allegati collegati da Drive, e un dialog di modifica con assegnatario (utenti della stessa area), priorità, stato "In attesa" e scadenza. Ogni riga mostra priorità alta/critica, assegnatario, commenti e allegati.
- L'elenco utenti può essere filtrato per area (`/api/users/?leave_area=`) e riporta l'area di ciascun utente.
```

- [ ] **Step 2: Catena di verifica frontend**

```bash
cd /home/fede/inventory-app/frontend
npx tsc -b --force
npm run build
npm run lint 2>&1 | tail -3
npx vitest run 2>&1 | grep -E "Test Files|Tests "
```

Atteso: `tsc` e `build` senza errori; lint **non oltre 27 problemi**, 0 errori; vitest `62 + i nuovi test` tutti passati (i nuovi sono 8 + 4 + 8 + 5 = 25, quindi 87 in totale, salvo test aggiunti o rimossi: riportare i numeri reali).

- [ ] **Step 3: Verifica backend**

```bash
cd /home/fede/inventory-app
DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
$DC exec backend pytest core/tests -q
$DC exec backend python manage.py check
$DC exec backend python manage.py makemigrations --check --dry-run
```

Atteso: tutto verde, `no issues`, `No changes detected`.

- [ ] **Step 4: Ricostruire e provare la UI**

```bash
$DC up -d --build backend cron frontend
$DC ps --format '{{.Service}} {{.State}} {{.Health}}' | grep -E "backend|cron|frontend"
```

Poi, in browser su `archie` dev con un utente che ha un'area: aprire la dashboard, cliccare il titolo di un task, verificare drawer (tre tab), scrivere un commento, aprire "Modifica" e cambiare assegnatario/priorità/stato "In attesa", collegare e scollegare un file Drive, provare l'icona di stato (ciclo che salta "In attesa"), provare con un utente di un'altra area (sola lettura: niente Modifica/Collega). Chi esegue il piano senza browser lo dichiara nel report invece di dire che la UI è verificata.

- [ ] **Step 5: Checkpoint finale**

```bash
git status --short && git diff --stat
```

Atteso: modificati `CHANGELOG.md`, `backend/core/api.py`, `frontend/src/ui/AreaTaskCard.tsx`; nuovi `backend/core/tests/test_users_list_area.py` e i file di `frontend/src/features/areatasks/` e `frontend/src/ui/AreaTaskCard.test.tsx`. Riferire i risultati a Fede e chiedere se vuole il commit.

---

## Self-Review (spec → task)

| Requisito della spec (fase 2) | Task |
|---|---|
| Drawer sul modello di `IssueDrawer`, tab Dettagli/Commenti/Allegati | 4, 5 |
| Tab Attività (audit) | Non incluso: rimandato alla fase 2b (serve il componente audit già presente, da valutare lì) |
| Dialog crea/modifica sul modello di `IssueDialog` | 4 (supporta anche `task = null` per la creazione, usata in 2b), 5 (modifica) |
| Selettore Drive con navigazione, collega/scollega | 3, 5 |
| Assegnabili solo dell'area del task | 1, 5 |
| Widget dashboard compatto, click apre il drawer | 6 |
| Pagina elenco `/tasks` con filtri, ricerca, cestino/restore, link "Vedi tutti" | Fuori da questo piano: fase 2b |
| Voce di menu e route, `npm run gen:api` | Fuori: fase 2b. `generated.ts` non contiene `area-tasks`, quindi i tipi sono scritti a mano (Task 2) |
| Stato "In attesa" e priorità visibili | 2, 4, 6 |
| `useTheme()` e nessun import statico del tema | Global Constraints; nessun componente importa il tema |
| Verifica: tsc, build, lint (baseline), vitest, prova nel browser | 7 |

Nomi e firme coerenti tra i task: `AreaTaskRow`, `AreaTaskComment`, `TaskDriveFile`, `AreaUser`, `TaskFormData`, `STATUS_ORDER/META`, `PRIORITY_ORDER/META`, `formToPayload`, `taskToForm`, `extractFieldErrors`, `formatBytes`, `personInitials` sono definiti nel Task 2 e usati con gli stessi nomi nei Task 3-6. Le props di `AreaTaskDrawer`/`AreaTaskDialog` (Task 4) coincidono con come le usa `AreaTaskDetail` (Task 5).
