import CloseIcon from '@mui/icons-material/Close'
import { Box, Divider, Stack, Typography } from '@mui/material'
import * as React from 'react'

import { ActionIconButton } from './ActionIconButton'

export type DetailDrawerHeaderProps = {
  title: string
  subtitle?: string
  onClose: () => void
  actions?: React.ReactNode
  /**
   * Whether to render the Divider below the header. Defaults to true.
   * Some pages (e.g. WIP) pass divider={false}.
   */
  divider?: boolean
}

export function DetailDrawerHeader({
  title,
  subtitle,
  onClose,
  actions,
  divider = true,
}: DetailDrawerHeaderProps) {
  return (
    <>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }} noWrap>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                {subtitle}
              </Typography>
            ) : null}
          </Box>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            {actions}
            <ActionIconButton label="Chiudi" onClick={onClose}>
              <CloseIcon />
            </ActionIconButton>
          </Stack>
        </Stack>
      </Box>

      {divider ? <Divider /> : null}
    </>
  )
}

export default DetailDrawerHeader
