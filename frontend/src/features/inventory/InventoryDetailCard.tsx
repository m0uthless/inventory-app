import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import AddIcon from '@mui/icons-material/Add'
import { buildQuery } from '@shared/utils/nav'
import { CampoIcon, DetailSection, FloatingDetail, LinkButton, Properties } from '../../ui/campo'
import { Empty, Group, Loading, mono, Row, Rows, Tile, useList } from '../../ui/campo/ListRows'
import { IssuePriorityMark, IssueStatusBadge } from '../issues/IssueBadges'
import { PRIORITY_META } from '../issues/types'
import { disabledFieldsFor, InventoryStatusBadge, invTypeIcon, type InventoryFieldName } from './inventoryUi'

export type InventoryCardDetail = {
  id: number
  customer: number
  customer_name?: string
  site?: number | null
  site_name?: string
  site_display_name?: string | null
  name: string
  knumber?: string | null
  serial_number?: string | null
  hostname?: string | null
  local_ip?: string | null
  srsa_ip?: string | null
  location?: string | null
  telefono?: string | null
  type?: number | null
  type_key?: string | null
  type_label?: string | null
  status: number
  status_key?: string | null
  status_label?: string | null
  os_user?: string | null
  os_pwd?: string | null
  app_usr?: string | null
  app_pwd?: string | null
  vnc_pwd?: string | null
  manufacturer?: string | null
  model?: string | null
  warranty_end_date?: string | null
  notes?: string | null
  tags?: string[] | null
  deleted_at?: string | null
  has_active_issue?: boolean
  active_issue_priority?: string | null
  monitors?: { id: number; produttore?: string | null; modello?: string | null; seriale?: string | null; tipo_label?: string | null; stato_label?: string | null }[]
}

export type InventoryPatch = Partial<Pick<InventoryCardDetail, 'status' | 'type' | 'site' | 'name' | 'knumber' | 'serial_number' | 'location' | 'telefono' | 'manufacturer' | 'model' | 'warranty_end_date'>>
export type InventoryTab = 'det' | 'iss' | 'att'

type Lookup = { id: number; label: string; key?: string }
type SiteOpt = { id: number; name: string; display_name?: string | null }

type Props = {
  detail: InventoryCardDetail | null
  loading: boolean
  statuses: Lookup[]
  types: Lookup[]
  canChange: boolean
  canDelete: boolean
  canViewSecrets: boolean
  tab: InventoryTab
  onTab: (t: InventoryTab) => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onPatch: (patch: InventoryPatch, label: string) => void
  onCopy: (v: string) => void
  onNewIssue: () => void
  onOpenCustomer: () => void
  onOpenSite: () => void
  activityTab: React.ReactNode
}

const none = (t = '—') => <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>{t}</Box>
const dIt = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '')

/** Riga del blocco Accesso: etichetta, valore in mono, azioni (mostra/copia). */
function AccessRow({ label, value, secret, onCopy, locked }: { label: string; value?: string | null; secret?: boolean; onCopy: (v: string) => void; locked?: boolean }) {
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => { if (!shown) return; const t = window.setTimeout(() => setShown(false), 30000); return () => window.clearTimeout(t) }, [shown])
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) auto', alignItems: 'center', gap: 1, minHeight: 38, pl: 1.5, pr: 0.5, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...mono }}>
        {locked ? <Box component="span" sx={{ fontFamily: 'inherit', color: 'text.secondary' }}>Serve il permesso Credenziali</Box>
          : !value ? none()
          : secret ? <Box component="span" sx={shown ? { bgcolor: 'warning.light', borderRadius: '4px', px: 0.5 } : { letterSpacing: '.08em', color: 'text.secondary' }}>{shown ? value : '••••••••'}</Box>
          : value}
      </Box>
      <Box sx={{ display: 'inline-flex' }}>
        {value && secret && !locked ? (
          <Tooltip title={shown ? 'Nascondi' : 'Mostra · si nasconde dopo 30 secondi'}>
            <IconButton size="small" aria-pressed={shown} aria-label={`${shown ? 'Nascondi' : 'Mostra'} ${label}`} onClick={() => setShown((v) => !v)} sx={{ width: 28, height: 28, color: shown ? 'warning.main' : undefined }}>
              <CampoIcon name={shown ? 'eyeOff' : 'eye'} size={14} />
            </IconButton>
          </Tooltip>
        ) : null}
        {value && !locked ? <Tooltip title="Copia"><IconButton size="small" aria-label={`Copia ${label}`} onClick={() => onCopy(value)} sx={{ width: 28, height: 28 }}><CampoIcon name="copy" size={14} /></IconButton></Tooltip> : null}
      </Box>
    </Box>
  )
}

function InventoryIssuesPanel({ inventoryId }: { inventoryId: number }) {
  const navigate = useNavigate()
  type I = { id: number; title: string; status: string; status_label?: string; assigned_to_full_name?: string | null; opened_at?: string | null }
  const open = useList<I>('/issues/', { inventory: inventoryId, status: ['open', 'in_progress', 'waiting'], page_size: 100, ordering: '-opened_at' })
  const closed = useList<I>('/issues/', { inventory: inventoryId, status: ['resolved', 'closed'], page_size: 5, ordering: '-opened_at' })
  if (!open) return <Loading />
  const row = (i: I) => (
    <Row key={i.id} tile={<Tile text={`#${i.id}`} />} chevron title={i.title}
      sub={[i.assigned_to_full_name, i.opened_at ? `aperta il ${new Date(i.opened_at).toLocaleDateString('it-IT')}` : null].filter(Boolean).join(' · ') || undefined}
      end={<IssueStatusBadge status={i.status} label={i.status_label} />}
      onClick={() => navigate(`/issues${buildQuery({ open: i.id })}`)} />
  )
  return (
    <>
      <Group first title="Issue aperte" count={open.length}>
        {open.length ? <Rows>{open.map(row)}</Rows> : <Empty text="Nessuna issue aperta su questo sistema." />}
      </Group>
      {closed && closed.length ? <Group title="Risolte di recente" count={closed.length}><Rows>{closed.map(row)}</Rows></Group> : null}
    </>
  )
}

/** Scheda flottante dell'inventario: identità, accesso (rete e credenziali), monitor. */
export default function InventoryDetailCard(p: Props) {
  const d = p.detail
  const sites = useList<SiteOpt>('/sites/', d?.customer ? { customer: d.customer, page_size: 200, ordering: 'name' } : null)

  if (!d) {
    return (
      <FloatingDetail open onClose={p.onClose} title="Caricamento…" ariaLabel="Dettaglio inventario">
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>{p.loading ? <CircularProgress size={22} /> : <Typography sx={{ color: 'text.secondary' }}>Inventario non trovato.</Typography>}</Box>
      </FloatingDetail>
    )
  }

  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted
  const off = disabledFieldsFor(d.type_key)
  const has = (f: InventoryFieldName) => !off.has(f)
  const siteName = d.site_display_name || d.site_name || ''
  const prio = d.active_issue_priority || 'medium'

  const props = [
    {
      key: 'st', label: 'Stato', disabled: !editable, current: String(d.status),
      options: p.statuses.map((s) => ({ value: String(s.id), label: <InventoryStatusBadge statusKey={s.key} label={s.label} /> })),
      display: <InventoryStatusBadge statusKey={d.status_key} label={d.status_label} />,
      onChange: (v: string) => p.onPatch({ status: Number(v) }, 'Stato aggiornato'),
    },
    {
      key: 'ty', label: 'Tipo', disabled: !editable, current: d.type ? String(d.type) : '',
      options: p.types.map((t) => ({ value: String(t.id), label: t.label })),
      display: d.type_label || none(),
      onChange: (v: string) => p.onPatch({ type: Number(v) }, 'Tipo aggiornato'),
    },
    {
      key: 'name', label: 'Nome', full: true, disabled: !editable,
      text: { value: d.name, placeholder: 'Nome del sistema' }, display: d.name,
      onChange: (v: string) => { if (v.trim()) p.onPatch({ name: v.trim() }, 'Nome aggiornato') },
    },
    {
      key: 'site', label: 'Sito', full: true, disabled: !editable || !sites, current: d.site ? String(d.site) : '',
      options: [{ value: '', label: 'Nessun sito' }, ...(sites ?? []).map((s) => ({ value: String(s.id), label: s.display_name || s.name }))],
      display: siteName || <Box component="span" sx={{ color: 'warning.main', fontWeight: 550, fontSize: 12 }}>Manca</Box>,
      onChange: (v: string) => p.onPatch({ site: v ? Number(v) : null }, 'Sito aggiornato'),
    },
    {
      key: 'kn', label: 'K-Number', disabled: !editable,
      text: { value: d.knumber ?? '', mono: true }, display: d.knumber ? <Box component="span" sx={mono}>{d.knumber}</Box> : none(),
      onChange: (v: string) => p.onPatch({ knumber: v.trim() || null }, 'K-Number aggiornato'),
    },
    {
      key: 'sn', label: 'Seriale', disabled: !editable,
      text: { value: d.serial_number ?? '', mono: true }, display: d.serial_number ? <Box component="span" sx={mono}>{d.serial_number}</Box> : none(),
      onChange: (v: string) => p.onPatch({ serial_number: v.trim() || null }, 'Seriale aggiornato'),
    },
    ...(has('manufacturer') ? [{
      key: 'mf', label: 'Produttore', disabled: !editable, text: { value: d.manufacturer ?? '' }, display: d.manufacturer || none(),
      onChange: (v: string) => p.onPatch({ manufacturer: v.trim() || null }, 'Produttore aggiornato'),
    }] : []),
    ...(has('model') ? [{
      key: 'md', label: 'Modello', disabled: !editable, text: { value: d.model ?? '' }, display: d.model || none(),
      onChange: (v: string) => p.onPatch({ model: v.trim() || null }, 'Modello aggiornato'),
    }] : []),
    ...(has('location') ? [{
      key: 'loc', label: 'Posizione', disabled: !editable, text: { value: d.location ?? '', placeholder: 'es. Sala server, piano 2' }, display: d.location || none(),
      onChange: (v: string) => p.onPatch({ location: v.trim() || null }, 'Posizione aggiornata'),
    }] : []),
    ...(has('telefono') ? [{
      key: 'tel', label: 'Telefono', disabled: !editable, text: { value: d.telefono ?? '', placeholder: 'Interno o diretto' }, display: d.telefono || none(),
      onChange: (v: string) => p.onPatch({ telefono: v.trim() || null }, 'Telefono aggiornato'),
    }] : []),
    ...(has('warranty_end_date') ? [{
      key: 'war', label: 'Fine garanzia', disabled: !editable, text: { value: d.warranty_end_date ?? '', type: 'date' as const }, display: d.warranty_end_date ? dIt(d.warranty_end_date) : none(),
      onChange: (v: string) => p.onPatch({ warranty_end_date: v || null }, 'Fine garanzia aggiornata'),
    }] : []),
  ]

  const net = ([['hostname', 'Hostname', d.hostname], ['local_ip', 'IP locale', d.local_ip], ['srsa_ip', 'IP SRSA', d.srsa_ip]] as const).filter(([f]) => has(f))
  const creds = ([
    ['os_user', 'Utente OS', d.os_user, false], ['os_pwd', 'Password OS', d.os_pwd, true],
    ['app_usr', 'Utente app', d.app_usr, false], ['app_pwd', 'Password app', d.app_pwd, true],
    ['vnc_pwd', 'Password VNC', d.vnc_pwd, true],
  ] as const).filter(([f]) => has(f))

  const details = (
    <>
      {d.has_active_issue ? (
        <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '9px 12px', borderRadius: '8px', border: '1px solid', borderColor: prio === 'critical' ? 'error.main' : 'archie.borderStrong', bgcolor: prio === 'critical' ? 'error.light' : 'archie.surface2' }}>
          <IssuePriorityMark priority={prio} compact />
          <Typography sx={{ fontSize: 13, fontWeight: 550, flex: 1 }}>Issue aperta su questo sistema · priorità {PRIORITY_META[prio]?.label?.toLowerCase() ?? prio}</Typography>
          <LinkButton onClick={() => p.onTab('iss')}>Vedi</LinkButton>
        </Box>
      ) : null}

      <Properties
        storageKey="inventory-props-open"
        props={props}
        summary={<><InventoryStatusBadge statusKey={d.status_key} label={d.status_label} />{d.knumber ? <Box component="span" sx={{ ...mono, color: 'text.secondary' }}>{d.knumber}</Box> : null}</>}
      />

      <DetailSection title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><CampoIcon name="lock" size={13} />Accesso</Box>}
        end={!p.canViewSecrets && creds.some(([, , , s]) => s) ? <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>password solo con il permesso Credenziali</Typography> : undefined}>
        {net.length || creds.length ? (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper' }}>
            {net.map(([f, l, v]) => <AccessRow key={f} label={l} value={v} onCopy={p.onCopy} />)}
            {creds.map(([f, l, v, secret]) => <AccessRow key={f} label={l} value={v} secret={secret} locked={secret && !p.canViewSecrets} onCopy={p.onCopy} />)}
          </Box>
        ) : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessun dato di accesso per questo tipo.</Typography>}
      </DetailSection>

      <Group title="Dove si trova">
        <Rows>
          <Row tile={<Tile icon="building" tone="brand" />} title={d.customer_name || '—'} sub="Cliente" chevron onClick={p.onOpenCustomer} />
          {d.site ? <Row tile={<Tile icon="pin" tone="brand" />} title={siteName} sub={[d.location, d.telefono ? `tel. ${d.telefono}` : null].filter(Boolean).join(' · ') || 'Sito'} chevron onClick={p.onOpenSite} />
            : <Row tile={<Tile icon="pin" />} title={<Box component="span" sx={{ color: 'warning.main', fontWeight: 550 }}>Nessun sito</Box>} sub="Collegalo a un sito dalle Proprietà" />}
        </Rows>
      </Group>

      {d.monitors && d.monitors.length ? (
        <Group title="Monitor" count={d.monitors.length}>
          <Rows>
            {d.monitors.map((m) => (
              <Row key={m.id} tile={<Tile icon="monitor" />} title={[m.produttore, m.modello].filter(Boolean).join(' ') || `Monitor #${m.id}`}
                sub={<>{m.seriale ? <Box component="span" sx={mono}>{m.seriale}</Box> : null}{m.seriale && m.tipo_label ? ' · ' : ''}{m.tipo_label}</>}
                end={m.stato_label ? <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{m.stato_label}</Typography> : null} />
            ))}
          </Rows>
        </Group>
      ) : null}

      <DetailSection title="Note">
        {d.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.notes}</Typography> : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessuna nota.</Typography>}
        {d.tags && d.tags.length ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {d.tags.map((t) => <Box key={t} component="span" sx={{ fontSize: 11, fontWeight: 600, px: 0.75, borderRadius: '4px', bgcolor: 'archie.neutralBg', color: 'text.secondary' }}>{t}</Box>)}
          </Box>
        ) : null}
      </DetailSection>
    </>
  )

  const footer = p.tab === 'det' ? (
    deleted ? (
      <>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nel cestino</Typography>
        <Box sx={{ flex: 1 }} />
        {p.canChange ? <Button variant="contained" startIcon={<RestoreFromTrashIcon />} onClick={p.onRestore}>Ripristina</Button> : null}
      </>
    ) : (
      <>
        {p.canChange ? <Button variant="outlined" startIcon={<EditIcon />} onClick={p.onEdit}>Modifica</Button> : null}
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={p.onNewIssue}>Nuova issue</Button>
      </>
    )
  ) : undefined

  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio inventario"
      idLabel={d.knumber ? <Box component="span" sx={mono}>{d.knumber}</Box> : undefined}
      status={<InventoryStatusBadge statusKey={d.status_key} label={d.status_label} onDark />}
      title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}><CampoIcon name={invTypeIcon(d.type_key)} size={18} />{d.name}</Box>}
      subtitle={[d.type_label, d.hostname, d.customer_name, siteName].filter(Boolean).join(' · ') || undefined}
      tabs={[{ key: 'det', label: 'Dettagli' }, { key: 'iss', label: 'Issue' }, { key: 'att', label: 'Attività' }]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as InventoryTab)}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={deleted ? undefined : [
        { label: 'Modifica tutti i campi', icon: <EditIcon />, onClick: p.onEdit, disabled: !p.canChange },
        ...(d.hostname ? [{ label: "Copia l'hostname", icon: <CampoIcon name="copy" />, onClick: () => p.onCopy(d.hostname!) }] : []),
        ...(d.local_ip ? [{ label: "Copia l'IP locale", icon: <CampoIcon name="copy" />, onClick: () => p.onCopy(d.local_ip!) }] : []),
        { label: 'Apri il cliente', icon: <CampoIcon name="building" />, onClick: p.onOpenCustomer },
        { label: 'Elimina', icon: <DeleteOutlineIcon />, onClick: p.onDelete, danger: true, disabled: !p.canDelete },
      ]}
      footer={footer}
    >
      {p.tab === 'det' ? details : p.tab === 'iss' ? <InventoryIssuesPanel inventoryId={d.id} /> : p.activityTab}
    </FloatingDetail>
  )
}

