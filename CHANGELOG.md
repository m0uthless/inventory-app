# Changelog

Tutte le modifiche rilevanti al progetto sono documentate qui.

Formato ispirato a “Keep a Changelog” + SemVer.
Le date sono in timezone Europe/Rome.

---

## [0.3.0] - 2026-02-25

### Added
- (TBD) Hardening prod: security headers, rate limiting login, audit retention config.

### Changed
- (TBD) Consolidamento endpoint Search (unificato) + ottimizzazione query.

### Fixed
- (TBD) Bugfix selezionati dalla review (vedi sezione “Roadmap 0.3.0 stabile”).

### Security
- (TBD) Riduzione superficie: rimozione opzioni “allow all origins” per CSRF in ambienti non-dev.

### Technical Debt
- (TBD) Refactor mixin soft-delete/queryset + riduzione duplicazioni.

---

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
