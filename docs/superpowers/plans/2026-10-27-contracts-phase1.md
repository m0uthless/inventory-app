# Contratti — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nuovo modulo `contracts` (contratti + anagrafica venditori) con CRUD completo in Archie, device collegabili al contratto e gestibili da Archie (solo campi base).

**Architecture:** Nuova app Django `backend/contracts/` sullo stesso schema di `purchaseorders` (models + api.py + tests/), registrata nel `DefaultRouter`. I device restano in `backend/device/` senza modifiche backend: Archie usa il `DeviceViewSet` esistente con PATCH sui soli campi base. Frontend Archie: pagina `/contracts` + `features/contracts/` e `features/devices/`, due nuove tab nel drawer Cliente.

**Tech Stack:** Django 5 + DRF, pytest; React 19 + TS + MUI v7, vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-contracts-design.md`

## Global Constraints

- Tutti i comandi backend: `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend ...` (container `backend`).
- Lavoro su `develop`, mai commit su `main`.
- Ogni ViewSet nuovo: `permission_classes = [PortalModelPermissions, IsInternalOrPortalDedicatedApp]` (da `portal.permissions`) — lettura richiede `view_<model>`, Portal sempre escluso.
- Il Portal **non** vede i contratti.
- Device da Archie: scrivibili solo `site`, `type`, `status`, `manufacturer`, `model`, `serial_number`, `inventario`, `note` (+ `customer` in creazione). Mai inviare `ip`, `aetitle`, `reparto`, `room`, `location`, `vlan`, `dose`, `wifi`, `rispacs`.
- I device sono **opzionali**: un contratto (es. di assistenza) può non avere alcun device collegato. Nessuna validazione, campo o UI deve richiederli.
- `auto_renew` è solo informativo: nessuna logica automatica sulle date.
- PDF del contratto servito solo via API (`protected_media_response`), mai via nginx.
- Mai modificare una migrazione già applicata.
- Changelog: sezioni inglesi (`Added`/`Changed`/`Fixed`/`Security`) sotto `## [Unreleased]`.
- Verifica finale: frontend `tsc -b --force` → `npm run build` → `npm run lint` (baseline 30 problemi) → `npx vitest run` (baseline 62/62 + i nuovi); backend `manage.py check` → `makemigrations --check --dry-run` → `pytest -q`.

**Scope cut rispetto allo spec:** `custom_fields` sul contratto rinviato (richiederebbe una nuova `Entity` in `custom_fields` + migrazione + UI admin). Statistiche (`stats`), `expiring` e reminder sono fasi 2–3.

## Review Focus

1. Device di un altro cliente collegato al contratto → 400, non salvataggio silenzioso. (Task 2)
2. Utente senza `contracts.view_contract_value`: `total_value` assente in lista/dettaglio e una PATCH con `total_value` non lo modifica. (Task 2)
3. Modifica di un device da Archie che non azzera IP/flag WiFi/RIS-PACS impostati dal Portal. (Task 3 backend, Task 6 payload)
4. Rinnovo da fine mese (es. contratto 2025-01-31 → 2026-01-31): le nuove date non devono sforare né saltare giorni. (Task 5)
5. Codice contratto riusato dopo soft delete di un contratto con lo stesso codice → consentito. (Task 1)

---

### Task 1: App `contracts` — modelli e migrazione

**Files:**
- Create: `backend/contracts/__init__.py`, `apps.py`, `models.py`, `admin.py`, `migrations/__init__.py`, `migrations/0001_initial.py` (generata), `tests/__init__.py`, `tests/test_models.py`
- Modify: `backend/config/settings.py` (INSTALLED_APPS, dopo `purchaseorders`), `backend/core/permission_modules.py` (`MODULE_LABELS["contracts"] = "Contratti"`)

**Interfaces:**
- Produces:
  - `ContractType(TextChoices)`: `assistenza`, `noleggio`, `licenza`, `altro`
  - `BillingFrequency(TextChoices)`: `una_tantum`, `mensile`, `trimestrale`, `annuale`
  - `ContractStatus(TextChoices)`: `bozza`, `attivo`, `disdetto`
  - `ExpiryState`: costanti stringa `"none" | "ok" | "notice" | "expiring" | "expired"`; `EXPIRING_DAYS = 30`
  - `Seller(TimeStampedModel)`: `name` (255), `email` (blank), `phone` (64, blank), `user` OneToOne(User, null, SET_NULL, related_name="seller"), `is_active` (default True), `created_by`/`updated_by`
  - `Contract(TimeStampedModel)`: `customer` FK(Customer, PROTECT, related_name="contracts"), `code` (64), `title` (255), `contract_type`, `seller` FK(Seller, null, SET_NULL, related_name="contracts"), `start_date`, `end_date`, `auto_renew` (False), `notice_days` PositiveInteger (default 90), `total_value` Decimal(12,2, default 0), `billing_freq` (default `annuale`), `status` (default `bozza`), `document` FileField(upload_to `contracts/documents/<pk|tmp>/<filename>`, blank), `document_original_filename` (255, blank), `notes` (blank), `devices` M2M(device.Device, through="ContractDevice", related_name="contracts"), `created_by`/`updated_by`
  - `Contract.Meta.permissions = [("view_contract_value", "Can view contract economic value")]`; `UniqueConstraint(fields=["code"], condition=Q(deleted_at__isnull=True), name="ux_contracts_code_active")`; indici su `customer+deleted_at`, `seller`, `end_date`, `status`
  - `Contract.notice_deadline -> date` (property): `end_date - timedelta(days=notice_days)`
  - `Contract.expiry_state_on(today: date) -> str`
  - `ContractDevice`: `contract` FK CASCADE (related_name="device_links"), `device` FK CASCADE, `UniqueConstraint(contract, device)`

- [ ] **Step 1: Write the failing tests** in `backend/contracts/tests/test_models.py`

```python
# helper _contract(**kw) crea customer (CustomerStatus get_or_create) + Contract
def test_notice_deadline():          # end 2027-03-31, notice 90 → date(2026, 12, 31)
def test_expiry_state_bozza_and_disdetto_are_none():   # status bozza/disdetto → "none" anche se scaduto
def test_expiry_state_expired():     # attivo, end 2026-10-26, today 2026-10-27 → "expired"
def test_expiry_state_expiring():    # attivo, end = today + 30 → "expiring"; today + 31 con notice 0 → "ok"
def test_expiry_state_notice():      # attivo, end today+60, notice 90 → "notice"
def test_expiry_state_ok():          # attivo, end today+200, notice 90 → "ok"
def test_code_unique_only_among_active():  # stesso code: IntegrityError; dopo deleted_at=now() sul primo → crea ok
```

- [ ] **Step 2: Run** `... exec backend pytest contracts/tests/test_models.py -q` — Expected: FAIL (`ModuleNotFoundError: contracts`).

- [ ] **Step 3: Implement models** — ordine in `expiry_state_on`: status ≠ `attivo` → `none`; `end_date < today` → `expired`; `end_date - today <= EXPIRING_DAYS` → `expiring`; `today >= notice_deadline` → `notice`; altrimenti `ok`. Registrare app, `MODULE_LABELS`, admin semplice (list_display code/customer/end_date/status).

- [ ] **Step 4: Generate & apply migration** — `... run --entrypoint "" backend python manage.py makemigrations contracts` poi `... exec backend python manage.py migrate contracts`. Expected: `Applying contracts.0001_initial... OK`.

- [ ] **Step 5: Run tests** — Expected: 7 passed.

- [ ] **Step 6: Commit** — `git commit -m "feat(contracts): modelli Contract, Seller, ContractDevice"`

---

### Task 2: API `sellers` e `contracts`

**Files:**
- Create: `backend/contracts/api.py`, `backend/contracts/tests/test_api.py`
- Modify: `backend/config/urls.py` (import + `router.register(r"contracts", ContractViewSet, basename="contract")`, `router.register(r"sellers", SellerViewSet, basename="seller")`)

**Interfaces:**
- Consumes: modelli Task 1.
- Produces (endpoint consumati dal frontend):
  - `/api/sellers/` — campi: `id, name, email, phone, user, user_username, is_active, created_at, updated_at, deleted_at`; filtri `is_active`, `user`; search `name, email`.
  - `/api/contracts/` — campi: `id, code, title, customer, customer_name, contract_type, contract_type_label, seller, seller_name, start_date, end_date, notice_days, notice_deadline, auto_renew, total_value*, billing_freq, billing_freq_label, status, status_label, expiry_state, devices (list[int]), devices_detail (list[{id, label, serial_number}]), document_url, document_filename, notes, created_at, updated_at, deleted_at`. `*` solo con `contracts.view_contract_value`.
  - filterset: `customer, seller, status, contract_type, auto_renew, year` (year = contratti attivi in quell'anno: `start_date__year <= y <= end_date__year`); search `code, title, customer__name, customer__display_name, seller__name`; ordering `code, title, end_date, start_date, total_value, updated_at, customer__display_name, seller__name`; default `["end_date"]`.
  - `POST/GET/DELETE /api/contracts/{id}/document/` — upload multipart campo `file` (PDF, 15 MB, stesso `validate_upload` dei PO), download inline, rimozione.
  - restore/bulk_restore/purge da mixin.

- [ ] **Step 1: Write the failing tests** in `test_api.py` (helper `_internal_user(perms)` come in `device/tests/test_rispacs_permissions.py`: `access_archie` + permessi indicati; helper `_portal_user(customer)`):

```python
def test_list_requires_view_contract():            # internal senza view_contract → 403; con → 200
def test_portal_user_forbidden():                  # portal user con view_contract, sessione con ambito="portal"
                                                   # (pattern di vlan/tests/test_portal_scoping.py:170-173:
                                                   # session["ambito"]="portal"; session.save(); cookie sessionid)
                                                   # GET /api/contracts/ e /api/sellers/ → 403
def test_create_contract_without_devices():        # POST assistenza senza chiave devices → 201, devices == []; anche devices=[] → 201
def test_create_contract_with_devices():           # POST con devices=[d1] del customer → 201, devices == [d1.id]
def test_device_of_other_customer_rejected():      # devices=[d_altro_cliente] → 400, "devices" in errors
def test_end_before_start_rejected():              # end_date < start_date → 400, "end_date" in errors
def test_total_value_hidden_without_perm():        # view_contract senza view_contract_value → "total_value" not in item
def test_total_value_not_writable_without_perm():  # PATCH total_value=999 con change ma senza value perm → 200, DB invariato
def test_expiry_state_and_notice_deadline_in_payload()
def test_year_filter():                            # contratto 2025-01-01→2027-12-31 in ?year=2026; 2023→2024 escluso
def test_document_upload_download_delete():        # 201, GET 200 application/pdf, DELETE 204 e document vuoto
def test_soft_delete_and_restore():                # DELETE → deleted_at valorizzato; POST restore → null
def test_sellers_crud_and_user_link():             # POST seller con user → user_username nel payload
```

- [ ] **Step 2: Run** `... exec backend pytest contracts/tests/test_api.py -q` — Expected: FAIL (404 sulle route).

- [ ] **Step 3: Implement** `SellerViewSet(RestoreActionMixin, PurgeActionMixin, SoftDeleteAuditMixin, ModelViewSet)` e `ContractViewSet(...)` stessi mixin, `permission_classes = [PortalModelPermissions, IsInternalOrPortalDedicatedApp]`, queryset via `apply_soft_delete_filters`, `select_related("customer", "seller")`, `prefetch_related("devices")`. Serializer: in `get_fields()` rimuovere `total_value` se `not request.user.has_perm("contracts.view_contract_value")`; `validate()` verifica `end_date >= start_date` e `device.customer_id == customer_id` per ogni device (su update usare il customer dell'istanza se non nel payload). `devices` = `PrimaryKeyRelatedField(many=True, required=False, queryset=Device.objects.filter(deleted_at__isnull=True))`. `expiry_state` = `obj.expiry_state_on(timezone.localdate())`. `document_url` con `build_action_url`. Azione `document` modellata su `PurchaseOrderEntryViewSet.documents` (stesso `_validate_document`, `protected_media_response`).

- [ ] **Step 4: Run tests** — Expected: 13 passed. Poi `... exec backend python manage.py check` → `System check identified no issues`.

- [ ] **Step 5: Commit** — `git commit -m "feat(contracts): API contratti e venditori"`

---

### Task 3: Device gestibili da Archie (backend: regressione + docs)

Nessuna modifica al `DeviceViewSet`: questo task fissa con test il comportamento su cui si appoggia il frontend e aggiorna la documentazione della regola superata.

**Files:**
- Create: `backend/device/tests/test_archie_base_fields.py`
- Modify: `CLAUDE.md` (sezione "Device/VLAN exclusivity": Device gestibili anche da Archie limitatamente ai campi base, elenco come in Global Constraints; VLAN, `DeviceWifi`, `Rispacs` restano esclusivi Portal), `backend/core/permission_modules.py` (commento su `PORTAL_DEDICATED_APPS`: device resta nel gruppo Portal del pannello permessi, ma lo staff Archie lo usa per i campi base — i permessi `device.*` si assegnano dalla sezione Portal del pannello Utenti)

- [ ] **Step 1: Write tests**

```python
def test_internal_user_creates_device_with_base_fields_only():
    # internal con access_archie + view/add_device: POST customer, site, type, status,
    # manufacturer, model, serial_number="SN-1", inventario, note → 201, ip is None, wifi is False
def test_device_created_from_archie_visible_to_portal_of_same_customer():
    # GET /api/devices/ come portal user del customer → contiene SN-1; portal user di altro customer → no
def test_patch_base_fields_preserves_portal_fields():
    # device con ip="10.0.0.5", wifi=True, reparto="RX" → PATCH {model: "X2"} → ip/wifi/reparto invariati
```

- [ ] **Step 2: Run** `... exec backend pytest device/tests/test_archie_base_fields.py -q` — Expected: 3 passed (se uno fallisce: è un bug reale del DeviceViewSet, fermarsi e riportarlo).

- [ ] **Step 3: Update docs** come da Files.

- [ ] **Step 4: Commit** — `git commit -m "test(device): gestione campi base da Archie; docs: device non più esclusivi del Portal"`

---

### Task 4: Frontend — client API, tipi e anagrafica venditori

**Files:**
- Modify: `frontend/src/api/generated.ts` (via `npm run gen:api`, backend dev attivo)
- Create: `frontend/src/features/contracts/types.ts`, `frontend/src/features/contracts/SellersDialog.tsx`

**Interfaces:**
- Produces in `types.ts`: `Seller`, `ContractListItem`, `ContractDetail`, `ExpiryState`, `CONTRACT_TYPE_OPTIONS`, `CONTRACT_STATUS_OPTIONS`, `BILLING_FREQ_OPTIONS` (value/label come i TextChoices), `EXPIRY_CHIP: Record<ExpiryState, { label: string; color: 'default'|'success'|'warning'|'error' }>` con `none→default "—"`, `ok→success "In corso"`, `notice→warning "Preavviso"`, `expiring→warning "In scadenza"`, `expired→error "Scaduto"`.
- `SellersDialog({ open, onClose })`: lista + crea/modifica/disattiva venditori; campo utente opzionale (autocomplete utenti, stesso componente usato altrove per selezionare utenti).

- [ ] **Step 1:** `npm run gen:api` → `generated.ts` contiene `/api/contracts/` e `/api/sellers/`.
- [ ] **Step 2:** Scrivere `types.ts` e `SellersDialog.tsx` seguendo il pattern di `features/purchaseorders/PurchaseOrderDialog.tsx`.
- [ ] **Step 3:** `npx tsc --noEmit` → nessun errore.
- [ ] **Step 4: Commit** — `git commit -m "feat(contracts): tipi frontend e anagrafica venditori"`

---

### Task 5: Frontend — pagina Contratti

**Files:**
- Create: `frontend/src/pages/Contracts.tsx`, `frontend/src/features/contracts/ContractDialog.tsx`, `ContractDrawer.tsx`, `ContractRenewDialog.tsx`, `renew.ts`, `renew.test.ts`
- Modify: `frontend/src/App.tsx` (route `contracts` con `RequirePerm perm="contracts.view_contract"`), `frontend/src/layout/appLayoutNav.tsx` (voce "Contratti", sezione `principale`, perm `contracts.view_contract`, titolo `CONTRATTI`), `frontend/src/layout/AppSpeedDial.tsx` ("Nuovo contratto", perm `contracts.add_contract`)

**Interfaces:**
- Consumes: Task 4; `DevicePicker` e `DeviceDialog` da Task 6 (se Task 6 non è ancora fatto, il campo device nel dialog arriva con Task 6).
- Produces: `proposeRenewal(start: string, end: string): { start_date: string; end_date: string }` in `renew.ts` — nuova `start_date` = `end + 1 giorno`; nuova `end_date` = nuova start + stessa durata in mesi interi − 1 giorno, con clamp a fine mese.

- [ ] **Step 1: Write the failing test** `renew.test.ts`

```ts
expect(proposeRenewal('2025-01-01', '2025-12-31')).toEqual({ start_date: '2026-01-01', end_date: '2026-12-31' })
expect(proposeRenewal('2024-02-01', '2025-01-31')).toEqual({ start_date: '2025-02-01', end_date: '2026-01-31' })
expect(proposeRenewal('2025-03-01', '2025-05-31')).toEqual({ start_date: '2025-06-01', end_date: '2025-08-31' })
expect(proposeRenewal('2024-03-01', '2028-02-29')).toEqual({ start_date: '2028-03-01', end_date: '2032-02-29' })
```

- [ ] **Step 2: Run** `npx vitest run src/features/contracts/renew.test.ts` — Expected: FAIL (modulo mancante).
- [ ] **Step 3: Implement** `renew.ts` (date come stringhe ISO, nessun uso di `Date` locale soggetto a timezone).
- [ ] **Step 4: Run** — Expected: 4 passed.
- [ ] **Step 5: Implement pagina** sul modello di `pages/PurchaseOrders.tsx`: `ServerDataGrid` con colonne code, title, cliente, venditore, tipo, inizio, fine, scadenza (chip `EXPIRY_CHIP`), valore (solo se `contracts.view_contract_value`), stato; filtri cliente/venditore/stato/tipo/anno; toolbar "Nuovo contratto" + "Venditori" (apre `SellersDialog`). `ContractDialog`: tutti i campi, `devices` via `DevicePicker` filtrato su cliente (si svuota al cambio cliente), campo facoltativo etichettato "Device collegati (opzionale)", `total_value` nascosto senza permesso. `ContractDrawer`: dettaglio, device collegati ("Nessun device collegato" se vuoto), PDF (upload/apri/rimuovi), badge "Rinnovo automatico" se `auto_renew`, azione "Rinnova" → `ContractRenewDialog` precompilato con `proposeRenewal`, conferma = PATCH `start_date`/`end_date`.
- [ ] **Step 6:** `npx tsc --noEmit` + `npm run lint` (≤ 30 problemi).
- [ ] **Step 7: Commit** — `git commit -m "feat(contracts): pagina Contratti con rinnovo manuale"`

---

### Task 6: Frontend — device da Archie e tab Cliente

**Files:**
- Create: `frontend/src/features/devices/types.ts`, `devicePayload.ts`, `devicePayload.test.ts`, `DeviceDialog.tsx`, `DevicePicker.tsx`, `CustomerDevicesTab.tsx`, `frontend/src/features/contracts/CustomerContractsTab.tsx`
- Modify: `frontend/src/features/customers/CustomerDrawer.tsx` (tab: Dettagli, Siti, Inventari, Drive, **Device**, **Contratti**, Attività → Attività passa da indice 4 a 6; nuove props `devicesTabContent`, `contractsTabContent`, `devicesCount`, `contractsCount`), `frontend/src/pages/Customers.tsx` (passare i contenuti e aggiornare ogni riferimento all'indice tab Attività)

**Interfaces:**
- Produces:
  - `DEVICE_BASE_FIELDS = ['site','type','status','manufacturer','model','serial_number','inventario','note'] as const`
  - `buildDevicePayload(form: DeviceBaseForm, mode: 'create' | 'edit', customerId: number): Record<string, unknown>` — solo chiavi di `DEVICE_BASE_FIELDS`, più `customer` in `create`; stringhe vuote → `null`.
  - `DeviceDialog({ open, customerId, device?, onClose, onSaved(device) })` — lookup da `/api/sites/?customer=`, `/api/device-types/`, `/api/device-statuses/`, `/api/device-manufacturers/`; edit = PATCH.
  - `DevicePicker({ customerId, value: number[], onChange, allowCreate })` — autocomplete multiplo su `/api/devices/?customer=`, opzione "Nuovo device" che apre `DeviceDialog` e aggiunge il creato.
  - `CustomerDevicesTab({ customerId })`, `CustomerContractsTab({ customerId })` (lista compatta + link a `/contracts?customer=`).

- [ ] **Step 1: Write the failing test** `devicePayload.test.ts`

```ts
// create: include customer, esclude ip/wifi/reparto anche se presenti nel form
expect(Object.keys(buildDevicePayload({ ...form, ip: '1.2.3.4', wifi: true } as any, 'create', 7)).sort())
  .toEqual(['customer', ...DEVICE_BASE_FIELDS].sort())
// edit: niente customer
expect(buildDevicePayload(form, 'edit', 7)).not.toHaveProperty('customer')
// stringa vuota → null
expect(buildDevicePayload({ ...form, serial_number: '' }, 'edit', 7).serial_number).toBeNull()
```

- [ ] **Step 2: Run** `npx vitest run src/features/devices/devicePayload.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `devicePayload.ts`. — **Step 4:** Run → 3 passed.
- [ ] **Step 5: Implement** dialog, picker, tab e modifiche al drawer Cliente. Tab Device visibile solo con `device.view_device`, Contratti solo con `contracts.view_contract`.
- [ ] **Step 6:** `npx tsc --noEmit` + `npm run lint` (≤ 30).
- [ ] **Step 7: Commit** — `git commit -m "feat(devices): gestione device base da Archie e tab Device/Contratti nel Cliente"`

---

### Task 7: Changelog, verifica completa, pacchetto

**Files:**
- Modify: `CHANGELOG.md` (sotto `## [Unreleased]` → `### Added`: modulo Contratti con venditori, device collegabili, rinnovo manuale e PDF; device gestibili da Archie per i dati base)

- [ ] **Step 1:** Scrivere le voci changelog.
- [ ] **Step 2: Backend** — `manage.py check` → no issues; `makemigrations --check --dry-run` → `No changes detected`; `pytest -q` → tutto verde.
- [ ] **Step 3: Frontend** (`frontend/`) — `npx tsc -b --force` → ok; `npm run build` → ok; `npm run lint` → ≤ 30 problemi; `npx vitest run` → 62 + 7 nuovi, tutti passati.
- [ ] **Step 4: Frontend Portal** — `npx tsc --noEmit` e `npx vitest run` in `frontend-portal/` invariati (nessun file toccato, check di non-regressione).
- [ ] **Step 5: Commit** — `git commit -m "docs: changelog modulo Contratti fase 1"`
- [ ] **Step 6:** Pacchetto `archie-contracts-01.zip` con i soli file creati/modificati, struttura da root di `inventory-app/`, esclusi `.claude`, `.git`, `__pycache__`, `node_modules`.
