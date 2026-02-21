import * as React from "react";

import { Box, Card, CardContent } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { GridValidRowModel } from "@mui/x-data-grid";

import ListToolbar, { type ListToolbarProps } from "./ListToolbar";
import ServerDataGrid, { type ServerDataGridProps } from "./ServerDataGrid";

type Props<R extends GridValidRowModel> = {
  toolbar: ListToolbarProps;
  children?: React.ReactNode;
  grid: ServerDataGridProps<R>;
  /** Optional Card props via sx (useful for per-page tweaks) */
  sx?: any;

  /** Keep the toolbar visible while scrolling (sticks under the AppBar). */
  stickyToolbar?: boolean;
};

/**
 * Standard list container:
 * - Card + CardContent
 * - shared ListToolbar
 * - shared ServerDataGrid
 */
export default function EntityListCard<R extends GridValidRowModel>(props: Props<R>) {
  const { toolbar, children, grid, sx, stickyToolbar = false } = props;

  return (
    <Card sx={sx}>
      <CardContent
        sx={{
          // Default CardContent padding feels a bit “airy” for list pages.
          // Tighten it up so the toolbar sits closer to the top.
          pt: 1.5,
          pb: 2,
          "&:last-child": { pb: 2 },
        }}
      >
        <Box
          sx={
            stickyToolbar
              ? {
                  position: "sticky",
                  // A tiny breathing space under the AppBar feels nicer than “glued”.
                  top: { xs: 56 + 8, sm: 64 + 8 },
                  zIndex: 2,
                  bgcolor: (theme) => alpha(theme.palette.background.paper, 0.92),
                  backdropFilter: "blur(8px)",
                  borderRadius: 2,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                  // No outline/border: keep it clean.
                  px: 1,
                  py: 0.75,
                  mb: 1.5,
                }
              : { mb: 1.5 }
          }
        >
          <ListToolbar {...toolbar}>{children}</ListToolbar>
        </Box>
        <ServerDataGrid {...(grid as any)} />
      </CardContent>
    </Card>
  );
}
