import * as React from 'react'
import { Box, Typography } from '@mui/material'

import { CampoIcon } from '../../ui/campo'
import { daysLabel, dShort } from './contractModel'
import type { ContractReminders as Reminders, ReminderState } from './types'

/** Oltre questo numero di promemoria già passati, si mostrano il primo, quanti altri e l'ultimo. */
const FOLD_AFTER = 4

const STATE_LABEL: Record<ReminderState, string> = { sent: 'Inviato', failed: 'Non riuscito', skipped: 'Saltato', next: 'Prossimo', planned: 'Previsto' }

/**
 * Sezione «Promemoria di rinnovo» della finestra del contratto (anteprima ctr2-base): a chi vanno
 * (venditore e ufficio) e il calendario, dall'avviso alla fine, con l'esito degli invii.
 */
export default function ContractReminders({ reminders: r, sellerName, active, endDate }: { reminders: Reminders; sellerName: string; active: boolean; endDate?: string }) {
  if (!active) return <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Contratto non attivo: nessun promemoria.</Typography>

  const office = r.seller_kind ? r.cc : r.to
  const who = (icon: 'user' | 'users', title: React.ReactNode, sub: string) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr)', gap: 1, alignItems: 'start', fontSize: 13 }}>
      <Box sx={{ color: 'text.secondary', mt: '2px', display: 'inline-flex' }}><CampoIcon name={icon} size={16} /></Box>
      <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title}<Typography component="span" sx={{ display: 'block', fontSize: 11.5, color: 'text.secondary' }}>{sub}</Typography></Box>
    </Box>
  )

  const past = r.dates.filter((d) => d.state === 'sent' || d.state === 'failed' || d.state === 'skipped')
  type Row = { kind: 'date'; d: Reminders['dates'][number]; i: number } | { kind: 'gap'; n: number; allSent: boolean }
  const rows: Row[] = r.dates.map((d, i) => ({ kind: 'date', d, i }))
  const shown: Row[] = past.length > FOLD_AFTER
    ? [rows[0], { kind: 'gap', n: past.length - 2, allSent: past.slice(1, -1).every((d) => d.state === 'sent') }, ...rows.slice(past.length - 1)]
    : rows

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        {r.seller_kind
          ? who('user', <><b>{sellerName || 'Venditore'}</b> · {r.to.join(', ')}</>, r.seller_kind === 'user' ? 'Venditore, utente Archie: email e campanella' : 'Venditore inserito a mano: solo email')
          : who('user', <b>Nessun venditore</b>, "Il promemoria va solo all'ufficio")}
        {office.length ? who('users', <><b>Ufficio</b> · {office.join(', ')}</>, 'Dalle Impostazioni di Archie') : null}
        {!r.to.length ? (
          <Typography role="alert" sx={{ fontSize: 12.5, color: 'warning.main', fontWeight: 600 }}>
            Nessun destinatario: imposta gli indirizzi dell'ufficio nelle Impostazioni di Archie o un'email per il venditore.
          </Typography>
        ) : null}
      </Box>

      {r.dates.length ? (
        <Box component="ol" aria-label="Calendario dei promemoria" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
          {shown.map((row, k) => {
            if (row.kind === 'gap') {
              return (
                <Box component="li" key={`gap-${k}`} sx={{ display: 'grid', gridTemplateColumns: '14px 120px minmax(0,1fr)', gap: 1, alignItems: 'center', py: 0.6, fontSize: 12.5, color: 'text.secondary' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', border: '2px dotted', borderColor: 'archie.borderStrong', justifySelf: 'center' }} />
                  <span>{row.allSent ? `… altri ${row.n} inviati` : `… altre ${row.n} date passate`}</span><span />
                </Box>
              )
            }
            const { d, i } = row
            const tone = d.state === 'failed' ? 'error.main' : d.state === 'next' ? 'warning.main' : 'text.secondary'
            return (
              <Box component="li" key={d.date} sx={{ display: 'grid', gridTemplateColumns: '14px 120px minmax(0,1fr)', gap: 1, alignItems: 'center', py: 0.6, fontSize: 12.5 }}>
                <Box sx={{
                  width: 10, height: 10, borderRadius: '50%', justifySelf: 'center', border: '2px solid',
                  borderColor: d.state === 'sent' ? 'primary.main' : d.state === 'failed' ? 'error.main' : d.state === 'next' ? 'warning.main' : 'archie.borderStrong',
                  bgcolor: d.state === 'sent' ? 'primary.main' : 'background.paper',
                }} />
                <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{dShort(d.date)}</Box>
                <Box component="span" sx={{ color: tone, fontWeight: d.state === 'next' || d.state === 'failed' ? 600 : 400, display: 'inline-flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                  {d.state === 'sent' ? <Box component="span" sx={{ color: 'success.main', display: 'inline-flex' }}><CampoIcon name="check" size={14} /></Box> : null}
                  <span>{d.state === 'next' ? `${STATE_LABEL.next} · ${daysLabel(d.date)}` : d.state === 'failed' ? `${STATE_LABEL.failed}: ${d.error ?? 'errore'}` : STATE_LABEL[d.state]}</span>
                  {i === 0 ? <span>· avviso</span> : null}
                  {endDate && d.date === endDate ? <span>· scadenza</span> : null}
                </Box>
              </Box>
            )
          })}
        </Box>
      ) : null}

      <Typography sx={{ fontSize: 11.5, color: 'text.secondary', display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <CampoIcon name="clock" size={13} />Uno ogni {r.every} giorni dalla data dell'avviso. Si fermano quando sposti in avanti la fine (Rinnova…) o segni il contratto come chiuso.
      </Typography>
    </Box>
  )
}
