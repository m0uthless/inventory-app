# Changelog

Tutte le modifiche rilevanti al progetto sono documentate qui.

Formato ispirato a “Keep a Changelog” + SemVer.
Le date sono in timezone Europe/Rome.

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
