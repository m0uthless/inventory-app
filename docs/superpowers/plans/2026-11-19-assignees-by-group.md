# Assegnabili per gruppo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chi è tecnico ServiceNow e chi è assegnatario delle issue lo decidono due permessi distinti dati ai gruppi, non più il flag `UserProfile.is_servicenow_technician`.

**Architecture:** due permessi custom in `Meta.permissions` (compaiono da soli tra i permessi extra della pagina Gruppi). `core/technicians.py` diventa l'unico punto che traduce permesso → idoneità, con una coppia di funzioni per ciascun ruolo. Tutti i punti che leggevano il flag passano da lì. Il flag sparisce da modello, API utenti e interfaccia; Philips viene nascosto nella sezione Utenti con una costante frontend.

**Tech Stack:** Django 5 + DRF, pytest; React 19 + TS + MUI, vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-issue-area-assignee-groups-design.md` (Parte 1).

## Global Constraints

- Permessi: `servicenow.be_technician` «È tecnico ServiceNow» (su `ServiceNowCase`), `issues.be_assignee` «Può essere assegnatario delle issue» (su `Issue`).
- Nessuna migrazione di dati: al rilascio nessuno ha i permessi.
- Il superuser non è tecnico/assegnatario per il solo fatto di essere superuser (`include_superusers=False`).
- Tecnico = `servicenow.be_technician` **e** utente interno (accesso Archie, Philips o account funzionale). Assegnatario issue = `issues.be_assignee` **e** `core.access_archie`; niente esclusione Philips nel codice.
- Il campo calcolato `is_servicenow_technician` della lista utenti (`/api/users/`) conserva il nome; nuovo campo `is_issue_assignee`.
- Migrazioni solo nuove, mai modificare quelle applicate.
- Comandi backend sul working tree: `DC="docker compose -f docker-compose.yml -f docker-compose.dev.yml"` e `$DC run --rm --no-deps -v ./backend:/app --entrypoint "" backend <cmd>` (dalla radice del repo).
- Baseline frontend: lint 5 problemi, vitest 256 passati.

## Review Focus

1. Superuser senza gruppo: non deve comparire tra gli assegnatari né ricevere l'email «nuova issue». → test in Task 1.
2. Utente disattivato con il permesso: non assegnabile. → test in Task 1.
3. Cliente del Portal a cui è stato dato il permesso per errore: non idoneo (regola B-22 conservata). → test in Task 1.
4. Issue esistente con un assegnatario che non ha più il permesso: una modifica che non tocca `assigned_to` deve passare (si valida solo se il campo è nel payload). → test in Task 2.
5. Utente con entrambi i permessi revocati dal gruppo: sparisce subito dalle liste (nessuna cache oltre la singola richiesta). → coperto dai test di Task 2 sulla lista utenti.

---

### Task 1: Permessi e criterio di idoneità

**Files:**
- Modify: `backend/servicenow/models.py` (Meta di `ServiceNowCase`), `backend/issues/models.py` (Meta di `Issue`)
- Create: `backend/servicenow/migrations/0012_*.py`, `backend/issues/migrations/0009_*.py` (via `makemigrations`)
- Modify: `backend/core/technicians.py`, `backend/core/testing.py`
- Test: `backend/servicenow/tests/test_technician_eligibility.py` (riscrivere `_flag` e i casi), Create `backend/core/tests/test_issue_assignee_eligibility.py`

**Interfaces:**
- Produces (in `core/technicians.py`):
  - `TECHNICIAN_PERM = "servicenow.be_technician"`, `ISSUE_ASSIGNEE_PERM = "issues.be_assignee"`
  - `eligible_technician_q(prefix: str = "") -> Q` (stessa firma di oggi)
  - `is_eligible_technician(user) -> bool` (stessa firma)
  - `eligible_issue_assignee_q(prefix: str = "") -> Q`
  - `is_eligible_issue_assignee(user) -> bool`
- Produces (in `core/testing.py`): `make_technician(*args, **kwargs)` ora dà `servicenow.be_technician` all'utente (via un gruppo «Tecnici test» creato al volo, così il test esercita il percorso di gruppo); nuovo `make_issue_assignee(*args, **kwargs)` con `issues.be_assignee` allo stesso modo.

- [ ] **Step 1: Test che falliscono.** In `test_issue_assignee_eligibility.py`: `test_group_permission_makes_assignee` (utente Archie in un gruppo con `issues.be_assignee` → `is_eligible_issue_assignee` True e presente in `User.objects.filter(eligible_issue_assignee_q())`); `test_without_permission_not_assignee`; `test_superuser_without_group_not_assignee`; `test_inactive_user_not_assignee`; `test_portal_user_with_permission_not_assignee`; `test_technician_permission_does_not_make_assignee` (i due permessi sono distinti). In `test_technician_eligibility.py` sostituire `_flag` con un helper che aggiunge l'utente a un gruppo con `servicenow.be_technician` e aggiungere `test_superuser_without_group_not_technician`, `test_assignee_permission_does_not_make_technician`.
- [ ] **Step 2:** `$DC run ... backend pytest -q core/tests/test_issue_assignee_eligibility.py servicenow/tests/test_technician_eligibility.py` → FAIL (permessi inesistenti).
- [ ] **Step 3:** aggiungere `permissions = [("be_technician", "È tecnico ServiceNow")]` a `ServiceNowCase.Meta` e `permissions = [("be_assignee", "Può essere assegnatario delle issue")]` a `Issue.Meta`; `makemigrations servicenow issues`.
- [ ] **Step 4:** riscrivere `core/technicians.py`: gli id idonei vengono da `User.objects.with_perm(PERM, include_superusers=False, is_active=True)`; la parte «utente interno» resta quella attuale per i tecnici, per gli assegnatari è solo `with_perm("core.access_archie")`. Le versioni per singolo utente fanno `with_perm(...).filter(pk=user.pk).exists()` (mai `user.has_perm`, vero per i superuser). Aggiornare il docstring del modulo. Aggiornare `core/testing.py` come da Interfaces.
- [ ] **Step 5:** rilanciare i due file di test → PASS.
- [ ] **Step 6: Commit** `feat(permessi): tecnico ServiceNow e assegnatario issue come permessi di gruppo`.

### Task 2: Consumatori del criterio

**Files:**
- Modify: `backend/servicenow/api.py` (righe ~93, ~214, ~276, ~319, ~351, ~761-771), `backend/issues/api.py` (validazione `assigned_to` ~218-227, `notify_issue_created` ~346), `backend/core/api.py` (`UserListSerializer`, controllo assegnatario nella conversione task→issue ~868-878)
- Test: test esistenti di `servicenow/tests/`, `issues/tests/`, `core/tests/test_area_task_convert.py`, `core/tests/test_users_list_area.py` (aggiungere casi)

**Interfaces:**
- Consumes: le quattro funzioni di Task 1, `make_technician`, `make_issue_assignee`.
- Produces: `/api/users/` restituisce anche `is_issue_assignee: bool`.

- [ ] **Step 1: Test che falliscono.** `test_users_list_exposes_issue_assignee_flag` (in `test_users_list_area.py`: utente con `issues.be_assignee` → `is_issue_assignee` True, `is_servicenow_technician` False); in `issues/tests/test_issue_notification_emails.py` un caso in cui l'email «nuova issue» va solo agli assegnatari issue e non a un tecnico ServiceNow senza `be_assignee`; in `issues/tests/` `test_assign_requires_issue_assignee_permission` (400 su `assigned_to` di un tecnico senza `be_assignee`) e `test_patch_without_assigned_to_keeps_stale_assignee` (issue con assegnatario che ha perso il permesso: PATCH del titolo → 200).
- [ ] **Step 2:** lanciarli → FAIL.
- [ ] **Step 3:** in `servicenow/api.py` sostituire i due filtri diretti sul flag: `Absence ... .filter(eligible_technician_q("user__"))` al posto di `user__profile__is_servicenow_technician=True`; nel ciclo delle statistiche (~771) togliere il controllo del flag (la queryset è già filtrata con `eligible_technician_q()`). In `issues/api.py` usare `is_eligible_issue_assignee` nella validazione (messaggio: «L'utente selezionato non è assegnabile alle issue.») e `eligible_issue_assignee_q()` in `notify_issue_created` (togliere `profile__is_philips=False`). In `core/api.py`: `get_is_issue_assignee` con lo stesso schema a cache per richiesta di `get_is_servicenow_technician`, campo in `Meta.fields`; la conversione task→issue usa `is_eligible_issue_assignee`.
- [ ] **Step 4:** nei test esistenti che usano `make_technician` come assegnatario di una issue passare a `make_issue_assignee` (cercare con `grep -rn make_technician backend/issues backend/core/tests`).
- [ ] **Step 5:** `$DC run ... backend pytest -q` → tutto PASS.
- [ ] **Step 6: Commit** `feat(issue, servicenow): assegnatari dai permessi di gruppo`.

### Task 3: Via il flag dal profilo

**Files:**
- Modify: `backend/core/models.py` (rimuovere `is_servicenow_technician`), `backend/core/admin.py`, `backend/core/admin_users_api.py` (liste campi ~108 e ~398, forzatura Philips ~317), `backend/core/testing.py` (nessun riferimento al flag)
- Create: `backend/core/migrations/0048_*.py` (`RemoveField`)
- Modify: `frontend/src/api/generated.ts` (rigenerato), `frontend/src/types/adminUsers.ts`, `frontend/src/features/users/UserDetailModal.tsx` (toggle ~327, `onPhilips` ~125, chiavi ~137 e payload ~163), `frontend/src/features/users/usersModel.ts` (tag ~34)
- Test: `backend/core/tests/test_admin_users_api.py`, `frontend/src/features/users/*.test.ts(x)`

- [ ] **Step 1:** aggiornare `test_admin_users_api.py`: nessun test invia o legge `is_servicenow_technician`; aggiungere `test_profile_payload_ignores_removed_technician_flag` (un PATCH con la chiave vecchia non fallisce e non crea nulla). Lanciare → FAIL dove il campo è ancora atteso.
- [ ] **Step 2:** rimuovere il campo dal modello, da admin e da `admin_users_api.py`; `makemigrations core`; `grep -rn is_servicenow_technician backend --include=*.py | grep -v migrations` deve restituire solo `core/api.py` (campo calcolato) e i test di idoneità.
- [ ] **Step 3:** `$DC run ... backend pytest -q` → PASS; `python manage.py check` e `makemigrations --check --dry-run` puliti.
- [ ] **Step 4:** frontend: rigenerare `generated.ts` (procedura in CLAUDE.md: `spectacular --file`, `docker compose cp`, `OPENAPI_URL=<file> npm run gen:api`, prettier), togliere il flag da `adminUsers.ts`, il toggle «Tecnico ServiceNow» e il suo uso in `onPhilips`/payload da `UserDetailModal.tsx`, il tag da `usersModel.ts`; adeguare i test vitest che lo citano.
- [ ] **Step 5:** `npx tsc -b --force`, `npx vitest run src/features/users` → PASS.
- [ ] **Step 6: Commit** `refactor(utenti): rimosso il flag Tecnico ServiceNow dal profilo`.

### Task 4: Frontend — assegnatari issue e Philips nascosto

**Files:**
- Create: `frontend/src/features/users/visibleProfiles.ts` (`export const SHOW_PHILIPS = false`, commento sul modello di `features/servicenow/visibleCategories.ts`)
- Modify: `frontend/src/features/issues/types.ts` (`is_issue_assignee?: boolean`), `frontend/src/pages/Issues.tsx` (~111 mappatura utenti, ~322 `assignableUsers`), `frontend/src/features/users/UserDetailModal.tsx` (toggle Philips ~328 e riquadro informativo ~242 solo se `SHOW_PHILIPS`), `frontend/src/features/users/usersModel.ts` (tag Philips ~35 solo se `SHOW_PHILIPS`)
- Test: `frontend/src/features/users/usersModel.test.ts`, `UserDetailModal.test.tsx`

- [ ] **Step 1: Test che falliscono.** `usersModel.test.ts`: `roleTags` di un utente Philips non contiene «Philips»; `UserDetailModal.test.tsx`: il toggle «Philips» non è nel documento; un test su `Issues` (o sull'helper estratto per mappare gli utenti) che usa `is_issue_assignee` per costruire gli assegnabili.
- [ ] **Step 2:** `npx vitest run` sui file → FAIL.
- [ ] **Step 3:** implementare: `assignableUsers = users.filter((u) => u.is_issue_assignee)`; mappatura `RawUser` in `Issues.tsx` legge `is_issue_assignee` (default `false`); costante e condizioni Philips. Le altre regole Philips già presenti (blocchi su gruppi, livelli) restano.
- [ ] **Step 4:** catena completa: `npx tsc -b --force` → `npm run build` → `npm run lint` (5 problemi) → `npx vitest run` (tutti PASS).
- [ ] **Step 5: Commit** `feat(issue, utenti): assegnatari dal permesso, Philips nascosto`.

### Task 5: Rilascio in dev e changelog

- [ ] **Step 1:** voce in `CHANGELOG.md` sotto `## [Unreleased]`, sezione `Changed`: permessi di gruppo «È tecnico ServiceNow» e «Può essere assegnatario delle issue» al posto del flag; **passo manuale dopo il deploy**: assegnare i due permessi ai gruppi, altrimenti nessuno è assegnabile e l'email «nuova issue» non parte; migrazioni `servicenow.0012`, `issues.0009`, `core.0048` da lanciare a mano.
- [ ] **Step 2:** `$DC up -d --build backend cron frontend`, verificare che le migrazioni siano applicate (`$DC exec backend python manage.py showmigrations core issues servicenow | tail`), `make health`.
- [ ] **Step 3: Commit** `docs(changelog): assegnabili per gruppo`.
