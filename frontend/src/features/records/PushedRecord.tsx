import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'
import { isRecord } from '@shared/utils/guards'
import { useAuth } from '../../auth/AuthProvider'
import { PERMS } from '../../auth/perms'
import { useStatusTokens } from '../../theme/AppThemeProvider'
import { CustomerWindow, type CustomerModalDetail } from '../customers/CustomerDetailModal'
import { vendorColorOf } from '../customers/customerUi'
import { SiteWindow, type SiteModalDetail } from '../sites/SiteDetailModal'
import { ContactWindow, type ContactModalDetail } from '../contacts/ContactDetailModal'
import { recordPath, type StackRef } from './recordStack'

type Lookup = { id: number; label: string; key?: string }
const URL = { customer: '/customers/', site: '/sites/', contact: '/contacts/' } as const

function useLookup(url: string | null) {
  const [rows, setRows] = React.useState<Lookup[]>([])
  React.useEffect(() => {
    if (!url) return
    let alive = true
    api.get(url).then((r) => { const d = r.data as Lookup[] | { results?: Lookup[] }; if (alive) setRows((Array.isArray(d) ? d : d.results ?? []).slice().sort((a, b) => a.id - b.id)) }).catch(() => {})
    return () => { alive = false }
  }, [url])
  return rows
}

/** Indirizzo del cliente dai campi personalizzati (come nella pagina Clienti), per la mappa. */
function customerAddress(d: Record<string, unknown>) {
  const cf = d.custom_fields
  if (!isRecord(cf)) return null
  const key = Object.keys(cf).find((k) => k.trim().toLowerCase() === 'indirizzo')
  const v = key ? cf[key] : null
  if (typeof v !== 'string' || !v.trim()) return null
  return [v.trim(), typeof d.city === 'string' ? d.city.trim() : ''].filter(Boolean).join(', ')
}

/**
 * Record aperto sopra un altro nella stessa finestra. Le azioni che vivono nella pagina del record
 * (modifica completa, elimina, ripristina, VPN) portano a quella pagina, dove il record si riapre.
 */
export default function PushedRecord({ r, onClose, onLabel }: { r: StackRef; onClose: () => void; onLabel: (label: string) => void }) {
  const { hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const tokens = useStatusTokens()
  const [detail, setDetail] = React.useState<Record<string, unknown> | null>(null)
  const load = React.useCallback(() => {
    api.get(`${URL[r.kind]}${r.id}/`, { params: { include_deleted: 1 } })
      .then((res) => setDetail(res.data as Record<string, unknown>))
      .catch((e) => toast.error(apiErrorToMessage(e)))
  }, [r.kind, r.id, toast])
  React.useEffect(() => { load() }, [load])
  const label = detail ? String(detail.display_name || detail.name || '') : ''
  React.useEffect(() => { if (label) onLabel(label) }, [label, onLabel])

  const customerStatuses = useLookup(r.kind === 'customer' ? '/customer-statuses/' : null)
  const siteStatuses = useLookup(r.kind === 'site' ? '/site-statuses/' : null)
  const vendorOrder = React.useMemo(() => customerStatuses.map((x) => x.label), [customerStatuses])

  if (!detail) return null
  const toPage = () => navigate(recordPath(r))
  const common = {
    onClose, onSaved: load, onEdit: toPage, onDelete: toPage, onRestore: toPage,
    onCopy: (v: string) => { void copyToClipboard(v).then(() => toast.success('Copiato')) },
  }

  if (r.kind === 'customer') {
    const d = detail as unknown as CustomerModalDetail
    return (
      <CustomerWindow {...common} detail={d} loading={false} statuses={customerStatuses}
        vendorColor={(l) => vendorColorOf(l, tokens.clientChipPalette, vendorOrder)}
        canChange={hasPerm(PERMS.crm.customer.change)} canDelete={hasPerm(PERMS.crm.customer.delete)}
        canEditVpn={hasPerm(PERMS.crm.vpn.change) || hasPerm(PERMS.crm.vpn.add)} showContracts={hasPerm(PERMS.contracts.contract.view)}
        showDevices={hasPerm(PERMS.device.device.view)} canEditDevices={hasPerm(PERMS.device.device.change)} address={customerAddress(detail)}
        onEditVpn={toPage}
        onNewIssue={() => navigate('/issues', { state: { createForCustomer: { customerId: d.id, customerName: d.display_name || d.name } } })} />
    )
  }
  if (r.kind === 'site') {
    const d = detail as unknown as SiteModalDetail
    return (
      <SiteWindow {...common} detail={d} statuses={siteStatuses} canChange={hasPerm(PERMS.crm.site.change)} canDelete={hasPerm(PERMS.crm.site.delete)}
        onNewIssue={() => { if (d.customer) navigate('/issues', { state: { createForCustomer: { customerId: d.customer, customerName: d.customer_display_name || d.customer_name || '', siteId: d.id } } }) }} />
    )
  }
  const d = detail as unknown as ContactModalDetail
  return <ContactWindow {...common} detail={d} canChange={hasPerm(PERMS.crm.contact.change)} canDelete={hasPerm(PERMS.crm.contact.delete)} onOpenContact={() => {}} />
}
