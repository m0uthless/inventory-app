import * as React from 'react'
import { Button, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import { navSectionButtonSx } from './relatedListUtils'

/**
 * Intestazione comune delle tab "entità collegate" (titolo + badge conteggio
 * + bottone "Apri lista"), identica tra Customers.tsx e Sites.tsx.
 */
export function RelatedListHeader(props: {
  title: string
  count: number
  buttonLabel: string
  onOpenList: () => void
}) {
  const { title, count, buttonLabel, onOpenList } = props
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
          {title}
        </Typography>
        <Chip size="small" label={count} />
      </Stack>
      <Button size="small" variant="contained" sx={navSectionButtonSx} onClick={onOpenList}>
        {buttonLabel}
      </Button>
    </Stack>
  )
}

/**
 * Corpo comune delle tab "entità collegate": stato di caricamento, stato
 * vuoto ("—") o il contenuto effettivo (lista), a scelta del chiamante.
 */
export function RelatedListBody(props: {
  loading: boolean
  isEmpty: boolean
  emptyText?: string
  children: React.ReactNode
}) {
  const { loading, isEmpty, emptyText = '—', children } = props

  if (loading) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Caricamento…
        </Typography>
      </Stack>
    )
  }

  if (isEmpty) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.7 }}>
        {emptyText}
      </Typography>
    )
  }

  return <>{children}</>
}
