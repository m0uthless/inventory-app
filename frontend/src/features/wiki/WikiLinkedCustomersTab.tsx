/**
 * WikiLinkedCustomersTab — tab "Clienti collegati" della pagina Wiki.
 * Estratto da WikiPage.tsx per ridurne la dimensione (era >1900 righe in un solo file).
 */
import { Button, Card, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import AddLinkIcon from '@mui/icons-material/AddLink'
import BusinessIcon from '@mui/icons-material/Business'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import { useNavigate } from 'react-router-dom'

import { customerDrawerPath } from '../../utils/entityPaths'
import { Can } from '../../auth/Can'
import { PERMS } from '../../auth/perms'

export type WikiLink = {
  id: number
  entity_type: string
  entity_id: number
  entity_label?: string | null
  entity_path?: string | null
  notes?: string | null
}

function CustomerChip({
  link,
  customerName,
  onRemove,
}: {
  link: WikiLink
  customerName: string
  onRemove: () => void
}) {
  const navigate = useNavigate()

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      sx={{
        border: '1px solid',
        borderColor: 'grey.200',
        borderRadius: 1,
        px: 1.5,
        py: 0.75,
        bgcolor: 'background.paper',
        display: 'inline-flex',
      }}
    >
      <BusinessIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
      <Typography variant="body2" fontWeight={600} fontSize={13}>
        {customerName}
      </Typography>
      {link.notes && (
        <Typography variant="caption" color="text.secondary" fontSize={11}>
          — {link.notes}
        </Typography>
      )}
      <Tooltip title="Vai al cliente">
        <IconButton
          aria-label="Vai al cliente"
          size="small"
          onClick={() => navigate(link.entity_path ?? customerDrawerPath(link.entity_id))}
        >
          <OpenInNewIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
      <Can perm={PERMS.wiki.page.change}>
        <Tooltip title="Rimuovi collegamento">
          <IconButton
            aria-label="Rimuovi collegamento"
            size="small"
            color="error"
            onClick={onRemove}
          >
            <LinkOffIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      </Can>
    </Stack>
  )
}

export default function WikiLinkedCustomersTab({
  links,
  onRemoveLink,
  onAddCustomer,
}: {
  links: WikiLink[]
  onRemoveLink: (linkId: number) => void
  onAddCustomer: () => void
}) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2" color="text.secondary">
          {links.length === 0
            ? 'Nessun cliente collegato'
            : `${links.length} client${links.length === 1 ? 'e' : 'i'} collegat${links.length === 1 ? 'o' : 'i'}`}
        </Typography>
        <Can perm={PERMS.wiki.page.change}>
          <Button size="small" variant="outlined" startIcon={<AddLinkIcon />} onClick={onAddCustomer}>
            Collega cliente
          </Button>
        </Can>
      </Stack>

      {links.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 1, p: 4, textAlign: 'center' }}>
          <BusinessIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.disabled" fontSize={13}>
            Collega questa pagina wiki ai clienti pertinenti.
          </Typography>
        </Card>
      ) : (
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {links.map((l) => (
            <CustomerChip
              key={l.id}
              link={l}
              customerName={l.entity_label ?? `Cliente #${l.entity_id}`}
              onRemove={() => onRemoveLink(l.id)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
