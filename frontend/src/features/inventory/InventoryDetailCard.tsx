import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { keyframes } from '@mui/material/styles'
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
import { disabledFieldsFor, InventoryStatusBadge, invTypeIcon, isHardwareType, KNumberPlate, type InventoryFieldName } from './inventoryUi'
import { InventoryMaintenancePanel, maintenanceDue, useInventoryMaintenance } from './InventoryMaintenancePanel'
import type { CampoIconName } from '../../ui/campo'

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
export type InventoryTab = 'det' | 'iss' | 'man' | 'att'

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
  /** Scheda Manutenzioni (piani e rapportini): serve il permesso sugli interventi. */
  canViewMaintenance?: boolean
  canUploadReports?: boolean
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

const countdown = keyframes({ from: { width: '100%' }, to: { width: '0%' } })
const copyBtnSx = { width: 28, height: 28 }

/** Casella di rete (hostname, IP): valore in mono, copia al passaggio. */
function NetTile({ label, value, onCopy }: { label: string; value?: string | null; onCopy: (v: string) => void }) {
  return (
    <Box sx={{
      position: 'relative', display: 'grid', gap: '3px', minWidth: 0, p: '9px 10px 10px', borderRadius: '8px',
      border: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2',
      '& .net-copy': { opacity: 0, transition: 'opacity .12s' }, '&:hover .net-copy, & .net-copy.Mui-focusVisible': { opacity: 1 },
    }}>
      <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
      <Box component="span" sx={{ ...mono, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || none()}</Box>
      {value ? (
        <Tooltip title="Copia"><IconButton className="net-copy" size="small" aria-label={`Copia ${label}`} onClick={() => onCopy(value)} sx={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24 }}><CampoIcon name="copy" size={13} /></IconButton></Tooltip>
      ) : null}
    </Box>
  )
}

/** Riga di una credenziale: utente in chiaro, password mascherata che si nasconde da sola dopo 30 secondi. */
function CredRow({ icon, label, value, secret, locked, onCopy }: { icon: CampoIconName; label: string; value?: string | null; secret?: boolean; locked?: boolean; onCopy: (v: string) => void }) {
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => { if (!shown) return; const t = window.setTimeout(() => setShown(false), 30000); return () => window.clearTimeout(t) }, [shown])
  return (
    <Box sx={{
      position: 'relative', display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) auto', alignItems: 'center', gap: 0.5, minHeight: 42, pl: 1.5, pr: 0.75,
      '& + &': { borderTop: '1px dashed', borderColor: 'divider' }, ...(shown && { bgcolor: 'warning.light' }),
    }}>
      <Typography component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875, fontSize: 12, color: 'text.secondary', '& svg': { color: shown ? 'warning.main' : 'text.disabled' } }}>
        <CampoIcon name={icon} size={14} />{label}
      </Typography>
      <Box sx={{ ...mono, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {locked ? <Box component="span" sx={{ fontFamily: (t) => t.typography.fontFamily, fontSize: 12, color: 'text.secondary' }}>Serve il permesso Credenziali</Box>
          : !value ? none()
          : secret && !shown ? <Box component="span" sx={{ letterSpacing: '.12em', color: 'text.disabled' }}>••••••••</Box>
          : <Box component="span" sx={{ letterSpacing: '.02em', fontWeight: secret ? 550 : 400 }}>{value}</Box>}
      </Box>
      <Box sx={{ display: 'inline-flex' }}>
        {value && secret && !locked ? (
          <Tooltip title={shown ? 'Nascondi' : 'Mostra · si nasconde dopo 30 secondi'}>
            <IconButton size="small" aria-pressed={shown} aria-label={`${shown ? 'Nascondi' : 'Mostra'} ${label.toLowerCase()}`} onClick={() => setShown((v) => !v)} sx={{ ...copyBtnSx, color: shown ? 'warning.main' : undefined }}>
              <CampoIcon name={shown ? 'eyeOff' : 'eye'} size={15} />
            </IconButton>
          </Tooltip>
        ) : null}
        {value && !locked ? <Tooltip title="Copia"><IconButton size="small" aria-label={`Copia ${label.toLowerCase()}`} onClick={() => onCopy(value)} sx={copyBtnSx}><CampoIcon name="copy" size={15} /></IconButton></Tooltip> : null}
      </Box>
      {shown ? <Box aria-hidden sx={{ position: 'absolute', left: 0, bottom: 0, height: 2, bgcolor: 'warning.main', animation: `${countdown} 30s linear forwards`, '@media (prefers-reduced-motion: reduce)': { animation: 'none', width: '100%' } }} /> : null}
    </Box>
  )
}

/** Scheda di una coppia di credenziali (sistema operativo, applicazione, VNC). */
function CredGroup({ icon, title, children }: { icon: CampoIconName; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ width: 28, height: 28, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: '8px', bgcolor: 'archie.neutralBg', color: 'text.secondary' }}><CampoIcon name={icon} size={15} /></Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{title}</Typography>
      </Box>
      {children}
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
  const navigate = useNavigate()
  const [maintKey, setMaintKey] = React.useState(0)
  const maint = useInventoryMaintenance(d?.id ?? null, Boolean(p.canViewMaintenance) && !d?.deleted_at, maintKey)

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
  const locked = !p.canViewSecrets
  // Una scheda per coppia di credenziali, solo se c'è qualcosa da mostrare.
  const credGroups = ([
    { key: 'os', icon: 'monitor', title: 'Sistema operativo', user: has('os_user') ? d.os_user : null, pwd: has('os_pwd') ? d.os_pwd : null, pwdOn: has('os_pwd') },
    { key: 'app', icon: 'file', title: 'Applicazione', user: has('app_usr') ? d.app_usr : null, pwd: has('app_pwd') ? d.app_pwd : null, pwdOn: has('app_pwd') },
    { key: 'vnc', icon: 'eye', title: 'Accesso remoto VNC', user: null, pwd: has('vnc_pwd') ? d.vnc_pwd : null, pwdOn: has('vnc_pwd') },
  ] as const).filter((g) => g.user || g.pwd)
  const hasMaint = Boolean(p.canViewMaintenance) && (isHardwareType(d.type_key) || Boolean(maint && (maint.plans.length || maint.events.length)))
  const tab: InventoryTab = p.tab === 'man' && !hasMaint ? 'det' : p.tab

  const details = (
    <>
      {d.has_active_issue ? (
        <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '9px 12px', borderRadius: '8px', border: '1px solid', borderColor: prio === 'critical' ? 'error.main' : 'archie.borderStrong', bgcolor: prio === 'critical' ? 'error.light' : 'archie.surface2' }}>
          <IssuePriorityMark priority={prio} compact />
          <Typography sx={{ fontSize: 13, fontWeight: 550, flex: 1 }}>Issue aperta su questo sistema · priorità {PRIORITY_META[prio]?.label?.toLowerCase() ?? prio}</Typography>
          <LinkButton onClick={() => p.onTab('iss')}>Vedi</LinkButton>
        </Box>
      ) : null}

      {d.knumber && /\d/.test(d.knumber) ? <KNumberPlate knumber={d.knumber} /> : null}

      <Properties
        storageKey="inventory-props-open"
        props={props}
        summary={<><InventoryStatusBadge statusKey={d.status_key} label={d.status_label} />{d.knumber ? <Box component="span" sx={{ ...mono, color: 'text.secondary' }}>{d.knumber}</Box> : null}</>}
      />

      <DetailSection title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><CampoIcon name="lock" size={13} />Accesso</Box>}
        end={<Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.875, py: '1px' }}>credenziali solo qui</Box>}>
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          {net.length ? <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${net.length}, minmax(0,1fr))`, gap: 1 }}>{net.map(([f, l, v]) => <NetTile key={f} label={l} value={v} onCopy={p.onCopy} />)}</Box> : null}
          {credGroups.map((g) => (
            <CredGroup key={g.key} icon={g.icon} title={g.title}>
              {g.user ? <CredRow icon="user" label="Utente" value={g.user} onCopy={p.onCopy} /> : null}
              {g.pwdOn && (g.pwd || locked) ? <CredRow icon="key" label="Password" value={g.pwd} secret locked={locked} onCopy={p.onCopy} /> : null}
            </CredGroup>
          ))}
          {!credGroups.length ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessuna credenziale registrata per questo sistema.</Typography> : null}
          <Typography sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', fontSize: 11, color: 'text.disabled', lineHeight: 1.45, '& svg': { flex: 'none', mt: '2px' } }}>
            <CampoIcon name="lock" size={12} />Le password si vedono solo con il permesso Credenziali e si nascondono da sole dopo 30 secondi.
          </Typography>
        </Box>
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

  const footer = tab === 'det' ? (
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
  ) : tab === 'iss' && !deleted ? (
    <><Box sx={{ flex: 1 }} /><Button variant="contained" startIcon={<AddIcon />} onClick={p.onNewIssue}>Nuova issue</Button></>
  ) : tab === 'man' ? (
    <><Box sx={{ flex: 1 }} /><Button variant="outlined" startIcon={<CampoIcon name="calendar" />} onClick={() => navigate('/maintenance/rapportini')}>Apri i rapportini</Button></>
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
      tabs={[
        { key: 'det', label: 'Dettagli' },
        { key: 'iss', label: 'Issue' },
        ...(hasMaint ? [{ key: 'man', label: 'Manutenzioni', count: maint ? maint.events.length : null, warn: maintenanceDue(maint) ? 'Manutenzione scaduta o in scadenza' : undefined }] : []),
        { key: 'att', label: 'Attività' },
      ]}
      tab={tab}
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
      {tab === 'det' ? details
        : tab === 'iss' ? <InventoryIssuesPanel inventoryId={d.id} />
        : tab === 'man' ? <InventoryMaintenancePanel data={maint} canUpload={Boolean(p.canUploadReports)} onChanged={() => setMaintKey((k) => k + 1)} onOpenModule={() => navigate('/maintenance')} />
        : p.activityTab}
    </FloatingDetail>
  )
}

