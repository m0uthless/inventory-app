/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { Box, ButtonBase, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { CampoIcon } from '../../ui/campo'
import { mono } from '../../ui/campo/ListRows'
import { IssuePriorityMark } from '../issues/IssueBadges'
import { PRIORITY_META } from '../issues/types'
import { AssetTypeIcon, InventoryStatusBadge } from '../inventory/inventoryUi'
import { SiteStatusBadge } from '../sites/siteUi'
import type { RepoAsset, RepoCustomer, RepoCustomerContent, RepoSite } from './types'

// ── Elementi comuni ──────────────────────────────────────────────────────────

export const focusInset = { '&.Mui-focusVisible': { boxShadow: (t: Theme) => `inset ${t.palette.archie.focusRing}` } }
export const numSx = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 } as const
export const countSx = { fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const

export function Chevron({ open, color }: { open: boolean; color?: string }) {
  return (
    <Box component="span" sx={{ width: 20, height: 20, flex: 'none', display: 'inline-grid', placeItems: 'center', color: color ?? (open ? 'text.secondary' : 'text.disabled'), transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none' }}>
      <CampoIcon name="chevR" size={14} />
    </Box>
  )
}

/** Due righe: nome (con eventuale segno) e dettaglio; si accorciano coi puntini. */
export function NameCell({ title, sub, titleSx }: { title: React.ReactNode; sub?: React.ReactNode; titleSx?: SxProps<Theme> }) {
  return (
    <Box sx={{ display: 'grid', minWidth: 0, textAlign: 'left' }}>
      <Box component="b" sx={[{ fontWeight: 550, fontSize: 13, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, ...(Array.isArray(titleSx) ? titleSx : [titleSx])]}>{title}</Box>
      {sub ? <Box component="small" sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</Box> : null}
    </Box>
  )
}

export function Highlight({ text, q }: { text?: string | null; q?: string }) {
  const t = text ?? ''
  if (!q) return <>{t}</>
  const i = t.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return <>{t}</>
  return <>{t.slice(0, i)}<Box component="mark" sx={(th) => ({ bgcolor: `color-mix(in oklab, ${th.palette.warning.main} 28%, transparent)`, color: 'inherit', borderRadius: '2px', px: '1px' })}>{t.slice(i, i + q.length)}</Box>{t.slice(i + q.length)}</>
}

export function PrioMark({ priority }: { priority?: string | null }) {
  const p = priority || 'medium'
  return (
    <Tooltip title={`Issue aperta · priorità ${PRIORITY_META[p]?.label?.toLowerCase() ?? p}`}>
      <Box component="span" sx={{ display: 'inline-flex', flex: 'none' }}><IssuePriorityMark priority={p} compact /></Box>
    </Tooltip>
  )
}

// ── Tabella degli asset ──────────────────────────────────────────────────────

const assetCols = {
  display: 'grid', alignItems: 'center', gap: 1.25,
  gridTemplateColumns: '20px minmax(0,1.3fr) minmax(0,1fr) 104px 104px 76px 132px',
  '@media (max-width: 1280px)': { gridTemplateColumns: '20px minmax(0,1.3fr) minmax(0,1fr) 104px 104px 132px', '& > :nth-of-type(6)': { display: 'none' } },
  '@media (max-width: 760px)': { gridTemplateColumns: '20px minmax(0,1fr) auto', '& > :nth-of-type(3), & > :nth-of-type(4), & > :nth-of-type(5), & > :nth-of-type(6)': { display: 'none' } },
} as const

export function AssetHead() {
  return (
    <Box aria-hidden sx={{ ...assetCols, height: 30, px: 1.5, fontSize: 11, fontWeight: 550, color: 'text.secondary', bgcolor: 'archie.surface2', borderBottom: '1px solid', borderColor: 'divider', '@media (max-width: 760px)': { display: 'none' } }}>
      <span /><span>Sistema</span><span>Hostname</span><span>IP</span><span>IP SRSA</span><span>K-Number</span><span>Stato</span>
    </Box>
  )
}

const monoCell = (v?: string | null, q?: string, missing?: React.ReactNode) => (
  <Box component="span" sx={{ ...mono, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {v ? <Highlight text={v} q={q} /> : missing ?? <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}
  </Box>
)

export function AssetRow({ a, selected, q, sub, onOpen, onContextMenu }: { a: RepoAsset; selected: boolean; q?: string; sub?: React.ReactNode; onOpen: (a: RepoAsset) => void; onContextMenu?: (a: RepoAsset, e: React.MouseEvent) => void }) {
  return (
    <ButtonBase onClick={() => onOpen(a)} onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(a, e) } : undefined} aria-current={selected || undefined}
      sx={[assetCols, {
        width: '100%', minHeight: 44, px: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', textAlign: 'left',
        '&:last-of-type': { borderBottom: 0 }, '&:hover': { bgcolor: 'archie.surface2' },
        ...(selected && { bgcolor: 'archie.field', '&:hover': { bgcolor: 'archie.field' }, boxShadow: (t: Theme) => `inset 1px 0 0 ${t.palette.archie.fieldLine}` }),
      }, focusInset]}>
      <AssetTypeIcon typeKey={a.type_key} label={a.type_label} />
      <NameCell title={<><Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}><Highlight text={a.name} q={q} /></Box>{a.has_active_issue ? <PrioMark priority={a.active_issue_priority} /> : null}</>}
        sub={sub ?? a.type_label ?? undefined} />
      {monoCell(a.hostname, q)}
      {monoCell(a.local_ip, q, <Box component="span" sx={{ fontFamily: (t) => t.typography.fontFamily, fontSize: 12, fontWeight: 550, color: 'warning.main' }}>Nessun IP</Box>)}
      {monoCell(a.srsa_ip, q)}
      {monoCell(a.knumber, q)}
      <Box component="span"><InventoryStatusBadge statusKey={a.status_key} label={a.status_label} /></Box>
    </ButtonBase>
  )
}

// ── Cliente e sito ───────────────────────────────────────────────────────────

const VpnMark = () => <Box component="span" sx={{ ...mono, fontSize: 10, fontWeight: 650, letterSpacing: '.04em', px: '5px', py: '1px', borderRadius: '4px', border: '1px solid', borderColor: 'archie.borderStrong', color: 'text.secondary' }}>VPN</Box>
const actBtn = { width: 30, height: 30, borderRadius: '6px', color: 'primary.main', border: '1px solid transparent', '&:hover': { bgcolor: 'archie.surface2', borderColor: 'divider' } } as const

export type CustomerActions = {
  onVpn: (c: RepoCustomer) => void
  onOpenCustomer: (c: RepoCustomer) => void
  onExport: (c: RepoCustomer) => void
}

export function CustomerBlock({ c, vendorColor, open, onToggle, content, openSites, onToggleSite, selectedId, onOpenAsset, actions, onCustomerMenu, onSiteMenu, onAssetMenu }: {
  c: RepoCustomer
  vendorColor: string
  open: boolean
  onToggle: () => void
  content: RepoCustomerContent | null | undefined
  openSites: Set<number>
  onToggleSite: (id: number) => void
  selectedId: number | null
  onOpenAsset: (a: RepoAsset) => void
  actions: CustomerActions
  onCustomerMenu: (c: RepoCustomer, e: React.MouseEvent) => void
  onSiteMenu: (s: RepoSite, e: React.MouseEvent) => void
  onAssetMenu: (a: RepoAsset, e: React.MouseEvent) => void
}) {
  const name = c.display_name || c.name
  return (
    <Box sx={{ border: '1px solid', borderColor: open ? 'archie.borderStrong' : 'divider', borderRadius: '8px', bgcolor: 'background.paper', overflow: 'hidden' }}>
      <Box onContextMenu={(e) => { e.preventDefault(); onCustomerMenu(c, e) }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 56, py: 0.75, pl: 1, pr: 1.5, ...(open && { bgcolor: 'archie.neutralBg', borderBottom: '1px solid', borderColor: 'divider' }), '@media (max-width: 760px)': { flexWrap: 'wrap' } }}>
        <ButtonBase onClick={onToggle} aria-expanded={open} sx={[{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.25, justifyContent: 'flex-start', borderRadius: '6px', py: 0.5 }, focusInset]}>
          <Chevron open={open} />
          <Box component="span" sx={{ width: 20, height: 20, flex: 'none', display: 'grid', placeItems: 'center', color: 'primary.main' }}><CampoIcon name="building" size={17} /></Box>
          <NameCell title={name} titleSx={open ? { fontWeight: 650, color: 'text.primary' } : undefined}
            sub={<>
              {c.status_label ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.625 }}><Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: vendorColor }} />{c.status_label}</Box> : null}
              {c.status_label ? ' · ' : ''}
              {c.primary_contact_name || <Box component="span" sx={{ color: 'warning.main', fontWeight: 550 }}>Nessun contatto</Box>}
            </>} />
        </ButtonBase>
        <Box component="span" sx={{ ...countSx, '@media (max-width: 760px)': { display: 'none' } }}>{c.sites_with_assets_count ?? 0} siti · {c.assets_count ?? 0} asset</Box>
        <Box sx={{ display: 'inline-flex', gap: '2px', flex: 'none' }}>
          {c.has_vpn ? <Tooltip title="Accesso VPN"><IconButton aria-label={`Accesso VPN di ${name}`} onClick={() => actions.onVpn(c)} sx={actBtn}><VpnMark /></IconButton></Tooltip> : null}
          {c.primary_contact_phone ? (
            <Tooltip title={`Chiama ${c.primary_contact_name || 'il contatto'} · ${c.primary_contact_phone}`}>
              <IconButton component="a" href={`tel:${c.primary_contact_phone.replace(/\s+/g, '')}`} aria-label={`Chiama ${c.primary_contact_name || 'il contatto principale'}`} sx={actBtn}><CampoIcon name="phone" size={15} bold /></IconButton>
            </Tooltip>
          ) : null}
          <Tooltip title="Scheda cliente"><IconButton aria-label={`Scheda di ${name}`} onClick={() => actions.onOpenCustomer(c)} sx={actBtn}><CampoIcon name="building" size={15} /></IconButton></Tooltip>
          <Tooltip title="Esporta Excel"><IconButton aria-label={`Esporta Excel di ${name}`} onClick={() => actions.onExport(c)} sx={actBtn}><CampoIcon name="download" size={15} /></IconButton></Tooltip>
        </Box>
      </Box>

      {open ? (
        content === undefined || content === null ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 2.5 }}><CircularProgress size={18} /></Box>
        ) : content.sites.length ? (
          content.sites.map((s) => (
            <SiteBlock key={s.id} s={s} open={openSites.has(s.id)} onToggle={() => onToggleSite(s.id)} selectedId={selectedId} onOpenAsset={onOpenAsset} onSiteMenu={onSiteMenu} onAssetMenu={onAssetMenu} />
          ))
        ) : <Typography sx={{ px: 2, py: 1.5, fontSize: 12, color: 'text.secondary' }}>Nessun asset registrato per questo cliente.</Typography>
      ) : null}
    </Box>
  )
}

function SiteBlock({ s, open, onToggle, selectedId, onOpenAsset, onSiteMenu, onAssetMenu }: {
  s: RepoSite & { assets: RepoAsset[] }
  open: boolean
  onToggle: () => void
  selectedId: number | null
  onOpenAsset: (a: RepoAsset) => void
  onSiteMenu: (s: RepoSite, e: React.MouseEvent) => void
  onAssetMenu: (a: RepoAsset, e: React.MouseEvent) => void
}) {
  const issues = s.assets.filter((a) => a.has_active_issue).length
  const noSite = s.id < 0
  const addr = [s.address_line1, s.city].filter(Boolean).join(', ')
  return (
    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <ButtonBase onClick={onToggle} aria-expanded={open} onContextMenu={noSite ? undefined : (e) => { e.preventDefault(); onSiteMenu(s, e) }}
        sx={[{
          width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48, py: 0.75, pl: 1, pr: 1.5, justifyContent: 'flex-start',
          '&:hover': { bgcolor: open ? 'info.light' : 'archie.surface2' },
          ...(open && { bgcolor: 'info.light', borderBottom: '1px solid', borderColor: 'divider' }),
        }, focusInset]}>
        <Chevron open={open} color={open ? 'info.main' : undefined} />
        <Box component="span" sx={{ width: 20, height: 20, flex: 'none', display: 'grid', placeItems: 'center', color: open ? 'info.main' : 'text.disabled' }}><CampoIcon name="pin" size={17} /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NameCell title={noSite ? <i>Senza sito</i> : (s.display_name || s.name)} titleSx={open ? { color: 'info.main' } : undefined}
            sub={noSite ? 'asset del cliente non collegati a un sito' : addr || 'Nessun indirizzo'} />
        </Box>
        {!noSite && s.status_key && s.status_key !== 'active' ? <SiteStatusBadge statusKey={s.status_key} label={s.status_label} /> : null}
        <Box component="span" sx={countSx}>{s.assets.length} asset{issues ? <> · <Box component="span" sx={{ color: 'info.main', fontWeight: 600 }}>{issues} issue</Box></> : null}</Box>
      </ButtonBase>
      {open ? (
        <Box>
          <AssetHead />
          {s.assets.map((a) => <AssetRow key={a.id} a={a} selected={a.id === selectedId} onOpen={onOpenAsset} onContextMenu={onAssetMenu} />)}
        </Box>
      ) : null}
    </Box>
  )
}
