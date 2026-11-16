import * as React from 'react'
import { Box, ButtonBase, IconButton, Tooltip } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import TrainOutlined from '@mui/icons-material/TrainOutlined'
import LocalTaxiOutlined from '@mui/icons-material/LocalTaxiOutlined'
import DirectionsBusOutlined from '@mui/icons-material/DirectionsBusOutlined'
import TollOutlined from '@mui/icons-material/TollOutlined'
import SpeedOutlined from '@mui/icons-material/SpeedOutlined'
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined'
import LocalGasStationOutlined from '@mui/icons-material/LocalGasStationOutlined'
import HotelOutlined from '@mui/icons-material/HotelOutlined'
import RestaurantOutlined from '@mui/icons-material/RestaurantOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import PhoneIphoneOutlined from '@mui/icons-material/PhoneIphoneOutlined'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import { CampoIcon } from '../../ui/campo'
import type { ExpenseCategory, ExpenseReceiptRow, ExpenseReportStatus } from './expensesShared'
import { STATUS_TONE, statusLabel } from './nsModel'

const CAT_ICON: Record<ExpenseCategory, SvgIconComponent> = {
  treni: TrainOutlined, taxi_comune: LocalTaxiOutlined, taxi_fuori_comune: DirectionsBusOutlined, autostrade: TollOutlined,
  rimborso_km: SpeedOutlined, varie_automezzi: DirectionsCarOutlined, carburanti: LocalGasStationOutlined, pernottamento: HotelOutlined,
  pasti: RestaurantOutlined, rappresentanza: GroupsOutlined, telefoniche: PhoneIphoneOutlined, varie: MoreHorizOutlined,
}

export function CategoryIcon({ category, size = 16 }: { category: ExpenseCategory; size?: number }) {
  const I = CAT_ICON[category]
  return <I aria-hidden sx={{ fontSize: size, flex: 'none' }} />
}

const TONE_SX = {
  neutral: { bgcolor: 'archie.neutralBg', color: 'text.secondary' },
  info: { bgcolor: 'info.light', color: 'info.main' },
  success: { bgcolor: 'success.light', color: 'success.main' },
  error: { bgcolor: 'error.light', color: 'error.main' },
} as const
const TONE_MARK: Record<keyof typeof TONE_SX, React.ReactNode> = {
  neutral: <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  info: <><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 2.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor" /></>,
  success: <circle cx="6" cy="6" r="4" fill="currentColor" />,
  error: <path d="M6 1.6 10.8 10H1.2z" fill="currentColor" />,
}

/** Stato della nota (forma + colore, leggibile anche senza colore). */
export function ExpenseStatusBadge({ status, secretary = false }: { status: ExpenseReportStatus; secretary?: boolean }) {
  const tone = STATUS_TONE[status]
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 22, pl: '7px', pr: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap', ...TONE_SX[tone] }}>
      <svg viewBox="0 0 12 12" width={10} height={10} aria-hidden>{TONE_MARK[tone]}</svg>
      {statusLabel(status, secretary)}
    </Box>
  )
}

/** Etichetta "manca lo scontrino". */
export function MissingTag({ long }: { long?: boolean }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11.5, fontWeight: 600, color: 'warning.main', bgcolor: 'warning.light', borderRadius: '5px', px: 0.75, lineHeight: '20px', whiteSpace: 'nowrap' }}>
      {long ? <CampoIcon name="alert" size={12} /> : null}{long ? 'manca lo scontrino' : 'manca'}
    </Box>
  )
}

/** Scontrino allegato: apre l'anteprima; con `onRemove` si può togliere. */
export function ReceiptChip({ receipt, onOpen, onRemove, disabled }: { receipt: ExpenseReceiptRow; onOpen: () => void; onRemove?: () => void; disabled?: boolean }) {
  const name = receipt.file_name || 'Scontrino'
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 22, border: '1px solid', borderColor: 'divider', borderRadius: '5px', bgcolor: 'background.paper', maxWidth: 170 }}>
      <ButtonBase onClick={onOpen} title="Apri lo scontrino" sx={{ gap: 0.5, px: 0.75, height: '100%', minWidth: 0, fontSize: 11.5, color: 'text.primary', borderRadius: '5px', '&:hover': { color: 'primary.main' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing } }}>
        <CampoIcon name="file" size={12} />
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Box>
      </ButtonBase>
      {onRemove ? (
        <Tooltip title="Rimuovi">
          <span>
            <IconButton aria-label={`Rimuovi ${name}`} disabled={disabled} onClick={onRemove} sx={{ width: 20, height: 20, borderRadius: '0 4px 4px 0', borderLeft: '1px solid', borderColor: 'divider', color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
              <CampoIcon name="x" size={11} />
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
    </Box>
  )
}

