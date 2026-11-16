import type { ReactNode } from 'react'
import { Box, Tooltip } from '@mui/material'
import { CampoIcon } from '../../ui/campo'
import { daysLabel, dShort } from '../contracts/contractModel'
import { dueStateOf, RESULT_LABEL, type DueState, type Result } from './mtModel'

/* Badge della manutenzione, stesso linguaggio di Siti, Issue e Contratti: tinta + segno di forma. */
type Tone = 'success' | 'warning' | 'error' | 'neutral'
const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: 'success.light', fg: 'success.main' },
  warning: { bg: 'warning.light', fg: 'warning.main' },
  error: { bg: 'error.light', fg: 'error.main' },
  neutral: { bg: 'archie.neutralBg', fg: 'text.secondary' },
}
const MARK = {
  dot: <circle cx="6" cy="6" r="4" fill="currentColor" />,
  ring: <circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  half: <><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 2.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor" /></>,
  bang: <><path d="M6 1.6 10.8 10H1.2z" fill="currentColor" /><path d="M6 4.6v2.6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" /><circle cx="6" cy="8.6" r=".7" fill="#fff" /></>,
  dash: <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
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

const RES: Record<Result, [Tone, ReactNode]> = { ok: ['success', MARK.dot], partial: ['warning', MARK.half], ko: ['error', MARK.bang], not_planned: ['neutral', MARK.dash] }
export function ResultBadge({ result, onDark }: { result: Result; onDark?: boolean }) {
  const [tone, mark] = RES[result] ?? RES.not_planned
  return <Badge tone={tone} mark={mark} onDark={onDark}>{RESULT_LABEL[result] ?? result}</Badge>
}

const DUE: Record<DueState, [Tone, ReactNode, string]> = { overdue: ['error', MARK.bang, 'Scaduta'], next30: ['warning', MARK.half, 'In scadenza'], later: ['neutral', MARK.ring, 'Programmata'] }
export function DueStateBadge({ due, onDark }: { due: string; onDark?: boolean }) {
  const [tone, mark, label] = DUE[dueStateOf(due)]
  return <Badge tone={tone} mark={mark} onDark={onDark}>{label}</Badge>
}

/** Scadenza su due righe: data e distanza da oggi. `overrideTip` aggiunge l'icona della scadenza modificata. */
export function DueCell({ due, overrideTip }: { due: string; overrideTip?: string | null }) {
  const s = dueStateOf(due)
  return (
    <Box sx={{ lineHeight: 1.25, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
        {dShort(due)}
        {overrideTip ? (
          <Tooltip title={overrideTip}>
            <Box component="span" aria-label={overrideTip} sx={{ display: 'inline-grid', placeItems: 'center', width: 18, height: 18, borderRadius: '4px', bgcolor: 'warning.light', color: 'warning.main' }}><CampoIcon name="calendar" size={12} /></Box>
          </Tooltip>
        ) : null}
      </Box>
      <Box sx={{ fontSize: 12, color: s === 'overdue' ? 'error.main' : s === 'next30' ? 'warning.main' : 'text.secondary', fontWeight: s === 'later' ? 400 : 600 }}>{daysLabel(due)}</Box>
    </Box>
  )
}

/** Nome del piano; se la scadenza è stata spostata per questo inventario lo dice sotto. */
export function PlanCell({ title, override, planDue }: { title: string; override?: string | null; planDue?: string | null }) {
  return (
    <Box sx={{ minWidth: 0, lineHeight: 1.3 }}>
      <Box sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Box>
      {override ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 11.5, fontWeight: 550, color: 'warning.main', whiteSpace: 'nowrap' }}>
          <CampoIcon name="calendar" size={12} />scadenza modificata{planDue ? ` · il piano dice ${dShort(planDue)}` : ''}
        </Box>
      ) : null}
    </Box>
  )
}

const PLAN: Record<'run' | 'done' | 'arch', [Tone, ReactNode, string]> = { run: ['warning', MARK.half, 'In corso'], done: ['success', MARK.dot, 'Completato'], arch: ['neutral', MARK.dash, 'Archiviato'] }
export function PlanStateBadge({ state, onDark }: { state: 'run' | 'done' | 'arch'; onDark?: boolean }) {
  const [tone, mark, label] = PLAN[state]
  return <Badge tone={tone} mark={mark} onDark={onDark}>{label}</Badge>
}
