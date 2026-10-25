# Task di area: gestione allineata alle issue

Data: 2026-09-24. Stato: design approvato in chat, in attesa di review della spec.

## Obiettivo

Portare i task di area (`core.AreaTask`, oggi un widget leggero della dashboard) a una gestione simile a quella delle issue: assegnatario, priorità, commenti, allegati Drive, pagina elenco con filtri, notifiche email. `AreaTask` resta un modello separato da `Issue` (le issue sono legate a cliente/sito/ServiceNow, i task no).

## Decisioni

- Stati: `da_fare`, `in_corso`, `in_attesa` (nuovo), `completato`. I valori esistenti restano validi. Niente `waiting_reason`.
- Priorità: `AreaTaskPriority` in `core.models`, con gli stessi valori di `IssuePriority` (bassa/media/alta/critica), default media. Non si importa `IssuePriority` per evitare un import circolare.
- Assegnatario: solo utenti attivi della stessa area del task (validato lato server). Il superuser che scrive è esente. Se l'assegnatario non cambia in una modifica, il controllo di area non si ripete.
- Allegati: solo collegamento a file già presenti in Drive. Nessun upload da task (eventuale evoluzione futura).
- Tre fasi consegnabili separatamente: 1 modello/API, 2 UI, 3 notifiche.

## Fase 1 — Modello e API

Modello `AreaTask` (nuova migrazione, nessuna modifica a migrazioni già applicate):
- `assigned_to`: FK utente, nullable, `SET_NULL`, related_name dedicato.
- `priority`: choices `IssuePriority`, default `medium`.
- `status`: aggiunta `in_attesa` alle choices.
- `drive_files`: M2M verso `drive.DriveFile`, blank. Nell'API il campo `drive_files` è di sola scrittura (lista di id): in lettura si restituisce solo `drive_files_detail`, già filtrato per ACL e soft-delete, così gli id di file riservati non si rivelano.

Nuovo modello `AreaTaskComment`: `task` (FK, CASCADE, related_name `comments`), `author` (FK utente, PROTECT), `body`, `created_at`, `updated_at`. Stesso schema di `IssueComment`.

`AreaTaskViewSet`:
- Adotta `SoftDeleteAuditMixin` e `RestoreActionMixin`; rimuove `_changes_from_validated` e l'audit manuale. Aggiunge `restore`, `bulk_restore`, `?include_deleted`, `?only_deleted`.
- Permission class invariata: `IsAuthenticated` + `IsInternalOrPortalDedicatedApp`.
- `AreaTaskFilter`: stato, assegnatario, priorità, scadenza da/a, area, "miei task".
- Azione `comments` e `comments/<id>` come `IssueViewSet`.
- Scrittura solo nella propria area (regola `_check_own_area` invariata); altre aree in sola lettura, commenti inclusi. Modifica/cancellazione commento solo dall'autore o da un superuser.
- Nascondere i completati dopo `HIDE_COMPLETED_AFTER_DAYS` (3 giorni) vale solo per `action == 'list'` e resta il default (invariato per il widget della dashboard); `?include_hidden=1` li mostra, e la pagina `/tasks` lo passerà. Retrieve, modifica e restore raggiungono sempre i task completati da tempo.
- `restore`/`bulk_restore` richiedono il permesso `core.change_areatask`, la propria area (superuser sempre) e passano dalla barriera `IsInternalOrPortalDedicatedApp`. `?include_deleted`/`?only_deleted` valgono solo per list, retrieve, restore e bulk_restore: un task eliminato non è modificabile.

Allegati Drive (sicurezza):
- Collegare un file richiede `drive.access.has_file_access` sul file.
- In lettura il serializer restituisce solo i file visibili all'utente (`filter_accessible_files`); gli altri non compaiono e non ne rivelano l'esistenza.
- Il download resta sull'endpoint Drive con la sua ACL; nessun accesso diretto ai media.
- File Drive soft-deleted non compaiono; il collegamento resta e riappare al restore.
- Collegamento/scollegamento registrati nell'audit del task.

Test: permessi per area, assegnatario di altra area rifiutato, restore e audit, filtri, commenti (autore/superuser), allegati (file non accessibile rifiutato e non esposto, file soft-deleted), regressione sul nascondere i completati.

## Fase 2 — UI (`frontend/`)

- `AreaTaskDrawer` sul modello di `IssueDrawer`, tab: Dettagli, Commenti, Allegati, Attività (audit).
- Tab Allegati: selettore che sfoglia Drive (riuso componenti di `pages/drive/`), anteprima, scollegamento.
- Dialog di creazione/modifica sul modello di `IssueDialog`.
- Pagina elenco `/tasks`: tabella con filtri (area, stato, assegnatario, priorità, scadenza, "miei"), ricerca, cestino con restore. Altre aree in sola lettura.
- Widget dashboard (`AreaTaskCard`): resta compatto, click apre il drawer, link "Vedi tutti" verso `/tasks`.
- Voce di menu in `appLayoutNav.tsx`, route in `App.tsx`, client rigenerato con `npm run gen:api`.
- Usare `useTheme()`, mai l'import statico del tema.

## Fase 3 — Notifiche

- Assegnazione/riassegnazione: email ai due utenti coinvolti, come `_notify_assignment_change` delle issue; nessuna email se l'assegnatario viene solo svuotato o se attore e destinatario coincidono. Template `area_task_assigned.html`.
- Nuovo commento: email all'assegnatario e al creatore, esclusi autore del commento e duplicati. Template `area_task_comment.html`.
- Scadenze: `refresh_notifications` e `send_deadline_digest` invariati, ma verificare che considerino aperto ogni stato diverso da `completato` (incluso `in_attesa`).
- Vincoli: i test in `issues/tests/test_issue_notification_emails.py` e `notifications/tests/` devono continuare a passare; nel deploy vanno ricostruiti sia `backend` sia `cron`; le mascotte dei nuovi template le aggiunge Fede (convenzione `cid:` esistente).

## Verifica (per ogni fase)

Catena del CLAUDE.md: `tsc -b --force`, `npm run build`, `npm run lint` (baseline 30), `npx vitest run` (baseline 62/62), `manage.py check`, `makemigrations --check --dry-run`, migrazione applicata in dev, prova nel browser. Changelog sotto `## [Unreleased]` con intestazioni inglesi.

## Fuori scope

Upload di file da task, `waiting_reason`, collegamento a cliente/sito/ServiceNow, preferenze di opt-out email.

## Note di consegna (2026-09-25)

- La pagina `/tasks` (fase 2b) non ha vista cestino né tab "Attività": nell'app il cestino/restore vive nella pagina globale `Trash.tsx` (permessi per risorsa) e la pagina Issues non ha una vista cestino. Portare i task di area in `Trash.tsx` e decidere chi può fare restore (oggi serve `core.change_areatask`) è un lavoro separato, ancora da fare. L'audit resta consultabile dalla pagina `/audit`.
- I filtri della pagina sono in stato locale (non nell'URL); il dettaglio non è collegato all'URL.
