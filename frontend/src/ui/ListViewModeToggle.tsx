import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  type SxProps,
  type Theme,
} from "@mui/material";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import type { ListViewMode } from "../hooks/useServerGrid";

type Props = {
  value: ListViewMode;
  onChange: (v: ListViewMode) => void;
  sx?: SxProps<Theme>;
};

/**
 * Shared list view mode selector:
 * - Attivi / Tutti / Cestino
 */
export default function ListViewModeToggle({ value, onChange, sx }: Props) {
  return (
    <ToggleButtonGroup
      size="small"
      value={value}
      exclusive
      onChange={(_e, v) => {
        if (!v) return;
        onChange(v);
      }}
      sx={{
        borderRadius: 2,
        bgcolor: "rgba(0,0,0,0.015)",
        "& .MuiToggleButtonGroup-grouped": {
          borderRadius: 0,
          textTransform: "none",
          px: 1.25,
          // Avoid clipped glyphs on some browsers / font renderers.
          py: 0.5,
          minHeight: 34,
          lineHeight: 1.1,
        },
        "& .MuiToggleButtonGroup-grouped:first-of-type": {
          borderTopLeftRadius: 16,
          borderBottomLeftRadius: 16,
        },
        "& .MuiToggleButtonGroup-grouped:last-of-type": {
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
        },
        "& .MuiToggleButton-root": {
          gap: 0.75,
          whiteSpace: "nowrap",
        },
        ...((sx as any) || {}),
      }}
    >
      <ToggleButton value="active">
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <CheckCircleOutlineIcon fontSize="small" />
          <Box component="span" sx={{ lineHeight: 1.1 }}>
            Attivi
          </Box>
        </Box>
      </ToggleButton>
      <ToggleButton value="all">
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <ViewListOutlinedIcon fontSize="small" />
          <Box component="span" sx={{ lineHeight: 1.1 }}>
            Tutti
          </Box>
        </Box>
      </ToggleButton>
      <ToggleButton value="deleted">
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <DeleteOutlineIcon fontSize="small" />
          <Box component="span" sx={{ lineHeight: 1.1 }}>
            Cestino
          </Box>
        </Box>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
