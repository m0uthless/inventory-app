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
