# Release checklist

## 1. Preparazione configurazione

```bash
cp .env.example .env
# oppure per sviluppo
cp .env.dev .env
```

Verificare almeno questi valori prima del deploy:
- `APP_VERSION=0.5.0`
- `DJANGO_DEBUG=0` in produzione
- `DJANGO_ALLOWED_HOSTS` valorizzato con host/IP reali
- `DJANGO_CORS_ORIGINS` e `CSRF_TRUSTED_ORIGINS` coerenti con il reverse proxy
- `FIELD_ENCRYPTION_KEY` persistente e salvata fuori dal repo
- `RUN_MIGRATIONS=0` e `RUN_COLLECTSTATIC=0` in prod se il deploy e controllato manualmente

## 2. Avvio stack

```bash
# sviluppo
cp .env.dev .env
docker compose up -d --build

# produzione
# compila/verifica .env.prod e poi avvia lo stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## 3. Backend post-deploy

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_defaults
docker compose exec backend python manage.py createsuperuser
```

In produzione il compose override imposta `RUN_MIGRATIONS=0` e `RUN_COLLECTSTATIC=0`, quindi queste operazioni vanno gestite come step espliciti di deploy.

## 4. Acceptance rapida

```bash
make health
./scripts/smoke.sh quick
```

Controlli minimi consigliati prima di dichiarare la release pronta:
- login/logout e caricamento stats pubbliche nella pagina di login
- ricerca globale con deep-link funzionante
- restore singolo e bulk dal Trash, inclusi casi bloccati con parent ancora deleted
- visualizzazione e update dei secrets Inventory con e senza `inventory.view_secrets`
- create/edit `Contact` con validazione coerente `customer/site`
- custom fields su Customer/Site/Inventory/Maintenance con alias canonicalizzati e type-check corretto
- apertura Wiki e restore revisione

## 5. Contratti applicativi da non rompere

Riferimento esteso: `docs/contracts-and-policies.md`.

Punti chiave:
- `POST /api/<resource>/<id>/restore/` deve restituire `409` quando il parent richiesto e ancora eliminato.
- `POST /api/<resource>/bulk_restore/` deve distinguere tra elementi ripristinati e bloccati (`count`, `blocked`, `blocked_count`).
- I secrets Inventory sono leggibili e scrivibili solo da utenti con `inventory.view_secrets`.
- Gli alias legacy `/api/inventory/...` e `/api/custom-fields/...` esistono solo per retrocompatibilita con client/test piu vecchi: i path canonici restano quelli pluralizzati del router.

## 6. Hardening produzione

- Tenere `DJANGO_DEBUG=0`.
- Non esporre Postgres all'esterno della rete Docker.
- Attivare HTTPS sul reverse proxy pubblico prima di alzare `DJANGO_SECURE_SSL_REDIRECT` e HSTS.
- Eseguire `python manage.py check --deploy` oppure lasciare `DJANGO_RUN_DEPLOY_CHECK=1`.
- Fare backup regolari del database e della `FIELD_ENCRYPTION_KEY`.

## 7. Osservabilita minima

Endpoint pubblici utili:

- `GET /api/health/` → stato backend + database
- `GET /api/system-stats/` → statistiche login page
- `GET /healthz` → liveness frontend nginx

Con Docker Compose puoi verificare lo stato dei container con:

```bash
docker compose ps
```
