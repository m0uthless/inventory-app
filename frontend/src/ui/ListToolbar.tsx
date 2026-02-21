import type { ReactNode } from "react";

import { Box, Button, Stack, TextField } from "@mui/material";

import type { ListViewMode } from "../hooks/useServerGrid";

import ListViewModeToggle from "./ListViewModeToggle";

type Props = {
  q: string;
  onQChange: (v: string) => void;

  /**
   * Optional: when provided, a segmented control (Attivi/Tutti/Cestino) is rendered
   * on the right side of the toolbar.
   */
  viewMode?: ListViewMode;
  onViewModeChange?: (v: ListViewMode) => void;

  /** Optional. If omitted, the "Reimposta" button is hidden. */
  onReset?: () => void;

  children?: ReactNode;
  createButton?: ReactNode;

  /** Right-side extra actions (e.g. bulk restore button) */
  rightActions?: ReactNode;

  searchLabel?: string;
  resetLabel?: string;
};

export type ListToolbarProps = Props;

export default function ListToolbar(props: Props) {
  const {
    q,
    onQChange,
    viewMode,
    onViewModeChange,
    onReset,
    children,
    createButton,
    rightActions,
    searchLabel = "Cerca",
    resetLabel = "Reimposta",
  } = props;

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1}
      sx={{ flexWrap: { md: "wrap" } }}
      alignItems="center"
    >
      {createButton ? (
        <Box sx={{ width: { xs: "100%", md: "auto" } }}>{createButton}</Box>
      ) : null}

      <TextField
        size="small"
        label={searchLabel}
        placeholder={searchLabel}
        value={q}
        onChange={(e) => onQChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{
          width: { xs: "100%", md: 240 },
          "& .MuiInputLabel-root": { fontSize: 12 },
          "& .MuiInputBase-input": { fontSize: 12, py: "6px" },
        }}
      />

      {children}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          width: { xs: "100%", md: "auto" },
          ml: { md: "auto" },
          justifyContent: { xs: "stretch", md: "flex-end" },
          flexWrap: "wrap",
        }}
      >
        {viewMode !== undefined && typeof onViewModeChange === "function" ? (
          <ListViewModeToggle
            value={viewMode}
            onChange={onViewModeChange}
            sx={{ width: { xs: "100%", md: "auto" } }}
          />
        ) : null}

        {rightActions ? (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            {rightActions}
          </Box>
        ) : null}

        {typeof onReset === "function" ? (
          <Button
            size="small"
            variant="outlined"
            onClick={onReset}
            sx={{ width: { xs: "100%", md: "auto" } }}
          >
            {resetLabel}
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
