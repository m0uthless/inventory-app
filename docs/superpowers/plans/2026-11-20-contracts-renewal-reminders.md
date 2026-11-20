# Contratti fase 2 — promemoria di rinnovo e Impostazioni di Archie · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Togliere la disdetta dai Contratti, introdurre l'avviso di rinnovo per contratto con promemoria email ripetuti, e il pannello «Impostazioni di Archie».

**Architecture:** Backend Django: campi del contratto rinominati/tolti con migrazioni nuove, calendario dei promemoria come funzione pura in `contracts/reminders.py`, invio giornaliero idempotente (`ContractReminder` con vincolo unico) da un comando nel servizio `cron`; impostazioni applicative su `core.AppSetting` con un registro tipizzato e un'API protetta da un permesso nuovo. Frontend React/MUI: finestra del contratto come `design-previews/ctr2-base.html`, nuova pagina `/impostazioni`.

**Tech Stack:** Django 5 + DRF, PostgreSQL, React 19 + TS + MUI v7, vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-11-20-contracts-renewal-reminders-design.md` (anteprima `design-previews/ctr2-base.html`).

## Global Constraints

- Nessun testo «disdett*», «preavviso», «termine di disdetta» in UI, messaggi API, email, nuovi changelog.
- Stato contratto: `bozza` «Bozza», `attivo` «Attivo», `chiuso` «Chiuso».
- Stati di scadenza: `ok` «In corso», `renew` «Da rinnovare», `expired` «Scaduto», `none`.
- Anticipo per contratto `reminder_days`: default 90, valori 1–365; scelte rapide 30 / 60 / 90 / 180.
- Ripetizione default **10** giorni; date `reminder_date + k·every ≤ end_date`.
- Email: una per contratto e per promemoria; A = venditore, Cc = ufficio; senza venditore utile tutto l'ufficio in A; **nessun importo**.
- Invio alle **8:00 locali** (`Europe/Rome`), stesso schema di `send_deadline_digest`; saltato se il modulo `contracts` è spento.
- Impostazioni (chiavi `AppSetting`): `contracts.reminder_emails` (testo `;`), `contracts.reminder_default_days` (90), `contracts.reminder_every_days` (10).
- Permesso nuovo `core.manage_app_settings` «Gestisce le impostazioni di Archie»; superuser sempre.
- Ogni nuovo endpoint con `IsInternalOrPortalDedicatedApp`; mai modificare migrazioni applicate.
- Comandi backend sul working tree: `docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps -v ./backend:/app --entrypoint "" backend <cmd>` (abbreviato **`BRUN`** sotto).
- Baseline frontend: lint 5 avvisi, vitest tutto verde; backend pytest tutto verde.

## Review Focus

1. **Cron fermo per giorni** → al rientro un solo promemoria per contratto (l'ultima data dovuta), non uno per data saltata. Test in Task 3.
2. **Contratto rinnovato a metà ciclo** (fine spostata in avanti) → nessun promemoria finché non arriva la nuova data d'avviso; la notifica in campanella non letta sparisce. Test in Task 3.
3. **Indirizzi dell'ufficio sporchi** (spazi, `;` finale, duplicati, maiuscole, un indirizzo non valido) → normalizzati e deduplicati; uno non valido blocca il salvataggio con 400 che lo nomina. Test in Task 2.
4. **Venditore senza email utile** (utente senza email e campo vuoto, venditore disattivato o nel cestino) → l'email va all'ufficio in A; nessun crash. Test in Task 3.
5. **Contratto di un cliente nel cestino / contratto nel cestino / modulo spento** → nessun invio. Test in Task 3.

---

### Task 1: Contratto senza disdetta (modello, migrazioni, API)

**Files:**
- Modify: `backend/contracts/models.py` (ContractStatus, ExpiryState, `Contract`), `backend/contracts/api.py` (serializer, `expiry_q`, filtro, `stats`), `backend/contracts/admin.py` se cita i campi
- Create: `backend/contracts/migrations/0003_reminder_days_chiuso.py`
- Test: `backend/contracts/tests/test_models.py`, `test_expiry_stats.py`, `test_api.py` (aggiornare i test esistenti che usano `notice_days`, `auto_renew`, `disdetto`, `notice`, `expiring`, `attention`)

**Interfaces:**
- Produces: `Contract.reminder_days: int`, `Contract.reminder_date -> date` (property, `date.min` su overflow), `Contract.expiry_state_on(today) -> "ok"|"renew"|"expired"|"none"`, `ContractStatus.CHIUSO == "chiuso"`, `expiry_q(state, today) -> Q` per `ok|renew|expired`. API: campo `reminder_days` (max 365, min 1), `reminder_date` (read-only); spariscono `notice_days`, `notice_deadline`, `auto_renew`; filtro `?expiry=ok|renew|expired`; `stats.by_expiry` con chiavi `ok, renew, expired`; `next_deadlines[].reminder_date`.

- [ ] **Step 1: Failing tests** in `test_models.py`:
  `test_expiry_state_renew_from_reminder_date` (end tra 50 gg, reminder_days 60 → `renew`; reminder_days 30 → `ok`), `test_expiry_state_expired_after_end` (end ieri → `expired`), `test_expiry_state_none_when_closed` (status `chiuso` → `none`), `test_reminder_date_overflow_is_date_min`. In `test_expiry_stats.py` parametrizzare `test_expiry_filter_matches_model_state` su `("ok","renew","expired")`, sostituire il test `attention` con `test_expiry_filter_rejects_old_states` (`?expiry=notice` → 400), e `stats` → `by_expiry == {"ok":…, "renew":…, "expired":…}`. In `test_api.py`: `test_reminder_days_bounds` (0 → 400, 366 → 400, 365 → 200) e `test_auto_renew_not_in_payload`.
- [ ] **Step 2:** `BRUN pytest -q contracts` → FAIL sui nuovi test.
- [ ] **Step 3: Implementare.** Migrazione `0003`: `RenameField(notice_days → reminder_days)`, `RemoveField(auto_renew)`, `AlterField(status choices)`, `RunPython` `disdetto → chiuso` (reverse `chiuso → disdetto`). `EXPIRING_DAYS` va eliminato (verificare che `crm/api.py` usa la sua costante `CONTRACT_EXPIRING_DAYS`, indipendente). `expiry_q("renew")`: `status=attivo & end_date >= today & end_date <= today + reminder_days` (stesso `ExpressionWrapper` di oggi); `ok`: attivo, `end_date > today + reminder_days`; `expired`: attivo, `end_date < today`. Commenti e messaggi senza «disdetta».
- [ ] **Step 4:** `BRUN pytest -q contracts` → PASS; `BRUN python manage.py makemigrations --check --dry-run` → «No changes detected».
- [ ] **Step 5: Commit** `feat(contracts): avviso di rinnovo al posto della disdetta, stato Chiuso, via il rinnovo automatico`.

### Task 2: Impostazioni di Archie (backend)

**Files:**
- Create: `backend/core/app_settings.py`, `backend/core/app_settings_api.py`, `backend/core/migrations/0049_appsetting_manage_permission.py`
- Modify: `backend/core/models.py` (`AppSetting.Meta.permissions`), `backend/config/urls.py`
- Test: `backend/core/tests/test_app_settings.py`

**Interfaces:**
- Produces:
  - `core.app_settings.get_setting(key: str)` → valore tipizzato (default se la riga manca o è nel cestino); `set_settings(values: dict[str, str|int], actor, request) -> dict` (valida tutto, poi salva, audit `log_event` con from/to per chiave); `office_emails() -> list[str]` (normalizzate: trim, minuscole, dedup in ordine, vuote tolte).
  - Registro `SETTINGS: dict[str, SettingDef]` con `SettingDef(key, section, label, kind: "emails"|"int", default, min=None, max=None)`; chiavi e default dalla Global Constraints (`reminder_default_days` 1–365, `reminder_every_days` 1–60).
  - API (permesso `IsAuthenticated, IsInternalOrPortalDedicatedApp, CanManageAppSettings`; `CanManageAppSettings` = superuser o `core.manage_app_settings`):
    - `GET /api/app-settings/` → `{"sections": [{"key": "contracts", "label": "Contratti", "settings": [{"key", "label", "kind", "value", "default"}]}]}`
    - `PATCH /api/app-settings/` body `{key: value, …}` → 200 come GET; chiave sconosciuta o valore non valido → 400 `{key: "messaggio"}` (per le email: «Indirizzi non validi: a@, b»).
    - `POST /api/app-settings/contracts/test-email/` → 200 `{"sent_to": [...]}`; nessun indirizzo → 400; errore SMTP → 502 `{"detail": "Invio non riuscito: …"}`. Email: template `emails/contract_reminder_test.html` (breve, «Prova dei promemoria dei contratti»).
  - Permesso `("manage_app_settings", "Gestisce le impostazioni di Archie")` su `AppSetting.Meta`.

- [ ] **Step 1: Failing tests** (`make_archie_user`, `grant_via_group` da `core.testing`): `test_get_requires_permission` (utente Archie senza permesso → 403; con permesso via gruppo → 200; superuser → 200), `test_get_returns_defaults_without_rows` (valori 90 e 10, email `""`), `test_patch_normalizes_office_emails` (`" A@x.it ; b@y.it;;a@x.it; "` → salvato `"a@x.it; b@y.it"`, `office_emails() == ["a@x.it","b@y.it"]`), `test_patch_rejects_invalid_email` (`"a@x.it; nonvalida"` → 400 con `"nonvalida"` nel messaggio, niente salvato), `test_patch_rejects_out_of_range` (`reminder_every_days` 0 e 61 → 400), `test_patch_unknown_key_400`, `test_patch_writes_audit`, `test_test_email_sends_to_office` (`mail.outbox[0].to` = indirizzi), `test_test_email_without_addresses_400`, `test_portal_user_forbidden`.
- [ ] **Step 2:** `BRUN pytest -q core/tests/test_app_settings.py` → FAIL.
- [ ] **Step 3: Implementare** registro, API (APIView o ViewSet senza modello, registrata in `config/urls.py` accanto alle altre `path("api/…")`), migrazione `0049` (AlterModelOptions su `AppSetting`), template di prova; aggiungere la categoria email `contracts` → `("Contratti", "#efe9f7", "#5b3f8c")` in `core/emails.py` e mappare `contract_reminder`, `contract_reminder_test`.
- [ ] **Step 4:** test PASS; `makemigrations --check` pulito.
- [ ] **Step 5: Commit** `feat(core): Impostazioni di Archie (API, permesso dedicato, email di prova)`.

### Task 3: Promemoria di rinnovo (calendario, invio, campanella)

**Files:**
- Create: `backend/contracts/reminders.py`, `backend/contracts/management/__init__.py`, `backend/contracts/management/commands/__init__.py`, `backend/contracts/management/commands/send_contract_reminders.py`, `backend/contracts/migrations/0004_contractreminder.py`, `backend/notifications/migrations/0005_contract_renewal_type.py`, `backend/core/templates/emails/contract_reminder.html`
- Modify: `backend/contracts/models.py` (`ContractReminder`), `backend/notifications/models.py` (`CONTRACT_RENEWAL = "contract_renewal", "Contratto da rinnovare"`), `backend/core/modules.py` (`contracts` → `notification_types=("contract_renewal",)`), `backend/contracts/admin.py` (registrare `ContractReminder` in sola lettura), `docker-compose.yml` (ciclo cron)
- Test: `backend/contracts/tests/test_reminders.py`

**Interfaces:**
- Consumes: `Contract.reminder_date`, `ContractStatus`, `core.app_settings.get_setting`, `office_emails()` (Task 1–2); `core.emails.send_templated_email`.
- Produces:
  - `ContractReminder(contract FK CASCADE related_name="reminders", due_on: date, sent_at: datetime auto_now_add, to: TextField, cc: TextField, ok: bool, error: TextField blank)`, `UniqueConstraint(contract, due_on, name="uq_contract_reminder_due")`, ordering `due_on`.
  - `reminders.schedule(contract, every: int) -> list[date]` (vuota se non attivo).
  - `reminders.due_today(contract, every: int, today: date) -> date | None` (ultima data `≤ today` del calendario, `None` se nessuna o se `today > end_date`).
  - `reminders.recipients(contract, office: list[str]) -> tuple[list[str], list[str]]` (A, Cc); email venditore = `seller.user.email` se utente attivo con email, altrimenti `seller.email`; venditore inattivo o nel cestino → ignorato; A vuoto → A = office, Cc = [].
  - `reminders.eligible_contracts(today) -> QuerySet` (attivi, `deleted_at` nullo, cliente non nel cestino, `reminder_date ≤ today ≤ end_date`).
  - `reminders.send_due(today: date) -> int` (invii fatti; crea `ContractReminder` anche per i falliti; aggiorna la campanella).
  - Comando `send_contract_reminders [--force]`: esegue solo alle 8 locali (costante `SEND_HOUR = 8`) salvo `--force`; esce senza fare nulla se `is_module_enabled("contracts")` è falso.
  - Campanella: `Notification` `CONTRACT_RENEWAL`, `source_key=str(contract.id)`, `recipient=seller.user`, title `f"{code} · {cliente}"`, subtitle `f"Scade il {dd/mm/yyyy}"`, `link=f"/contracts?open={id}"`, `event_date=end_date`, `last_emailed_event_date=end_date`; ogni invio la rimette non letta. `send_due` cancella le `CONTRACT_RENEWAL` non lette dei contratti non più idonei.

- [ ] **Step 1: Failing tests** (date fisse passate come `today`, niente `timezone.now` nei test di calendario):
  - `test_schedule_every_10_until_end` (end 2026-12-31, reminder_days 60 → `[11-01, 11-11, 11-21, 12-01, 12-11, 12-21, 12-31]`);
  - `test_schedule_empty_when_not_active`;
  - `test_due_today_picks_latest_past_date` (today 2026-11-25 → 2026-11-21) e `None` dopo la fine;
  - `test_send_due_sends_one_email_per_contract` (due contratti stesse date → 2 email, oggetto `"Rinnovo contratto CT-… · Cliente · scade il 31/12/2026"`);
  - `test_send_due_is_idempotent` (seconda chiamata stesso giorno → 0);
  - `test_send_due_catch_up_sends_only_latest` (today 2026-12-05 senza storico → 1 email con `due_on=2026-12-01`);
  - `test_renewed_contract_stops` (dopo un invio, end spostato al 2027-12-31 → `send_due` → 0 e notifica non letta rimossa);
  - `test_recipients_seller_user_to_office_cc`, `test_recipients_manual_seller_email`, `test_recipients_without_seller_office_in_to`, `test_recipients_seller_without_email_falls_back_to_office`, `test_inactive_seller_ignored`;
  - `test_no_recipients_records_failure` (`ok=False`, `error="Nessun destinatario"`);
  - `test_skips_trashed_contract_and_trashed_customer`;
  - `test_email_has_no_amounts` (`"€"` e il valore non compaiono nel corpo);
  - `test_bell_only_for_seller_user` (venditore utente → 1 `Notification`; venditore manuale → 0);
  - `test_command_skips_when_module_off` e `test_command_runs_only_at_8_unless_forced` (patch dell'ora locale come in `notifications/tests` per il digest).
- [ ] **Step 2:** `BRUN pytest -q contracts/tests/test_reminders.py` → FAIL.
- [ ] **Step 3: Implementare** modello + migrazioni, `reminders.py`, comando, template email (struttura come `issue_assigned.html`: h1 «Il contratto {code} scade il {data}», saluto `Ciao {nome}` se A è il venditore, altrimenti `Buongiorno`; righe Contratto/Cliente/Periodo/Venditore/Device; `_button.html` «Apri il contratto in Archie» con `url="/contracts?open=" id=contract_id`; riga «promemoria i di n» e prossimo promemoria o «È l'ultimo promemoria»; piè con il motivo della ricezione). `send_templated_email` accetta un nuovo argomento facoltativo `cc: list[str] | None = None` passato a `EmailMultiAlternatives(cc=…)` (aggiungere un test in `core/tests` se esiste quello dell'helper, altrimenti coperto da `test_recipients_seller_user_to_office_cc` via `mail.outbox[0].cc`). In `docker-compose.yml`, nel servizio `cron`, un terzo ciclo come quello di `send_deadline_digest` (`echo` di avvio + `while true; python manage.py send_contract_reminders; sleep 900`).
- [ ] **Step 4:** test PASS; `BRUN pytest -q notifications core contracts` verde; `docker compose … config --quiet` ok.
- [ ] **Step 5: Commit** `feat(contracts): promemoria di rinnovo via email ogni 10 giorni e campanella del venditore`.

### Task 4: Venditori e dettaglio del contratto per la finestra

**Files:**
- Modify: `backend/contracts/api.py` (`SellerSerializer`, `ContractSerializer`)
- Test: `backend/contracts/tests/test_api.py`

**Interfaces:**
- Consumes: `reminders.schedule`, `reminders.recipients`, `ContractReminder` (Task 3), `get_setting`, `office_emails` (Task 2).
- Produces:
  - `SellerSerializer.validate`: senza `user` l'`email` è obbligatoria («Indica l'email del venditore o collega un utente di Archie.»); `user` solo attivo e con accesso Archie (superuser o `core.access_archie`) — altrimenti «Scegli un utente di Archie attivo.». Campo read-only `reminder_email` (l'email che riceverà i promemoria o `null`).
  - `ContractSerializer.reminders` (solo `retrieve`, read-only): `{"every": int, "to": [str], "cc": [str], "seller_kind": "user"|"manual"|null, "dates": [{"date": "YYYY-MM-DD", "state": "sent"|"failed"|"next"|"planned", "error": str|null}]}`; `failed` porta l'errore; nessun dato del valore.
- [ ] **Step 1: Failing tests:** `test_seller_requires_email_without_user`, `test_seller_rejects_portal_only_user`, `test_seller_reminder_email_prefers_user_email`, `test_contract_detail_reminders_states` (con un `ContractReminder` inviato e uno fallito, today fisso con `unittest.mock.patch("contracts.api.timezone.localdate")`), `test_contract_list_has_no_reminders_field`.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. **Step 4:** `BRUN pytest -q contracts` PASS.
- [ ] **Step 5: Commit** `feat(contracts): venditore con email o utente Archie, promemoria nel dettaglio del contratto`.

### Task 5: Frontend Impostazioni di Archie

**Files:**
- Create: `frontend/src/pages/AppSettings.tsx`, `frontend/src/features/settings/appSettingsApi.ts`, `frontend/src/features/settings/useAppSetting.ts`, `frontend/src/features/settings/emails.ts`
- Modify: `frontend/src/App.tsx` (route `impostazioni`), `frontend/src/layout/AppLayout.tsx` (voce menu utente «Impostazioni» sopra «Moduli», visibile con `me.is_superuser || hasPerm(PERMS.core.manageAppSettings)`), `frontend/src/layout/appNav.tsx` (titolo `/impostazioni` → «Impostazioni»), `frontend/src/auth/perms.ts` (`core.manageAppSettings: 'core.manage_app_settings'`)
- Test: `frontend/src/features/settings/emails.test.ts`, `frontend/src/pages/AppSettings.test.tsx`

**Interfaces:**
- Consumes: API di Task 2.
- Produces: `parseEmails(raw: string) -> { list: string[]; invalid: string[] }` (stessa normalizzazione del backend); `useAppSetting<T>(key, fallback: T): T` (legge `GET /app-settings/` una volta per sessione; senza permesso → fallback, nessun errore mostrato); pagina con sezione «Contratti» come l'anteprima.
- [ ] **Step 1: Failing tests:** `parseEmails` (`" A@x.it ; b@y.it;;a@x.it; "` → `["a@x.it","b@y.it"]`, `invalid=[]`; `"a@x.it; nonvalida"` → `invalid=["nonvalida"]`); `AppSettings.test.tsx`: carica i valori, cambiare gli indirizzi mostra le etichette e la barra «1 modifica da salvare», un indirizzo non valido disattiva «Salva» e mostra «Questo indirizzo non è valido: nonvalida», «Salva» manda `PATCH /app-settings/` con le sole chiavi cambiate, «Manda un'email di prova all'ufficio» chiama `POST /app-settings/contracts/test-email/` e mostra «Email di prova inviata a 2 indirizzi»; route protetta: senza permesso la pagina mostra la 404 come le altre pagine riservate.
- [ ] **Step 2:** FAIL. **Step 3:** implementare (nuovo `RequirePermission` solo se non esiste già un guard equivalente: riusare quello di `/accesso-portal` se c'è). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(settings): pagina Impostazioni di Archie con la sezione Contratti`.

### Task 6: Frontend Contratti senza disdetta

**Files:**
- Modify: `frontend/src/api/generated.ts` (rigenerato), `frontend/src/features/contracts/types.ts`, `contractModel.ts`, `contractForm.ts`, `ContractFormParts.tsx`, `ContractDialog.tsx`, `ContractRenewDialog.tsx`, `renew.ts`, `ContractDetailCard.tsx`, `ContractKpis.tsx`, `contractUi.tsx`, `CustomerContractsTab.tsx`, `SellersDialog.tsx`, `frontend/src/pages/Contracts.tsx`
- Create: `frontend/src/features/contracts/ContractReminders.tsx`
- Test: `contractForm.test.ts`, `renew.test.ts`, nuovi `contractModel.test.ts`, `ContractReminders.test.tsx`, `ContractDetailCard` (se esiste un test, aggiornarlo)

**Interfaces:**
- Consumes: API di Task 1 e 4; `GET /api/app-settings/` non serve qui: il predefinito per il nuovo contratto arriva da Task 5 tramite `useAppSetting('contracts.reminder_default_days', 90)`.
- Produces: `ExpiryState = 'ok'|'renew'|'expired'|'none'`; `EXPIRY_META` (`renew` → «Da rinnovare», tono warning); `ContractStatus = 'bozza'|'attivo'|'chiuso'`; `expiryHint(c, today)` con le frasi dell'anteprima («È il momento di preparare il nuovo contratto. Prossimo promemoria …», «L'avviso di rinnovo parte il …, N giorni prima della fine.», «I promemoria sono finiti alla scadenza: rinnovalo o segnalo come chiuso.», «Non manda più promemoria.»); `<ContractReminders reminders={…} />`.

- [ ] **Step 1:** rigenerare il client: `exec backend python manage.py spectacular --file /tmp/schema.yml` dopo il rebuild del backend, `docker compose cp backend:/tmp/schema.yml /tmp/…`, `OPENAPI_URL=<file> npm run gen:api` + prettier (vedi CLAUDE.md).
- [ ] **Step 2: Failing tests:** `contractModel.test.ts` (`expiryHint` per i quattro casi con date fisse; nessuna stringa contiene `disdett` o `preavviso`), `contractForm.test.ts` aggiornato (`reminder_days` al posto di `notice_days`, niente `auto_renew`, il riepilogo dice «avviso di rinnovo il …»), `ContractReminders.test.tsx` (mostra «Venditore, utente Archie: email e campanella» / «Venditore inserito a mano: solo email» / «Nessun venditore»; elenco con «Inviato», «Non riuscito: <errore>», «Prossimo · …», «Previsto»; oltre 6 inviati ripiega in «… N inviati»), test di pagina: la vista «Da rinnovare» chiama `/contracts/?expiry=renew`, la vista «Chiusi» `status=chiuso`.
- [ ] **Step 3:** `npx vitest run src/features/contracts src/pages/Contracts.test.tsx` → FAIL.
- [ ] **Step 4: Implementare** seguendo `design-previews/ctr2-base.html` (testata con «avviso di rinnovo dal/il» e «prossimo promemoria» che scorre alla sezione; Periodo con il segno «avviso»; sezione «Promemoria di rinnovo»; Dettagli «Avviso di rinnovo: N giorni prima» con pastiglie 30/60/90/180 + numero in modifica; ⋯ «Segna come chiuso»; KPI senza «Preavviso»/«In scadenza»; colonna Venditore in elenco; `SellersDialog` con «Nome e cognome», email obbligatoria se manca l'utente, utenti solo Archie). Poi `grep -rniE "disdett|preavviso|notice|auto_renew" frontend/src` → nessun risultato fuori da `generated.ts` storico (che deve essere già rigenerato).
- [ ] **Step 5:** vitest contracts PASS; `npx tsc -b --force` ok.
- [ ] **Step 6: Commit** `feat(contracts): finestra con avviso di rinnovo e promemoria, stato Chiuso`.

### Task 7: Verifica, rilascio in dev, documenti

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]`: Added «Promemoria di rinnovo dei contratti…», «Impostazioni di Archie…»; Changed «Contratti: niente più disdetta…, stato Chiuso, via il rinnovo automatico»; **Dopo il deploy**: `migrate`, ricreare `cron`, impostare gli indirizzi dell'ufficio, dare il permesso), `CLAUDE.md` (cron: aggiungere `send_contract_reminders`; Impostazioni di Archie in Architecture), `docs/restyle-todo.md` (Contratti fase 2 fatta; ricerca asincrona e statistiche restano), memoria `contracts_module.md`.

- [ ] **Step 1:** backend: `BRUN python manage.py check`, `BRUN python manage.py makemigrations --check --dry-run`, `BRUN pytest -q` → tutto verde.
- [ ] **Step 2:** frontend: `npx tsc -b --force`, `npm run build`, `npm run lint` (≤ 5 avvisi), `npx vitest run` → verde.
- [ ] **Step 3:** `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build backend cron frontend` e `exec backend python manage.py migrate`; ricollegare `text2sql-worker` alla rete del prototipo se ricreato.
- [ ] **Step 4:** nel browser (Playwright, root): impostare gli indirizzi in `/impostazioni`, mandare l'email di prova, aprire un contratto «Da rinnovare» e confrontarlo con `ctr2-base.html`, `BRUN`-equivalente in dev `exec backend python manage.py send_contract_reminders --force` → controllare `ContractReminder` creati e la sezione aggiornata; verificare che un secondo `--force` non mandi nulla.
- [ ] **Step 5: Commit** `docs: Contratti fase 2 (changelog, CLAUDE.md, todo)`.
