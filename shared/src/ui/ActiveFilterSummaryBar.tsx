import { Box, Chip, Stack, Typography } from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'

export type ActiveFilterSummaryItem = {
  key: string
  label: string
  onDelete?: () => void
}

type Props = {
  items: ActiveFilterSummaryItem[]
  onClearAll?: () => void
}

export default function ActiveFilterSummaryBar({ items, onClearAll }: Props) {
  if (items.length === 0) return null

  return (
    <Box
      sx={{
        mt: 1,
        pt: 1,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <TuneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            Filtri attivi
          </Typography>
        </Stack>

        {onClearAll ? (
          <Chip
            size="small"
            label="Reimposta tutto"
            onDelete={onClearAll}
            variant="outlined"
            sx={{ height: 26 }}
          />
        ) : null}
      </Stack>

      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
        {items.map((item) => (
          <Chip
            key={item.key}
            size="small"
            label={item.label}
            onDelete={item.onDelete}
            sx={{
              maxWidth: '100%',
              '& .MuiChip-label': {
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            }}
          />
        ))}
      </Stack>
    </Box>
  )
}
