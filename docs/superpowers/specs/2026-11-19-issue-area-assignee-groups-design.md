# Issue per area e assegnabili per gruppo

Data: 2026-11-19. Stato: design approvato da Fede in chat.

## Perché

Le issue oggi sono generiche: le vede e le modifica chiunque abbia i permessi delle issue, indipendentemente dall'area. Fede vuole gestirle per area come i task di area (`core.AreaTask`), ma senza obbligare ogni issue ad avere un'area, perché una issue può passare da un'area all'altra.

Insieme a questo, chi è assegnabile non deve più dipendere da un flag sul profilo del singolo utente ma da un permesso dato a un gruppo, dalla pagina Gruppi. I permessi sono due e restano distinti: «tecnico ServiceNow» e «assegnatario delle issue».

## Due lavori, in quest'ordine

1. **Assegnabili per gruppo** (va fatto per primo: il punto 2 riusa le liste di assegnatari).
2. **Issue per area.**

Ogni parte si può consegnare da sola.

---

## Parte 1 · Assegnabili per gruppo

### Oggi

- `UserProfile.is_servicenow_technician` (flag per utente, toggle «Tecnico ServiceNow» nella finestra Utente) più `core/technicians.py` (`eligible_technician_q`, `is_eligible_technician`): tecnico = flag acceso **e** utente interno (`core.access_archie`, oppure profilo Philips, oppure account funzionale).
- Lo stesso criterio decide: assegnatari dei case ServiceNow, tecnici nelle statistiche e nelle assenze, assegnatari delle issue (in più esclusi i Philips), destinatari dell'email «nuova issue».
- Segnare un utente come Philips accende il flag in automatico (`admin_users_api.py`, `UserDetailModal.tsx`).

### Decisioni

- Due permessi custom, dichiarati in `Meta.permissions` (compaiono da soli tra i permessi «extra» della pagina Gruppi, vedi `core/permission_modules.py`):
  - `servicenow.be_technician`: «È tecnico ServiceNow» (sul modello dei case ServiceNow).
  - `issues.be_assignee`: «Può essere assegnatario delle issue» (su `Issue`).
- **Nessuna migrazione di dati (scelta B di Fede):** al rilascio nessuno ha i due permessi. Finché Fede non li assegna ai gruppi giusti, nessuno è assegnabile ai case o alle issue e l'email «nuova issue» non parte. Va scritto nelle note di rilascio come passo manuale dopo il deploy.
- Il superuser **non** diventa tecnico/assegnatario automaticamente: si usa `with_perm(..., include_superusers=False)` e nel controllo puntuale si guarda il permesso esplicito, non `has_perm` (che per il superuser è sempre vero).
- Nuovo criterio:
  - tecnico ServiceNow = permesso `servicenow.be_technician` **e** utente interno (stessa condizione di oggi: accesso Archie, Philips o account funzionale);
  - assegnatario issue = permesso `issues.be_assignee` **e** accesso ad Archie. L'esclusione esplicita dei Philips cade: decide il gruppo (e i Philips non possono stare in gruppi).
- Il permesso vale anche se dato direttamente all'utente (meccanismo Django additivo), ma l'interfaccia lo propone a livello di gruppo.
- Tutti i punti che oggi leggono il flag passano al permesso: `servicenow/api.py` (assegnazione, statistiche, assenze, inclusi i due filtri diretti su `profile__is_servicenow_technician`), `issues/api.py` (validazione `assigned_to`, `notify_issue_created`), `core/api.py` (campo calcolato `is_servicenow_technician` della lista utenti e controllo assegnabile issue).
- Il campo calcolato nella lista utenti mantiene il nome `is_servicenow_technician` (lo usano `CaseDialog` e `Issues`); se ne aggiunge uno nuovo, `is_issue_assignee`, che la pagina Issue usa al posto del filtro attuale (`tecnico && !philips`).
- Il flag `UserProfile.is_servicenow_technician` (colonna `is_servicenow_technician` della tabella dei profili utente, `core_userprofile`) si rimuove: via dal toggle nella finestra Utente, dal tag «Tecnico ServiceNow» nell'elenco utenti, da admin e API utenti, poi `RemoveField` con una migrazione nuova. **Scelta mia**: tenerlo inutilizzato lascerebbe un interruttore che non fa più niente.
- **Philips nascosto nella sezione Utenti**, come già fatto per ServiceNow (`features/servicenow/visibleCategories.ts`): una costante solo frontend nasconde il toggle «Philips» nella finestra Utente e il tag «Philips» nell'elenco. Il backend e i profili Philips restano invariati; per riattivarli basta cambiare la costante.

---

## Parte 2 · Issue per area

### Decisioni

- Nuovo campo `Issue.area`: FK facoltativa ad `attendance.LeaveArea` (la stessa area del profilo utente e dei task), `null=True, blank=True, on_delete=SET_NULL`, con indice.
- Le issue esistenti restano **senza area**: nessuna migrazione di dati.
- Una issue **senza area** si comporta come oggi: la modifica chiunque abbia i permessi delle issue.
- Una issue **con area**: tutti la vedono, ma la modificano solo i membri di quell'area (o il superuser). «Modificare» comprende ogni scrittura: modifica, cambio stato, elimina, ripristino, commenti, collegamenti Wiki. Stessa regola dei task (`_check_own_area` in `core/api.py`). Chi non è dell'area riceve 403 con un messaggio chiaro.
- **Passaggio di area**: l'area si cambia come gli altri campi, quindi solo chi può modificare la issue (membri dell'area attuale, o chiunque se la issue non ha area). Chi la sposta in un'altra area perde la possibilità di modificarla.
- **Proposta automatica**: nel modulo di creazione l'area parte dall'area del profilo di chi crea, ed è modificabile o svuotabile. Il backend non la impone.
- **Task → issue**: la conversione (`POST /area-tasks/{id}/convert-to-issue/`) porta l'area del task sulla issue.
- Il serializer espone `area`, `area_label` e `can_edit` (come per i task) così l'interfaccia disabilita le azioni.
- **Assegnatario (decisione di Fede)**: se la issue ha un'area, l'assegnatario dev'essere un membro di quell'area (`UserProfile.leave_area`) che sia anche assegnatario issue (Parte 1). Se la issue non ha area, va bene qualunque assegnatario issue. La regola vale sia nell'interfaccia (l'elenco propone solo i membri dell'area) sia nel backend (validazione su `assigned_to`, come per i task: se l'assegnatario non cambia in una modifica non si ricontrolla).
- **Cambio di area con un assegnatario fuori dalla nuova area** (**scelta mia**): nel modulo l'assegnatario viene svuotato con un avviso, così chi sposta la issue ne sceglie uno della nuova area o la lascia non assegnata. Il backend rifiuta la combinazione incoerente (area nuova + assegnatario di un'altra area).
- **Interfaccia**:
  - campo Area nel modulo di creazione/modifica e nella finestra della issue;
  - colonna e filtro «Area» nell'elenco, più una vista «La mia area» accanto alle viste esistenti;
  - sulle issue di un'altra area la finestra si apre in sola lettura (azioni nascoste o disabilitate, niente modifica sul posto, niente commenti), con una riga che spiega il perché;
  - il menu contestuale dell'elenco mostra solo «Apri» per le issue di un'altra area.
- **Contatore in barra laterale (decisione di Fede)**: conta le issue attive della propria area. Si ottiene con un parametro sul riepilogo (es. `GET /issues/summary/?area=mine`), così i numeri della pagina Issue restano quelli complessivi. Il contatore somma le issue attive della propria area **e** quelle senza area (decisione di Fede). **Scelta mia**: un utente senza area nel profilo vede il conteggio complessivo, come oggi.

---

## Fuori da questo lavoro

- Visibilità ristretta (nascondere le issue delle altre aree): per ora sola lettura.
- Email per area (es. «nuova issue» solo all'area): l'email va agli assegnatari issue della Parte 1.
- Portal: le issue non sono esposte lì, nessun impatto.

## Vincoli

- Migrazioni nuove, mai modificare quelle già applicate. In produzione `RUN_MIGRATIONS` è disattivato: `migrate` va lanciato a mano al deploy.
- La barriera Portal/Archie (`IsInternalOrPortalDedicatedApp`) resta sulla viewset delle issue: nessuna nuova viewset.
- Catena di verifica completa (tsc, build, lint sulla baseline, vitest, pytest, `check`, `makemigrations --check`) e pubblicazione nello stack dev ricostruendo `backend`, `cron` e `frontend`.

## Cosa resta a chi implementa

- Nomi esatti delle etichette dei permessi e dei messaggi di errore.
- Dove mettere la costante che nasconde Philips (accanto a `usersModel.ts`).
- Test: criterio tecnico/assegnatario (con e senza permesso, superuser, portal), regola di area su tutte le scritture, conversione task→issue con area.


---

## Parte 3 · Visibilità per area e «Area» nei Dettagli (aggiunta 2026-11-20, approvata)

### Perché

Fede vuole che chi non ha un permesso dedicato veda solo le issue della propria area (e quelle senza area). Chi ha il permesso, o il superuser, parte dalla sua area e con un interruttore vede tutte le aree. Dalla finestra della issue, anche su telefono, l'area deve cambiarsi senza passare dal modulo completo.

### Decisioni (di Fede)

- Nuovo permesso di gruppo `issues.view_all_areas` «Vede le issue di tutte le aree». Il superuser lo ha sempre.
- **Restrizione vera, ovunque (scelta 1)**: il server filtra le issue in ogni lettura, non solo nella pagina Issue.
- Chi ha il permesso parte dalla propria area. L'interruttore «Tutte le aree» nella barra dell'elenco Issue allarga la vista e la scelta viene ricordata. Le issue delle altre aree restano in sola lettura: il permesso è per vedere, non per modificare.
- Campo «Area» nei Dettagli della finestra della issue, cambiabile al volo (come «Assegnata a»). Se l'assegnatario non fa parte della nuova area, lo si toglie con un avviso.

### Regola di visibilità

Una funzione unica `visible_issues_q(user, prefix="")` in `issues/visibility.py`:
- superuser o permesso `issues.view_all_areas` → nessun filtro;
- utente con area nel profilo → `area = sua area` oppure `area vuota`;
- utente senza area nel profilo → nessun filtro (**scelta mia**, coerente col contatore).

Si applica a:
- `IssueViewSet.get_queryset` (elenco, dettaglio, commenti, Wiki, ripristino): una issue non visibile dà 404;
- `IssueViewSet.summary` (KPI e contatore, insieme a `?area=mine`);
- i conteggi e i badge delle altre pagine: `open_issues_count` di cliente e sito, `active_issue_count` del cliente, `has_active_issue` / `active_issue_priority` dell'inventario;
- l'etichetta delle issue nei collegamenti Wiki (`wiki/api/helpers.py`): una issue non visibile si mostra come «#id» senza titolo.

Non si applica alle email automatiche (digest scadenze, notifiche di assegnazione): vanno a chi è assegnatario, e l'assegnatario è dell'area per costruzione. **Scelta mia.**

### Interruttore «Tutte le aree»

Il nuovo parametro `?scope=mine` dell'elenco restringe alla propria area più le issue senza area. Lo manda solo la pagina Issue, solo a chi ha il permesso e solo a interruttore spento. Le altre pagine non lo mandano, quindi chi ha il permesso continua a vedere tutto nella scheda del cliente. A chi non ha il permesso l'interruttore non si mostra, perché il server lo restringe già. Lo stato viene ricordato in `localStorage`.
