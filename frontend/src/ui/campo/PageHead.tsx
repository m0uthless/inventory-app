import * as React from 'react'
import { Box, Typography } from '@mui/material'
import { useOwnPageHeader } from '../../layout/PageHeaderContext'

type Props = {
  title: string
  /** Riga breve accanto al titolo (conteggi, anno…). */
  meta?: React.ReactNode
  /** Controlli subito dopo il titolo (es. selettore anno). */
  inline?: React.ReactNode
  /** Azione primaria e secondarie, allineate a destra. */
  actions?: React.ReactNode
}

/** Testata di pagina (DESIGN.md › Layout): titolo + azione primaria. Sostituisce il titolo automatico della shell. */
export function PageHead({ title, meta, inline, actions }: Props) {
  useOwnPageHeader()
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2, flexWrap: 'wrap', minHeight: 32 }}>
      <Typography variant="h4" component="h1">{title}</Typography>
      {inline ? <Box sx={{ alignSelf: 'center', display: 'flex' }}>{inline}</Box> : null}
      {meta ? <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', display: { xs: 'none', sm: 'inline' } }}>{meta}</Typography> : null}
      {actions ? <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center', alignSelf: 'center' }}>{actions}</Box> : null}
    </Box>
  )
}
