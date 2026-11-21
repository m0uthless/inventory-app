import * as React from 'react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'

import { fetchAll } from '../../api/fetchAll'
import { useAuth } from '../../auth/AuthProvider'
import { PERMS } from '../../auth/perms'
import { CampoIcon, RecordRow } from '../../ui/campo'

type Contact = { id: number; name: string; phone?: string | null; email?: string | null; department?: string | null; is_primary?: boolean }

const MAX_SHOWN = 3
const telOf = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/**
 * Referente del sito per «Dove intervenire» (spec 2026-11-20, scelta A): il contatto principale del sito,
 * con chiamata ed email; senza principale, fino a 3 contatti del sito.
 */
export default function SiteReferent({ siteId }: { siteId: number }) {
  const { hasPerm } = useAuth()
  const allowed = hasPerm(PERMS.crm.contact.view)
  const [contacts, setContacts] = React.useState<Contact[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    if (!allowed) return
    let alive = true
    setContacts(null); setFailed(false)
    fetchAll<Contact>('/contacts/', { site: siteId, ordering: 'name' })
      .then((rows) => { if (alive) setContacts(rows) })
      .catch(() => { if (alive) { setFailed(true); setContacts([]) } })
    return () => { alive = false }
  }, [siteId, allowed])
  const muted = (text: React.ReactNode, icon: 'users' | 'lock' = 'users') => (
    <RecordRow lead={<CampoIcon name={icon} size={18} />} title={<Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>{text}</Box>} />
  )
  if (!allowed) return muted('Serve il permesso Contatti', 'lock')
  if (contacts === null) return null
  if (failed) return muted('Contatti non disponibili')
  if (!contacts.length) {
    return muted('Nessun contatto per questo sito')
  }
  const primary = contacts.find((c) => c.is_primary)
  const shown = primary ? [primary] : contacts.slice(0, MAX_SHOWN)
  const others = primary ? 0 : contacts.length - shown.length
  return (
    <>
      {shown.map((c) => (
        <RecordRow key={c.id} lead={<CampoIcon name="user" size={18} />} title={c.name}
          sub={<>{primary ? 'Referente' : 'Contatto del sito'}{c.department ? ` · ${c.department}` : ''}{c.phone ? <> · <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{c.phone}</Box></> : null}</>}
          end={<Box sx={{ display: 'inline-flex' }}>
            {c.phone ? <Tooltip title="Chiama"><IconButton size="small" component="a" href={telOf(c.phone)} aria-label={`Chiama ${c.name}`} onClick={(e) => e.stopPropagation()}><CampoIcon name="phone" size={15} /></IconButton></Tooltip> : null}
            {c.email ? <Tooltip title="Scrivi"><IconButton size="small" component="a" href={`mailto:${c.email}`} aria-label={`Scrivi a ${c.name}`} onClick={(e) => e.stopPropagation()}><CampoIcon name="mail" size={15} /></IconButton></Tooltip> : null}
          </Box>} />
      ))}
      {others > 0 ? <Typography sx={{ fontSize: 12, color: 'text.secondary', pl: 4.5, py: 0.5 }}>Altri {others} contatti del sito</Typography> : null}
    </>
  )
}
