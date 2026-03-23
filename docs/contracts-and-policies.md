# Contracts and policies baseline (0.5.1)

Questo documento raccoglie i contratti applicativi che, dopo le patch 28-36, sono considerati baseline del progetto. Se cambi uno di questi comportamenti, aggiorna anche test, UI e changelog.

## 1. Restore policy

### Endpoint canonici
- `POST /api/<resource>/<id>/restore/`
- `POST /api/<resource>/bulk_restore/` con body `{"ids": [1, 2, 3]}`

### Compatibilita legacy temporanea
Sono ancora accettati anche questi alias:
- `/api/inventory/<id>/restore/`
- `/api/inventory/bulk_restore/`
- `/api/custom-fields/<id>/restore/`
- `/api/custom-fields/bulk_restore/`

Questi alias esistono solo per compatibilita con client/test piu vecchi. I path di riferimento restano quelli pluralizzati del router (`/api/inventories/...`, `/api/custom-field-definitions/...`).

### Restore bloccato
Il restore singolo deve restituire `409` quando manca ancora un parent necessario. Esempi:
- `Site` bloccato se il `Customer` e ancora deleted
- `Contact` bloccato se `Customer` o `Site` sono deleted
- `Inventory` bloccato se `Customer` o `Site` sono deleted
- `MaintenancePlan` bloccato se il `Customer` e deleted

Payload minimo atteso per il caso bloccato:

```json
{
  "detail": "Restore blocked by deleted parent",
  "blocked_by": [
    {"model": "customer", "id": 12}
  ]
}
```

### Bulk restore
Il bulk restore non deve fallire in modo binario se una parte degli elementi e bloccata. Deve distinguere chiaramente tra:
- elementi ripristinati
- elementi bloccati

Shape minima attesa:

```json
{
  "count": 2,
  "restored_ids": [10, 11],
  "blocked_count": 1,
  "blocked": [
    {"id": 12, "blocked_by": [{"model": "customer", "id": 3}]}
  ]
}
```

## 2. Inventory secrets

I campi secrets supportati sono:
- `os_pwd`
- `app_pwd`
- `vnc_pwd`

Regole baseline:
- in list non devono comparire
- in detail sono leggibili solo con permesso `inventory.view_secrets`
- anche la scrittura/modifica di questi campi richiede `inventory.view_secrets`
- un tentativo di update senza quel permesso deve rispondere `403`

## 3. CRM integrity

Per i `Contact` vale questo vincolo: il `site` selezionato deve appartenere allo stesso `customer` del contatto.

Quindi create e partial update devono restituire `400` se il pairing `customer/site` e incoerente.

Per il dettaglio `Site`, `province` e `country` fanno parte del contratto esposto al frontend.

## 4. Custom fields normalization

La normalizzazione dei `custom_fields` e baseline su almeno queste entita:
- `Customer`
- `Site`
- `Inventory`
- `MaintenancePlan`

Comportamenti attesi:
- validazione coerente per `string`, `number`, `bool`, `date`, `select`, `multiselect`
- alias user-friendly canonicalizzati sulla chiave definita (`service_window`, ecc.)
- valori invalidi per campi tipizzati devono restituire `400`

## 5. Public status endpoints

Endpoint pubblici supportati:
- `GET /api/health/`
- `GET /api/system-stats/`
- `GET /healthz` (frontend nginx)

Shape minima `GET /api/health/`:

```json
{
  "status": "ok",
  "database": "ok",
  "version": "0.5.1"
}
```

Shape minima `GET /api/system-stats/`:

```json
{
  "inventory_count": 142,
  "uptime": "3d 4h",
  "version": "0.5.1"
}
```

## 6. Note operative

Quando tocchi una di queste aree, aggiorna almeno:
- `CHANGELOG.md`
- `docs/regression-checklist.md`
- `docs/release-checklist.md`
- i test contrattuali coinvolti
