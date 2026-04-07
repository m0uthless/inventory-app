import { Box, Pagination, Typography } from '@mui/material'
import type { GridPaginationModel } from '@mui/x-data-grid'

type Props = {
  rowCount: number
  paginationModel: GridPaginationModel
  onPaginationModelChange: (model: GridPaginationModel) => void
  label: string
}

export default function GridPaginationFooter({
  rowCount,
  paginationModel,
  onPaginationModelChange,
  label,
}: Props) {
  const pageSize = Math.max(1, paginationModel.pageSize || 25)
  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize))

  return (
    <Box
      sx={{
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto minmax(0, 1fr)' },
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <Box
        sx={{
          justifySelf: { xs: 'center', sm: 'start' },
          display: 'inline-flex',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            bgcolor: 'action.hover',
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          {rowCount} {label}
        </Typography>
      </Box>

      <Pagination
        shape="rounded"
        page={paginationModel.page + 1}
        count={pageCount}
        onChange={(_e, page) =>
          onPaginationModelChange({
            ...paginationModel,
            page: page - 1,
          })
        }
        siblingCount={1}
        boundaryCount={1}
        sx={{
          justifySelf: 'center',
          '& .MuiPagination-ul': {
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 0.25,
          },
          '& .MuiPaginationItem-root': {
            width: 30,
            height: 30,
            minWidth: 'unset',
            borderRadius: '50%',
            border: (theme) => `1px solid ${theme.palette.divider}`,
            fontWeight: 600,
            bgcolor: 'background.paper',
            transition: 'all 0.15s ease',
          },
          '& .MuiPaginationItem-root.Mui-selected': {
            width: 34,
            height: 34,
            bgcolor: (theme) => `${theme.palette.primary.main} !important`,
            borderColor: (theme) => `${theme.palette.primary.main} !important`,
            color: '#fff',
            fontWeight: 700,
            boxShadow: (theme) => `0 4px 12px ${theme.palette.primary.main}40`,
          },
          '& .MuiPaginationItem-root.Mui-selected:hover': {
            bgcolor: (theme) => `${theme.palette.primary.dark} !important`,
          },
        }}
      />

      <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
    </Box>
  )
}
