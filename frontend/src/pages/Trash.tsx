import * as React from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";

import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";

import { api } from "../api/client";
import { buildDrfListParams } from "../api/drf";
import { apiErrorToMessage } from "../api/error";
import { useServerGrid } from "../hooks/useServerGrid";
import { useToast } from "../ui/toast";
import { emptySelectionModel, selectionSize } from "../utils/gridSelection";
import ServerDataGrid from "../ui/ServerDataGrid";
import ListToolbar from "../ui/ListToolbar";
import { useAuth } from "../auth/AuthProvider";
import ConfirmActionDialog from "../ui/ConfirmActionDialog";
import { PERMS } from "../auth/perms";

type TrashResourceKey = "customers" | "sites" | "contacts" | "inventory" | "maintenance-plans" | "techs";
type TrashTypeKey = "all" | TrashResourceKey;

type ResourceCfg = {
  key: TrashResourceKey;
  label: string;
  endpoint: string;
  restoreEndpoint: string;
  viewPerm: string;
  restorePerm: string;
  buildTitle: (row: any) => string;
};

const RESOURCES: ResourceCfg[] = [
  {
    key: "customers",
    label: "Clienti",
    endpoint: "/customers/",
    restoreEndpoint: "/customers/bulk_restore/",
    viewPerm: PERMS.crm.customer.view,
    restorePerm: PERMS.crm.customer.change,
    buildTitle: (r) => `${r.code || ""} — ${r.display_name || r.name || "Cliente"}`.trim(),
  },
  {
    key: "sites",
    label: "Siti",
    endpoint: "/sites/",
    restoreEndpoint: "/sites/bulk_restore/",
    viewPerm: PERMS.crm.site.view,
    restorePerm: PERMS.crm.site.change,
    buildTitle: (r) =>
      `${r.customer_code ? r.customer_code + " · " : ""}${r.display_name || r.name || "Sito"}`.trim(),
  },
  {
    key: "contacts",
    label: "Contatti",
    endpoint: "/contacts/",
    restoreEndpoint: "/contacts/bulk_restore/",
    viewPerm: PERMS.crm.contact.view,
    restorePerm: PERMS.crm.contact.change,
    buildTitle: (r) =>
      `${r.full_name || r.display_name || "Contatto"}${r.email ? " — " + r.email : ""}`.trim(),
  },
  {
    key: "inventory",
    label: "Inventari",
    endpoint: "/inventories/",
    restoreEndpoint: "/inventories/bulk_restore/",
    viewPerm: PERMS.inventory.inventory.view,
    restorePerm: PERMS.inventory.inventory.change,
    buildTitle: (r) =>
      `${r.hostname || r.name || "Inventario"}${r.knumber ? " · " + r.knumber : ""}`.trim(),
  },
  {
    key: "maintenance-plans",
    label: "Piani manutenzione",
    endpoint: "/maintenance-plans/",
    restoreEndpoint: "/maintenance-plans/bulk_restore/",
    viewPerm: PERMS.maintenance.plan.view,
    restorePerm: PERMS.maintenance.plan.change,
    buildTitle: (r) =>
      `${r.customer_code ? r.customer_code + " · " : ""}${r.title || "Piano"}`.trim(),
  },
  {
    key: "techs",
    label: "Tecnici",
    endpoint: "/techs/",
    restoreEndpoint: "/techs/bulk_restore/",
    viewPerm: PERMS.maintenance.tech.view,
    restorePerm: PERMS.maintenance.tech.change,
    buildTitle: (r) =>
      `${r.full_name || r.first_name + " " + r.last_name || "Tecnico"}${r.email ? " — " + r.email : ""}`.trim(),
  },
];

type ApiPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function fmt(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

export default function Trash() {
  const toast = useToast();
  const { hasPerm } = useAuth();

  const grid = useServerGrid({
    defaultOrdering: "-updated_at",
    allowedOrderingFields: ["updated_at", "created_at", "id", "deleted_at"],
    defaultPageSize: 25,
  });

  const [typeKey, setTypeKey] = React.useState<TrashTypeKey>("all");
  const cfg = React.useMemo(() => (typeKey === "all" ? null : RESOURCES.find((r) => r.key === typeKey)!), [typeKey]);

  React.useEffect(() => {
    if (grid.view !== "deleted") grid.setViewMode("deleted", { keepOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rows, setRows] = React.useState<any[]>([]);
  const [rowCount, setRowCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const [selectionModel, setSelectionModel] = React.useState<GridRowSelectionModel>(emptySelectionModel());

  const [restoreBusy, setRestoreBusy] = React.useState(false);
  const [bulkRestoreDlgOpen, setBulkRestoreDlgOpen] = React.useState(false);

  const visibleResources = React.useMemo(() => RESOURCES.filter((r) => hasPerm(r.viewPerm)), [hasPerm]);

  const selectionToIdStrings = React.useCallback((m: GridRowSelectionModel): string[] => {
    const anyM: any = m as any;
    if (anyM?.ids && typeof anyM.ids.forEach === "function") {
      const out: string[] = [];
      anyM.ids.forEach((v: any) => out.push(String(v)));
      return out;
    }
    if (Array.isArray(m)) return (m as any[]).map((v) => String(v));
    return [];
  }, []);

  const selectedByType = React.useMemo(() => {
    const ids = selectionToIdStrings(selectionModel);
    const groups: Record<TrashResourceKey, number[]> = { customers: [], sites: [], contacts: [], inventory: [], "maintenance-plans": [], techs: [] };

    if (typeKey !== "all") {
      for (const s of ids) {
        const n = Number(s);
        if (!Number.isNaN(n)) groups[typeKey].push(n);
      }
      return groups;
    }

    for (const s of ids) {
      const [k, idStr] = s.split(":", 2);
      if (!k || !idStr) continue;
      if (!Object.prototype.hasOwnProperty.call(groups, k)) continue;
      const n = Number(idStr);
      if (!Number.isNaN(n)) (groups as any)[k].push(n);
    }
    return groups;
  }, [selectionModel, selectionToIdStrings, typeKey]);

  const selectedCount = React.useMemo(() => selectionSize(selectionModel), [selectionModel]);

  const emptyState = React.useMemo(() => {
    if (!grid.search.trim()) {
      return {
        title: "Cestino vuoto",
        subtitle: typeKey === "all" ? "Non ci sono elementi eliminati." : "Non ci sono elementi eliminati per questo tipo.",
      };
    }
    return { title: "Nessun risultato", subtitle: "Prova a cambiare ricerca o tipo." };
  }, [grid.search, typeKey]);

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
      }),
    [
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      grid.includeDeleted,
      grid.onlyDeleted,
    ]
  );

  const load = React.useCallback(async () => {
    // "Tutti" = merge client-side of visible resources.
    if (typeKey === "all") {
      if (visibleResources.length === 0) {
        setRows([]);
        setRowCount(0);
        return;
      }

      setLoading(true);
      try {
        // Fetch enough items per resource to cover the current page after merging.
        const need = (grid.paginationModel.page + 1) * grid.paginationModel.pageSize;
        const params = {
          ...listParams,
          page: 1,
          page_size: need,
        };

        const resps = await Promise.all(
          visibleResources.map((r) => api.get<ApiPage<any>>(r.endpoint, { params }).then((x) => ({ cfg: r, data: x.data })))
        );

        const all: any[] = [];
        let total = 0;
        for (const rr of resps) {
          total += rr.data.count || 0;
          for (const row of rr.data.results || []) {
            all.push({
              ...row,
              __kind: rr.cfg.key,
              __rid: `${rr.cfg.key}:${row.id}`,
              __title: rr.cfg.buildTitle(row),
            });
          }
        }

        // Apply ordering client-side (best-effort)
        const ord = (grid.ordering || "-deleted_at").trim();
        const dir = ord.startsWith("-") ? -1 : 1;
        const field = ord.replace(/^[-+]/, "");
        all.sort((a, b) => {
          const av = (a as any)[field];
          const bv = (b as any)[field];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
          return 0;
        });

        const start = grid.paginationModel.page * grid.paginationModel.pageSize;
        const end = start + grid.paginationModel.pageSize;
        setRows(all.slice(start, end));
        setRowCount(total);
      } catch (e) {
        toast.error(apiErrorToMessage(e));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Single resource.
    if (!cfg || !hasPerm(cfg.viewPerm)) {
      setRows([]);
      setRowCount(0);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<ApiPage<any>>(cfg.endpoint, { params: listParams });
      setRows(res.data.results || []);
      setRowCount(res.data.count || 0);
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cfg, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, hasPerm, listParams, toast, typeKey, visibleResources]);

  React.useEffect(() => {
    setSelectionModel(emptySelectionModel());
    load();
  }, [load, typeKey]);

  const canBulkRestore =
    !restoreBusy &&
    grid.view === "deleted" &&
    selectedCount > 0 &&
    (typeKey === "all"
      ? RESOURCES.some((r) => hasPerm(r.restorePerm) && (selectedByType as any)[r.key]?.length)
      : cfg != null && hasPerm(cfg.restorePerm));

  const doBulkRestore = async (): Promise<boolean> => {
    if (!canBulkRestore) return false;
    setRestoreBusy(true);
    try {
      if (typeKey === "all") {
        const calls: Promise<any>[] = [];
        let restored = 0;
        let skipped = 0;
        for (const r of RESOURCES) {
          const ids = (selectedByType as any)[r.key] as number[];
          if (!ids?.length) continue;
          if (!hasPerm(r.restorePerm)) {
            skipped += ids.length;
            continue;
          }
          restored += ids.length;
          calls.push(api.post(r.restoreEndpoint, { ids }));
        }
        await Promise.all(calls);
        if (restored > 0) toast.success(`Ripristinati ${restored} elementi ✅`);
        if (skipped > 0) toast.warning(`Saltati ${skipped} elementi (permessi mancanti).`);
      } else {
        const ids = (selectedByType as any)[typeKey] as number[];
        await api.post(cfg!.restoreEndpoint, { ids });
        toast.success(`Ripristinati ${selectedCount} elementi ✅`);
      }
      setSelectionModel(emptySelectionModel());
      load();
      return true;
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    } finally {
      setRestoreBusy(false);
    }
    return false;
  };

  const cols: GridColDef<any>[] = [
    {
      field: "__kind",
      headerName: "Tipo",
      width: 120,
      sortable: false,
      valueGetter: (_v, row) => {
        const k = (row as any).__kind as TrashResourceKey | undefined;
        if (!k) return cfg?.label || "—";
        return RESOURCES.find((r) => r.key === k)?.label || k;
      },
    },
    {
      field: "__id",
      headerName: "ID",
      width: 90,
      sortable: false,
      valueGetter: (_v, row) => (row as any).id,
    },
    {
      field: "__title",
      headerName: "Oggetto",
      flex: 1,
      minWidth: 320,
      sortable: false,
      valueGetter: (_v, row) => (row as any).__title || (cfg ? cfg.buildTitle(row) : "—"),
    },
    {
      field: "deleted_at",
      headerName: "Eliminato il",
      width: 190,
      sortable: true,
      valueGetter: (v) => v,
      renderCell: (p) => <span>{fmt(p.value as any)}</span>,
    },
    {
      field: "updated_at",
      headerName: "Aggiornato",
      width: 190,
      sortable: true,
      valueGetter: (v) => v,
      renderCell: (p) => <span>{fmt(p.value as any)}</span>,
    },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
        Cestino
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
        Qui trovi gli elementi eliminati (soft-delete). Puoi filtrare e ripristinare in blocco.
      </Typography>

      <ConfirmActionDialog
        open={bulkRestoreDlgOpen}
        busy={restoreBusy}
        title={`Ripristinare ${selectedCount} elementi?`}
        description={
          typeKey === "all"
            ? `Verranno ripristinati ${selectedCount} elementi dal cestino.`
            : `Verranno ripristinati ${selectedCount} ${cfg!.label.toLowerCase()} dal cestino.`
        }
        confirmText="Ripristina"
        confirmColor="success"
        onClose={() => setBulkRestoreDlgOpen(false)}
        onConfirm={async () => {
          const ok = await doBulkRestore();
          if (ok) setBulkRestoreDlgOpen(false);
        }}
      />

      <Card>
        <CardContent>
          <ListToolbar
            q={grid.q}
            onQChange={grid.setQ}
            viewMode={grid.view}
            onViewModeChange={(v) => grid.setViewMode(v, { keepOpen: false })}
            rightActions={
              <Button
                variant="contained"
                startIcon={<RestoreFromTrashIcon />}
                disabled={!canBulkRestore}
                onClick={() => setBulkRestoreDlgOpen(true)}
              >
                Ripristina selezionati
              </Button>
            }
          >
            <FormControl size="small" sx={{ width: { xs: "100%", md: 220 } }}>
              <InputLabel>Tipo</InputLabel>
              <Select label="Tipo" value={typeKey} onChange={(e) => setTypeKey(e.target.value as any)}>
                <MenuItem value="all">Tutti</MenuItem>
                {visibleResources.map((r) => (
                  <MenuItem key={r.key} value={r.key}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </ListToolbar>

          {typeKey === "all" && visibleResources.length === 0 ? (
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 2 }}>
              Non hai i permessi per visualizzare alcun tipo di dati.
            </Typography>
          ) : typeKey !== "all" && cfg && !hasPerm(cfg.viewPerm) ? (
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 2 }}>
              Non hai i permessi per visualizzare questo tipo di dati.
            </Typography>
          ) : (
            <ServerDataGrid
              rows={rows}
              columns={cols}
              loading={loading}
              rowCount={rowCount}
              emptyState={emptyState}
              columnVisibilityModel={{ __kind: typeKey === "all" }}
              paginationModel={grid.paginationModel}
              onPaginationModelChange={grid.onPaginationModelChange}
              sortModel={grid.sortModel}
              onSortModelChange={grid.onSortModelChange}
              checkboxSelection={grid.view === "deleted"}
              rowSelectionModel={selectionModel}
              onRowSelectionModelChange={(m) => setSelectionModel(m as GridRowSelectionModel)}
              height={680}
              deletedField="deleted_at"
              getRowId={typeKey === "all" ? ((r: any) => r.__rid) : undefined}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
