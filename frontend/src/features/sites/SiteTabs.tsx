import { useNavigate } from 'react-router-dom'
import { Box, Tooltip, Typography } from '@mui/material'
import { buildQuery } from '@shared/utils/nav'
import { CampoIcon, type CampoIconName } from '../../ui/campo'
import { Empty, Group, GroupLink, Loading, mono, Row, Rows, Tile, useList } from '../../ui/campo/ListRows'
import { AuditFeedPanel } from '../customers/CustomerTabs'
import { IssueStatusBadge } from '../issues/IssueBadges'

/* Schede del pannello sito nello stile "Campo sterile" (come il pannello cliente). */

type InvRow = { id: number; name?: string | null; hostname?: string | null; knumber?: string | null; type_key?: string | null; type_label?: string | null; status_label?: string | null; local_ip?: string | null; has_active_issue?: boolean }
type ContactRow = { id: number; name: string; email?: string | null; phone?: string | null; department?: string | null; is_primary?: boolean }
type IssueRow = { id: number; title: string; status: string; status_label?: string; priority?: string; opened_at?: string | null; assigned_to_full_name?: string | null }

const invIcon = (k?: string | null): CampoIconName => {
  const t = (k || '').toLowerCase()
  if (/(work|ws|pc|client|monitor|modal)/.test(t)) return 'monitor'
  if (/(rout|switch|fire|vpn|net|rete)/.test(t)) return 'cloud'
  return 'server'
}

export function SiteInventoriesPanel({ siteId, customerId }: { siteId: number; customerId: number | null }) {
  const navigate = useNavigate()
  const invs = useList<InvRow>('/inventories/', { site: siteId, page_size: 500, ordering: 'name' })
  if (!invs) return <Loading />
  return (
    <Group first title="Inventari" count={invs.length}
      action={customerId ? <GroupLink label="Apri elenco" onClick={() => navigate(`/inventory${buildQuery({ customer: customerId })}`)} /> : undefined}>
      {invs.length ? (
        <Rows>
          {invs.map((i) => (
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
      ) : <Empty text="Nessun inventario su questo sito." />}
    </Group>
  )
}

export function SiteContactsPanel({ siteId, customerId }: { siteId: number; customerId: number | null }) {
  const navigate = useNavigate()
  const rows = useList<ContactRow>('/contacts/', { site: siteId, page_size: 200, ordering: 'name' })
  if (!rows) return <Loading />
  return (
    <Group first title="Contatti del sito" count={rows.length}
      action={<GroupLink label="Apri elenco" onClick={() => navigate(`/contacts${buildQuery({ customer: customerId ?? undefined, site: siteId })}`)} />}>
      {rows.length ? (
        <Rows>
          {rows.map((c) => (
            <Row key={c.id} tile={<Tile icon="user" tone={c.is_primary ? 'brand' : 'neutral'} />} chevron
              title={<>{c.name}{c.is_primary ? <Box component="span" sx={{ ml: 1, fontSize: 10, fontWeight: 650, color: 'primary.main', bgcolor: 'archie.field', borderRadius: '4px', px: 0.75, py: '1px' }}>Primario</Box> : null}</>}
              sub={[c.department, c.email].filter(Boolean).join(' · ') || '—'}
              end={c.phone ? (
                <Box component="a" href={`tel:${c.phone.replace(/\s+/g, '')}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} title={`Chiama ${c.name}`}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 550, color: 'text.primary', textDecoration: 'none', whiteSpace: 'nowrap', '& svg': { color: 'primary.main' }, '&:hover': { color: 'primary.main' } }}>
                  <CampoIcon name="phone" size={14} bold /><Box component="span" sx={mono}>{c.phone}</Box>
                </Box>
              ) : null}
              onClick={() => navigate(`/contacts${buildQuery({ open: c.id })}`)} />
          ))}
        </Rows>
      ) : <Empty text="Nessun contatto per questo sito." />}
    </Group>
  )
}

const ACTIVE = ['open', 'in_progress', 'waiting']

export function SiteIssuesPanel({ siteId, siteName }: { siteId: number; siteName: string }) {
  const navigate = useNavigate()
  const open = useList<IssueRow>('/issues/', { site: siteId, status: ACTIVE, page_size: 100, ordering: '-opened_at' })
  const closed = useList<IssueRow>('/issues/', { site: siteId, status: ['resolved', 'closed'], page_size: 5, ordering: '-opened_at' })
  if (!open) return <Loading />
  const row = (i: IssueRow) => (
    <Row key={i.id} tile={<Tile text={`#${i.id}`} />} chevron title={i.title}
      sub={[i.assigned_to_full_name, i.opened_at ? `aperta il ${new Date(i.opened_at).toLocaleDateString('it-IT')}` : null].filter(Boolean).join(' · ') || undefined}
      end={<IssueStatusBadge status={i.status} label={i.status_label} />}
      onClick={() => navigate(`/issues${buildQuery({ open: i.id })}`)} />
  )
  return (
    <>
      <Group first title="Issue aperte" count={open.length} action={<GroupLink label="Apri elenco" onClick={() => navigate(`/issues${buildQuery({ cliente: siteName })}`)} />}>
        {open.length ? <Rows>{open.map(row)}</Rows> : <Empty text="Nessuna issue aperta su questo sito." />}
      </Group>
      {closed && closed.length ? (
        <Group title="Risolte di recente" count={closed.length}>
          <Rows>{closed.map(row)}</Rows>
        </Group>
      ) : null}
    </>
  )
}

const SITE_FIELDS: Record<string, string> = {
  name: 'il nome', display_name: 'il nome breve', status: 'lo stato', customer: 'il cliente', address_line1: "l'indirizzo",
  city: 'la città', postal_code: 'il CAP', province: 'la provincia', country: 'il paese', notes: 'le note', custom_fields: 'i campi personalizzati',
}

export function SiteActivityPanel({ siteId }: { siteId: number }) {
  return <AuditFeedPanel appLabel="crm" model="site" objectId={siteId} fields={SITE_FIELDS} noun="il sito" />
}
