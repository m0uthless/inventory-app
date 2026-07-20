import type { SvgIconComponent } from '@mui/icons-material'

import DesktopWindowsOutlinedIcon from '@mui/icons-material/DesktopWindowsOutlined'
import BalanceIcon from '@mui/icons-material/Balance'
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import MicIcon from '@mui/icons-material/Mic'
import AccessibleIcon from '@mui/icons-material/Accessible'
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined'
import SwitchVideoOutlinedIcon from '@mui/icons-material/SwitchVideoOutlined'
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import ComputerOutlinedIcon from '@mui/icons-material/ComputerOutlined'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

export const INVENTORY_TYPE_ICON_COLOR = '#457f79'

// Mappa type_key (backend InventoryType.key) -> icona Material
export const INVENTORY_TYPE_ICONS: Record<string, SvgIconComponent> = {
  // Workstation / PC
  service_pc:  DesktopWindowsOutlinedIcon,
  workstation: DesktopWindowsOutlinedIcon,
  ws:          DesktopWindowsOutlinedIcon,

  // Load balancer
  load_balancer2: BalanceIcon,
  load_balancer1: BalanceIcon,

  // Storage
  storage: StorageOutlinedIcon,

  // Robot
  robot:    PrecisionManufacturingOutlinedIcon,
  pc_robot: SmartToyOutlinedIcon,

  // Broker / hub di rete
  broker: HubOutlinedIcon,

  // Portale web MyVue
  myvue: VideocamOutlinedIcon,

  // Video motion
  vue_motion: SwitchVideoOutlinedIcon,

  // PACS server (WFM)
  wfm: MedicalServicesOutlinedIcon,

  // Monitoring (Zabbix)
  zabbix: MonitorHeartOutlinedIcon,

  // Cloud (CSAP)
  csap: CloudOutlinedIcon,

  // Speech
  speech: MicIcon,

  // Orthoview
  orthoview: AccessibleIcon,

  // Domain controller / host
  dc:    DnsOutlinedIcon,
  host:  ComputerOutlinedIcon,
  host4: ComputerOutlinedIcon,
  host3: ComputerOutlinedIcon,
  host2: ComputerOutlinedIcon,
  host1: ComputerOutlinedIcon,

  // Management
  management:  AdminPanelSettingsOutlinedIcon,
  management4: AdminPanelSettingsOutlinedIcon,
  management3: AdminPanelSettingsOutlinedIcon,
  management2: AdminPanelSettingsOutlinedIcon,
  management1: AdminPanelSettingsOutlinedIcon,
}

export function getInventoryTypeIcon(typeKey?: string | null): SvgIconComponent {
  if (!typeKey) return HelpOutlineIcon
  return INVENTORY_TYPE_ICONS[typeKey] ?? HelpOutlineIcon
}

// ─── Famiglie di tipo — colore pieno per identificazione rapida ────────────────
// Raggruppa i type_key in famiglie logiche con un colore dedicato, scelto per
// non entrare in conflitto con i colori di stato (verde/rosso/ambra/blu =
// attivo/issue/warning/info) usati altrove nell'app.

export type InventoryTypeFamily = {
  key: string
  label: string
  color: string
}

const FAMILY_CLIENT: InventoryTypeFamily = { key: 'client', label: 'Client / PC', color: '#0d9488' }
const FAMILY_SERVER: InventoryTypeFamily = { key: 'server', label: 'Server / Infrastruttura', color: '#4f46e5' }
const FAMILY_NETWORK: InventoryTypeFamily = { key: 'network', label: 'Rete', color: '#7c3aed' }
const FAMILY_MEDICAL: InventoryTypeFamily = { key: 'medical', label: 'Medical / Imaging', color: '#db2777' }
const FAMILY_MONITORING: InventoryTypeFamily = { key: 'monitoring', label: 'Monitoring / Cloud', color: '#0891b2' }
const FAMILY_ROBOT: InventoryTypeFamily = { key: 'robot', label: 'Robotica', color: '#92400e' }
const FAMILY_UNKNOWN: InventoryTypeFamily = { key: 'unknown', label: 'Non classificato', color: '#6b7280' }

// Mappa type_key -> famiglia
export const INVENTORY_TYPE_FAMILIES: Record<string, InventoryTypeFamily> = {
  // Client / PC
  service_pc:  FAMILY_CLIENT,
  workstation: FAMILY_CLIENT,
  ws:          FAMILY_CLIENT,

  // Server / Infrastruttura
  dc:          FAMILY_SERVER,
  host:        FAMILY_SERVER,
  host1:       FAMILY_SERVER,
  host2:       FAMILY_SERVER,
  host3:       FAMILY_SERVER,
  host4:       FAMILY_SERVER,
  management:  FAMILY_SERVER,
  management1: FAMILY_SERVER,
  management2: FAMILY_SERVER,
  management3: FAMILY_SERVER,
  management4: FAMILY_SERVER,
  storage:     FAMILY_SERVER,

  // Rete
  load_balancer1: FAMILY_NETWORK,
  load_balancer2: FAMILY_NETWORK,
  broker:         FAMILY_NETWORK,

  // Medical / Imaging
  myvue:      FAMILY_MEDICAL,
  vue_motion: FAMILY_MEDICAL,
  wfm:        FAMILY_MEDICAL,
  orthoview:  FAMILY_MEDICAL,
  speech:     FAMILY_MEDICAL,

  // Monitoring / Cloud
  zabbix: FAMILY_MONITORING,
  csap:   FAMILY_MONITORING,

  // Robotica
  robot:    FAMILY_ROBOT,
  pc_robot: FAMILY_ROBOT,
}

export function getInventoryTypeFamily(typeKey?: string | null): InventoryTypeFamily {
  if (!typeKey) return FAMILY_UNKNOWN
  return INVENTORY_TYPE_FAMILIES[typeKey] ?? FAMILY_UNKNOWN
}
