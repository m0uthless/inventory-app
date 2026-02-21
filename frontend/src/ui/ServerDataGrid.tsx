import { Box, Typography } from "@mui/material";
import {
  DataGrid,
  GridToolbar,
  type DataGridProps,
  type GridColDef,
  type GridColumnVisibilityModel,
  type GridPaginationModel,
  type GridRowSelectionModel,
  type GridSortModel,
  type GridValidRowModel,
} from "@mui/x-data-grid";
import type { ReactNode } from "react";
import { alpha, type SxProps, type Theme } from "@mui/material/styles";

export type GridEmptyState = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

type Props<R extends GridValidRowModel> = {
  rows: R[];
  columns: GridColDef<R>[];
  loading?: boolean;
  rowCount: number;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  onSortModelChange: (model: GridSortModel) => void;
  onRowClick?: (id: number) => void;
  height?: number;
  pageSizeOptions?: number[];
  deletedField?: keyof R | string;
  getRowId?: DataGridProps<R>["getRowId"];
  sx?: SxProps<Theme>;
  showGridToolbar?: boolean;
  slots?: DataGridProps<R>["slots"];
  slotProps?: DataGridProps<R>["slotProps"];

  /** DataGrid density preset */
  density?: DataGridProps<R>["density"];

  /** Soft zebra striping (odd/even rows). */
  zebra?: boolean;

  /** Enable checkbox selection (useful for bulk actions) */
  checkboxSelection?: boolean;
  rowSelectionModel?: GridRowSelectionModel;
  onRowSelectionModelChange?: (model: GridRowSelectionModel) => void;

  /** Column visibility toggles (useful to show deleted_at only in Cestino) */
  columnVisibilityModel?: GridColumnVisibilityModel;

  /** Custom empty state overlay */
  emptyState?: GridEmptyState;
};

export type ServerDataGridProps<R extends GridValidRowModel> = Props<R>;

/**
 * Standard DataGrid wrapper for DRF server-side lists.
 * - server pagination + server sorting
 * - optional built-in GridToolbar
 * - standard styling for soft-deleted rows (deleted_at)
 * - optional checkbox selection for bulk actions
 */
export default function ServerDataGrid<R extends GridValidRowModel>(props: Props<R>) {
  const {
    rows,
    columns,
    loading,
    rowCount,
    paginationModel,
    onPaginationModelChange,
    sortModel,
    onSortModelChange,
    onRowClick,
    height = 640,
    pageSizeOptions = [10, 25, 50, 100],
    deletedField = "deleted_at",
    getRowId,
    sx,
    showGridToolbar = true,
    slots,
    slotProps,
    density,
    zebra = false,
    checkboxSelection,
    rowSelectionModel,
    onRowSelectionModelChange,
    columnVisibilityModel,
    emptyState,
  } = props;

  const NoRowsOverlay = emptyState
    ? function NoRowsOverlayImpl() {
        return (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 3,
              textAlign: "center",
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>{emptyState.title}</Typography>
              {emptyState.subtitle ? (
                <Typography variant="body2" sx={{ opacity: 0.7, mb: emptyState.action ? 1.25 : 0 }}>
                  {emptyState.subtitle}
                </Typography>
              ) : null}
              {emptyState.action ? <Box>{emptyState.action}</Box> : null}
            </Box>
          </Box>
        );
      }
    : undefined;

  return (
    <Box sx={{ height }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        density={density}
        // Be explicit: some overrides/density combos can collapse headers.
        columnHeaderHeight={44}
        disableRowSelectionOnClick={!checkboxSelection}
        checkboxSelection={!!checkboxSelection}
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={onRowSelectionModelChange}
        slots={
          showGridToolbar
            ? ({ toolbar: GridToolbar, ...(slots || {}), ...(NoRowsOverlay ? { noRowsOverlay: NoRowsOverlay } : {}) } as any)
            : ({ ...(slots || {}), ...(NoRowsOverlay ? { noRowsOverlay: NoRowsOverlay } : {}) } as any)
        }
        slotProps={slotProps as any}
        rowCount={rowCount}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        sortingMode="server"
        sortModel={sortModel}
        onSortModelChange={onSortModelChange}
        pageSizeOptions={pageSizeOptions}
        columnVisibilityModel={columnVisibilityModel}
        getRowId={getRowId}
        getRowClassName={(p) => {
          const cls: string[] = [];
          if ((p.row as any)?.[deletedField]) cls.push("row-deleted");
          if (zebra) cls.push(p.indexRelativeToCurrentPage % 2 === 0 ? "row-even" : "row-odd");
          return cls.join(" ");
        }}
        sx={[
          {
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "rgba(0,0,0,0.018)",
            },
            "& .row-deleted": { opacity: 0.55 },
            "& .row-deleted .MuiDataGrid-cell": { textDecoration: "line-through" },
            ...(zebra
              ? {
                  "& .row-odd": {
                    backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.03),
                  },
                }
              : {}),
            "& .MuiDataGrid-row:hover": {
              backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.06),
            },
          } as SxProps<Theme>,
          (sx as any) || {},
        ]}
        onRowClick={(params) => {
          if (!onRowClick) return;
          const n = Number(params.id);
          if (!Number.isNaN(n)) onRowClick(n);
        }}
      />
    </Box>
  );
}
