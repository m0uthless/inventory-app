/* Email di Archie (anteprima). Ogni direzione produce l'HTML di una vera email:
   tabelle, stili in linea, larghezza 600, niente JS né SVG (Gmail e Outlook non li mostrano).
   Dati finti modellati sul contesto reale dei template:
   issue_created (issue_title, customer_name, priority_label, description),
   deadline_digest (area_task_items, issue_items: title, due_date),
   leave_request_submitted (richiedente, motivo, giorni: date, day_part). Oggi: lunedì 16/11/2026. */
(() => {
  const C = {
    green: '#1f6b5c', greenHover: '#18584c', band: '#17463c', band2: '#1f5a4d',
    canvas: '#eef2f1', paper: '#ffffff', paper2: '#f5f8f7', frame: '#e3eae8',
    line: '#d5dedb', lineStrong: '#b9c7c3', ink: '#15201e', muted: '#5b6b67', faint: '#66766f',
    field: '#e2f0eb', onBand: '#d3e6df', onBandMuted: '#a9cbbf',
    error: '#c2362b', errorTint: '#fbe5e2', warning: '#9a5b00', warningTint: '#fbefd9',
    info: '#2f5f9e', infoTint: '#e5edf8', neutral: '#edf1f0',
    leave: '#7cc4a4', leaveHalf: '#bfe3d1',
  }
  const FONT = "Geist,'Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif"
  const APP = 'https://archie.biotron.it'
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // ── Dati ────────────────────────────────────────────────────────
  const ISSUE = {
    id: 1042, title: 'PACS non raggiungibile dalla Radiologia PS', customer: 'AUSL Bologna', site: 'Osp. Maggiore · Radiologia PS',
    priority: 'Critica', by: 'Luca Romano', at: 'oggi alle 09:14', due: 'mercoledì 18/11',
    description: "Dalle 8:40 le modalità della Radiologia PS non riescono a inviare studi al PACS. Il gateway risponde al ping, ma l'associazione DICOM viene rifiutata.",
  }
  const DIGEST = [
    { day: 'Oggi', dow: 'Oggi', date: '16/11', items: [
      { kind: 'Issue', ref: '#1035', title: 'Utenze VPN da rinnovare per 3 tecnici', where: 'AUSL Bologna', url: '/issues?open=1035' },
    ] },
    { day: 'Domani', dow: 'Mar', date: '17/11', items: [
      { kind: 'Task di area', ref: 'Bologna', title: 'Rinnovo certificati VPN dei tecnici', where: 'Area Bologna', url: '/tasks?open=88' },
    ] },
    { day: 'Mercoledì', dow: 'Mer', date: '18/11', items: [
      { kind: 'Issue', ref: '#1039', title: 'Rinnovo certificato TLS del gateway RIS', where: 'IRCCS Rizzoli', url: '/issues?open=1039' },
      { kind: 'Task di area', ref: 'Bologna', title: 'Inventario della sala server di via Gramsci', where: 'Area Bologna', url: '/tasks?open=91' },
    ] },
  ]
  const LEAVE = {
    who: 'Nicole Spazzoli', reason: 'Ferie', area: 'Bologna', sent: 'oggi alle 11:02',
    days: [
      { dow: 'Mer', d: '18', m: 'nov', part: 'Giornata intera', full: true },
      { dow: 'Gio', d: '19', m: 'nov', part: 'Giornata intera', full: true },
      { dow: 'Ven', d: '20', m: 'nov', part: 'Mattina', full: false },
    ],
    total: '2,5 giorni', note: 'Matrimonio di mia sorella a Lecce.',
  }
  const EMAILS = {
    issue: { subject: `Nuova issue #${ISSUE.id} · ${ISSUE.title}`, why: 'Ricevi questa email perché sei un tecnico ServiceNow di Biotron.', owl: 'shared/img/email/archie_issue_created.png' },
    digest: { subject: 'Le tue scadenze dei prossimi 3 giorni', why: 'Ricevi questa email ogni mattina alle 8, solo quando hai qualcosa in scadenza.', owl: 'shared/img/email/archie_notifications_digest.png' },
    leave: { subject: `${LEAVE.who} ha chiesto ${LEAVE.total} di ferie`, why: "Ricevi questa email perché coordini le ferie dell'area Bologna.", owl: null },
  }
  // Categoria dell'email: il colore del modulo (anteprima «Colore per modulo»), in versione tenue.
  const CAT = {
    issue: { label: 'Issue', bg: '#e3eefa', ink: '#1f4f86', dot: '#4a82c6' },
    digest: { label: 'Scadenze', bg: '#e2f2eb', ink: '#175a4c', dot: '#3f8f7b' },
    leave: { label: 'Piano ferie', bg: '#fbece3', ink: '#86441f', dot: '#d27f52' },
  }
  // Logo di Archie (schedario + scritta): PNG trasparente a 3x della copia statica public/logo.svg.
  // Le email non usano SVG (Gmail e Outlook non lo mostrano); in produzione il PNG sta su archie.biotron.it.
  const logo = () => `<img src="shared/img/email/archie-logo.png" width="129" height="28" alt="Archie" style="display:block;width:129px;height:28px;border:0;">`
  const catChip = (k) => `<span style="display:inline-block;padding:3px 10px 3px 9px;border-radius:999px;background:${CAT[k].bg};font:600 12px/18px ${FONT};color:${CAT[k].ink};white-space:nowrap;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${CAT[k].dot};margin-right:6px;vertical-align:1px;"></span>${CAT[k].label}</span>`
  const PRIO = { Critica: [C.error, C.errorTint], Alta: [C.warning, C.warningTint], Media: [C.info, C.infoTint], Bassa: [C.muted, C.neutral] }

  // ── Pezzi comuni ────────────────────────────────────────────────
  const t = (s) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;">${s}</table>`
  const btn = (label, url, { ghost = false, onDark = false } = {}) => {
    const bg = ghost ? (onDark ? 'transparent' : C.paper) : (onDark ? C.paper : C.green)
    const fg = ghost ? (onDark ? C.paper : C.ink) : (onDark ? C.band : C.paper)
    const bd = ghost ? (onDark ? C.onBandMuted : C.lineStrong) : bg
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 8px 8px 0;"><tr><td style="border-radius:6px;background:${bg};border:1px solid ${bd};mso-padding-alt:8px 14px;">
      <a href="${APP}${url}" style="display:inline-block;padding:7px 14px;font:600 13px/18px ${FONT};color:${fg};text-decoration:none;border-radius:6px;">${esc(label)}</a></td></tr></table>`
  }
  const prio = (p) => `<span style="display:inline-block;padding:2px 9px;border-radius:5px;background:${PRIO[p][1]};color:${PRIO[p][0]};font:600 12px/18px ${FONT};">${p}</span>`
  const owlImg = (src, size, radius = 0) => src
    ? `<img src="${src}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border:0;border-radius:${radius}px;">`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;border:1.5px dashed ${C.lineStrong};background:${C.paper2};text-align:center;font:500 11px/15px ${FONT};color:${C.faint};display:table-cell;vertical-align:middle;padding:0 10px;box-sizing:border-box;">gufo da disegnare</div>`
  const wordmark = (color, dot) => `<span style="font:700 15px/20px ${FONT};letter-spacing:2.4px;color:${color};">ARCHIE</span><span style="font:700 15px/20px ${FONT};color:${dot};">.</span>`
  const footer = () => `<!--FOOT--><tr><td class="px" style="padding:9px 32px;background:${C.frame};border-top:1px solid ${C.line};font:400 12px/18px ${FONT};color:${C.muted};">
      Archie · Biotron S.p.A. · <a href="${APP}/" style="color:${C.muted};text-decoration:underline;">archie.biotron.it</a></td></tr>`
  const shell = (rows, subject, { bg = C.canvas } = {}) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title>
    <style>
      @font-face{font-family:Geist;src:url(fonts/Geist-300_800-normal.woff2) format('woff2');font-weight:300 800;}
      body{margin:0;padding:0;background:${bg};-webkit-text-size-adjust:100%;}
      a{color:${C.green};}
      @media (max-width:620px){.wrap{padding:0!important}.card{width:100%!important;border-radius:0!important;border:0!important}.px{padding-left:20px!important;padding-right:20px!important}.stack{display:block!important;width:100%!important;padding:0 0 12px!important}.hide-sm{display:none!important}.h1{font-size:24px!important;line-height:30px!important}.tab{width:40%!important}.big{font-size:44px!important;line-height:46px!important}}
    </style></head>
    <body style="margin:0;background:${bg};">
    <div style="display:none;max-height:0;overflow:hidden;">${esc(subject)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};"><tr><td align="center" class="wrap" style="padding:28px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="card" style="width:600px;max-width:600px;background:${C.paper};border-radius:12px;overflow:hidden;border:1px solid ${C.frame};">
    ${rows}
    </table></td></tr></table></body></html>`

  // ═══ A · Bollettino ════════════════════════════════════════════
  // Le email come un orario: testata con il giorno, righe con la data a sinistra, lo stato a destra.
  const A = {
    head: (right, cat) => `<tr><td class="px" style="padding:14px 32px;background:${C.frame};">${t(`<tr><td valign="middle">${logo()}</td><td align="right" valign="middle" style="font:500 12px/18px ${FONT};color:${C.muted};">${right}</td></tr>`)}</td></tr>
      <!--STRIP--><tr><td style="padding:0;border-top:1px solid ${C.line};">${t(`<tr><td width="75%" style="width:75%;font-size:0;line-height:0;">&nbsp;</td>
        <td width="25%" align="center" class="tab" style="width:25%;padding:6px 12px;background:${CAT[cat].bg};border-left:1px solid ${C.line};border-bottom:1px solid ${C.line};border-radius:0 0 0 10px;font:600 12px/18px ${FONT};letter-spacing:.4px;color:${CAT[cat].ink};white-space:nowrap;">${CAT[cat].label}</td></tr>`)}</td></tr><!--BODY-->`,
    title: (h, sub, owl) => `<tr><td class="px" style="padding:28px 32px 8px;">${t(`<tr><td valign="top">
        <h1 class="h1" style="margin:0 0 6px;font:650 22px/28px ${FONT};letter-spacing:-0.3px;color:${C.ink};">${h}</h1>
        <p style="margin:0;font:400 14px/22px ${FONT};color:${C.muted};">${sub}</p></td>
        ${owl !== undefined ? `<td width="96" valign="top" align="right" class="hide-sm" style="padding-left:16px;">${owlImg(owl, 96)}</td>` : ''}</tr>`)}</td></tr>`,
    dateCell: (dow, d, m, hl) => `<td width="64" valign="top" style="padding:14px 0;">
        <div style="width:50px;border-radius:8px;background:${hl ? C.field : C.paper2};border:1px solid ${hl ? C.green : C.line};text-align:center;padding:5px 0 6px;">
          <div style="font:600 10px/14px ${FONT};letter-spacing:.5px;text-transform:uppercase;color:${hl ? C.green : C.muted};">${dow}</div>
          <div style="font:600 20px/22px ${FONT};color:${C.ink};">${d}</div>
          <div style="font:500 10px/12px ${FONT};color:${C.muted};">${m}</div></div></td>`,
    issue(owl) {
      const i = ISSUE
      return A.head('Lunedì 16 novembre', 'issue') + A.title(`Nuova issue per ${esc(i.customer)}`, `Aperta da ${i.by} ${i.at}.`, owl ? EMAILS.issue.owl : undefined)
        + `<tr><td class="px" style="padding:12px 32px 0;">${t(`<tr>${A.dateCell('Lun', '16', 'nov', true)}
          <td valign="top" style="padding:14px 0;border-bottom:1px solid ${C.line};">
            <p style="margin:0 0 4px;font:500 12px/18px ${FONT};color:${C.muted};">#${i.id} · ${esc(i.site)}</p>
            <p style="margin:0 0 10px;font:600 17px/24px ${FONT};color:${C.ink};">${esc(i.title)}</p>
            <p style="margin:0;font:400 14px/22px ${FONT};color:${C.ink};">${esc(i.description)}</p></td>
          <td width="84" valign="top" align="right" style="padding:16px 0 0 12px;border-bottom:1px solid ${C.line};">${prio(i.priority)}</td></tr>`)}</td></tr>`
        + `<tr><td class="px" style="padding:14px 32px 0;">${t(`<tr>${A.dateCell('Mer', '18', 'nov', false)}
          <td valign="middle" style="padding:14px 0;"><p style="margin:0;font:600 14px/20px ${FONT};color:${C.ink};">Scadenza</p><p style="margin:0;font:400 13px/20px ${FONT};color:${C.muted};">tra 2 giorni, ancora da assegnare</p></td></tr>`)}</td></tr>`
        + `<tr><td class="px" style="padding:20px 32px 30px;">${btn('Apri la issue', `/issues?open=${i.id}`)}</td></tr>`
        + footer(EMAILS.issue.why)
    },
    digest(owl) {
      const n = DIGEST.reduce((a, g) => a + g.items.length, 0)
      return A.head('Lunedì 16 novembre · ore 8:00', 'digest') + A.title(`${n} scadenze nei prossimi 3 giorni`, 'Una oggi, le altre tra domani e mercoledì.', owl ? EMAILS.digest.owl : undefined)
        + `<tr><td class="px" style="padding:12px 32px 4px;">${t(DIGEST.map((g, gi) => g.items.map((it, ii) => `<tr>
            ${ii === 0 ? A.dateCell(g.dow, g.date.slice(0, 2), 'nov', gi === 0).replace('<td width="64"', `<td width="64" rowspan="${g.items.length}"`) : ''}
            <td valign="top" style="padding:14px 0;border-bottom:1px solid ${C.line};">
              <p style="margin:0 0 3px;font:500 12px/18px ${FONT};color:${C.muted};">${it.kind}${it.kind === 'Issue' ? ` ${it.ref}` : ''} · ${esc(it.where)}</p>
              <a href="${APP}${it.url}" style="font:600 15px/22px ${FONT};color:${C.ink};text-decoration:none;">${esc(it.title)}</a></td>
            <td width="70" valign="top" align="right" style="padding:16px 0 0 12px;border-bottom:1px solid ${C.line};"><a href="${APP}${it.url}" style="font:600 13px/20px ${FONT};color:${C.green};text-decoration:none;">Apri&nbsp;›</a></td></tr>`).join('')).join(''))}</td></tr>`
        + `<tr><td class="px" style="padding:20px 32px 30px;">${btn('Apri la Dashboard', '/')}</td></tr>`
        + footer(EMAILS.digest.why)
    },
    leave(owl) {
      const l = LEAVE
      return A.head('Lunedì 16 novembre', 'leave') + A.title(`${esc(l.who)} chiede ${l.total} di ferie`, `Richiesta inviata ${l.sent}, in attesa della tua validazione.`, owl ? EMAILS.leave.owl : undefined)
        + `<tr><td class="px" style="padding:12px 32px 0;">${t(l.days.map((d) => `<tr>${A.dateCell(d.dow, d.d, d.m, false)}
            <td valign="middle" style="padding:14px 0;border-bottom:1px solid ${C.line};"><p style="margin:0;font:600 15px/22px ${FONT};color:${C.ink};">${d.part}</p><p style="margin:0;font:400 13px/20px ${FONT};color:${C.muted};">${l.reason}</p></td>
            <td width="96" valign="middle" align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid ${C.line};">
              <span style="display:inline-block;width:30px;height:14px;border-radius:3px;background:${C.leave};"></span><span style="display:inline-block;width:30px;height:14px;border-radius:3px;margin-left:3px;background:${d.full ? C.leave : C.neutral};"></span>
              <div style="font:500 10px/14px ${FONT};color:${C.faint};padding-top:3px;">MAT&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;POM</div></td></tr>`).join(''))}</td></tr>`
        + `<tr><td class="px" style="padding:18px 32px 0;"><p style="margin:0;padding:12px 14px;border-radius:8px;background:${C.paper2};font:400 14px/22px ${FONT};color:${C.ink};"><span style="color:${C.muted};">Nota di Nicole:</span> ${esc(l.note)}</p></td></tr>`
        + `<tr><td class="px" style="padding:20px 32px 30px;">${btn('Valida o rifiuta', '/piano-ferie?vista=coordinamento')}${btn('Vedi la griglia di novembre', '/piano-ferie?mese=2026-11', { ghost: true })}</td></tr>`
        + footer(EMAILS.leave.why)
    },
  }

  // ═══ B · Scheda ════════════════════════════════════════════════
  // L'email è la scheda flottante dell'app: testata scura con riferimento e stato, proprietà in griglia, azione in fondo.
  const B = {
    band: (ref, chip, h, sub, owl) => `<tr><td class="px" style="padding:22px 32px 26px;background:${C.band};background-image:linear-gradient(160deg,${C.band2},${C.band});">
        ${t(`<tr><td style="padding-bottom:20px;">${wordmark(C.paper, C.leave)}</td><td align="right" style="padding-bottom:20px;font:500 12px/18px ${FONT};color:${C.onBandMuted};">Biotron S.p.A.</td></tr>`)}
        ${t(`<tr><td valign="bottom">
          <p style="margin:0 0 8px;font:500 13px/18px ${FONT};color:${C.onBand};">${ref}${chip ? `&nbsp;&nbsp;${chip}` : ''}</p>
          <h1 class="h1" style="margin:0 0 6px;font:650 25px/31px ${FONT};letter-spacing:-0.3px;color:${C.paper};">${h}</h1>
          <p style="margin:0;font:400 14px/21px ${FONT};color:${C.onBand};">${sub}</p></td>
          ${owl !== undefined ? `<td width="112" valign="bottom" align="right" class="hide-sm" style="padding-left:16px;">${owlImg(owl, 112, 16)}</td>` : ''}</tr>`)}</td></tr>`,
    props: (rows) => `<tr><td class="px" style="padding:24px 32px 4px;">${t(rows.map((r) => `<tr>${r.map(([k, v]) => `<td class="stack" width="50%" valign="top" style="padding:0 16px 16px 0;">
        <p style="margin:0 0 3px;font:500 12px/18px ${FONT};color:${C.muted};">${k}</p><p style="margin:0;font:600 15px/22px ${FONT};color:${C.ink};">${v}</p></td>`).join('')}</tr>`).join(''))}</td></tr>`,
    issue(owl) {
      const i = ISSUE
      return B.band(`Issue #${i.id}`, prio(i.priority), esc(i.title), `Aperta da ${i.by} ${i.at}`, owl ? EMAILS.issue.owl : undefined)
        + B.props([[['Cliente', esc(i.customer)], ['Sito', esc(i.site)]], [['Scadenza', i.due], ['Assegnata a', '<span style="color:#5b6b67;font-weight:500;">nessuno</span>']]])
        + `<tr><td class="px" style="padding:4px 32px 0;"><p style="margin:0;padding-top:16px;border-top:1px solid ${C.line};font:400 15px/24px ${FONT};color:${C.ink};">${esc(i.description)}</p></td></tr>`
        + `<tr><td class="px" style="padding:24px 32px 30px;">${btn('Apri la issue', `/issues?open=${i.id}`)}</td></tr>`
        + footer(EMAILS.issue.why)
    },
    digest(owl) {
      const n = DIGEST.reduce((a, g) => a + g.items.length, 0)
      return B.band('Scadenze · lunedì 16 novembre', '', `${n} cose da chiudere entro mercoledì`, 'Issue assegnate a te e task della tua area.', owl ? EMAILS.digest.owl : undefined)
        + DIGEST.map((g, gi) => `<tr><td class="px" style="padding:${gi ? 18 : 24}px 32px 0;">
            <p style="margin:0 0 6px;font:650 13px/18px ${FONT};color:${gi === 0 ? C.error : C.ink};">${g.day} ${g.date}</p>
            ${t(g.items.map((it) => `<tr><td style="padding:12px 14px;border:1px solid ${C.line};border-radius:8px;background:${C.paper};">
              ${t(`<tr><td valign="top"><a href="${APP}${it.url}" style="font:600 15px/22px ${FONT};color:${C.ink};text-decoration:none;">${esc(it.title)}</a>
              <p style="margin:2px 0 0;font:400 13px/19px ${FONT};color:${C.muted};">${it.kind}${it.kind === 'Issue' ? ` ${it.ref}` : ''} · ${esc(it.where)}</p></td>
              <td width="60" align="right" valign="middle"><a href="${APP}${it.url}" style="font:600 13px/20px ${FONT};color:${C.green};text-decoration:none;">Apri&nbsp;›</a></td></tr>`)}</td></tr><tr><td height="6" style="font-size:0;line-height:6px;">&nbsp;</td></tr>`).join(''))}</td></tr>`).join('')
        + `<tr><td class="px" style="padding:16px 32px 30px;">${btn('Apri la Dashboard', '/')}</td></tr>`
        + footer(EMAILS.digest.why)
    },
    leave(owl) {
      const l = LEAVE
      return B.band('Piano ferie · da validare', '', `${esc(l.who)} · ${l.total} di ${l.reason.toLowerCase()}`, `Da mercoledì 18 a venerdì 20 novembre, mattina compresa`, owl ? EMAILS.leave.owl : undefined)
        + B.props([[['Area', l.area], ['Inviata', l.sent]]])
        + `<tr><td class="px" style="padding:0 32px;">${t(`<tr>${l.days.map((d) => `<td width="33%" valign="top" class="stack" style="padding:0 6px 0 0;">
            <div style="border:1px solid ${C.line};border-radius:8px;padding:10px 12px;">
              <p style="margin:0;font:500 12px/18px ${FONT};color:${C.muted};">${d.dow} ${d.d} ${d.m}</p>
              <p style="margin:2px 0 8px;font:600 14px/20px ${FONT};color:${C.ink};">${d.full ? 'Tutto il giorno' : 'Mattina'}</p>
              ${t(`<tr><td width="50%" style="height:8px;font-size:0;line-height:0;border-radius:4px 0 0 4px;background:${C.leave};">&nbsp;</td><td width="50%" style="height:8px;font-size:0;line-height:0;border-radius:0 4px 4px 0;background:${d.full ? C.leave : C.neutral};">&nbsp;</td></tr>`)}</div></td>`).join('')}</tr>`)}</td></tr>`
        + `<tr><td class="px" style="padding:18px 32px 0;"><p style="margin:0;font:400 15px/24px ${FONT};color:${C.ink};">«${esc(l.note)}»</p></td></tr>`
        + `<tr><td class="px" style="padding:22px 32px 30px;">${btn('Valida o rifiuta', '/piano-ferie?vista=coordinamento')}${btn('Vedi la griglia', '/piano-ferie?mese=2026-11', { ghost: true })}</td></tr>`
        + footer(EMAILS.leave.why)
    },
  }

  // ═══ C · Ricevuta ══════════════════════════════════════════════
  // Una cosa sola da fare: la frase in grande, i fatti come voci di una ricevuta tra righe tratteggiate, il pulsante.
  const C_ = {
    top: (owl) => `<tr><td align="center" class="px" style="padding:28px 32px 0;">
        ${owl !== undefined ? `<div style="margin:0 auto 14px;width:88px;">${owlImg(owl, 88)}</div>` : ''}
        ${wordmark(C.ink, C.green)}</td></tr>`,
    lead: (big, h, sub) => `<tr><td align="center" class="px" style="padding:22px 40px 6px;">
        ${big ? `<p class="big" style="margin:0 0 6px;font:650 56px/58px ${FONT};letter-spacing:-1.5px;color:${C.green};">${big}</p>` : ''}
        <h1 class="h1" style="margin:0 0 8px;font:650 24px/31px ${FONT};letter-spacing:-0.3px;color:${C.ink};">${h}</h1>
        <p style="margin:0;font:400 15px/23px ${FONT};color:${C.muted};">${sub}</p></td></tr>`,
    cut: () => `<tr><td class="px" style="padding:22px 32px 0;"><div style="border-top:1.5px dashed ${C.lineStrong};font-size:0;line-height:0;">&nbsp;</div></td></tr>`,
    lines: (rows, total) => `<tr><td class="px" style="padding:14px 32px 0;">${t(rows.map(([k, v]) => `<tr>
        <td valign="top" style="padding:7px 0;font:400 14px/21px ${FONT};color:${C.muted};">${k}</td>
        <td valign="top" align="right" style="padding:7px 0 7px 16px;font:600 14px/21px ${FONT};color:${C.ink};">${v}</td></tr>`).join('')
        + (total ? `<tr><td colspan="2" style="padding-top:8px;"><div style="border-top:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</div></td></tr><tr><td style="padding:8px 0 0;font:650 15px/22px ${FONT};color:${C.ink};">${total[0]}</td><td align="right" style="padding:8px 0 0 16px;font:650 15px/22px ${FONT};color:${C.ink};">${total[1]}</td></tr>` : ''))}</td></tr>`,
    action: (main, ghost) => `<tr><td align="center" class="px" style="padding:26px 32px 30px;">${main}${ghost || ''}</td></tr>`,
    issue(owl) {
      const i = ISSUE
      return A.head('Lunedì 16 novembre', 'issue') + C_.lead(`#${i.id}`, esc(i.title), `${esc(i.customer)} · aperta da ${i.by} ${i.at}`) + C_.cut()
        + C_.lines([['Priorità', prio(i.priority)], ['Sito', esc(i.site)], ['Scadenza', i.due], ['Assegnata a', 'nessuno']])
        + `<tr><td class="px" style="padding:14px 32px 0;"><p style="margin:0;font:400 14px/22px ${FONT};color:${C.ink};">${esc(i.description)}</p></td></tr>`
        + C_.cut() + C_.action(btn('Apri la issue', `/issues?open=${i.id}`))
        + footer(EMAILS.issue.why)
    },
    digest(owl) {
      const n = DIGEST.reduce((a, g) => a + g.items.length, 0)
      return A.head('Lunedì 16 novembre', 'digest') + C_.lead(String(n), 'scadenze nei prossimi 3 giorni', 'Buongiorno Federico, ecco cosa chiudere entro mercoledì.') + C_.cut()
        + DIGEST.map((g) => `<tr><td class="px" style="padding:14px 32px 0;"><p style="margin:0 0 2px;font:650 12px/18px ${FONT};letter-spacing:.3px;color:${C.green};">${g.day} ${g.date}</p>
            ${t(g.items.map((it) => `<tr><td valign="top" style="padding:6px 0;"><a href="${APP}${it.url}" style="font:600 14px/21px ${FONT};color:${C.ink};text-decoration:none;">${esc(it.title)}</a><br><span style="font:400 12px/18px ${FONT};color:${C.muted};">${it.kind}${it.kind === 'Issue' ? ` ${it.ref}` : ''} · ${esc(it.where)}</span></td>
              <td width="60" align="right" valign="top" style="padding:6px 0 6px 12px;"><a href="${APP}${it.url}" style="font:600 13px/21px ${FONT};color:${C.green};text-decoration:none;">Apri&nbsp;›</a></td></tr>`).join(''))}</td></tr>`).join('')
        + C_.cut() + C_.action(btn('Apri la Dashboard', '/'))
        + footer(EMAILS.digest.why)
    },
    leave(owl) {
      const l = LEAVE
      return A.head('Lunedì 16 novembre', 'leave') + C_.lead(l.total.replace(' giorni', ''), `giorni di ferie per ${esc(l.who)}`, 'In attesa della tua validazione.') + C_.cut()
        + C_.lines(l.days.map((d) => [`${d.dow} ${d.d} ${d.m}`, d.full ? 'Tutto il giorno' : 'Mattina']), ['Totale', l.total])
        + `<tr><td class="px" style="padding:14px 32px 0;"><p style="margin:0;font:400 14px/22px ${FONT};color:${C.muted};">Nota: <span style="color:${C.ink};">${esc(l.note)}</span></p></td></tr>`
        + C_.cut() + C_.action(btn('Valida o rifiuta', '/piano-ferie?vista=coordinamento'), btn('Vedi la griglia', '/piano-ferie?mese=2026-11', { ghost: true }))
        + footer(EMAILS.leave.why)
    },
  }

  const DIRS = { a: A, b: B, c: C_ }
  window.ArchieEmails = {
    EMAILS,
    render: (dir, kind, owl, vertical = false) => {
      const html = DIRS[dir][kind](owl)
      if (!vertical) return shell(html, EMAILS[kind].subject)
      // Striscia verticale: la categoria scorre lungo il lato sinistro del corpo, testo ruotato.
      // Nei template veri l'etichetta ruotata va come immagine: Gmail e Outlook ignorano writing-mode/transform.
      const [head, rest] = html.split('<!--STRIP-->')
      const [, afterStrip] = rest.split('<!--BODY-->')
      const [body, foot] = afterStrip.split('<!--FOOT-->')
      const c = CAT[kind]
      const strip = `<tr><td style="padding:0;border-top:1px solid ${C.line};">${t(`<tr>
        <td width="30" valign="middle" align="center" style="width:30px;background:${c.bg};border-right:1px solid ${C.line};padding:16px 0;">
          <div style="writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;margin:0 auto;font:600 12px/30px ${FONT};letter-spacing:1.2px;text-transform:uppercase;color:${c.ink};">${c.label}</div></td>
        <td valign="top" style="padding:0;">${t(body)}</td></tr>`)}</td></tr>`
      return shell(head + strip + '<!--FOOT-->' + foot, EMAILS[kind].subject)
    },
  }
})()
