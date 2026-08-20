import * as React from 'react'
import {
  Box, Dialog, DialogContent, DialogTitle, IconButton, Link, List, ListItem,
  Skeleton, Stack, Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import StarRoundedIcon from '@mui/icons-material/StarRounded'

import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { FS } from './style'
import { MetaTag } from './primitives'

// ─── ContactsListModal ──────────────────────────────────────────────────────
//
// Modal semplice, sola lettura: elenca i contatti collegati a un cliente
// (o a un cliente+sito) senza lasciare il Site Repository. Aperto dal
// bottone "Contatti" in CustomerCard/CollapsibleSiteRow.

type Contact = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  department?: string | null
  is_primary: boolean
}

export function ContactsListModal({
  open, onClose, title, customerId, siteId, onViewAll,
}: {
  open: boolean
  onClose: () => void
  title: string
  customerId: number
  /** Se presente, filtra ai soli contatti del sito; altrimenti tutti quelli del cliente. */
  siteId?: number | null
  /** Se presente, mostra un link per aprire la pagina Contatti completa (modificabile). */
  onViewAll?: () => void
}) {
  const theme = useTheme()
  const toast = useToast()
  const [loading, setLoading] = React.useState(false)
  const [contacts, setContacts] = React.useState<Contact[]>([])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    api.get('/contacts/', {
      params: {
        customer: customerId,
        ...(siteId ? { site: siteId } : {}),
        page_size: 100,
        ordering: '-is_primary,name',
      },
    })
      .then((res) => { if (!cancelled) setContacts(res.data?.results ?? []) })
      .catch((e: unknown) => { if (!cancelled) toast.error(apiErrorToMessage(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, customerId, siteId, toast])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <GroupsOutlinedIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Chiudi">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack spacing={1.5}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height={48} />)}
          </Stack>
        ) : contacts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nessun contatto trovato.
          </Typography>
        ) : (
          <List disablePadding>
            {contacts.map((c) => (
              <ListItem
                key={c.id}
                disableGutters
                sx={{
                  py: 1, px: 0,
                  borderBottom: '1px solid', borderColor: 'divider',
                  '&:last-of-type': { borderBottom: 'none' },
                  alignItems: 'flex-start',
                }}
              >
                <Box sx={{ width: '100%', minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Typography fontWeight={600} sx={{ fontSize: FS.body }}>
                      {c.name}
                    </Typography>
                    {c.is_primary && (
                      <MetaTag
                        label="Primario"
                        icon={<StarRoundedIcon sx={{ fontSize: 14 }} />}
                        sx={{ flexShrink: 0 }}
                      />
                    )}
                    {c.department && (
                      <Typography color="text.secondary" sx={{ fontSize: FS.micro }}>
                        {c.department}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={2} sx={{ mt: 0.25, flexWrap: 'wrap' }}>
                    {c.email && (
                      <Link
                        href={`mailto:${c.email}`}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: FS.micro }}
                      >
                        <EmailOutlinedIcon sx={{ fontSize: 14 }} />
                        {c.email}
                      </Link>
                    )}
                    {c.phone && (
                      <Link
                        href={`tel:${c.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: FS.micro }}
                      >
                        <PhoneOutlinedIcon sx={{ fontSize: 14 }} />
                        {c.phone}
                      </Link>
                    )}
                  </Stack>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      {onViewAll && (
        <Box sx={{ px: 3, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
          <Link
            component="button"
            onClick={onViewAll}
            sx={{ fontSize: FS.micro, fontWeight: 600 }}
          >
            Apri in Contatti (per modificare) →
          </Link>
        </Box>
      )}
    </Dialog>
  )
}
