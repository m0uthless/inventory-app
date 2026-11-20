# Issue per area — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** le issue possono avere un'area (facoltativa); chi non è dell'area le vede in sola lettura, l'assegnatario è un membro dell'area, il contatore in barra laterale conta la propria area più le issue senza area.

**Architecture:** FK facoltativa `Issue.area` → `attendance.LeaveArea`. Un controllo unico `_check_issue_area(issue)` nella `IssueViewSet` protegge ogni scrittura, come `_check_own_area` dei task in `core/api.py`. Il serializer espone `area_label` e `can_edit`; l'interfaccia legge `can_edit` per passare in sola lettura.

**Tech Stack:** Django 5 + DRF, pytest; React 19 + TS + MUI, vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-issue-area-assignee-groups-design.md` (Parte 2). **Prerequisito:** piano `2026-11-19-assignees-by-group.md` completato (usa `is_eligible_issue_assignee` e `is_issue_assignee`).

## Global Constraints

- `Issue.area`: `ForeignKey("attendance.LeaveArea", null=True, blank=True, on_delete=SET_NULL, related_name="issues")`, indice; nessuna migrazione di dati.
- Issue senza area: modificabile da chiunque abbia i permessi delle issue (come oggi).
- Issue con area: scrivono solo i membri dell'area (`UserProfile.leave_area`) o il superuser; vale per modifica, stato, eliminazione, ripristino, commenti (creazione, modifica, eliminazione), collegamenti Wiki. Messaggio 403: «Puoi modificare solo le issue della tua area.»
- La regola d'area si valuta sull'area **attuale** della issue (prima della modifica): chi la sposta altrove poi non la modifica più.
- Creazione: area libera (anche un'altra area); il frontend propone quella del profilo.
- Assegnatario: se c'è un'area, membro di quell'area **e** assegnatario issue; senza area, qualunque assegnatario issue. Superuser che scrive: esente dal controllo d'area sull'assegnatario. Se né `area` né `assigned_to` sono nel payload, nessun ricontrollo.
- Messaggio di validazione: «L'assegnatario deve far parte dell'area «<label>».»
- Conversione task→issue: la issue prende l'area del task.
- Contatore barra laterale: `GET /issues/summary/?area=mine` = issue della propria area + senza area; utente senza area → conteggio complessivo. Senza parametro il riepilogo resta globale.
- Comandi backend e baseline come nel piano precedente.

## Review Focus

1. Commento POST su una issue di un'altra area → 403 (non solo PATCH). → test Task 2.
2. Bulk restore / restore di una issue di un'altra area → 403. → test Task 2.
3. Spostare l'area senza toccare l'assegnatario, con assegnatario fuori dalla nuova area → 400 su `assigned_to`. → test Task 1.
4. Area cancellata (soft delete del lookup) con issue collegate: la issue resta leggibile e `area_label` non esplode. → test Task 1.
5. Utente senza area nel profilo che apre una issue con area: sola lettura, nessuna eccezione su `profile` mancante. → test Task 2.

---

### Task 1: Modello, serializer, filtro

**Files:**
- Modify: `backend/issues/models.py`, `backend/issues/api.py` (`IssueSerializer` ~68-280, `IssueFilter` ~284)
- Create: `backend/issues/migrations/0010_issue_area.py`
- Test: Create `backend/issues/tests/test_issue_area.py`

**Interfaces:**
- Produces: campi API `area` (id, scrivibile), `area_label` (sola lettura), `can_edit` (bool, sola lettura); filtro `?area=<id>`; helper modulo `issues.api.user_area_id(user) -> int | None` e `issues.api.can_edit_issue(user, issue) -> bool` (riusati da Task 2 e dal serializer).

- [ ] **Step 1: Test che falliscono** in `test_issue_area.py`: `test_create_with_area`, `test_area_label_and_can_edit_for_member`, `test_can_edit_false_for_other_area`, `test_can_edit_true_without_area`, `test_assignee_must_belong_to_area` (400), `test_assignee_without_area_any_assignee`, `test_changing_area_rejects_assignee_from_other_area` (Review 3), `test_patch_untouched_area_and_assignee_skips_check`, `test_filter_by_area`, `test_deleted_area_keeps_issue_readable` (Review 4).
- [ ] **Step 2:** lanciarli → FAIL.
- [ ] **Step 3:** campo, `makemigrations issues`, serializer (`area_label` da `area.label`, `can_edit` via `can_edit_issue`), validazione assegnatario in `validate()` accanto a quella del Task 2 del piano precedente, filtro `area` nel `IssueFilter`.
- [ ] **Step 4:** test → PASS; `pytest -q issues` tutto verde.
- [ ] **Step 5: Commit** `feat(issue): area facoltativa e assegnatario dell'area`.

### Task 2: Sola lettura per le altre aree, riepilogo, conversione

**Files:**
- Modify: `backend/issues/api.py` (`IssueViewSet`: `perform_update`, `perform_destroy`, `restore`/`bulk_restore` se presenti, `comments` POST, `comment_detail`, `wiki` POST, `wiki_detail`, `summary`), `backend/core/api.py` (`convert-to-issue`)
- Test: `backend/issues/tests/test_issue_area.py`, `backend/core/tests/test_area_task_convert.py`

**Interfaces:**
- Consumes: `user_area_id`, `can_edit_issue` (Task 1).
- Produces: `IssueViewSet._check_issue_area(self, issue) -> None` (solleva `PermissionDenied`).

- [ ] **Step 1: Test che falliscono:** `test_other_area_cannot_patch`, `test_other_area_cannot_delete`, `test_other_area_cannot_restore` (Review 2), `test_other_area_cannot_comment` (Review 1), `test_other_area_cannot_edit_comment`, `test_other_area_cannot_link_wiki`, `test_member_can_move_issue_to_other_area_then_cannot_edit`, `test_user_without_area_reads_but_cannot_edit` (Review 5), `test_superuser_can_edit_any_area`; `test_summary_area_mine_counts_own_and_unassigned` (issue attive: 2 propria area, 1 senza area, 3 altra area → `active_count == 3`), `test_summary_area_mine_without_profile_area_is_global`, `test_summary_without_param_is_global`; in `test_area_task_convert.py` `test_convert_copies_area`.
- [ ] **Step 2:** lanciarli → FAIL.
- [ ] **Step 3:** implementare `_check_issue_area` e chiamarlo in ogni scrittura su una issue esistente (prima del salvataggio, sull'istanza dal DB); `summary` applica `Q(area_id=uid) | Q(area__isnull=True)` a tutte le aggregazioni quando `area=mine` e l'utente ha un'area; la conversione imposta `area=task.area`.
- [ ] **Step 4:** `pytest -q` intero → PASS; `check`, `makemigrations --check --dry-run` puliti.
- [ ] **Step 5: Commit** `feat(issue): sola lettura per le altre aree, contatore per area`.

### Task 3: Frontend

**Files:**
- Modify: `frontend/src/api/generated.ts` (rigenerato), `frontend/src/features/issues/types.ts` (`area`, `area_label`, `can_edit`), `frontend/src/features/issues/IssueDialog.tsx` (campo Area; elenco assegnatari filtrato), `frontend/src/features/issues/IssueDetail.tsx` (sola lettura quando `!can_edit`), `frontend/src/pages/Issues.tsx` (colonna e filtro Area, vista `myarea`, menu contestuale, caricamento aree da `/leave-areas/`), `frontend/src/layout/AppLayout.tsx` (~227 `'/issues/summary/', { params: { area: 'mine' } }`)
- Test: `frontend/src/features/issues/IssueDetail.test.tsx`, Create `frontend/src/features/issues/IssueDialog.test.tsx`

**Interfaces:**
- Consumes: campi API di Task 1, `UserOption` con `leave_area` (già esposto da `/api/users/`) e `is_issue_assignee`.
- Produces: helper puro `assigneesForArea(users: UserOption[], areaId: number | '') : UserOption[]` in `features/issues/types.ts` (o file accanto), usato da dialog e dettaglio.

- [ ] **Step 1: Test che falliscono:** `assigneesForArea` filtra per `leave_area` quando l'area è impostata e restituisce tutti senza area; `IssueDialog` nuova issue: area precompilata con `me.profile.leave_area`; cambiare area con un assegnatario fuori area lo svuota e mostra l'avviso «L'assegnatario non fa parte della nuova area: scegline un altro.»; `IssueDetail` con `can_edit: false`: niente pulsanti di stato, niente «Modifica», niente casella commento, e la riga «Issue dell'area <label>: puoi solo consultarla.»
- [ ] **Step 2:** `npx vitest run src/features/issues` → FAIL.
- [ ] **Step 3:** implementare. In `Issues.tsx`: vista `{ key: 'myarea', label: 'La mia area' }` (parametro `area=<me.profile.leave_area>`; nascosta se l'utente non ha area), colonna «Area» con `area_label`, filtro colonna «Area» sulle aree; menu contestuale: per `!row.can_edit` solo «Apri». `AppLayout` passa `area: 'mine'`.
- [ ] **Step 4:** catena: `npx tsc -b --force` → `npm run build` → `npm run lint` (5) → `npx vitest run` (tutti PASS).
- [ ] **Step 5: Commit** `feat(issue): area nell'interfaccia, sola lettura e vista La mia area`.

### Task 4: Rilascio in dev e changelog

- [ ] **Step 1:** `CHANGELOG.md` `## [Unreleased]` → `Added`: area sulle issue, sola lettura per le altre aree, vista «La mia area», contatore per area; migrazione `issues.0010` da lanciare a mano in produzione.
- [ ] **Step 2:** `$DC up -d --build backend cron frontend`, `showmigrations issues`, `make health`.
- [ ] **Step 3: Commit** `docs(changelog): issue per area`.
