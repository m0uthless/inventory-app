# Changelog

Tutte le modifiche rilevanti al progetto sono documentate qui.

Formato ispirato a “Keep a Changelog” + SemVer.
Le date sono in timezone Europe/Rome.

---

## [0.5.2] - 2026-03-23

### Fixed

- **`issues/api.py` — NullPointerError in `IssueSerializer.get_created_by_full_name`** (PC-01):
  il metodo accedeva a `obj.created_by.first_name` senza null-check. Con `on_delete=SET_NULL`,
  l'eliminazione di un utente imposta `created_by=NULL` su tutte le sue issue, causando
  `AttributeError: 'NoneType' object has no attribute 'first_name'` su ogni chiamata a
  `GET /api/issues/`. Aggiunto `if not u: return None` in testa al metodo.

- **`audit/models.py` — `AuditEvent.action="rate"` fuori dalla enum `Action`** (PC-02):
  `WikiPageViewSet.rate_page()` scriveva `action="rate"` in un campo con `choices` che non
  includeva tale valore, causando inconsistenze nei log di audit e impossibilità di filtrare
  per tipo. Aggiunto `RATE = "rate", "Rate"` alla enum `Action`. `max_length` aumentato da
  16 a 32 per supportare futuri valori senza migration aggiuntiva.

- **`wiki/api/pages.py` + `wiki/api/revisions.py` — race condition su `WikiPageRevision.revision_number`** (PC-03):
  il calcolo del prossimo `revision_number` avveniva con SELECT + INSERT non atomici
  (pattern check-then-act). Sotto carico concorrente, due richieste PATCH sullo stesso
  `WikiPage` potevano generare revisioni con lo stesso `revision_number`. Stesso problema
  nel metodo `restore()`. Entrambi i blocchi avvolti in `transaction.atomic()` con
  `select_for_update()` sulla query di ricerca dell'ultima revisione.

- **`maintenance/api/plans.py` — N+1 query in `get_covered_count()` e `get_inventory_type_labels()`** (PC-04):
  `get_covered_count()` eseguiva 3 query per piano nella lista; `get_inventory_type_labels()`
  bypassava il `prefetch_related` chiamando `.values_list()`. Sostituiti con: annotazione
  `_covered_count` nel queryset tramite Subquery annidata sulla through table M2M;
  `get_inventory_type_labels()` ora legge dalla cache del prefetch (`obj.inventory_types.all()`).

- **`config/settings.py` — `FIELD_ENCRYPTION_KEY` senza guard-rail in produzione** (PC-05):
  a differenza di `SECRET_KEY` e `DB_PASSWORD`, la chiave Fernet non aveva alcun controllo
  all'avvio. Aggiunto guard-rail: `if not DEBUG and not FIELD_ENCRYPTION_KEY: raise RuntimeError(...)`.

- **`crm/api.py` — `CustomerFilter.filter_city` con falsi positivi e full table scan** (PC-06):
  il filtro usava `Cast("custom_fields", TextField()).__icontains=v`, che serializzava
  l'intera colonna JSON. Un cliente con `{"city": "Roma", "indirizzo": "Via Bologna 1"}`
  matchava per ricerca "bologna". Sostituito con `Q(city__icontains=v)` sull'annotazione
  `city` già presente nel queryset (Coalesce di `KeyTextTransform`).

- **`core/mixins.py` — precedenza operatori booleani errata in `has_userstamps`**:
  `hasattr(...) or hasattr(...) and any(...)` valutava `and` prima di `or`.
  Aggiunto parentesizzazione esplicita.

- **`wiki/api/revisions.py` — import duplicato di `DjangoFilterBackend`**: rimosso.

- **`frontend/src/ui/ContributorCard_orig.tsx`**: file di backup eliminato.

### Added

- **`inventory/management/commands/encrypt_rotate.py` — rotazione chiave Fernet**:
  nuovo management command per ruotare `FIELD_ENCRYPTION_KEY` senza downtime.
  Modalità: rotazione chiave (`OLD_FIELD_ENCRYPTION_KEY` → `FIELD_ENCRYPTION_KEY`),
  prima cifratura di campi plaintext legacy, verifica integrità (`--check`).
  Supporta `--dry-run`, `--batch-size`, `--force`.

- **`.env.example`**: template documentato con tutte le variabili d'ambiente,
  placeholder `CHANGEME_*` e istruzioni per generare `SECRET_KEY` e `FIELD_ENCRYPTION_KEY`.

- **Test** — 46 test nuovi in 5 file:
  - `wiki/tests/test_revision_integrity.py` (7): fix race condition PC-03 con thread reali.
  - `maintenance/tests/test_plan_list_no_n1.py` (6): fix N+1 PC-04 + PC-01 Issues null user.
  - `wiki/tests/test_export_and_audit_action.py` (12): `export_pdf` e `AuditEvent.Action.RATE`.
  - `crm/tests/test_city_filter.py` (11): fix PC-06 filtro città, serializer, canario allineamento.
  - `inventory/tests/test_encrypt_rotate.py` (10): `encrypt_rotate` dry-run, cifratura, rotazione.

### Changed

- **`crm/api.py` — `CustomerSerializer.get_city` unificato con la logica del queryset**:
  eliminata la logica di normalizzazione `.casefold()` + strip accenti, divergente rispetto
  alla `Coalesce(KeyTextTransform(...))` del queryset. `get_city` ora legge prima
  dall'annotazione `obj.city` e cade in fallback sui `custom_fields` con le stesse chiavi
  dichiarate in `_CITY_KEYS = frozenset({...})`, allineate con la Coalesce.

- **`frontend/src/hooks/useColumnPrefs.ts` — eliminata stale closure nelle callback**:
  `onColumnVisibilityModelChange`, `saveOrder` e `saveWidth` catturavano `prefs` nella
  closure, ricreandosi ad ogni cambio di stato e propagando re-render inutili ai componenti
  figli. Convertiti alla forma funzionale `setPrefs((prev) => ...)`: `prefs` rimosso
  dalle deps di `useCallback`. `hasPrefs` stabilizzato con `useMemo`.

- **`docker-compose.prod.yml`**: aggiunto commento sulle variabili obbligatorie in produzione
  (`DJANGO_SECRET_KEY`, `DB_PASSWORD`, `FIELD_ENCRYPTION_KEY`, `REDIS_URL`).

### Security

- `FIELD_ENCRYPTION_KEY` ora richiesta esplicitamente all'avvio in produzione
  (`RuntimeError` se assente con `DJANGO_DEBUG=0`), allineata alle guardie già presenti
  per `SECRET_KEY` e `DB_PASSWORD`.

### Migrations

- `audit/0008_auditevent_action_rate_maxlength32`: `AuditEvent.action` —
  aggiunto valore `rate` alle `choices`; `max_length` portato da 16 a 32.

---

## [0.5.1] - 2026-03-22

### Fixed

- **`wiki/api.py` — NameError `WikiQuery` a runtime** (`WikiStatsView.get()`):
  l'import di `WikiQuery`/`WikiQueryLanguage` era posizionato dopo la definizione
  di `WikiStatsView` (riga 1214), causando un potenziale `NameError` all'endpoint
  `GET /api/wiki-stats/`. Import spostato in cima al file con gli altri import del
  modulo wiki.

- **`inventory/api.py` — campo `status_key` duplicato** in `InventoryDetailSerializer`:
  due assegnazioni identiche su righe consecutive; la prima veniva silenziosamente
  sovrascritta da Python. Rimossa la riga duplicata.

- **`wiki/api.py` — race condition rating** (`WikiPageViewSet.rate_page()`):
  il pattern check-then-act (`filter().exists()` → `create()`) permetteva a due
  richieste concorrenti dello stesso utente di creare due `WikiPageRating` distinti.
  Sostituito con `get_or_create(page, user, defaults={rating})`.

- **`wiki/models.py` — `WikiPageRating` senza vincolo unicità a DB**:
  aggiunto `UniqueConstraint(fields=["page", "user"], name="ux_wiki_page_rating_page_user")`
  come guardia definitiva contro la race condition. Migrazione `0012` resa idempotente
  con `SeparateDatabaseAndState` + `DO $$ IF NOT EXISTS $$` per ambienti dove il
  constraint era già presente.

- **`crm/api.py` — N+1 queries in `SiteViewSet.bulk_restore()`**:
  il loop `for obj in restorable: obj.save(...)` eseguiva 1 UPDATE per sito.
  Sostituito con `Site.objects.filter(id__in=restored_ids).update(...)` identico
  a `CustomerViewSet` e `InventoryViewSet`.

- **`issues/api.py` — `perform_update()` con doppio `get_object()`**:
  il metodo chiamava `self.get_object()` ridondantemente invece di usare
  `serializer.instance` già caricato da DRF, causando una query extra.

- **`drive/api.py` — loop infinito potenziale in `breadcrumb()` e `move()`**:
  i cicli `while node:` e `while node is not None:` non avevano limite di profondità.
  Aggiunto `MAX_DEPTH = 50` con contatore in entrambe le funzioni come protezione
  contro cicli nel grafo parent di `DriveFolder`.

- **`frontend/src/App.tsx` — rotte `/bug-feature` senza `RequireAuth`**:
  le rotte `/bug-feature` e `/bug-feature/resolved` erano accessibili senza
  autenticazione. Aggiunte con `<RequireAuth>`.

- **`frontend/src/ui/ServerDataGrid.tsx` — `useEffect` senza dependency array**:
  l'effect che espone `colPrefs` tramite `colPrefsRef` veniva rieseguito ad ogni
  render. Aggiunto `[colPrefsRef, colPrefs]` come dependency array.

- **`frontend/src/ui/ContributorCard_orig.tsx`**: file di backup del componente
  originale rimasto in `src/ui/` ed incluso nel build TypeScript. Eliminato.

### Added

- **`core/mixins.py` — `RestoreActionMixin`**: centralizza le action DRF `restore`
  e `bulk_restore` (prima replicate in ogni ViewSet). Configurabile via attributi
  di classe: `restore_use_block_check`, `restore_has_updated_by`,
  `restore_response_204`, `restore_use_split`. Elimina ~250 righe di boilerplate
  identico tra `crm`, `inventory`, `wiki`, `drive`, `issues`.

- **`core/mixins.py` — `PurgeActionMixin`**: centralizza le action DRF `purge`
  e `bulk_purge` (prima replicate in `crm`, `inventory`, `maintenance`).
  Riconosce automaticamente il modello dalla queryset senza configurazione.

- **`.env.dev.example`**: template di configurazione con placeholder `CHANGEME_*`
  per onboarding e ambienti nuovi. Il `.gitignore` aggiornato con commento
  esplicito e regole `!.env.*.example` per tenerlo nel repo.

### Changed

- **`wiki/api.py` → pacchetto `wiki/api/`**: il file monolitico da 1350 righe è
  stato diviso in 7 moduli indipendenti con `__init__.py` che re-esporta tutte le
  classi pubbliche (backward compatible con `from wiki.api import ...`):
  `helpers.py` · `categories.py` · `pages.py` · `attachments.py` ·
  `links.py` · `revisions.py` · `stats.py` · `queries.py`.

- **`crm/api.py`**: `CustomerViewSet` e `SiteViewSet` migrati a
  `PurgeActionMixin + RestoreActionMixin`; rimossi i 4 metodi manuali
  (`restore`, `bulk_restore`, `purge`, `bulk_purge`) da ciascuno.
  `ContactViewSet` usa `PurgeActionMixin` e `restore` semplificato
  tramite `_restore_obj`.

- **`inventory/api.py`**: `InventoryViewSet` migrato a
  `PurgeActionMixin + RestoreActionMixin`; rimossi i 4 metodi manuali.

- **`issues/api.py`**: `IssueViewSet` migrato a
  `RestoreActionMixin + SoftDeleteAuditMixin`. Allineato il `get_queryset`
  a `apply_soft_delete_filters` (standard di progetto). Rimosso `destroy()`
  manuale (ora gestito dal mixin, che rileva l'assenza di `updated_by` su
  `Issue`). Rimosso `IssueFilter.filter_deleted` ridondante. Formato diff
  audit cambiato da lista `[from, to]` a dict `{from, to}` coerente con
  gli altri ViewSet.

- **`wiki/api/` ViewSet**: `WikiCategoryViewSet`, `WikiPageViewSet`,
  `WikiAttachmentViewSet`, `WikiLinkViewSet`, `WikiQueryViewSet` migrati
  a `RestoreActionMixin` con configurazione appropriata per ciascuno
  (presenza/assenza `updated_by`, tipo di risposta).

- **`wiki/api/stats.py` — `WikiStatsView` con cache**: la view che esegue
  8+ query aggregate è ora cachata per 5 minuti (configurabile via
  `settings.WIKI_STATS_CACHE_TTL`). La logica è separata in `_compute_stats()`
  che ritorna un dict (cachabile) invece di un `Response`.

- **`drive/api.py` — `select_related` catena parent**: `DriveFolderViewSet.get_queryset()`
  carica i parent fino a 5 livelli di profondità in un unico JOIN, eliminando
  le query N+1 in `breadcrumb()` e `move()`.

- **`config/settings.py` — DRF throttle globale**: aggiunti
  `DEFAULT_THROTTLE_CLASSES` (`AnonRateThrottle` + `UserRateThrottle`) e
  `DEFAULT_THROTTLE_RATES` configurabili via env (`API_THROTTLE_ANON`,
  `API_THROTTLE_USER`; default `60/min` anonimo, `600/min` autenticato).

- **`crm/models.py` — indice GIN su `Customer.custom_fields`**:
  aggiunto `GinIndex(fields=["custom_fields"], name="cust_custom_fields_gin")`
  per rendere efficienti le ricerche JSON nel filtro città.

### Migrations

- `wiki/0012_wikipagerating_unique_page_user`: `UniqueConstraint` su
  `WikiPageRating(page, user)`. Migrazione idempotente via
  `SeparateDatabaseAndState`.
- `crm/0007_customer_custom_fields_gin_index`: indice GIN su
  `Customer.custom_fields`.

---

## [0.5.0] - 2026-03-13

### Changed
- Promossa la baseline consolidata a `0.5.0` dopo i pass di stabilizzazione, release prep e polish UI/UX.
- Allineata la versione applicativa a `0.5.0` tra backend, frontend, env, documentazione e test dei public status endpoint.

### Fixed
- Nessun fix funzionale aggiuntivo in questa release: il bump di versione fotografa lo stato stabile raggiunto con la suite verde.

---

## [0.4.2] - 2026-03-13

### Added
- Documentazione di baseline `docs/contracts-and-policies.md` con i contratti applicativi consolidati per restore policy, custom fields, secrets Inventory ed endpoint pubblici.
- Note esplicite di retrocompatibilita sulle route legacy di restore (`/api/inventory/...`, `/api/custom-fields/...`) in attesa di futura rimozione controllata.

### Changed
- Allineata la versione applicativa a `0.4.2` tra backend, frontend, env e test dei public status endpoint.
- Aggiornate README, regression checklist e release checklist per riflettere la baseline chiusa dopo le patch 34-36 e la smoke suite effettiva.

### Fixed
- Formalizzato in documentazione il contratto di restore bloccato (`409`) e il payload di bulk restore con `count`, `blocked` e `blocked_count`, cosi da evitare ambiguita tra UI, test e client legacy.

---

## [0.4.1] - 2026-03-12

### Added
- Endpoint pubblico `GET /api/health/` per readiness/liveness check backend con stato database e versione.
- Endpoint frontend `GET /healthz` servito da nginx per healthcheck del container UI.
- `make health` e documentazione `docs/release-checklist.md` per controlli rapidi di rilascio.

### Fixed
- Collegato finalmente `GET /api/system-stats/`, gia usato dalla login page ma non esposto nelle URL Django.
- Allineato il fallback versione nella login page a `VITE_APP_VERSION`, eliminando il residuo `0.4.0-alpha`.
- In `docker-compose.prod.yml` impostato `RUN_COLLECTSTATIC=0` coerentemente con il deploy controllato gia documentato.

### Changed
- Aggiunti healthcheck Docker Compose per `backend`, `backend_nginx` e `frontend` per avere stato container piu affidabile in `docker compose ps`.

---

## [0.4.0] - 2026-03-06

### Added

- **Wiki / Knowledge Base** (modulo completo):
  - Modello `WikiPage` con versioning automatico tramite `WikiPageRevision` (snapshot ad ogni salvataggio).
  - Categorie con emoji e colore personalizzabile.
  - Editor rich-text con autosave via localStorage.
  - Slug deduplication e codice univoco generato automaticamente (formato `KB0000001`).
  - Tracciamento view count per pagina.
  - Wiki page linking (link interni tra pagine) e allegati (`WikiAttachment`).
  - Statistiche KB (dashboard conteggi per categoria, pagine più viste).
- **CI/CD** (`.github/workflows/ci.yml`): pipeline GitHub Actions con step build Docker, mypy, `manage.py check`, `makemigrations --check`, pytest.
- **Type checking** (`mypy`): configurazione `mypy.ini` scoped ai moduli del progetto, escluse migrazioni.
- **OpenAPI TypeScript** (`frontend/scripts/gen-api-types.mjs`): generazione automatica dei tipi TypeScript dallo schema OpenAPI via `openapi-typescript`.
- **Code splitting** frontend: tutte le route lazy-loaded con `React.lazy` + `Suspense`.
- **ErrorBoundary** globale (`frontend/src/ui/ErrorBoundary.tsx`): cattura errori React non gestiti con UI di fallback (Dashboard + Reload), stack trace in `DEV`.
- **Column preferences** per-user/per-page: visibilita e ordine colonne persistito in localStorage su cinque pagine DataGrid principali.
- **Design system** (`docs/ui-standards.md`): standard UI progressivi documentati (ActionIconButton, DetailDrawerHeader, form pattern, spacing tokens).
- **Spacing tokens** (`frontend/src/theme/tokens.ts`): costanti `xs/sm/md/lg/xl` con valori MUI e CSS.
- **Separazione ambienti**: `.env.dev` (sviluppo) e `.env.prod` (produzione) con `docker-compose.prod.yml` che punta a `.env.prod`.

### Changed

- **Audit log** — copertura completata su tutti i moduli:
  - `AuditEvent.content_type` ora nullable (migrazione `0007`); `log_event()` gestisce `instance=None`.
  - Campi `path`, `method`, `ip_address`, `user_agent` popolati nelle colonne dedicate e in `metadata`.
  - Aggiunto audit su create/update per: `TechViewSet`, `MaintenancePlanViewSet`, `MaintenanceEventViewSet`, `MaintenanceNotificationViewSet`, `WikiAttachmentViewSet.upload`.
- **`WikiPage.restore()`**: ora aggiorna `updated_by=request.user` al ripristino.
- **`WikiPageRevisionViewSet.restore`**: aggiunto `permission_classes=[CanRestoreModelPermission]`.
- **Versione OpenAPI** aggiornata a `"0.4.0"` in `SPECTACULAR_SETTINGS`.
- **Route WIP rimosse** da `App.tsx` (`InventoryWip`, `MaintenanceWip` non piu esposte in produzione).
- **`ActionIconButton`** adottato uniformemente in tutti i drawer (Contacts, Drive, Audit, Inventory, Sites, Maintenance).
- **`DetailDrawerHeader`** adottato nei drawer di `Drive.PreviewDrawer` e `Contacts`.
- **`ServerDataGrid`**: pulsante reset colonne migrato ad `ActionIconButton`.
- **`scripts/check.sh`**: orchestrazione controlli backend + frontend.

### Fixed

- **N+1 query `bulk_restore`**: `SiteViewSet` e `ContactViewSet` ora usano `QuerySet.update()`; `_enforce_primary` eseguito solo sui contatti `is_primary=True` ripristinati.
- **`SECRET_KEY`**: sostituita chiave di 9 caratteri con chiave JWT-safe da 90+ caratteri.
- **Permessi restore Issues**: `@action` restore ora dichiara `permission_classes=[CanRestoreModelPermission]`.
- **Email aziendale in `.env`**: rimosso indirizzo reale, sostituito con placeholder.

### Security

- `SECRET_KEY` di produzione ruotata.
- `WikiPageRevisionViewSet.restore` protetto da `CanRestoreModelPermission` — in precedenza qualsiasi utente con permesso view poteva sovrascrivere il contenuto di una pagina wiki.
- `DJANGO_ALLOWED_HOSTS` separato tra dev (`*`) e prod (IP esplicito) tramite `.env.prod`.
- `.env.prod` escluso da git; aggiunto `.env.example` con istruzioni di generazione chiavi.

### Technical Debt

- `ContactViewSet.bulk_restore`: loop residuo su `_enforce_primary` intenzionale, limitato ai soli contatti `is_primary=True`; documentato nel codice.
- Drawer `Contacts` e `Drive`: uniformati al design system in questa versione (sviluppati prima della standardizzazione).

---

## [0.3.0] - 2026-02-25

### Added
- Modulo **Wiki** (alpha): struttura base modelli, API e UI — completato e stabilizzato in v0.4.0.
- **ActionIconButton** (`frontend/src/ui/ActionIconButton.tsx`): primo wrapper a11y per `IconButton`.
- **DetailDrawerHeader** (`frontend/src/ui/DetailDrawerHeader.tsx`): header standardizzato per drawer di dettaglio.

### Changed
- Consolidamento endpoint Search e ottimizzazione query N+1 su moduli CRM e Inventory.
- Allineamento versione OpenAPI a `"0.3.0"`.

### Fixed
- Bugfix selezionati dalla code review: notifiche, JSON parser PATCH, URL PDF serializer, filtri client-side.

### Security
- Riduzione superficie CSRF: `CSRF_ALLOW_ALL_ORIGINS=1` ora fa fallire l'avvio se `DJANGO_DEBUG=0`.

### Technical Debt
- Alcune logiche soft-delete/restore replicate tra viewset (affrontate sistematicamente in v0.4.0).


## [0.3.0-alpha.1] - 2026-02-24

### Added
- **Audit**:
  - AuditEvent per create/update/delete/restore (con masking aggressivo dei campi sensibili).
  - Tracciamento tentativi di autenticazione (login/logout/login_failed).
  - UI Audit con filtri e drawer diff.
- **Custom Fields “veri”**:
  - Definizioni (CustomFieldDefinition) con validazione/normalizzazione su JSONField.
  - Supporto flag `is_sensitive` (mask in audit).
- **User Profile**:
  - Avatar upload e pagina profilo.
  - Preferred customer (scoping UX lato UI).
- **Drive**:
  - Cartelle/file con API dedicate + upload multipart.
  - Protezione Nginx contro bypass ACL su drive media.
- **Search (UI)**: pagina di ricerca globale (fan-out su endpoint list in base ai permessi).
- **Trash (UI)**: cestino unificato con selezione multipla e bulk restore.
- **Permessi a gruppi** (admin/editor/viewer) con sidebar/azioni condizionali.
- **DataGrid server-side** (pagination/search/ordering) sulle liste principali.

### Changed
- Stack Docker Compose: aggiunto Nginx per backend (porta **6382**) e Nginx per frontend (porta **6383**).
- Inventory:
  - secrets (OS/App/VNC) **solo** nel dettaglio e mascherati in UI.
  - introdotto permesso `inventory.view_secrets` per visualizzare/copiarli.
- Wiki: rendering hardening con sanitizzazione HTML (anti-XSS).
- Allineamento metadati versione (frontend package*, OpenAPI).

### Fixed
- Fix incoerenze endpoint bulk restore (`/bulk_restore/`) e parametri query coerenti (`page/page_size/search/ordering`).
- Fix doppio evento `login` su Audit.
- Fix vari su DataGrid (typing/JSX, columnVisibilityModel, selection model compatibile MUI X).
- Restore Contatti ri-applica regola “primario” per evitare duplicati.

### Security
- Audit masking: password/token/secret/apiKey/privateKey ecc. mascherati.
- Docs OpenAPI: pubbliche in DEBUG, ristrette in prod a staff/superuser o gruppo `admin`.

### Technical Debt
- Presenza di endpoint/bozza backend per Search non cablata nei `urls.py` (file `backend/config/search_api.py`).
- Alcune logiche soft-delete/restore e alias ordering replicate tra viewset.

---

## [0.2.1] - 2026-02-18

### Fixed
- UI: endpoint bulk restore inventari allineato al backend (`/inventories/bulk_restore/`).
- API: ordinamenti coerenti con i campi usati in UI (alias ordering su label/display_name per CRM e Inventory).
- API: bulk restore Contatti ora ri-applica la regola del “primario” per evitare duplicati.
- API: credenziali inventario disponibili nel dettaglio (retrieve) ma non in list (più coerente e più sicuro).

### Changed
- Allineamento metadati di versione (frontend package*, OpenAPI).
- Pulizia repo: aggiunto `.gitignore`, previsto `data/.gitkeep`.

---

## [0.2.0] - 2026-02-18

### Added
- **Cestino unificato (UI)** con selezione multipla e **bulk restore**.
- **Dialog di conferma** per azioni bulk (ripristino selezionati).
- **Audit UI** con filtri (azione, entità/app/model, attore, date range, object id) e **drawer** con diff leggibile.
- Tracciamento audit eventi auth:
  - `login`
  - `login_failed` (credenziali errate / utente disabilitato)
  - `logout`
- **Source-of-truth permessi** lato frontend (`perms.ts`) e allineamento sidebar/route/actions.
- Miglioramento UX liste: coerenza querystring (page/page_size/search/ordering/view) e sorting più esteso.
- Branding UI:
  - titolo tab browser “Site Repository”
  - favicon coerente con tema teal/ottanio

### Changed
- **Wiki render hardening**: HTML sanitizzato (anti-XSS).
- Uniformata la gestione soft-delete/restore su più moduli (coerenza endpoint e parametri).
- Migliorata gestione selezione DataGrid (compatibile con versioni recenti MUI X: selection model non più array semplice).

### Fixed
- Doppia registrazione evento `login` in Audit (rimosso doppio hook).
- Fix endpoint inventari in Cestino (allineamento path API).
- Fix vari di typing/JSX e visibilità colonne DataGrid (es. rimozione `hide` a favore di `columnVisibilityModel`).
- Rimozione “Reimposta” nel Cestino (non necessario e comportamento non corretto).

---

## [0.1.0] - 2026-02-17

### Added
- Backend Django + Postgres con moduli:
  - `core`, `crm`, `inventory`, `maintenance`, `wiki`, `audit`, `custom_fields`.
- Soft delete + restore per entità principali (con query param include/only deleted).
- Seed di lookup di base (`seed_defaults`).
- Comandi import CSV custom (customers/sites/contacts/inventories) con modalità controllata.
- Frontend React + TS (Vite) + MUI, servito via Nginx su porta 6383 con proxy `/api`.

### Changed
- UI con layout Material Design (tema chiaro, accenti teal/ottanio), sidebar e pagine lista principali.
- Paginazione server-side, sorting server-side e ricerca con debounce sulle liste principali.

### Fixed
- Correzioni varie su configurazioni e coerenza doc/porte rispetto allo stack (README aggiornato rispetto al runtime reale).

### Notes
- Il DB non è incluso negli export zip: per migrare i dati serve dump/restore di Postgres separato.
