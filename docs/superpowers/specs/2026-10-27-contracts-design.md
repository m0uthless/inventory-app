# Modulo Contratti — design

Data: 2026-10-27 · Stato: design approvato

## Obiettivo

Nuova pagina in Archie per gestire i contratti legati ai clienti, con:
- device collegabili al contratto;
- visione del valore economico (totale, per anno/mese, per venditore);
- reminder di scadenza (in-app + email).

## Decisioni prese

1. **Device anche da Archie.** I device si possono creare/modificare anche dal
   frontend Archie; essendo legati a `customer`, compaiono automaticamente nel
   Portal di quel cliente (lo scoping tenant è già in `DeviceViewSet` via
   `PortalScopedMixin`, nessuna modifica backend necessaria per l'"eredità").
   → Supera la regola "Device esclusivo di `frontend-portal`" in CLAUDE.md, da
   aggiornare.
   In Archie si gestiscono **solo i dati propri del device**: tipo, produttore,
   modello, numero seriale, inventario, stato, note — più `customer` e `site`
   (obbligatori nel modello). Restano esclusivi del Portal i dati del device
   "dentro il cliente": IP, AE Title, reparto, stanza, posizione, flag
   VLAN/DoseSR/WiFi/RIS-PACS, `DeviceWifi`, `DeviceRispacs`. Le modifiche da
   Archie usano PATCH sui soli campi base, così non toccano gli altri.
2. **Venditore = anagrafica `Seller`** con `user` opzionale: copre sia utenti
   Archie sia agenti esterni con un'unica FK sul contratto.
3. **Valore per periodo calcolato al volo** (opzione A): `total_value` spalmato
   linearmente sui mesi di durata. Nessuna tabella rate per ora; `billing_freq`
   resta come dato informativo e predispone un'eventuale `ContractInstallment`.

## Modello dati — `backend/contracts/`

```python
class Seller(TimeStampedModel):            # soft delete
    name      = CharField
    email     = EmailField(blank=True)
    phone     = CharField(blank=True)
    user      = OneToOneField(User, null=True, blank=True)   # se è un utente Archie
    is_active = BooleanField(default=True)

class Contract(TimeStampedModel):          # soft delete
    customer      = FK(crm.Customer, PROTECT)
    code          = CharField(unique)
    title         = CharField
    contract_type = TextChoices            # assistenza / noleggio / licenza / altro
    seller        = FK(Seller, SET_NULL, null=True)
    start_date    = DateField
    end_date      = DateField
    auto_renew    = BooleanField
    notice_days   = PositiveIntegerField(default=90)
    total_value   = DecimalField(12, 2)
    billing_freq  = TextChoices            # una_tantum / mensile / trimestrale / annuale
    status        = TextChoices            # bozza / attivo / disdetto  (scaduto = derivato)
    document      = FileField(blank=True)  # servito via API, non via nginx
    notes         = TextField(blank=True)
    devices       = M2M(device.Device, through="ContractDevice", blank=True)
    custom_fields = JSONField(default=dict)

class ContractDevice(models.Model):
    contract = FK(Contract, CASCADE)
    device   = FK(device.Device, CASCADE)
    # unique (contract, device)
```

Proprietà derivate (serializer/annotate):
- `notice_deadline = end_date - notice_days` → la data che guida i reminder;
- `expiry_state`: `ok` / `notice` (entro preavviso) / `expiring` (≤30 gg) / `expired`.

Validazioni: `end_date >= start_date`; i device collegati devono appartenere a
`contract.customer`.

## API

- `ContractViewSet`, `SellerViewSet`: `SoftDeleteAuditMixin`,
  `RestoreActionMixin`, `PurgeActionMixin`, `CustomFieldsValidationMixin`;
  **permesso interno** (`IsInternalOrPortalDedicatedApp`): i contratti NON sono
  esposti al Portal.
- Permesso custom `contracts.view_contract_value`: senza, gli importi vengono
  omessi dal serializer e `stats` risponde 403.
- `GET /api/contracts/stats/?year=YYYY&group_by=month|seller|customer|type`
  — ripartizione lineare: valore mensile = `total_value / mesi_durata`,
  sommato sui mesi che cadono nel periodo richiesto.
- `GET /api/contracts/expiring/?days=90`.
- `GET /api/contracts/{id}/document/` — download con check permessi.
- Registrazione nel `DefaultRouter` + `npm run gen:api`.

## Reminder

- `NotificationType.CONTRACT_EXPIRING`.
- `refresh_notifications._sync_contracts_expiring()`: contratti attivi con
  `notice_deadline` entro 90 gg o già superata e `end_date` non passata da più
  di 30 gg. `source_key = contract:<id>`, `event_date = notice_deadline`
  (dedup email già gestito da `last_emailed_event_date`).
- Destinatari: `seller.user` (se presente) + gruppo `Contratti - Reminder`
  (creato da `seed_defaults`).
- Inclusione nel digest delle 8:00 (`send_deadline_digest`).

## Frontend Archie

`frontend/src/features/contracts/`:
- **Lista** (DataGrid): filtri cliente / venditore / stato / tipo / anno; chip
  colorato su `expiry_state`.
- **Dettaglio/drawer**: dati, device collegati (picker filtrato per cliente +
  "nuovo device" inline), PDF, audit.
- Rinnovo **manuale**: azione "Rinnova" che apre il form precompilato con
  nuove date (stesso contratto, `end_date` aggiornata); `auto_renew` è solo
  informativo (badge + testo nel reminder).
- **Cruscotto** in testa: KPI (valore attivo, in scadenza ≤90 gg, rinnovi del
  mese), barre per mese, ripartizione per venditore.
- Tab "Contratti" nella scheda Cliente.
- Pagina/dialog anagrafica Venditori.

`frontend/src/features/devices/` (nuovo, per decisione 1):
- Tab "Device" nella scheda Cliente: lista + create/edit dei soli campi base
  (vedi decisione 1).

## Fasi

1. Backend `contracts` (modelli, migrazione, API, permessi, test) + CRUD
   frontend contratti/venditori + device in Archie (tab cliente + picker).
2. Reminder (notifiche + email + digest).
3. Statistiche + cruscotto.
4. (Eventuale) rate / collegamento Purchase Order.

## Decisioni ulteriori

- Device in Archie: solo campi base (vedi decisione 1).
- Il Portal **non** vede i contratti.
- `auto_renew` solo informativo, rinnovo sempre manuale.
