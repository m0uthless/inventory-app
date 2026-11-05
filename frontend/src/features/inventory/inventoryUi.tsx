/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { Box, Tooltip } from '@mui/material'
import { IssuePriorityMark } from '../issues/IssueBadges'
import { PRIORITY_META } from '../issues/types'
import type { CampoIconName } from '../../ui/campo'

// ── Campi non applicabili per tipo di inventario ─────────────────────────────
// Per ogni tipo, i campi che non hanno senso (disabilitati nel modulo, nascosti
// nel pannello). Campo non elencato = sempre applicabile.
export type InventoryFieldName =
  | 'hostname' | 'local_ip' | 'srsa_ip'
  | 'location' | 'telefono'
  | 'os_user' | 'os_pwd' | 'app_usr' | 'app_pwd' | 'vnc_pwd'
  | 'manufacturer' | 'model' | 'warranty_end_date'

const PROFILE_MANAGEMENT: InventoryFieldName[] = ['vnc_pwd', 'app_usr', 'app_pwd']
const PROFILE_LOAD_BALANCER: InventoryFieldName[] = ['vnc_pwd', 'os_user', 'os_pwd', 'app_usr', 'app_pwd']
const PROFILE_STORAGE: InventoryFieldName[] = ['vnc_pwd', 'os_user', 'os_pwd']

export const TYPE_DISABLED_FIELDS: Partial<Record<string, InventoryFieldName[]>> = {
  management: PROFILE_MANAGEMENT,
  management1: PROFILE_MANAGEMENT,
  management2: PROFILE_MANAGEMENT,
  management3: PROFILE_MANAGEMENT,
  management4: PROFILE_MANAGEMENT,
  load_balancer1: PROFILE_LOAD_BALANCER,
  load_balancer2: PROFILE_LOAD_BALANCER,
  storage: PROFILE_STORAGE,
}

export const disabledFieldsFor = (typeKey?: string | null) => new Set(TYPE_DISABLED_FIELDS[typeKey ?? ''] ?? [])

/** Icona a tratto per il tipo di inventario (workstation, rete, server…). */
export function invTypeIcon(key?: string | null): CampoIconName {
  const t = (key || '').toLowerCase()
  if (/(work|ws|pc|client|monitor|modal|vue)/.test(t)) return 'monitor'
  if (/(rout|switch|fire|vpn|net|rete|balancer)/.test(t)) return 'cloud'
  if (/(storage|nas|vna)/.test(t)) return 'layers'
  return 'server'
}

// ── Stato dell'inventario: badge con segno di forma (come lo stato delle Issue) ─
const MARK: Record<string, ReactNode> = {
  in_use: <circle cx="6" cy="6" r="4" fill="currentColor" />,
  to_install: <circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  maintenance: <><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor" /></>,
  repair: <path d="M6 1.6 10.6 10H1.4z" fill="currentColor" />,
  retired: <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
}
const TONE: Record<string, { bg: string; fg: string }> = {
  in_use: { bg: 'success.light', fg: 'success.main' },
  to_install: { bg: 'info.light', fg: 'info.main' },
  maintenance: { bg: 'warning.light', fg: 'warning.main' },
  repair: { bg: 'error.light', fg: 'error.main' },
  retired: { bg: 'archie.neutralBg', fg: 'text.secondary' },
}

export function InventoryStatusBadge({ statusKey, label, onDark }: { statusKey?: string | null; label?: string | null; onDark?: boolean }) {
  if (!label) return <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
  const k = statusKey ?? ''
  const t = TONE[k] ?? TONE.retired
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 22, pl: 0.875, pr: 1, borderRadius: '5px',
      fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap', bgcolor: t.bg, color: t.fg,
      ...(onDark && { boxShadow: '0 0 0 1px rgb(255 255 255 / .2)' }),
    }}>
      <Box component="svg" viewBox="0 0 12 12" aria-hidden sx={{ width: 10, height: 10, flex: 'none' }}>{MARK[k] ?? MARK.retired}</Box>
      {label}
    </Box>
  )
}

/** Segnale di issue aperta: le tacche di priorità delle Issue, con suggerimento. */
export function OpenIssueMark({ priority }: { priority?: string | null }) {
  const p = priority || 'medium'
  return (
    <Tooltip title={`Issue aperta · priorità ${PRIORITY_META[p]?.label?.toLowerCase() ?? p}`}>
      <Box component="span" sx={{ display: 'inline-flex', flex: 'none', ml: 1 }}><IssuePriorityMark priority={p} compact /></Box>
    </Tooltip>
  )
}
