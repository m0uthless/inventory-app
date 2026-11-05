import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, ButtonBase, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { buildQuery } from '@shared/utils/nav'
import { CampoIcon, type CampoIconName } from '../../ui/campo'
import DeviceDialog from '../devices/DeviceDialog'
import { deviceLabel, type DeviceListItem } from '../devices/types'
import type { ContractListItem } from '../contracts/types'
import { daysTo, dIt } from './customerUi'

/*
 * Schede del pannello cliente (Siti, Inventari, Documenti, Attività) nello stile
 * "Campo sterile" (design-previews/c-base.html, variante A): righe a filo con
 * riquadro icona, titolo, dettaglio e coda a destra; gruppi con titolo e conteggio.
 */

type Page<T> = { results?: T[] } | T[]
const list = <T,>(d: Page<T>): T[] => (Array.isArray(d) ? d : d.results ?? [])
const mono = { fontFamily: '"Geist Mono", monospace' }

function useList<T>(url: string, params: Record<string, unknown> | null, reloadKey?: unknown) {
  const [rows, setRows] = React.useState<T[] | null>(null)
  const key = JSON.stringify(params)
  React.useEffect(() => {
    if (!params) { setRows([]); return }
    let alive = true
    setRows(null)
    api.get(url, { params }).then((r) => { if (alive) setRows(list(r.data as Page<T>)) }).catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, reloadKey])
  return rows
}

// ─── Elementi comuni ─────────────────────────────────────────────────────────

function Group({ title, count, action, children, first }: { title: React.ReactNode; count?: number | null; action?: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  return (
    <Box component="section" sx={{ mt: first ? 0 : 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, minHeight: 22 }}>
        <Typography component="h3" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Typography>
        {count != null ? <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.75, lineHeight: '18px', fontVariantNumeric: 'tabular-nums' }}>{count}</Box> : null}
        {action ? <Box sx={{ ml: 'auto', flex: 'none' }}>{action}</Box> : null}
      </Box>
      {children}
    </Box>
  )
}

const linkSx = { minWidth: 0, p: 0, height: 'auto', fontSize: 12, fontWeight: 550, color: 'primary.main', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline', textUnderlineOffset: '3px' } }
function GroupLink({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button size="small" onClick={onClick} sx={linkSx}>{label}</Button>
}

type Tone = 'brand' | 'neutral' | 'pdf'
function Tile({ icon, text, tone = 'neutral' }: { icon?: CampoIconName; text?: string; tone?: Tone }) {
  return (
    <Box sx={{
      width: 28, height: 28, flex: 'none', borderRadius: '7px', display: 'grid', placeItems: 'center',
      ...(tone === 'brand' ? { bgcolor: 'archie.field', color: 'primary.main' } : tone === 'pdf' ? { bgcolor: 'error.light', color: 'error.main' } : { bgcolor: 'archie.neutralBg', color: 'text.secondary' }),
      ...(text ? { ...mono, fontSize: 8.5, fontWeight: 650, letterSpacing: '.03em' } : {}),
    }}>
      {icon ? <CampoIcon name={icon} size={15} /> : text}
    </Box>
  )
}

/** Riga a filo: icona, titolo + dettaglio, coda; cliccabile se `onClick`. */
function Row({ tile, title, sub, end, onClick, chevron }: { tile: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; end?: React.ReactNode; onClick?: () => void; chevron?: boolean }) {
  const body = (
    <>
      {tile}
      <Box sx={{ minWidth: 0, display: 'grid', gap: '1px', textAlign: 'left' }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{title}</Typography>
        {sub ? <Typography noWrap component="div" sx={{ fontSize: 12, color: 'text.secondary' }}>{sub}</Typography> : null}
      </Box>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flex: 'none' }}>
        {end}
        {chevron ? <Box sx={{ color: 'text.disabled', display: 'inline-flex' }}><CampoIcon name="chevR" size={14} /></Box> : null}
      </Box>
    </>
  )
  const sx = {
    display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', alignItems: 'center', gap: 1.25, width: '100%',
    minHeight: 50, py: 0.75, px: 0.75, borderBottom: '1px solid', borderColor: 'divider',
  }
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      {onClick ? (
        <ButtonBase onClick={onClick} sx={{ ...sx, borderRadius: 0, '&:hover': { bgcolor: 'archie.surface2' }, '&.Mui-focusVisible': { boxShadow: (t) => `inset ${t.palette.archie.focusRing}` } }}>{body}</ButtonBase>
      ) : <Box sx={sx}>{body}</Box>}
    </Box>
  )
}

function Rows({ children }: { children: React.ReactNode }) {
  return <Box component="ul" sx={{ m: 0, p: 0, borderTop: '1px solid', borderColor: 'divider' }}>{children}</Box>
}

function Empty({ text }: { text: string }) {
  return <Typography sx={{ fontSize: 12, color: 'text.secondary', py: 1.25 }}>{text}</Typography>
}
function Loading() {
  return <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress size={20} /></Box>
}

// ─── Siti ────────────────────────────────────────────────────────────────────

type SiteRow = { id: number; name?: string | null; display_name?: string | null; city?: string | null; address_line1?: string | null; province?: string | null; status_label?: string | null }
type InvRow = { id: number; site?: number | null; site_name?: string | null; site_display_name?: string | null; name?: string | null; hostname?: string | null; knumber?: string | null; type_key?: string | null; type_label?: string | null; status_label?: string | null; local_ip?: string | null; has_active_issue?: boolean }
type IssueRow = { id: number; site?: number | null }

const ACTIVE_ISSUES = ['open', 'in_progress', 'waiting']

export function CustomerSitesPanel({ customerId }: { customerId: number }) {
  const navigate = useNavigate()
  const sites = useList<SiteRow>('/sites/', { customer: customerId, page_size: 200, ordering: 'name' })
  const invs = useList<InvRow>('/inventories/', { customer: customerId, page_size: 500 })
  const iss = useList<IssueRow>('/issues/', { customer: customerId, status: ACTIVE_ISSUES, page_size: 200 })
  if (!sites) return <Loading />
  const invBy = new Map<number, number>(); (invs ?? []).forEach((i) => { if (i.site) invBy.set(i.site, (invBy.get(i.site) ?? 0) + 1) })
  const issBy = new Map<number, number>(); (iss ?? []).forEach((i) => { if (i.site) issBy.set(i.site, (issBy.get(i.site) ?? 0) + 1) })
  return (
    <Group first title="Siti" count={sites.length} action={<GroupLink label="Apri elenco" onClick={() => navigate(`/sites${buildQuery({ customer: customerId })}`)} />}>
      {sites.length ? (
        <Rows>
          {sites.map((s) => {
            const ni = invBy.get(s.id) ?? 0; const nx = issBy.get(s.id) ?? 0
            const addr = [s.address_line1, s.city].filter(Boolean).join(', ')
            return (
              <Row key={s.id} tile={<Tile icon="pin" tone="brand" />} title={s.display_name || s.name} sub={addr || s.province || '—'} chevron
                end={<Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {ni} inv.{nx ? <> · <Box component="b" sx={{ color: 'info.main', fontWeight: 600 }}>{nx} issue</Box></> : null}
                </Typography>}
                onClick={() => navigate(`/sites${buildQuery({ open: s.id })}`)} />
            )
          })}
        </Rows>
      ) : <Empty text="Nessun sito per questo cliente." />}
    </Group>
  )
}

// ─── Inventari (+ device) ────────────────────────────────────────────────────

const invIcon = (k?: string | null): CampoIconName => {
  const t = (k || '').toLowerCase()
  if (/(work|ws|pc|client|monitor|modal)/.test(t)) return 'monitor'
  if (/(rout|switch|fire|vpn|net|rete)/.test(t)) return 'cloud'
  return 'server'
}

export function CustomerInventoriesPanel({ customerId, showDevices, canEditDevices }: { customerId: number; showDevices: boolean; canEditDevices: boolean }) {
  const navigate = useNavigate()
  const [devReload, setDevReload] = React.useState(0)
  const invs = useList<InvRow>('/inventories/', { customer: customerId, page_size: 500, ordering: 'site__name' })
  const devs = useList<DeviceListItem>('/devices/', showDevices ? { customer: customerId, page_size: 200 } : null, devReload)
  const [editing, setEditing] = React.useState<DeviceListItem | null>(null)
  if (!invs) return <Loading />
  const groups = new Map<string, InvRow[]>()
  invs.forEach((i) => { const k = i.site_display_name || i.site_name || 'Senza sito'; groups.set(k, [...(groups.get(k) ?? []), i]) })
  return (
    <>
      {invs.length ? [...groups.entries()].map(([site, rows], gi) => (
        <Group key={site} first={gi === 0} title={site} count={rows.length}
          action={gi === 0 ? <GroupLink label="Apri elenco" onClick={() => navigate(`/inventory${buildQuery({ customer: customerId })}`)} /> : undefined}>
          <Rows>
            {rows.map((i) => (
              <Row key={i.id} tile={<Tile icon={invIcon(i.type_key || i.type_label)} />} chevron
                title={i.name || i.hostname || i.knumber || `Inventario #${i.id}`}
                sub={<>{i.type_label || 'Inventario'}{i.hostname && i.hostname !== i.name ? <> · <Box component="span" sx={mono}>{i.hostname}</Box></> : null}{i.local_ip ? <> · <Box component="span" sx={mono}>{i.local_ip}</Box></> : null}</>}
                end={<>
                  {i.has_active_issue ? <Tooltip title="Ha issue aperte"><Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'info.main', mr: 0.5 }} /></Tooltip> : null}
                  {i.status_label ? <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{i.status_label}</Typography> : null}
                </>}
                onClick={() => navigate(`/inventory${buildQuery({ open: i.id })}`)} />
            ))}
          </Rows>
        </Group>
      )) : <Group first title="Inventari" count={0}><Empty text="Nessun inventario per questo cliente." /></Group>}

      {showDevices ? (
        <Group title="Device" count={devs?.length ?? null}>
          {!devs ? <Loading /> : devs.length ? (
            <Rows>
              {devs.map((d) => (
                <Row key={d.id} tile={<Tile icon="monitor" />} title={deviceLabel(d)}
                  sub={[d.site_display_name || d.site_name, d.inventario ? `Inv. ${d.inventario}` : null].filter(Boolean).join(' · ') || '—'}
                  end={d.status_name ? <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{d.status_name}</Typography> : null}
                  chevron={canEditDevices} onClick={canEditDevices ? () => setEditing(d) : undefined} />
              ))}
            </Rows>
          ) : <Empty text="Nessun device per questo cliente." />}
        </Group>
      ) : null}
      {editing ? (
        <DeviceDialog open customerId={customerId} device={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setDevReload((n) => n + 1) }} />
      ) : null}
    </>
  )
}

// ─── Documenti: contratti + Drive ────────────────────────────────────────────

type DriveRow = { id: number; name: string; mime_type?: string; size_human?: string; updated_at: string; kind: 'file' | 'folder' }

function ContractEnd({ c }: { c: ContractListItem }) {
  const n = daysTo(c.end_date)
  if (c.expiry_state === 'expired' || n < 0) return <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: 'error.main' }}>scaduto</Typography>
  if (c.expiry_state === 'notice' || c.expiry_state === 'expiring') {
    return (
      <Box component="span" title={`Scade il ${dIt(c.end_date)}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, fontWeight: 600, color: 'warning.main', whiteSpace: 'nowrap' }}>
        <CampoIcon name="clock" size={14} bold />tra {n} {n === 1 ? 'giorno' : 'giorni'}
      </Box>
    )
  }
  return <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>in corso</Typography>
}

const extOf = (n: string) => (n.includes('.') ? n.split('.').pop()!.slice(0, 4).toUpperCase() : 'FILE')

export function CustomerDocumentsPanel({ customerId, showContracts }: { customerId: number; showContracts: boolean }) {
  const navigate = useNavigate()
  const contracts = useList<ContractListItem>('/contracts/', showContracts ? { customer: customerId, page_size: 50, ordering: 'end_date' } : null)
  const folders = useList<DriveRow>('/drive-folders/', { customer: customerId, page_size: 50, ordering: 'name' })
  const files = useList<DriveRow>('/drive-files/', { customer: customerId, page_size: 50, ordering: '-updated_at' })
  const drive = folders && files ? [...folders.map((f) => ({ ...f, kind: 'folder' as const })), ...files.map((f) => ({ ...f, kind: 'file' as const }))] : null
  return (
    <>
      {showContracts ? (
        <Group first title="Contratti" count={contracts?.length ?? null} action={<GroupLink label="Apri elenco" onClick={() => navigate(`/contracts${buildQuery({ customer: customerId })}`)} />}>
          {!contracts ? <Loading /> : contracts.length ? (
            <Rows>
              {contracts.map((c) => (
                <Row key={c.id} tile={<Tile icon="file" tone="brand" />} chevron title={c.title}
                  sub={<><Box component="span" sx={mono}>{c.code}</Box> · scadenza {dIt(c.end_date)}{c.status_label ? ` · ${c.status_label}` : ''}</>}
                  end={<ContractEnd c={c} />}
                  onClick={() => navigate(`/contracts${buildQuery({ customer: customerId, open: c.id })}`)} />
              ))}
            </Rows>
          ) : <Empty text="Nessun contratto collegato." />}
        </Group>
      ) : null}

      <Group first={!showContracts} title="Drive" count={drive?.length ?? null} action={<GroupLink label="Apri nel Drive" onClick={() => navigate('/drive')} />}>
        {!drive ? <Loading /> : drive.length ? (
          <Rows>
            {drive.map((f) => f.kind === 'folder' ? (
              <Row key={`d${f.id}`} tile={<Tile icon="folder" tone="brand" />} title={f.name} sub="Cartella" chevron onClick={() => navigate('/drive')} />
            ) : (
              <Row key={`f${f.id}`} tile={<Tile text={extOf(f.name)} tone={/pdf/i.test(f.mime_type || f.name) ? 'pdf' : 'neutral'} />} title={f.name}
                sub={[dIt(f.updated_at), f.size_human].filter(Boolean).join(' · ')}
                end={<Tooltip title="Scarica"><IconButton size="small" aria-label={`Scarica ${f.name}`} onClick={() => window.open(`/api/drive-files/${f.id}/download/`, '_blank')} sx={{ width: 28, height: 28 }}><CampoIcon name="download" size={14} /></IconButton></Tooltip>} />
            ))}
          </Rows>
        ) : <Empty text="Nessun file nel Drive del cliente." />}
      </Group>
    </>
  )
}

// ─── Attività ────────────────────────────────────────────────────────────────

type AuditEvent = { id: number; created_at: string; action: string; actor_username?: string | null; changes?: Record<string, { from?: unknown; to?: unknown } | [unknown, unknown]> | null }

const FIELD: Record<string, string> = {
  name: 'la ragione sociale', display_name: 'il nome breve', status: 'il vendor', vat_number: 'la P.IVA', tax_code: 'il codice fiscale',
  province: 'la provincia', notes: 'le note', tags: 'i tag', custom_fields: 'i campi personalizzati', code: 'il codice',
}
const val = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))
function describe(e: AuditEvent): React.ReactNode {
  if (e.action === 'create') return 'ha creato il cliente'
  if (e.action === 'delete') return 'lo ha spostato nel cestino'
  if (e.action === 'restore') return 'lo ha ripristinato'
  const ch = Object.entries(e.changes ?? {}).filter(([k]) => k !== 'updated_at' && k !== 'updated_by')
  if (!ch.length) return 'ha modificato il cliente'
  return ch.map(([k, v], i) => {
    const [from, to] = Array.isArray(v) ? v : [v?.from, v?.to]
    const txt = k === 'notes' || k === 'custom_fields' ? <>ha modificato {FIELD[k]}</> : <>ha cambiato {FIELD[k] ?? k} da <b>{val(from)}</b> a <b>{val(to)}</b></>
    return <React.Fragment key={k}>{i ? '; ' : ''}{txt}</React.Fragment>
  })
}
const evIcon = (a: string): CampoIconName => (a === 'create' ? 'plus' : a === 'delete' ? 'trash' : a === 'restore' ? 'restore' : 'wrench')

export function CustomerActivityPanel({ customerId }: { customerId: number }) {
  const events = useList<AuditEvent>('/audit-events/', { app_label: 'crm', model: 'customer', object_id: String(customerId), ordering: '-created_at', page_size: 100 })
  if (!events) return <Loading />
  if (!events.length) return <Empty text="Nessuna attività registrata." />
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {events.map((e) => (
        <Box key={e.id} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 1, alignItems: 'center', fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
          <Box sx={{ width: 22, height: 22, ml: '1px', borderRadius: '50%', bgcolor: 'archie.neutralBg', display: 'grid', placeItems: 'center' }}><CampoIcon name={evIcon(e.action)} size={12} /></Box>
          <span><b>{e.actor_username || 'Sistema'}</b> {describe(e)}</span>
          <Box component="time" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Box>
        </Box>
      ))}
    </Box>
  )
}
