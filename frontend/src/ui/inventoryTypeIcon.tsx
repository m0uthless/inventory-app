import type { SvgIconComponent } from "@mui/icons-material";

import DesktopWindowsOutlinedIcon from "@mui/icons-material/DesktopWindowsOutlined";
import BalanceIcon from "@mui/icons-material/Balance";
import SaveIcon from "@mui/icons-material/Save";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import DiscFullIcon from "@mui/icons-material/DiscFull";
import MicIcon from "@mui/icons-material/Mic";
import AccessibleIcon from "@mui/icons-material/Accessible";
import PublicIcon from "@mui/icons-material/Public";
import WebhookIcon from "@mui/icons-material/Webhook";
import WbCloudyOutlinedIcon from "@mui/icons-material/WbCloudyOutlined";
import StorageIcon from "@mui/icons-material/Storage";
import ConstructionIcon from "@mui/icons-material/Construction";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

export const INVENTORY_TYPE_ICON_COLOR = "#457f79";


// Mappa type_key (backend InventoryType.key) -> icona Material
export const INVENTORY_TYPE_ICONS: Record<string, SvgIconComponent> = {
  service_pc: DesktopWindowsOutlinedIcon,
  workstation: DesktopWindowsOutlinedIcon,

  load_balancer2: BalanceIcon,
  load_balancer1: BalanceIcon,

  storage: SaveIcon,

  robot: PrecisionManufacturingIcon,
  pc_robot: DiscFullIcon,

  speech: MicIcon,
  orthoview: AccessibleIcon,
  vue_motion: PublicIcon,
  wfm: WebhookIcon,
  csap: WbCloudyOutlinedIcon,

  host4: StorageIcon,
  host3: StorageIcon,
  host2: StorageIcon,
  host1: StorageIcon,

  // Nel seed v0.2.1 esiste "management"; in roadmap potrebbero esistere management1..4
  management: ConstructionIcon,
  management4: ConstructionIcon,
  management3: ConstructionIcon,
  management2: ConstructionIcon,
  management1: ConstructionIcon,
};

export function getInventoryTypeIcon(typeKey?: string | null): SvgIconComponent {
  if (!typeKey) return HelpOutlineIcon;
  return INVENTORY_TYPE_ICONS[typeKey] ?? HelpOutlineIcon;
}
