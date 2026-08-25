# Design: sistema di template email condiviso (Archie / Portal)

Data: 2026-08-25
Stato: approvato per implementazione

## Contesto

Oggi Archie invia email da un solo punto del codice:
`core/admin_users_api.py` (reset password amministrativo), come stringa
plain-text costruita inline con `django.core.mail.send_mail`. Non esiste
alcuna infrastruttura di template condivisa. L'obiettivo di questo lavoro è
introdurre un sistema di template email riusabile modulo per modulo (a
partire dal reset password come primo caso reale), in vista dei prossimi
step: notifiche manutenzione via email, notifiche issues, ecc.

Il backend serve due frontend distinti con branding diverso:
`frontend/` (Archie, staff interno) e `frontend-portal/` (Portal Biotron,
clienti). Le email devono poter distinguere visivamente i due contesti.

SMTP dev è già configurato e testato in `.env.dev` (server
`vsmtpdext.internal.ausl.bologna.it:465`, SSL implicita). In produzione è
previsto un server SMTP diverso, già disponibile, non ancora configurato in
questo lavoro.

## Decisioni

- **Contenuto**: HTML con branding, non solo plain-text.
- **Editabilità**: template Django statici nel repo (file `.html`),
  modificabili solo da codice + deploy — nessun editor admin, nessuna
  tabella DB per i contenuti. Coerente con l'assenza di un sistema di
  contenuti dinamici nel resto del progetto.
- **Infrastruttura condivisa**: vive in `core/` (`core/emails.py` +
  `core/templates/emails/base_*.html`), come le altre infrastrutture
  cross-cutting (`core/mixins.py`, `core/permissions.py`).
- **Selezione brand (Archie vs Portal)**: automatica, in base al modulo
  Python chiamante — nessun parametro esplicito da passare a ogni chiamata.
- **Mittente**: unico indirizzo `noreply@biotron.it` per entrambi i brand
  (nuovo default, sostituisce l'attuale `archie@biotron.it`), con
  **display name diverso** per brand (`"ARCHIE" <noreply@biotron.it>` /
  `"Portal Biotron" <noreply@biotron.it>`).
- **Fallback plain-text**: generato automaticamente da `strip_tags()`
  sull'HTML renderizzato — nessun template `.txt` scritto a mano.

## Architettura

### `core/emails.py`

```python
def send_templated_email(
    template_name: str,
    context: dict,
    subject: str,
    recipient_list: list[str],
    fail_silently: bool = False,
) -> bool:
    ...
```

Comportamento:

1. Determina il brand ispezionando lo stack del chiamante
   (`inspect.stack()`): se il modulo chiamante appartiene al package
   `portal` (nome modulo che inizia per `"portal."` o `== "portal"`) →
   brand `"portal"`, altrimenti → brand `"archie"` (default).
2. Inietta nel context: `base_template` (percorso del layout brand:
   `"emails/base_archie.html"` o `"emails/base_portal.html"`) più le
   variabili di branding usate dai layout (nome prodotto, footer,
   eventuale URL logo — decise in fase di implementazione dei template
   stessi, non bloccanti per questa spec).
3. Renderizza `template_name` con Django (`render_to_string`), che deve
   iniziare con `{% extends base_template %}` e definire
   `{% block content %}`.
4. Genera plain-text con `strip_tags(html_body)`.
5. Costruisce il mittente con `email.utils.formataddr`:
   `("ARCHIE", "noreply@biotron.it")` o
   `("Portal Biotron", "noreply@biotron.it")` in base al brand.
6. Invia con `EmailMultiAlternatives` (corpo plain-text + alternativa
   `text/html`), rispettando `fail_silently` come l'attuale `send_mail`
   in `admin_users_api.py` (l'invio email non deve mai bloccare
   l'operazione applicativa che lo genera — stesso pattern già in uso).
7. Ritorna `True`/`False` in caso di successo/fallimento, loggando
   l'errore con `logger.warning` (stesso pattern di
   `admin_users_api.py:588-590`).

Nota sul rilevamento brand via introspezione: è una scelta esplicita
dell'utente (funzionalità automatica preferita a un parametro esplicito
ripetuto ad ogni call site). Va documentata chiaramente nel docstring
della funzione per evitare sorprese quando un nuovo modulo la richiama.

### Template

```
backend/core/templates/emails/
  base_archie.html   ← header/footer/colori brand ARCHIE
  base_portal.html   ← header/footer/colori brand Portal Biotron

backend/<app>/templates/emails/
  <nome_evento>.html ← {% extends base_template %} + {% block content %}
```

Ogni app di dominio possiede i propri template email nella propria
cartella `templates/emails/`, seguendo la convenzione app-per-dominio già
in uso nel progetto. I due layout base vivono in `core/` perché sono
infrastruttura condivisa, non specifica di un dominio.

### `DEFAULT_FROM_EMAIL`

`backend/config/settings.py` — cambia il default da `archie@biotron.it` a
`noreply@biotron.it` (variabile d'ambiente `DEFAULT_FROM_EMAIL`,
comportamento esistente invariato salvo il nuovo valore di default).
`.env.dev` e `.env.example` da aggiornare di conseguenza.

## Primo caso reale: reset password amministrativo

Migrazione di `core/admin_users_api.py` (righe ~571-590): sostituire la
chiamata a `send_mail(...)` con
`send_templated_email("emails/password_reset.html", context={...}, subject="ARCHIE — Password reimpostata", recipient_list=[user.email])`.

Nuovo template `backend/core/templates/emails/password_reset.html` con lo
stesso contenuto testuale già presente (nome utente, nuova password
temporanea, invito a cambiarla), ora in HTML brandizzato invece che
plain-text. Il comportamento applicativo (`email_sent`, `email_error` nella
response, mai bloccante) resta identico — cambia solo come viene composto e
inviato il messaggio.

Questo caso valida l'intero meccanismo (helper, rilevamento brand,
layout, invio, fallback testo) prima di estenderlo ai prossimi moduli
(notifiche manutenzione, issues, ecc. — fuori scope di questa spec).

## Testing

- Test unitario per `send_templated_email`: verifica che scelga il layout
  Archie quando chiamato da un modulo non-portal e il layout Portal quando
  chiamato da un modulo sotto `portal.`, verifica generazione plain-text,
  verifica `fail_silently`.
- Test esistente su reset password (`core/tests/test_admin_users_api.py`)
  aggiornato per il nuovo meccanismo, stessa asserzione di comportamento
  (`email_sent`/`email_error` nella response).
- Verifica manuale: invio reale via SMTP dev già configurato (vedi
  `.env.dev`), agli indirizzi di test già usati in questa sessione.

## Fuori scope

- Editor admin per i template (esplicitamente escluso).
- Email per altri moduli (manutenzione, notifiche, issues, ServiceNow) —
  saranno spec/implementazioni successive che riusano questa
  infrastruttura.
- Configurazione SMTP di produzione.
- Tracking/log degli invii email (nessun modello `EmailLog` — se servirà
  in futuro, è un'estensione successiva).
