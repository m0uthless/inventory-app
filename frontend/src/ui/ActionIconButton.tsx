import React from 'react'
import { IconButton, Tooltip } from '@mui/material'

type Props = {
  label: string
  icon?: React.ReactNode
  children?: React.ReactNode
} & Omit<React.ComponentProps<typeof IconButton>, 'children'>

export function ActionIconButton({ label, icon, children, ...rest }: Props) {
  const content = icon ?? children

  if (!content) {
    if (import.meta.env.DEV) {
      console.warn('ActionIconButton requires either `icon` or `children` prop.')
    }
    return null
  }

  return (
    <Tooltip title={label}>
      <span>
        <IconButton aria-label={label} {...rest}>
          {content}
        </IconButton>
      </span>
    </Tooltip>
  )
}

export default ActionIconButton
