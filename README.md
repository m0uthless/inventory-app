# inventory-app (Site Repository)

App web per la gestione di **Clienti**, **Siti**, **Contatti** e **Inventari** (con metadati e credenziali), con moduli **Wiki**, **Maintenance**, **Drive** e **Audit log**.

- **Backend**: Django + Django REST Framework + Postgres
- **Frontend**: React + TypeScript (Vite) + Material UI
- **Runtime**: Docker Compose + Nginx (proxy + static/media)

## Versione
- Current: **0.3.0**
- OpenAPI: `/api/schema/` (e `/api/docs/`)

---

## Porte (default)
- Frontend (nginx): `http://localhost:6383`
- Backend API (nginx): `http://localhost:6382/api/`
- Django admin: `http://localhost:6382/admin/`
- Postgres: `localhost:5432` *(solo dev; vedi note sicurezza sotto)*

---

## Quickstart (sviluppo)
1) Crea `.env` partendo da `.env.example`

2) Avvia lo stack:
```bash
docker compose up -d --build
```

3) Migrazioni + seed (lookup + gruppi/permessi di base):
```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_defaults
```

4) Crea un superuser:
```bash
docker compose exec backend python manage.py createsuperuser
```

---

## Stack / cartelle
- `backend/` — progetto Django (API, admin, auth a sessione)
- `frontend/` — React+TS (build Vite, UI MUI)
- `nginx/` — config Nginx (API proxy, static/media)
- `data/` — cartella persistente per export/import (non DB)

---

## Auth, CSRF e CORS (session-based)
L’autenticazione è **a sessione** (cookie). Il frontend usa `withCredentials` e invia CSRF via header `X-CSRFToken` (axios XSRF defaults).

### Endpoint auth
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET  /api/auth/csrf/` (inizializza il cookie CSRF)
- `GET  /api/me/` (utente + permessi + profilo)
- `POST /api/me/change-password/`

---

## Soft delete + Restore
Le entità principali supportano soft delete (`deleted_at`) e ripristino:
- query param: `include_deleted=1` / `only_deleted=1`
- action: `POST /api/<resource>/<id>/restore/`
- bulk: `POST /api/<resource>/bulk_restore/` con body `{"ids":[...]}`

---

## Drive (file/folder)
Modulo “Drive” con ACL lato API.  
⚠️ **Nginx blocca l’accesso diretto ai drive files** sotto `/api/media/drive/` per evitare bypass delle ACL.

---

## Note importanti (sicurezza / produzione)
Questa repo è pronta per LAN/dev, ma **prima di prod**:
- **Non esporre Postgres** pubblicamente (rimuovere `ports: "5432:5432"` o bind su localhost).
- Impostare `DJANGO_SECRET_KEY` forte e `DJANGO_DEBUG=0`.
- Configurare `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ORIGINS` e `CSRF_TRUSTED_ORIGINS`.
- **Non usare** `CSRF_ALLOW_ALL_ORIGINS=1` in ambienti non controllati (è un bypass dell’Origin check).
- Le credenziali inventario sono salvate in chiaro: valutare cifratura at-rest (KMS/fernet/field encryption) e policy di accesso.

---

## Dev tips
- Log backend:
```bash
docker compose logs -f backend
docker compose logs -f backend_nginx
```

- Rebuild pulito:
```bash
docker compose down -v
docker compose up -d --build
```

- Frontend in hot-reload (opzionale, senza nginx):
```bash
cd frontend
npm ci
npm run dev
```

---

## Licenza
TBD (interna/proprietaria finché non definita).
