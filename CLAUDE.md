# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

**ARCHIE** (`inventory-app`) is an enterprise inventory/asset management platform built for **Biotron S.p.A.**, covering clients, sites, contacts, inventories (with metadata and credentials), Wiki, Maintenance, Drive, and Audit-log modules.

- Backend: Django 5 + DRF + PostgreSQL + Redis. Frontend: React 19 + TypeScript (Vite) + MUI v7.
- Runtime: Docker Compose + Caddy (public reverse proxy, auto-TLS) + nginx (internal static/media serving).
- Repo: `m0uthless/inventory-app`. Dev machine: `poseidon`. Production: `archie` server, live at `archie.biotron.it` (main app) / `portal.biotron.it` (Portal), app deployed at `/opt/inventory-app`.
- **Sole developer / release manager:** Fede (Federico Mutuale). All work happens on the `dev` branch — **never commit directly to `main`**; releases go through the dedicated release toolchain (see below).

There are **two separate frontends** sharing the same backend: `frontend/` (main Archie app, internal staff) and `frontend-portal/` (customer-facing Portal, e.g. Biotron's AUSL BO tenant), plus a shared component library in `shared/src/`.

## Commands

Everything backend runs inside Docker; there's no local Python venv workflow described in the repo.

**Always use the dual-compose-file pattern for dev** — this is not optional, it's how the dev environment is defined:

```bash
cp .env.dev .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python manage.py migrate
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python manage.py seed_defaults   # lookups + base groups/permissions
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python manage.py createsuperuser
```

One-off management commands (e.g. app-scoped migrations) use an empty entrypoint:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --entrypoint "" backend python manage.py migrate [app]
```

The container is always named **`backend`** — never `web`.

Common `make` targets (see `Makefile` for the full list — verify they already wrap the dual-file invocation above): `make up`, `make down`, `make rebuild`, `make logs-backend`, `make shell` (Django shell), `make bash-backend`, `make migrate`, `make makemigrations-<app>`, `make health`.

Backend tests:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest -q
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest path/to/test_x.py -q -k some_test
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python manage.py test
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python -m mypy --config-file mypy.ini .
```

Frontend (either `frontend/` or `frontend-portal/`):
```bash
npm ci
npm run dev
npm run build          # tsc -b && vite build
npm run lint
npx tsc --noEmit
npm run test:run        # vitest run (single run, non-watch)
npm run test            # vitest watch mode
```

Regenerate the typed API client from the live OpenAPI schema (`frontend/` only):
```bash
npm run gen:api          # writes src/api/generated.ts
```

Full local quality gate (mirrors CI):
```bash
./scripts/check.sh
SKIP_AUDIT=1 ./scripts/check.sh
```
**Known issue:** `scripts/check-frontend.sh` references a `frontend-auslbo` directory that doesn't exist in this checkout (the real directory is `frontend-portal`) — that half of the script fails as-is. Check `frontend/` and `frontend-portal/` manually until the script is fixed.

Smoke tests: `make smoke` (`./scripts/smoke.sh full`) / `make smoke-quick`.

### Mandatory pre-delivery verification chain

Before considering any change complete, run the full chain and compare against baseline — **any new problem beyond baseline is a blocker**:

- Frontend: `tsc -b --force` → `npm run build` → `npm run lint` (baseline: 30 problems) → `npx vitest run` (baseline: 62/62 passing as of v0.9.5)
- Backend: `python manage.py check` → `makemigrations --check --dry-run`
- Any new migration: apply and verify it before considering the change done.

## Architecture

### Backend: app-per-domain Django project

`backend/config/` is the Django project (settings, root urls, auth views, search, system stats). Each business domain is its own app at `backend/<app>/` (e.g. `crm`, `inventory`, `device`, `vlan`, `wiki`, `drive`, `issues`, `maintenance`, `servicenow`, `attendance`, `expenses`, `purchaseorders`, `custom_fields`, `notifications`, `portal`, `audit`, `feedback`). `core/` holds cross-cutting infrastructure, not a domain of its own.

All API routes are registered in `backend/config/urls.py` via a single DRF `DefaultRouter`.

### `core/` — shared infrastructure, read before touching cross-cutting behavior

- `core/soft_delete.py` — `?include_deleted=1` / `?only_deleted=1` query params, centralized soft-delete convention.
- `core/mixins.py` — `SoftDeleteAuditMixin`, `RestoreActionMixin`, `PurgeActionMixin`, `CustomFieldsValidationMixin`. Most viewsets compose these instead of reimplementing delete/restore/purge.
- `core/permissions.py` — shared DRF permission classes (`CanRestoreModelPermission`, `IsStaffOrAdminGroup`, `HasManageUsersPermission`, etc.).
- `core/crypto.py` — Fernet at-rest encryption for sensitive fields (inventory/VPN/WiFi credentials); requires `FIELD_ENCRYPTION_KEY` in production. Decrypted-secret read access is additionally gated by dedicated permissions (`inventory.view_secrets`, `crm.view_vpn_secrets`, `device.view_wifi_secrets`).
- `core/restore_policy.py` / `core/restore_actions.py` / `core/purge_policy.py` — parent/child restore blocking (`409` with `{detail, blocked_by}`) and purge eligibility.
- `core/middleware.py` — `SessionIdleTimeoutMiddleware`, `CsrfAllowAllOriginsMiddleware` (dev/LAN-only escape hatch).

### Security barrier: Portal / Archie access separation — READ BEFORE ADDING ANY VIEWSET

`IsInternalOrPortalDedicatedApp` in `DEFAULT_PERMISSION_CLASSES` is the core gate separating internal-staff access (Archie) from customer access (Portal) — this closed audit finding WP-03. **Any new ViewSet must explicitly extend this permission class**, or it risks silently bypassing the Portal/Archie boundary. Check this proactively whenever adding a ViewSet, the same way it was caught for `NotificationViewSet` during the 0.9.5 delivery.

### Auth & CSRF

Session-based (cookie) auth, not tokens. Frontend uses axios `withCredentials` + XSRF defaults (`X-CSRFToken` header from cookie). Key endpoints: `POST /api/auth/login/`, `POST /api/auth/logout/`, `GET /api/auth/csrf/`, `GET /api/me/`, `POST /api/me/change-password/`.

**`SESSION_COOKIE_DOMAIN` must remain unset in production.** This is documented as must-not-set in both `settings.py` and `.env.example`. Setting it would share the session cookie across `archie.biotron.it` / `portal.biotron.it`, which breaks the server-side `ambito` session mechanism for users with dual profiles (internal + portal access).

`CSRF_ALLOW_ALL_ORIGINS=1` (env var) swaps in `core.middleware.CsrfAllowAllOriginsMiddleware`. Settings.py enforces this can only be enabled when `DEBUG=1` — dev/LAN-only, never a pattern to extend into prod.

### Soft delete / restore / purge convention

`deleted_at` field, `?include_deleted=1` / `?only_deleted=1` list filters, `POST /api/<resource>/<id>/restore/`, bulk `POST /api/<resource>/bulk_restore/` with `{"ids":[...]}`. Restore blocked with `409` if a required parent is still trashed. Legacy alias paths (`/api/inventory/...`, `/api/custom-fields/...`) exist purely for backward compatibility — canonical routes are the router-registered plural ones (`/api/inventories/...`, `/api/custom-field-definitions/...`).

### Migration discipline

**Never edit an already-applied migration.** Always create a new `AlterField`/`AddField` migration instead. Use `migrate --fake` only for the schema-already-exists edge case.

### Drive module

File/folder storage with API-side ACLs (`backend/drive/`). Nginx deliberately blocks direct access to `/api/media/drive/` — files must be served through the API so ACL checks aren't bypassable. Don't add a static/nginx passthrough for drive files.

### Portal (multi-tenant scoping)

`backend/portal/` + `frontend-portal/` implement the customer-facing portal. Tenant scoping is enforced entirely server-side from `request.user` — never trust a client-supplied header/param as a tenant boundary in portal code.

**Device/VLAN exclusivity:** `Device`, `DeviceType` (with `dose_sr`), `DeviceManufacturer` (logo), `Rispacs` M2M, and `DeviceWifi` (Fernet-encrypted password, `.p12` upload) remain **exclusive to `frontend-portal`** and are not ported to the main Archie frontend.

### Custom fields

`backend/custom_fields/` provides a generic, admin-configurable custom-fields system; `core.mixins.CustomFieldsValidationMixin` is how app serializers validate/normalize the `custom_fields` payload.

### Frontend structure

`frontend/src/` is organized by `features/<domain>/` (customers, contacts, inventory, wiki, issues, expenses, purchaseorders, servicenow, pianoferie/attendance, monitor, dashboard, audit, ...) alongside `layout/`, `pages/`, `ui/`, `auth/`, `api/`, `hooks/`, `theme/`. `frontend-portal/` mirrors a scoped subset.

**Known bug pattern — static theme import:** `import { theme } from '../theme'` at module level always resolves to the default theme regardless of the active theme (navy/temp). Always use the `useTheme()` hook inside components instead.

**Explicit exception:** hardcoded hex color values in `pianoFerieShared.ts` are intentional and must **not** be changed as part of any color/theme refactor.

### Runtime topology (docker-compose.yml)

`caddy` (edge proxy, ports 80/443/8081) → `frontend` / `frontend-portal` (static builds, internal 8080) and `backend_nginx` (static/media + proxy to `backend`). `backend` is Django/Gunicorn behind nginx, healthcheck on `/api/health/`. `db` is Postgres 16, `redis` is cache/broker. `cron` runs the same backend image with an empty entrypoint, looping management commands directly in shell (`refresh_notifications` every 15 min, `close_resolved_issues` every hour) — there is no Celery beat or real scheduler. `RUN_MIGRATIONS` / `RUN_COLLECTSTATIC` are env-controlled and disabled in the prod compose override, where they run as explicit deploy steps instead.

Dev override: `docker-compose.dev.yml`. Production override: `docker-compose.prod.yml` + `.env.prod`.

**Known Caddy/Docker issue (prod):** when git replaces the Caddyfile (new inode), a running Caddy container's bind mount can retain the old inode, and `caddy reload` reports "config is unchanged" even though the file changed. Fix: `docker compose $COMPOSE_FILES up -d --force-recreate caddy`. Treat `force-recreate caddy` as the standard post-deploy step whenever the Caddyfile changes, not just a fallback when reload fails.

## Release & versioning workflow

Keep a Changelog + Semantic Versioning. The release toolchain (`release-save.sh`, `release-push.sh`, `fix-save.sh`, `fix-push.sh`, `prod-sync.sh`, `status.sh`, `archie-dev-common.sh`) lives **outside this repo**, at `/home/fede/scripts` — it is not checked in and Claude Code won't see it by scanning the repo.

- `release-push.sh`'s `normalize_category()` requires **English section headers** (`Added`/`Changed`/`Fixed`/`Security`) — never write Italian headers (Sicurezza/Migliorie/Corretti).
- All new changelog content goes under `## [Unreleased]` — never write a version header directly into the file; the release script promotes `[Unreleased]` to a version on release.
- Flow: implement → run the full verification chain above → package the delivery zip (see below) → `release-save` → follow through `release-push` for the prod push.

### Delivery zip convention

When packaging a change for handoff/testing: name it `archie-xxxxxxx-NN.zip` (`xxxxxxx` = short identifier for the change, `NN` = sequential number — same feature gets `-01`, `-02`, ... for patches; a different feature gets a new identifier). Contains **only** modified/created files. Internal structure mirrors the project starting from the directories inside `inventory-app/`. Exclude `.claude`, `.git`, `__pycache__`, `node_modules`, and any other generated/cache directories.

## Roadmap guardrails

- The `pacs_sql` module (Oracle Vue PACS text-to-SQL) is currently **on HOLD** — do not develop or extend it until explicitly unblocked, even if related schema/reference files are present in the project.
- `pacs_log_report.py` (if encountered) is a standalone local tool and will **not** be integrated into Archie — it belongs to a separate future project.

## Security notes worth carrying into any change

- Never remove/weaken the `FIELD_ENCRYPTION_KEY` requirement or the secrets-permission gates in `core/permissions.py` without deliberate discussion.
- Never treat a client-supplied value as a tenant/permission boundary in `portal/` — scoping must be re-derived server-side from `request.user`.
- Any new ViewSet must extend `IsInternalOrPortalDedicatedApp` (or an equivalent explicit check) — don't let a new endpoint silently bypass the Portal/Archie barrier.
- `SESSION_COOKIE_DOMAIN` must stay unset in production — flag it if you ever see it set.
- Postgres port exposure (`5432:5432`) and `CSRF_ALLOW_ALL_ORIGINS=1` are dev/LAN conveniences only — flag them if seen enabled outside `docker-compose.dev.yml`/`.env.dev`.
