# Site Repository (inventory-app)

App web per la gestione di Clienti, Siti, Contatti e Inventari (con credenziali e metadati), con Wiki, Maintenance e Audit log.
Frontend in React + TypeScript (Vite + MUI) e backend Django + Postgres, orchestrati via Docker Compose.

## Versione
- Current: **0.2.1**
- Vedi `CHANGELOG.md` per lo storico.

---

## Stack
- **Backend**: Django + Django REST Framework
- **DB**: Postgres
- **Frontend**: React + TS (Vite) + Material UI
- **Reverse proxy**: Nginx (serve frontend e proxy `/api` verso backend)

---

## Porte
- **UI**: `http://localhost:6383`
- **API**: `http://localhost:6383/api` (proxy Nginx → backend)

> Nota: la UI parla sempre con l’API tramite base URL `/api`.

---

## Avvio rapido (Docker)
Prerequisiti:
- Docker + Docker Compose

1) Build & run
```bash
docker compose up -d --build
```

2) Migrations (prima installazione)
```bash
docker compose exec backend python manage.py migrate
```

3) Seed lookup di base (status, type, settings, ecc.)
```bash
docker compose exec backend python manage.py seed_defaults
```

4) Crea un utente admin
```bash
docker compose exec backend python manage.py createsuperuser
```

Apri:
- UI: `http://localhost:6383`

---

## Auth e permessi
- Autenticazione **a sessione** (cookie).
- Endpoint tipici:
  - `POST /api/auth/login/`
  - `POST /api/auth/logout/`
  - `GET /api/me/`
- UI con guard sulle route e azioni in base ai permessi.

Ruoli/gruppi tipici:
- **admin**
- **editor**
- **viewer**

---

## Funzionalità principali

### CRM
- **Customers** (codice auto `C-000001`, …)
- **Sites** (1:N con Customer)
- **Contacts** (primario per sito)

### Inventory
- Inventari con:
  - tipo/stato
  - serial/knumber
  - hostname, IP locali
  - credenziali OS/app/VNC (in chiaro lato DB: gestire accessi/permessi con attenzione)
    - le **password** sono esposte via API/UI solo con permesso `inventory.view_secrets`

### Soft delete + Restore
Molte entità supportano:
- soft delete (`deleted_at`)
- query param:
  - `?include_deleted=1`
  - `?only_deleted=1`
- endpoint restore:
  - `POST /.../{id}/restore/`

In **0.2.0** è presente anche il **Cestino unificato** (UI) con **bulk restore**.

### Audit
- Audit log su create/update/delete/restore
- In **0.2.0**: UI Audit con filtri + diff leggibile
- Tracciamento eventi auth (0.2.0):
  - `login`
  - `login_failed`
  - `logout`

### Wiki
- Pagine e categorie in Markdown
- Render HTML con hardening anti-XSS (0.1.x → 0.2.0)

### Maintenance
- Tech, templates, plans, events, notifications
- Supporto soft-delete/restore uniformato in 0.1.x/0.2.0

---

## Querystring e liste (0.2.0)
Le liste principali (Customers/Sites/Contacts/Inventory) e Audit/Trash supportano in modo coerente:
- `page`, `page_size`
- `search`
- `ordering`
- modalità vista (attivi/tutti/cestino), dove applicabile

---

## Import CSV (backend)
Sono presenti comandi di import custom (tipicamente con modalità dry-run/rollback):
- `import_customers`
- `import_sites`
- `import_contacts`
- `import_inventories`

---

## Migrazione dati / altro server
Questo progetto è pensato per essere portabile via:
- codice (zip/repo)
- docker compose
- dump del DB (se vuoi migrare i dati)

Note:
- Se non ti serve migrare i dati, basta codice + compose.
- Per migrare i dati Postgres: usa `pg_dump`/`pg_restore` sul volume/istanza Postgres.

---

## Sicurezza (note pratiche)
- Le credenziali inventario possono essere in chiaro: limita l’accesso, usa RBAC e (se necessario) cifra lato DB in futuro.
- In produzione evita configurazioni permissive (es. CORS “allow all”).
- Considera HTTPS e secure cookies lato reverse proxy.

---

## Troubleshooting
- Se cambi `.env`/env_file nel compose, spesso serve **ricreare** i container:
```bash
docker compose down
docker compose up -d --build
```

- Se la favicon non cambia, fai hard refresh:
  - Windows/Linux: `Ctrl+Shift+R`
  - macOS: `Cmd+Shift+R`
