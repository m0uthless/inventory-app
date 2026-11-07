import type { ReactNode } from 'react'
import { Box, Tooltip } from '@mui/material'
import { EXPIRY_TONE, STATUS_TONE, daysLabel, dShort, expiryHint, periodMarks, type Tone } from './contractModel'
import type { ContractStatus, ExpiryState } from './types'

/*
 * Badge del modulo Contratti, stesso linguaggio dei badge di Siti e Issue:
 * tinta + segno di forma, quindi mai solo colore.
 */
const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: 'success.light', fg: 'success.main' },
  warning: { bg: 'warning.light', fg: 'warning.main' },
  error: { bg: 'error.light', fg: 'error.main' },
  neutral: { bg: 'archie.neutralBg', fg: 'text.secondary' },
}
const MARK = {
  dot: <circle cx="6" cy="6" r="4" fill="currentColor" />,
  ring: <circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 1.6" />,
  dash: <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  half: <><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 2.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor" /></>,
  bang: <><path d="M6 1.6 10.8 10H1.2z" fill="currentColor" /><path d="M6 4.6v2.6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" /><circle cx="6" cy="8.6" r=".7" fill="#fff" /></>,
}

function Badge({ tone, mark, children, onDark }: { tone: Tone; mark: ReactNode; children: ReactNode; onDark?: boolean }) {
  const t = TONE[tone]
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 22, pl: 0.875, pr: 1, borderRadius: '5px',
      fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap', bgcolor: t.bg, color: t.fg,
      ...(onDark && { boxShadow: '0 0 0 1px rgb(255 255 255 / .2)' }),
    }}>
      <Box component="svg" viewBox="0 0 12 12" aria-hidden sx={{ width: 10, height: 10, flex: 'none' }}>{mark}</Box>
      {children}
    </Box>
  )
}

const STATUS_MARK: Record<ContractStatus, ReactNode> = { bozza: MARK.ring, attivo: MARK.dot, disdetto: MARK.dash }
export function ContractStatusBadge({ status, label, onDark }: { status: ContractStatus; label: string; onDark?: boolean }) {
  return <Badge tone={STATUS_TONE[status]} mark={STATUS_MARK[status]} onDark={onDark}>{label}</Badge>
}

const EXPIRY_MARK: Record<ExpiryState, ReactNode> = { none: MARK.dash, ok: MARK.dot, notice: MARK.half, expiring: MARK.half, expired: MARK.bang }
export function ExpiryBadge({ state, end, notice, onDark }: { state: ExpiryState; end: string; notice: string | null; onDark?: boolean }) {
  if (state === 'none') return <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
  const e = EXPIRY_TONE[state]
  return <Tooltip title={expiryHint(state, end, notice)}><span><Badge tone={e.tone} mark={EXPIRY_MARK[state]} onDark={onDark}>{e.label}</Badge></span></Tooltip>
}

/**
 * Periodo del contratto come linea: inizio → (termine di disdetta) → fine, con oggi.
 * `compact` è la versione da tabella (solo barra), altrimenti con le date sotto.
 */
export function PeriodBar({ start, end, notice, state, compact, endsOnly }: { start: string; end: string; notice: string | null; state: ExpiryState; compact?: boolean; endsOnly?: boolean }) {
  const m = periodMarks(start, end, state === 'none' ? null : notice)
  const tone = state === 'none' ? 'neutral' : EXPIRY_TONE[state].tone
  const fill = tone === 'neutral' ? 'text.disabled' : `${tone}.main`
  const H = compact ? 4 : 6
  const bar = (
    <Box sx={{ position: 'relative', height: compact ? 10 : 18, display: 'flex', alignItems: 'center' }}>
      <Box sx={{ position: 'absolute', left: 0, right: 0, height: H, borderRadius: H, bgcolor: 'archie.neutralBg' }} />
      {m.notice != null ? (
        <Box sx={{ position: 'absolute', left: `${m.notice * 100}%`, right: 0, height: H, borderRadius: H, bgcolor: (t) => t.palette.warning.light, opacity: state === 'none' ? 0.5 : 1 }} />
      ) : null}
      {m.started ? <Box sx={{ position: 'absolute', left: 0, width: `${m.today * 100}%`, height: H, borderRadius: H, bgcolor: fill, opacity: state === 'none' ? 0.45 : 0.9 }} /> : null}
      {m.notice != null && !compact ? <Box title="Termine di disdetta" sx={{ position: 'absolute', left: `calc(${m.notice * 100}% - 1px)`, width: 2, height: 14, borderRadius: 1, bgcolor: 'warning.main' }} /> : null}
      {m.started && !m.ended ? <Box sx={{ position: 'absolute', left: `calc(${m.today * 100}% - ${compact ? 4 : 6}px)`, width: compact ? 8 : 12, height: compact ? 8 : 12, borderRadius: '50%', bgcolor: 'background.paper', border: '2px solid', borderColor: fill }} /> : null}
    </Box>
  )
  if (compact) return bar
  return (
    <Box>
      {bar}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.5, fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
        <span>{dShort(start)}</span>
        {notice && state !== 'none' && !endsOnly ? <Box component="span" sx={{ color: 'warning.main', fontWeight: 550 }}>disdetta entro {dShort(notice)}</Box> : null}
        <span>{dShort(end)}</span>
      </Box>
    </Box>
  )
}

/** Stato in una colonna: per i contratti attivi la scadenza, altrimenti lo stato (bozza, disdetto). */
export function StateCell({ status, label, state, end, notice }: { status: ContractStatus; label: string; state: ExpiryState; end: string; notice: string | null }) {
  return status === 'attivo' ? <ExpiryBadge state={state} end={end} notice={notice} /> : <ContractStatusBadge status={status} label={label} />
}

/** Fine del contratto con distanza da oggi, per la tabella. */
export function EndCell({ end, state }: { end: string; state: ExpiryState }) {
  const warn = state === 'expired' ? 'error.main' : state === 'expiring' || state === 'notice' ? 'warning.main' : 'text.secondary'
  return (
    <Box sx={{ minWidth: 0, lineHeight: 1.25 }}>
      <Box sx={{ fontVariantNumeric: 'tabular-nums' }}>{dShort(end)}</Box>
      {state !== 'none' ? <Box sx={{ fontSize: 12, color: warn, fontWeight: state === 'ok' ? 400 : 550 }}>{daysLabel(end)}</Box> : null}
    </Box>
  )
}
