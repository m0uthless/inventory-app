import * as React from 'react'
import { Chip, List, ListItem, ListItemButton, ListItemText, Stack } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { buildDrfListParams } from '@shared/api/drf'
import { apiErrorToMessage } from '@shared/api/error'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useToast } from '@shared/ui/toast'
import { buildQuery } from '@shared/utils/nav'
import { RelatedListBody, RelatedListHeader } from '../entityRelations/RelatedListSection'
import { EXPIRY_CHIP, type ContractListItem } from './types'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Tab "Contratti" del drawer Cliente: lista compatta + link alla pagina Contratti filtrata. */
export default function CustomerContractsTab({ customerId }: { customerId: number }) {
  const theme = useTheme()
  const toast = useToast()
  const navigate = useNavigate()

  const params = React.useMemo(
    () => buildDrfListParams({ page0: 0, pageSize: 50, ordering: 'end_date', extra: { customer: customerId } }),
    [customerId],
  )
  const { rows, rowCount, loading } = useDrfList<ContractListItem>('/contracts/', params, (e: unknown) =>
    toast.error(apiErrorToMessage(e)),
  )

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <RelatedListHeader
        title="Contratti"
        count={rowCount}
        buttonLabel="Vedi tutti"
        onOpenList={() => navigate(`/contracts${buildQuery({ customer: customerId })}`)}
      />

      <RelatedListBody loading={loading} isEmpty={rows.length === 0} emptyText="Nessun contratto per questo cliente.">
        <List dense disablePadding sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
          {rows.map((c, idx) => {
            const expiry = EXPIRY_CHIP[c.expiry_state] ?? EXPIRY_CHIP.none
            return (
              <ListItem
                key={c.id}
                disablePadding
                sx={{ bgcolor: idx % 2 === 1 ? alpha(theme.palette.text.primary, 0.03) : 'transparent' }}
              >
                <ListItemButton
                  onClick={() => navigate(`/contracts${buildQuery({ customer: customerId, open: c.id })}`)}
                  sx={{ py: 0.75 }}
                >
                  <ListItemText
                    primary={`${c.code} · ${c.title}`}
                    secondary={`Scadenza ${formatDate(c.end_date)} · ${c.status_label}`}
                    primaryTypographyProps={{ noWrap: true, variant: 'body2', sx: { fontWeight: 600 } }}
                    secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                  />
                  {c.expiry_state !== 'none' ? (
                    <Chip size="small" color={expiry.color} label={expiry.label} sx={{ ml: 1 }} />
                  ) : null}
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      </RelatedListBody>
    </Stack>
  )
}
