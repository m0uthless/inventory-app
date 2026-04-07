import * as React from 'react'
import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'

export type EmptyStatePanelProps = {
  title: string
  subtitle?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  compact?: boolean
  sx?: SxProps<Theme>
}

export default function EmptyStatePanel({
  title,
  subtitle,
  action,
  icon,
  compact = false,
  sx,
}: EmptyStatePanelProps) {
  return (
    <Stack
      spacing={compact ? 0.75 : 1}
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      sx={{
        px: compact ? 2 : 3,
        py: compact ? 2.5 : 3,
        color: 'text.secondary',
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: compact ? 44 : 52,
          height: compact ? 44 : 52,
          borderRadius: '50%',
          bgcolor: 'action.hover',
          color: 'text.secondary',
          '& .MuiSvgIcon-root': { fontSize: compact ? 22 : 26 },
        }}
      >
        {icon ?? <InboxOutlinedIcon />}
      </Box>

      <Box>
        <Typography variant={compact ? 'body1' : 'subtitle1'} sx={{ fontWeight: 600, color: 'text.primary' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.82 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>

      {action ? <Box sx={{ pt: 0.25 }}>{action}</Box> : null}
    </Stack>
  )
}
