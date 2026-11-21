# Issue — allegati e «Dove intervenire» completo · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allegati caricati direttamente nella issue (con eredità di quelli del task di area) e «Dove intervenire» con referente, seriale e credenziali.

**Architecture:** Nuovo modello `issues.IssueAttachment` (file protetto oppure collegamento a `drive.DriveFile`), azioni annidate sul `IssueViewSet` come quelle già esistenti per wiki e commenti, download via `protected_media_response`; la conversione del task crea righe collegate ai file del Drive. Frontend: sezione «Allegati» nella finestra della issue; «Dove intervenire» legge contatti del sito e dettaglio dell'inventario dalle API esistenti.

**Tech Stack:** Django 5 + DRF, React 19 + MUI, vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-11-20-issue-attachments-where-design.md`

## Global Constraints

- File fino a **25 MB**; estensioni: `pdf, png, jpg, jpeg, gif, webp, txt, log, csv, zip, docx, xlsx`.
- Lettura: `issues.view_issue` + visibilità per area (issue invisibile → 404); allegati `drive_file` solo se `drive.access.has_file_access(user, file)`.
- Scrittura: `issues.change_issue` + `can_edit_issue(user, issue)`; issue `closed` → 409/400 «Issue chiusa: allegati in sola lettura.».
- File su disco in `issue_attachments/<issue_id>/`; nginx: `location ^~ /media/issue_attachments/ { return 404; }` e `/api/media/issue_attachments/`.
- Prefisso degli allegati ereditati: `"[Task] "`.
- Ogni aggiunta/rimozione: `log_event` sulla issue con `changes={"allegati": {"from": …, "to": …}}`.
- Comandi backend: `BRUN` = `docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps -v ./backend:/app --entrypoint "" backend`.
- Baseline: lint frontend 4 avvisi; vitest e pytest tutti verdi.

## Review Focus

1. **Issue di un'altra area** (utente senza `view_all_areas`): elenco, download e caricamento rispondono 404, mai il file. Test in Task 1.
2. **File con estensione finta** (es. `foto.png` che è un eseguibile) → 400. Test in Task 1.
3. **Allegato ereditato da un file del Drive non accessibile** all'utente → non compare nell'elenco né si scarica. Test in Task 2.
4. **Contatto principale senza telefono / sito senza contatti / issue senza sito** → la riga del referente si adatta o sparisce senza errori. Test in Task 3.
5. **Utente senza permesso Credenziali** → «Serve il permesso Credenziali», nessuna password nel DOM. Test in Task 3.

---

### Task 1: Allegati della issue (backend)

**Files:** Modify `backend/issues/models.py`, `backend/issues/api.py`, `backend/issues/admin.py` (sola lettura), `nginx/backend.conf`; Create `backend/issues/migrations/00xx_issueattachment.py`, `backend/issues/tests/test_issue_attachments.py`.

**Interfaces — Produces:**
- `IssueAttachment(issue FK CASCADE related_name="attachments", file FileField(upload_to=issue_attachment_path, blank=True), drive_file FK drive.DriveFile null SET_NULL, name CharField(255), size PositiveBigIntegerField(default=0), mime_type CharField(127, blank), from_task Bool(default False), uploaded_by FK user null SET_NULL, created_at auto)`; `CheckConstraint`: esattamente uno fra file e drive_file (`~Q(file="") ^ Q(drive_file__isnull=False)` nella forma supportata).
- Azioni su `IssueViewSet`: `attachments` (GET elenco, POST multipart `file` ripetibile), `attachments/(?P<att_pk>\d+)` (DELETE), `attachments/(?P<att_pk>\d+)/download` (GET).
- Riga di elenco: `{id, name, size, mime_type, from_task, url, uploaded_by_name, created_at}`; `url` = `/api/issues/{id}/attachments/{att}/download/` per i file, `/api/drive-files/{drive_file}/download/` per i collegati.
- `IssueSerializer.attachments_count` (solo allegati visibili? no: conteggio semplice delle righe, letto con annotate).

- [ ] **Step 1: Failing tests** in `test_issue_attachments.py` (helper `_staff`/`_issue` come `test_issue_area.py`; `MEDIA_ROOT` già isolato dal conftest): `test_upload_and_list`, `test_upload_multiple_files`, `test_download_serves_via_accel_redirect` (header `X-Accel-Redirect` inizia con `/protected_media/issue_attachments/`), `test_delete_removes_file_from_disk`, `test_rejects_bad_extension`, `test_rejects_fake_png` (contenuto non immagine con nome `.png`), `test_rejects_over_25mb` (patch del limite a 10 byte per non creare file grandi), `test_other_area_is_404_for_list_download_upload`, `test_read_only_user_cannot_upload` (403), `test_closed_issue_is_read_only`, `test_audit_on_upload_and_delete`, `test_attachments_count_in_detail`.
- [ ] **Step 2:** `BRUN pytest -q issues/tests/test_issue_attachments.py` → FAIL.
- [ ] **Step 3:** Implementare modello + migrazione (generata e riportata all'utente del repo, non root), azioni, validazione con `validate_upload(strict_real_mime=True)`, cancellazione del file con `att.file.delete(save=False)`, nginx.
- [ ] **Step 4:** test PASS; `BRUN pytest -q issues`; `makemigrations --check` pulito.
- [ ] **Step 5: Commit** `feat(issues): allegati caricati nella issue`.

### Task 2: Eredità degli allegati dal task di area

**Files:** Modify `backend/core/api.py` (`convert_to_issue`), `backend/issues/api.py` (filtro dei `drive_file` non accessibili nell'elenco e nel conteggio); Test `backend/core/tests/test_area_task_convert.py`, `backend/issues/tests/test_issue_attachments.py`.

**Interfaces — Consumes:** `IssueAttachment` (Task 1), `drive.access.has_file_access`.

- [ ] **Step 1: Failing tests:** `test_convert_copies_task_files_as_task_attachments` (task con 2 `drive_files` → 2 `IssueAttachment(from_task=True, drive_file=…, name="[Task] <nome>")`, nessun file su disco); `test_drive_attachment_hidden_without_drive_access` (utente senza accesso alla cartella → l'elenco non lo mostra); `test_drive_attachment_of_trashed_drive_file_hidden`.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. **Step 4:** `BRUN pytest -q core/tests/test_area_task_convert.py issues` PASS.
- [ ] **Step 5: Commit** `feat(issues): la issue nata da un task ne eredita gli allegati`.

### Task 3: Frontend — sezione Allegati e «Dove intervenire» completo

**Files:** Create `frontend/src/features/issues/IssueAttachments.tsx`, `IssueAttachments.test.tsx`, `frontend/src/features/issues/IssueWhere.tsx`, `IssueWhere.test.tsx`, `frontend/src/features/inventory/InventoryCredentials.tsx` (sola lettura: righe Utente/Password per SO, Applicazione, VNC; mostra 30 s; copia; «Serve il permesso Credenziali»); Modify `frontend/src/features/issues/IssueDetail.tsx` (sezione Allegati dopo la descrizione, «Dove intervenire» → `IssueWhere`, conteggio allegati in testata), `frontend/src/features/issues/types.ts` (`attachments_count`), `frontend/src/api/generated.ts` (rigenerato).

**Interfaces — Consumes:** API di Task 1; `GET /contacts/?site=<id>&ordering=-is_primary,name` (verificare i campi `is_primary`, `phone`, `email`, `department` nel serializer dei contatti), `GET /inventories/{id}/` (campi `serial_number`, `knumber`, `os_user`, `os_pwd`, `app_usr`, `app_pwd`, `vnc_pwd`; segreti assenti senza permesso).

- [ ] **Step 1: Failing tests.** `IssueAttachments.test.tsx`: elenco con icona/nome/dimensione e «[Task]» per gli ereditati; «Allega file» manda `POST /issues/<id>/attachments/` multipart; errore 400 mostrato nel toast; togli con conferma → `DELETE`; in sola lettura (issue chiusa o altra area) niente «Allega file» né «Togli»; trascinare un file sulla zona lo carica. `IssueWhere.test.tsx`: referente principale con «Chiama» (`tel:`) ed email; senza principale fino a 3 contatti e «Altri N»; senza sito nessuna riga referente; seriale e K-number dell'inventario; credenziali mascherate, «Mostra» per 30 s (fake timers), copia; senza permesso «Serve il permesso Credenziali» e nessuna password nel DOM.
- [ ] **Step 2:** `npx vitest run src/features/issues` → FAIL.
- [ ] **Step 3:** Implementare come da spec (stile della finestra: `RecordSection`, `RecordRows`/`RecordRow`, `CampoIcon`, `FileIcon` del Drive per il tipo).
- [ ] **Step 4:** vitest issues PASS; `npx tsc -b --force` ok.
- [ ] **Step 5: Commit** `feat(issues): allegati e «Dove intervenire» con referente, seriale e credenziali`.

### Task 4: Verifica e rilascio in dev

- [ ] **Step 1:** `BRUN python manage.py check`, `makemigrations --check --dry-run`, `BRUN pytest -q` → verde.
- [ ] **Step 2:** frontend `tsc -b --force`, `npm run build`, `npm run lint` (≤ 4), `npx vitest run` → verde.
- [ ] **Step 3:** rebuild `backend frontend backend_nginx` (nuova regola nginx), `migrate`; nel browser: caricare un'immagine e un PDF su una issue, aprirli, toglierne uno; trasformare un task con file del Drive in issue e vedere i «[Task]»; controllare «Dove intervenire» con referente e credenziali.
- [ ] **Step 4:** CHANGELOG (`[Unreleased]` › Added), todo (`docs/restyle-todo.md`: Allegati e Dove intervenire fatti), **Dopo il deploy**: `migrate` e ricreare `backend_nginx`.
- [ ] **Step 5: Commit** `docs: allegati e «Dove intervenire» delle issue`.
