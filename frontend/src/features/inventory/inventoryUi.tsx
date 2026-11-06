/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { Box, Tooltip } from '@mui/material'
import { IssuePriorityMark } from '../issues/IssueBadges'
import { PRIORITY_META } from '../issues/types'
import { CampoIcon, type CampoIconName } from '../../ui/campo'

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

// ── Targa K-Number ───────────────────────────────────────────────────────────
/**
 * Replica della targhetta fisica Philips K-Number. Il blu è quello reale del
 * marchio, non un colore dell'app: eccezione intenzionale, fisso in tutti i temi.
 */
export function KNumberPlate({ knumber, digits = 9, maxWidth = 420 }: { knumber: string; digits?: number; maxWidth?: number }) {
  const padded = (knumber ?? '').replace(/\D/g, '').slice(-digits).padStart(digits, '0')
  const blue = '#1e56ff'
  const sw = 6, lp = 22, tp = 18, gap = 10, bw = 74, bh = 74
  const rowW = digits * bw + (digits - 1) * gap
  const fw = lp * 2 + rowW
  const area = tp + bh + 18
  const by = area + 34
  const fh = by + 28
  return (
    <Box component="svg" viewBox={`0 0 ${fw} ${fh}`} role="img" aria-label={`K-Number ${padded}`} sx={{ display: 'block', width: '100%', maxWidth, height: 'auto', flexShrink: 0 }}>
      <rect x={sw / 2} y={sw / 2} width={fw - sw} height={area - sw} rx="6" fill="white" stroke={blue} strokeWidth={sw} />
      {Array.from(padded).map((d, i) => {
        const x = lp + i * (bw + gap)
        return (
          <g key={i}>
            <rect x={x} y={tp} width={bw} height={bh} fill="white" stroke="black" strokeWidth="4" />
            <text x={x + bw / 2} y={tp + bh / 2 + 18} textAnchor="middle" fontSize="52" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fill="black">{d}</text>
          </g>
        )
      })}
      <text x={lp} y={by} fontSize="36" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fill={blue}>PHILIPS</text>
    </Box>
  )
}

// ── Categoria del sistema: icona e colore di riconoscimento ──────────────────
// Tinte calme (il rosso resta per guasti e criticità). Sono etichette, non stati.
type Category = { icon: CampoIconName; color: string }
const CAT = {
  pacs: { icon: 'server', color: '#3f7fbf' },
  host: { icon: 'server', color: '#2e8b8b' },
  storage: { icon: 'layers', color: '#6f8a3a' },
  mgmt: { icon: 'wrench', color: '#4a58a6' },
  net: { icon: 'cloud', color: '#2f8fa8' },
  ws: { icon: 'monitor', color: '#5b6f86' },
  robot: { icon: 'activity', color: '#b4673a' },
  app: { icon: 'file', color: '#7a5bb8' },
} satisfies Record<string, Category>

export function assetCategory(typeKey?: string | null): Category {
  const t = (typeKey || '').toLowerCase()
  if (t === 'wfm' || t.includes('pacs')) return CAT.pacs
  if (t.startsWith('management')) return CAT.mgmt
  if (t.startsWith('host')) return CAT.host
  if (t.startsWith('storage') || t.includes('vna')) return CAT.storage
  if (t.startsWith('load_balancer') || /(rout|switch|fire|vpn)/.test(t)) return CAT.net
  if (t.includes('robot')) return CAT.robot
  if (/(csap|orthoview|vue|speech|ris)/.test(t)) return CAT.app
  return CAT.ws
}

// Applicazioni (software): nessuna manutenzione hardware da mostrare di default.
const SOFTWARE_TYPES = new Set(['csap', 'wfm', 'orthoview', 'vue_motion', 'speech'])
export const isHardwareType = (typeKey?: string | null) => Boolean(typeKey) && !SOFTWARE_TYPES.has(typeKey!)

/** Icona a tratto del sistema nel suo colore di categoria (schiarito nel tema scuro). */
export function AssetTypeIcon({ typeKey, label, size = 17 }: { typeKey?: string | null; label?: string | null; size?: number }) {
  const c = assetCategory(typeKey)
  return (
    <Box component="span" title={label ?? undefined} sx={(t) => ({
      width: 20, height: 20, flex: 'none', display: 'grid', placeItems: 'center',
      color: t.palette.mode === 'dark' ? `color-mix(in oklab, ${c.color} 55%, white)` : c.color,
    })}>
      <CampoIcon name={c.icon} size={size} />
    </Box>
  )
}
