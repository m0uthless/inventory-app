# Changelog

Tutte le modifiche rilevanti al progetto sono documentate qui.

Formato ispirato a “Keep a Changelog”.
Le date sono in timezone Europe/Rome.

---

## [0.3.0] - Unreleased

### Added
- Permission `inventory.view_secrets` per limitare la visualizzazione delle password inventario (OS/App/VNC).

### Changed
- UI Inventory: le password sono mascherate e visibili/copiabili solo agli utenti con permesso `inventory.view_secrets`.
- UI Login: dopo l'autenticazione si torna sempre alla Dashboard (/) invece dell'ultima pagina visitata.

## [0.2.1] - 2026-02-18

### Fixed
- UI: endpoint bulk restore inventari allineato al backend (`/inventories/bulk_restore/`).
- API: ordinamenti coerenti con i campi usati in UI (alias ordering su label/display_name per CRM e Inventory).
- API: bulk restore Contatti ora ri-applica la regola del “primario” per evitare duplicati.
- API: credenziali inventario disponibili nel dettaglio (retrieve) ma non in list (più coerente e più sicuro).

### Changed
- Allineamento metadati di versione (frontend package*, OpenAPI).
- Pulizia repo: aggiunto `.gitignore`, previsto `data/.gitkeep`.

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

### Notes / Migration
- Le liste usano query params coerenti (`search`, `ordering`, `view`), mantenendo compatibilità con alcuni parametri legacy quando presenti.
- Eventi auth compaiono in Audit solo se passano dagli endpoint backend (es. logout non tracciabile se chiudi il browser senza chiamare API).

---

## [0.1.0] - 2026-02-17

### Added
- Backend Django + Postgres con moduli:
  - `core`, `crm`, `inventory`, `maintenance`, `wiki`, `audit`, `custom_fields` (JSON custom fields su alcune entità).
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
- Wiki e Maintenance presenti ma con priorità evolutiva successiva (feature “hold”/espandibili).
- Il DB non è incluso negli export zip: per migrare i dati serve dump/restore di Postgres separato.

