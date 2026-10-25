# Chiudere i punti aperti sui task di area

## Contesto

Il lavoro "task di area → gestione come le issue" è su `develop` in 5 commit non pushati né rilasciati (più uno precedente sulle email). Restano aperti:

1. Una decisione mai presa: **chi può ripristinare un task eliminato**. Oggi la action `restore`/`bulk_restore` richiede il permesso Django `core.change_areatask`, che nessun gruppo ha — solo i superuser possono ripristinare, anche se è già nella propria area.
2. Tre funzionalità discusse ma non approvate in via definitiva: **menu contestuale**, **contatore personale in sidebar**, **trasformare un task in issue**.
3. Attività che restano fuori dalla mia portata e che il piano non chiude: verifica manuale nel browser (nessun agente ha un browser reale), mascotte Canva dei due template email, `release-save`/`release-push`.

Ho verificato il codice reale (non mi fido della memoria di un mese fa): working tree pulito, nessuna modifica pendente, `develop` è 6 commit avanti rispetto a `origin/develop`.

## Decisione presa (mi è stato chiesto di decidere io)

**Chi può ripristinare un task:** stessa regola di creazione/modifica/eliminazione — un membro della propria area (o un superuser), **senza bisogno di un permesso Django**. Oggi `AreaTaskViewSet` già vincola `_restore_obj`/`_get_scoped_trash_queryset` all'area dell'utente; l'unico blocco in più è `CanRestoreModelPermission`, che richiede `core.change_areatask` — permesso che nessun gruppo ha mai avuto e che è incoerente con come già funzionano create/update (nessun permesso Django, solo uguaglianza di area). Lo tolgo.

## 1 — Permesso di restore (bounded, backend)

**File:** `backend/core/api.py` (`AreaTaskViewSet.get_permissions`)

Sostituire l'attuale:
```python
def get_permissions(self):
    perms = super().get_permissions()
    if self.action in ('restore', 'bulk_restore'):
        perms.append(IsInternalOrPortalDedicatedApp())
    return perms
```
con:
```python
def get_permissions(self):
    if self.action in ('restore', 'bulk_restore'):
        # L'autorizzazione è per-area (_check_own_area / _get_scoped_trash_queryset),
        # non un permesso Django: CanRestoreModelPermission richiederebbe
        # core.change_areatask, che nessun gruppo ha mai avuto.
        return [IsAuthenticated(), IsInternalOrPortalDedicatedApp()]
    return super().get_permissions()
```

**Test** (`backend/core/tests/test_area_tasks_api.py`): riscrivere `test_restore_requires_change_permission_and_own_area` e `test_bulk_restore_without_change_permission_403` per affermare che un utente SENZA alcun permesso Django ma nella propria area ottiene 204/200, mentre un utente di un'altra area resta 403 (con o senza permesso). La barriera Portal resta testata da `test_restore_and_bulk_restore_blocked_for_portal_session` (nessuna modifica necessaria lì). Il helper `_grant_change` diventa inutile e va rimosso se non più referenziato.

## 2 — Menu contestuale su `/tasks` (bounded, frontend)

**File:** `frontend/src/pages/AreaTasks.tsx`

Riuso diretto di `RowContextMenu`/`RowContextMenuItem` (`@shared/ui/RowContextMenu`, già usato in `pages/Issues.tsx`): stato locale `contextMenu`, `onRowContextMenu` sulla griglia, voci costruite da `contextMenuItems`:
- Apri dettaglio → `setOpenTask(row)`
- Modifica → apre `AreaTaskDialog` in modifica (serve un piccolo refactor: oggi `openCreate`/`saveCreate` gestiscono solo la creazione; estendo lo stesso stato con un `editingTask: AreaTaskRow | null` per riusare `AreaTaskDialog` anche in modifica dalla lista, popolando il form con `taskToForm(row)`)
- Commenta → apre il drawer sulla tab Commenti (serve passare una tab iniziale ad `AreaTaskDetail`/`AreaTaskDrawer`, oggi parte sempre da 0 — piccola estensione prop `initialTab?`)
- Segna come [prossimo stato] → stesso ciclo di `NEXT_STATUS` già nel widget (`ui/AreaTaskCard.tsx`), con PATCH e reload
- Trasforma in issue → apre `ConvertToIssueDialog` (punto 4), nascosta se `row.converted_to_issue` è già impostato o l'utente non ha `issues.add_issue`
- Elimina → riusa `ConfirmDeleteDialog` già presente nella pagina

Disabilitate/nascoste secondo `row.can_edit`, esattamente come già fa `Issues.tsx`.

## 3 — Contatore personale in sidebar (bounded, full-stack)

**Backend — `backend/core/api.py`:** nuova azione `GET /area-tasks/summary/` su `AreaTaskViewSet`, sullo stesso modello di `IssueViewSet.summary` (`backend/issues/api.py:461`) ma minimale:
```python
@action(detail=False, methods=['get'], url_path='summary')
def summary(self, request):
    mine_open = AreaTask.objects.filter(
        assigned_to=request.user, deleted_at__isnull=True,
    ).exclude(status=AreaTask.STATUS_COMPLETATO).count()
    return Response({'mine_open_count': mine_open})
```

**Frontend — `frontend/src/layout/AppLayout.tsx`:** stesso pattern di `issueSummary` (fetch + `setInterval(60_000)`), nuovo stato `taskSummary`, reuso di `renderIssueCount` (già generico, `layout/NavCountChip.tsx`) sulla voce `/tasks`:
```ts
it.path === '/tasks' ? renderIssueCount(taskSummary?.mine_open_count, SIDEBAR) : null
```
Nessun controllo di permesso (la pagina `/tasks` è `RequireAuth` senza permesso di modello, stesso trattamento del widget dashboard).

**Test:** nuovo test backend per `summary` (conta solo i propri task assegnati, esclude i completati, esclude gli altri utenti). Il wiring frontend in `AppLayout.tsx` non ha test oggi nemmeno per `issueSummary` (nessun file `AppLayout.test.tsx` esiste): verificato con build/vitest di regressione, non con un test dedicato — coerente con la pratica esistente.

## 4 — Trasformare un task in issue (full-stack, il pezzo più grande)

### Modello e migrazione
`backend/core/models.py`: nuovo campo su `AreaTask`
```python
converted_to_issue = models.ForeignKey(
    'issues.Issue', null=True, blank=True, on_delete=models.SET_NULL,
    related_name='converted_from_tasks', verbose_name='Convertito in issue',
)
```
Riferimento a stringa (`'issues.Issue'`), stesso pattern già usato per `drive_files = ManyToManyField('drive.DriveFile', ...)`: nessun import circolare, Django risolve a runtime. Nuova migrazione `core/migrations/0041_areatask_converted_to_issue.py`.

### Piccolo refactor in `backend/issues/api.py` (per riuso, non cambia comportamento)
Estrarre `_notify_issue_created` e `_notify_assignment_change` di `IssueViewSet` (righe 410-460 circa) in funzioni di modulo `notify_issue_created(user, issue)` e `notify_issue_assignment_change(user, *, old_assigned_to_id, issue)`, con gli stessi identici corpi (sostituendo `self.request.user` → `user`). `IssueViewSet._notify_issue_created`/`_notify_assignment_change` diventano wrapper che chiamano le funzioni passando `self.request.user` — comportamento identico, stessi test esistenti (`issues/tests/test_issue_notification_emails.py`) restano verdi senza modifiche. Questo permette alla nuova action di task di area di inviare le stesse email di una issue creata normalmente, senza duplicare la logica né istanziare un `IssueViewSet` al volo.

### Nuova azione su `AreaTaskViewSet` (`backend/core/api.py`)
```
POST /api/area-tasks/{id}/convert-to-issue/
body: {customer: <id>, site?: <id>, description?: <str>, title?: <str>, priority?: <str>}
```
- 403 se non `_check_own_area(task.area_id)` o se l'utente non ha `issues.add_issue`.
- 409 se `task.converted_to_issue_id` è già impostato.
- Dentro `transaction.atomic()`:
  - `IssueSerializer(data={... title: body.get('title', task.title), description: body.get('description', task.description), priority: task.priority, customer, site, assigned_to: task.assigned_to_id})` (import locale `from issues.api import IssueSerializer`, stesso pattern di import locale già usato altrove in `core/api.py`/`issues/api.py`), `is_valid(raise_exception=True)`, `issue = serializer.save(created_by=request.user)`.
  - `log_event(request.user, action="create", instance=issue, changes={"title": ...}, request=request)` — stessa riga di `IssueViewSet.perform_create`.
  - `notify_issue_created(request.user, issue)` + `notify_issue_assignment_change(request.user, old_assigned_to_id=None, issue=issue)`.
  - Copia i commenti: per ogni `AreaTaskComment` del task, `IssueComment.objects.create(issue=issue, author=comment.author, body=comment.body)` (il timestamp sarà quello della conversione, non quello originale — compromesso accettato, l'autorialità invece è preservata esattamente).
  - `task.status = AreaTask.STATUS_COMPLETATO`; `task.completed_at = timezone.now()`; `task.converted_to_issue = issue`; `task.save(...)`; `log_event(..., action="update", changes={"status": {...}, "converted_to_issue": {...}})`.
  - Risposta: `{task: AreaTaskSerializer(task, context=...).data, issue: {id, title}}`.

### Serializer (`AreaTaskSerializer`)
Aggiungere `converted_to_issue` (id, read-only) e `converted_to_issue_title` (read-only, `source='converted_to_issue.title'`) ai campi, per mostrare il badge in UI senza una richiesta aggiuntiva.

### Frontend
- `frontend/src/features/areatasks/types.ts`: estendere `AreaTaskRow` con `converted_to_issue: number | null` e `converted_to_issue_title: string | null`.
- Nuovo `frontend/src/features/areatasks/ConvertToIssueDialog.tsx`: dialog con autocomplete cliente (stesso debounce ~300ms già in `pages/Issues.tsx` per `custFormInput`/`custFormOptions`, ma componente proprio, non riuso di `IssueDialog` che è troppo accoppiato allo stato della pagina Issues), select sito opzionale (filtrato per cliente come già fa `Issues.tsx`), titolo/descrizione precompilati e modificabili, priorità precompilata (sola visualizzazione — resta quella del task). Niente campo inventory in questa dialog (fuori scope: si collega dopo, dalla pagina Issues, come già oggi per qualunque issue).
- Wiring in `AreaTaskDetail.tsx` (nuovo stato `convertOpen`, handler che chiama l'azione e poi `apply(response.task)` + `toast.success('Task trasformato in issue #' + response.issue.id + '.')`) e in `AreaTaskDrawer.tsx` (bottone "Trasforma in issue" nella tab Dettagli, nascosto se `can_edit` è falso o `converted_to_issue` è già impostato; badge/link "Convertito in issue #N" cliccabile — `RouterLink` a `/issues?open=N` — quando presente).
- Stesso bottone raggiungibile anche dal menu contestuale del punto 2.
- Gating: il bottone/voce menu è visibile solo con `hasPerm('issues.add_issue')` (stessa costante già in `auth/perms.ts`: `PERMS.issues.issue.add`).

### Test
- Backend (`backend/core/tests/test_area_task_convert.py`, nuovo file): conversione riuscita (issue creata con cliente giusto, commenti copiati con autore preservato, task completato e linkato, email inviate — verificabile su `mail.outbox` come negli altri test email); 403 senza `issues.add_issue`; 403 fuori dalla propria area; 409 se già convertito; 400 se cliente assente; verifica che `issues/tests/test_issue_notification_emails.py` continui a passare dopo il refactor del punto "piccolo refactor".
- Frontend: test del dialog (submit, validazione cliente obbligatorio), test di `AreaTaskDetail`/`AreaTaskDrawer` per la visibilità del bottone/badge e la chiamata API, aggiornamento dei fixture `AreaTaskRow` esistenti nei test già scritti (serve aggiungere i due nuovi campi a ogni fixture `row(...)` usata nei test, altrimenti TypeScript si lamenta).

## Changelog
Una voce sotto `## [Unreleased]` / `### Added` per ciascun pezzo (restore senza permesso Django non è changelog-worthy essendo un fix interno; menu contestuale, contatore, conversione in issue sì).

## Esecuzione

Eseguo con lo stesso metodo già usato in questa sessione per le fasi precedenti: piano scritto, poi `subagent-driven-development` — un subagente implementatore per pezzo (1. permesso restore, 2. menu contestuale, 3. contatore, 4a. backend conversione, 4b. frontend conversione), review spec+qualità dopo ciascuno, fix loop se necessario, review finale di tutto il lavoro. Nessun commit da parte mia finché non lo chiedi esplicitamente (come per le fasi precedenti): ogni pezzo finisce con uno snapshot di verifica (`git status`), non un commit.

## Cosa resta fuori da questo piano (non posso chiuderlo io)

- **Verifica manuale nel browser** di questo lavoro e di quello già fatto (nessun agente ha un browser reale in questa sessione).
- **Mascotte Canva** dei template `area_task_assigned.html`/`area_task_comment.html`.
- **`release-save`/`release-push`**: azioni che toccano `main`/produzione — mi fermo e chiedo conferma esplicita prima di eseguirle, anche dopo l'approvazione di questo piano.

## Verifica (per ogni pezzo, prima di considerarlo chiuso)

Backend: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest -q`, `manage.py check`, `makemigrations --check --dry-run`. Frontend: `npx tsc -b --force`, `npm run build`, `npm run lint` (baseline 27 problemi, 0 errori), `npx vitest run` (baseline 125 test). Ricostruzione dev (`COMPOSE_BAKE=false ... build frontend` + `up -d --no-build frontend`; `up -d --build backend cron`) a fine lavoro, con una verifica via API reale (come fatto per le fasi precedenti) per la conversione in issue.
