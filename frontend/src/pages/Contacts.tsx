import * as React from "react";

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  FormControl,
  FormHelperText,
  FormControlLabel,
  IconButton,
  LinearProgress,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";

import { useLocation, useNavigate } from "react-router-dom";
import { useServerGrid } from "../hooks/useServerGrid";
import { useUrlNumberParam } from "../hooks/useUrlParam";

import { buildDrfListParams, includeDeletedParams } from "../api/drf";
import type { ApiPage } from "../api/drf";
import { useDrfList } from "../hooks/useDrfList";

import { api } from "../api/client";
import { apiErrorToFieldErrors, apiErrorToMessage } from "../api/error";
import { useAuth } from "../auth/AuthProvider";
import { Can } from "../auth/Can";
import { buildQuery } from "../utils/nav";
import { emptySelectionModel, selectionSize, selectionToNumberIds } from "../utils/gridSelection";
import { useToast } from "../ui/toast";

import ConfirmDeleteDialog from "../ui/ConfirmDeleteDialog";
import ConfirmActionDialog from "../ui/ConfirmActionDialog";
import { PERMS } from "../auth/perms";
import EntityListCard from "../ui/EntityListCard";
import FilterChip from "../ui/FilterChip";

type CustomerItem = { id: number; code?: string; name?: string; display_name?: string | null };

type SiteItem = { id: number; name: string; display_name?: string | null };

type ContactRow = {
  id: number;

  customer?: number | null;
  customer_code?: string | null;
  customer_name?: string | null;
  customer_display_name?: string | null;

  site?: number | null;
  site_name?: string | null;
  site_display_name?: string | null;

  name: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  is_primary: boolean;

  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type ContactDetail = ContactRow & { deleted_at?: string | null };

type ContactForm = {
  customer: number | "";
  site: number | "";
  name: string;
  email: string;
  phone: string;
  department: string;
  is_primary: boolean;
  notes: string;
};

const asId = (v: unknown): number | "" => {
  const s = String(v);
  return s === "" ? "" : Number(s);
};

async function copyToClipboard(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}


const cols: GridColDef<ContactRow>[] = [
  { field: "name", headerName: "Nome", flex: 1, minWidth: 220 },
  { field: "email", headerName: "Email", width: 240 },
  { field: "phone", headerName: "Telefono", width: 160 },
  {
    field: "customer_display_name",
    headerName: "Cliente",
    width: 220,
    valueGetter: (v, row) => {
      void v;
      return row.customer_display_name || row.customer_name || row.customer_code || "—";
    },
  },
  {
    field: "site_display_name",
    headerName: "Sito",
    width: 220,
    valueGetter: (v, row) => {
      void v;
      return row.site_display_name || row.site_name || "—";
    },
  },
  {
    field: "is_primary",
    headerName: "Primario",
    width: 120,
    renderCell: (p) =>
      p.value ? <Chip size="small" label="Sì" /> : <Chip size="small" variant="outlined" label="No" />,
  },
  {
    field: "deleted_at",
    headerName: "Eliminato il",
    width: 190,
    sortable: true,
    renderCell: (p) => <span>{fmtTs(p.value as any)}</span>,
  },
];

function fmtTs(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("it-IT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Contacts() {
  const { hasPerm } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const loc = useLocation();
  const grid = useServerGrid({
    defaultOrdering: "name",
    allowedOrderingFields: ["name", "email", "phone", "customer_display_name", "site_display_name", "is_primary", "deleted_at"],
    defaultPageSize: 25,
  });

  const [selectionModel, setSelectionModel] = React.useState<GridRowSelectionModel>(emptySelectionModel());
  const [bulkRestoreDlgOpen, setBulkRestoreDlgOpen] = React.useState(false);
  const selectedIds = React.useMemo(() => selectionToNumberIds(selectionModel), [selectionModel]);
  const selectedCount = React.useMemo(() => selectionSize(selectionModel), [selectionModel]);

  React.useEffect(() => {
    setSelectionModel(emptySelectionModel());
  }, [grid.view]);

  const emptyState = React.useMemo(() => {
    if (grid.view === "deleted" && !grid.search.trim()) {
      return { title: "Cestino vuoto", subtitle: "Non ci sono contatti eliminati." };
    }
    if (!grid.search.trim()) {
      return { title: "Nessun contatto", subtitle: "Crea un nuovo contatto o cambia i filtri." , action: (
        <Can perm={PERMS.crm.contact.add}>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } } )}>
            Crea contatto
          </Button>
        </Can>
      ) };

    }
    return { title: "Nessun risultato", subtitle: "Prova a cambiare ricerca o filtri." };
  }, [grid.view, grid.search]);


  // filters (URL)
  const [customerId, setCustomerId] = useUrlNumberParam("customer");
  const [siteId, setSiteId] = useUrlNumberParam("site");

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: { customer_display_name: 'customer__name', site_display_name: 'site__name' },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(customerId !== "" ? { customer: customerId } : {}),
          ...(siteId !== "" ? { site: siteId } : {}),
        },
      }),
    [
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      grid.includeDeleted,
      grid.onlyDeleted,
      customerId,
      siteId,
    ]
  );

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<ContactRow>(
    "/contacts/",
    listParams,
    (e: unknown) => toast.error(apiErrorToMessage(e))
  );

  // lookups
  const [customers, setCustomers] = React.useState<CustomerItem[]>([]);
  const [sites, setSites] = React.useState<SiteItem[]>([]); // sites for selected customer (filter + dialog)

  // drawer
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // delete/restore
  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [restoreBusy, setRestoreBusy] = React.useState(false);

  // dialog CRUD
  const [dlgOpen, setDlgOpen] = React.useState(false);
  const [dlgMode, setDlgMode] = React.useState<"create" | "edit">("create");
  const [dlgSaving, setDlgSaving] = React.useState(false);
  const [dlgId, setDlgId] = React.useState<number | null>(null);
  const [dlgErrors, setDlgErrors] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState<ContactForm>({
    customer: "",
    site: "",
    name: "",
    email: "",
    phone: "",
    department: "",
    is_primary: false,
    notes: "",
  });

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CustomerItem>>("/customers/", {
        params: { ordering: "name", page_size: 500 },
      });
      setCustomers(res.data.results ?? []);
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    }
  }, [toast]);

  const loadSitesForCustomer = React.useCallback(
    async (cust: number | "") => {
      try {
        if (cust === "") {
          setSites([]);
          return;
        }
        const res = await api.get<ApiPage<SiteItem>>("/sites/", {
          params: { customer: cust, ordering: "name", page_size: 500 },
        });
        setSites(res.data.results ?? []);
      } catch (e) {
        toast.error(apiErrorToMessage(e));
      }
    },
    [toast]
  );

  const loadDetail = React.useCallback(
    async (id: number, forceIncludeDeleted?: boolean) => {
      setDetailLoading(true);
      setDetail(null);
      try {
        const inc = forceIncludeDeleted ?? grid.includeDeleted;
        const incParams = includeDeletedParams(inc);
        const res = await api.get<ContactDetail>(`/contacts/${id}/`, incParams ? { params: incParams } : undefined);
        setDetail(res.data);
      } catch (e) {
        toast.error(apiErrorToMessage(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [toast, grid.includeDeleted]
  );

  const openDrawer = (id: number) => {
    setSelectedId(id);
    setDrawerOpen(true);
    loadDetail(id);
    grid.setOpenId(id);
  };

  // ── Row hover actions ────────────────────────────────────────────────────────
  const pendingEditIdRef   = React.useRef<number | null>(null);
  const pendingDeleteIdRef = React.useRef<number | null>(null);

  const openEditFromRow = (id: number) => {
    pendingEditIdRef.current = id;
    openDrawer(id);
  };

  const openDeleteFromRow = (id: number) => {
    pendingDeleteIdRef.current = id;
    openDrawer(id);
  };

  const restoreFromRow = async (id: number) => {
    setRestoreBusy(true);
    try {
      await api.post(`/contacts/${id}/restore/`);
      toast.success("Contatto ripristinato ✅");
      reloadList();
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    } finally {
      setRestoreBusy(false);
    }
  };

  React.useEffect(() => {
    if (!detail) return;
    if (pendingEditIdRef.current === detail.id) {
      pendingEditIdRef.current = null;
      openEdit();
    }
    if (pendingDeleteIdRef.current === detail.id) {
      pendingDeleteIdRef.current = null;
      setDeleteDlgOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const columns = React.useMemo<GridColDef<ContactRow>[]>(() => {
    const actionsCol: GridColDef<ContactRow> = {
      field: "__row_actions",
      headerName: "",
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => {
        const r = p.row as ContactRow;
        const isDeleted = Boolean(r.deleted_at);
        return (
          <Box
            className="row-actions"
            onClick={(e) => e.stopPropagation()}
            sx={{ width: "100%", display: "flex", justifyContent: "flex-end", gap: 0.25 }}
          >
            <Tooltip title="Apri" arrow>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDrawer(r.id); }}>
                <VisibilityOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Can perm={PERMS.crm.contact.change}>
              {isDeleted ? (
                <Tooltip title="Ripristina" arrow>
                  <span>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); restoreFromRow(r.id); }}
                      disabled={restoreBusy}
                    >
                      <RestoreFromTrashIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <>
                  <Tooltip title="Modifica" arrow>
                    <span>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); openEditFromRow(r.id); }}
                        disabled={restoreBusy}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Elimina" arrow>
                    <span>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); openDeleteFromRow(r.id); }}
                        disabled={deleteBusy}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}
            </Can>
          </Box>
        );
      },
    };
    return [...cols, actionsCol];
  }, [openDrawer, restoreBusy, deleteBusy, grid.view]);

  // If opened from global Search, we can return back to the Search results on close.
  const returnTo = React.useMemo(() => {
    return new URLSearchParams(loc.search).get("return");
  }, [loc.search]);

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
    grid.setOpenId(null);
    if (returnTo) navigate(returnTo, { replace: true });
  }, [grid, returnTo, navigate]);

  const doDelete = React.useCallback(async () => {
    if (!selectedId) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/contacts/${selectedId}/`);
      toast.success("Contatto eliminato.");
      setDeleteDlgOpen(false);
      closeDrawer();
      reloadList();
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }, [selectedId, toast, closeDrawer, reloadList]);

  const doBulkRestore = async (): Promise<boolean> => {
  const ids = selectedIds.filter((n) => Number.isFinite(n));
  if (!ids.length) return false;
  setRestoreBusy(true);
  try {
    await api.post(`/contacts/bulk_restore/`, { ids });
    toast.success(`Ripristinati ${ids.length} elementi ✅`);
    setSelectionModel(emptySelectionModel());
    reloadList();
    return true;
  } catch (e) {
    toast.error(apiErrorToMessage(e));
    return false;
  } finally {
    setRestoreBusy(false);
  }
  return false;
};

const doRestore = React.useCallback(async () => {
    if (!selectedId) return;
    setRestoreBusy(true);
    try {
      await api.post(`/contacts/${selectedId}/restore/`);
      toast.success("Contatto ripristinato.");
      await loadDetail(selectedId);
      reloadList();
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    } finally {
      setRestoreBusy(false);
    }
  }, [selectedId, toast, loadDetail, reloadList]);

  React.useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // initial sites load (based on customer from URL)
  React.useEffect(() => {
    loadSitesForCustomer(customerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when customerId changes after init, reload sites and reset site filter
  const prevCustomerRef = React.useRef<number | "">(customerId);
  React.useEffect(() => {
    loadSitesForCustomer(customerId);
    if (prevCustomerRef.current !== customerId) {
      setSiteId("", { patch: { page: 1 }, keepOpen: true });
      prevCustomerRef.current = customerId;
    }
  }, [customerId, loadSitesForCustomer, setSiteId]);

  // list loading is handled by useDrfList

  // open drawer from URL (?open=ID)
  const lastOpenRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!grid.openId) return;
    const id = grid.openId;
    if (lastOpenRef.current === id) return;
    lastOpenRef.current = id;

    setSelectedId(id);
    setDrawerOpen(true);
    loadDetail(id);
  }, [grid.openId, loadDetail]);

  // open create from sidebar quick action
  const openCreateOnceRef = React.useRef(false);

  const openCreate = async () => {
    const preCustomer = customerId !== "" ? customerId : "";
    setDlgMode("create");
    setDlgId(null);
    setDlgErrors({});
    setForm({
      customer: preCustomer,
      site: "",
      name: "",
      email: "",
      phone: "",
      department: "",
      is_primary: false,
      notes: "",
    });
    setDlgOpen(true);
    await loadSitesForCustomer(preCustomer);
  };

  React.useEffect(() => {
    const st: any = (loc as any).state;
    if (!st?.openCreate || openCreateOnceRef.current) return;
    openCreateOnceRef.current = true;
    void openCreate();
    navigate(loc.pathname + loc.search, { replace: true, state: {} });
  }, [loc, navigate]);

  const openEdit = async () => {
    if (!detail) return;
    setDlgMode("edit");
    setDlgId(detail.id);
    setDlgErrors({});

    const cust = (detail.customer ?? "") as any;
    setForm({
      customer: cust,
      site: (detail.site ?? "") as any,
      name: detail.name ?? "",
      email: detail.email ?? "",
      phone: detail.phone ?? "",
      department: detail.department ?? "",
      is_primary: Boolean(detail.is_primary),
      notes: detail.notes ?? "",
    });

    setDlgOpen(true);
    await loadSitesForCustomer(cust);
  };

  const save = async () => {
    setDlgErrors({});
    if (form.customer === "" || !String(form.name).trim()) {
      toast.warning("Compila almeno Cliente e Nome.");
      return;
    }

    const payload: any = {
      customer: Number(form.customer),
      site: form.site === "" ? null : Number(form.site),
      name: form.name.trim(),
      email: (form.email || "").trim() || null,
      phone: (form.phone || "").trim() || null,
      department: (form.department || "").trim() || null,
      is_primary: Boolean(form.is_primary),
      notes: (form.notes || "").trim() || null,
    };

    setDlgSaving(true);
    try {
      let id: number;
      if (dlgMode === "create") {
        const res = await api.post<ContactDetail>("/contacts/", payload);
        id = res.data.id;
        toast.success("Contatto creato ✅");
      } else {
        if (!dlgId) return;
        const res = await api.patch<ContactDetail>(`/contacts/${dlgId}/`, payload);
        id = res.data.id;
        toast.success("Contatto aggiornato ✅");
      }

      setDlgOpen(false);
      reloadList();
      openDrawer(id);
    } catch (e) {
      const fe = apiErrorToFieldErrors(e);
      if (fe) {
        setDlgErrors(fe);
        toast.warning("Controlla i campi evidenziati.");
      } else {
        toast.error(apiErrorToMessage(e));
      }
    } finally {
      setDlgSaving(false);
    }
  };

  const customerLabel = (d: ContactDetail | null) => d?.customer_display_name || d?.customer_name || d?.customer_code || "";
  const siteLabel = (d: ContactDetail | null) => d?.site_display_name || d?.site_name || "";

  return (
    <Stack spacing={2}>
       <Box>
         <Typography variant="h5">
           Contatti
         </Typography>
         <Typography variant="body2" sx={{ opacity: 0.7 }}>
           Schede di tutti i contatti legati a uno o più clienti.
         </Typography>
       </Box>
      <EntityListCard
        toolbar={{
          q: grid.q,
          onQChange: grid.setQ,
          viewMode: grid.view,
          onViewModeChange: (v) => grid.setViewMode(v, { keepOpen: true }),
          onReset: () => grid.reset(["customer", "site"]),
          rightActions: (
            <Can perm={PERMS.crm.contact.change}>
              <Button
                size="small"
                variant="contained"
                disabled={restoreBusy || grid.view !== "deleted" || selectedCount === 0}
                onClick={() => setBulkRestoreDlgOpen(true)}
              >
                Ripristina selezionati
              </Button>
            </Can>
          ),
          createButton: hasPerm(PERMS.crm.contact.add) ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
              sx={{ width: { xs: "100%", md: "auto" } }}
            >
              Nuovo
            </Button>
          ) : null,
        }}
        grid={{
          checkboxSelection: grid.view === "deleted",
          rowSelectionModel: selectionModel,
          onRowSelectionModelChange: (m) => setSelectionModel(m as GridRowSelectionModel),

          emptyState,
          columnVisibilityModel: { deleted_at: grid.view === "deleted" },

          rows,
          columns: columns,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: openDrawer,
          slotProps: { toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } } },
          sx: {
            "--DataGrid-rowHeight": "36px",
            "--DataGrid-headerHeight": "44px",
            "& .MuiDataGrid-cell": { py: 0.25 },
            "& .MuiDataGrid-columnHeader": { py: 0.75 },
            "& .MuiDataGrid-row:nth-of-type(even)": { backgroundColor: "rgba(69,127,121,0.03)" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(69,127,121,0.06)" },
            "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "rgba(69,127,121,0.10) !important" },
            "& .MuiDataGrid-row.Mui-selected:hover": { backgroundColor: "rgba(69,127,121,0.14) !important" },
            "& .row-actions": { opacity: 0, pointerEvents: "none", transition: "opacity 140ms ease" },
            "& .MuiDataGrid-row:hover .row-actions": { opacity: 1, pointerEvents: "auto" },
          } as any,
        }}
      >
        <FilterChip
          activeCount={(customerId !== "" ? 1 : 0) + (siteId !== "" ? 1 : 0)}
          onReset={() => {
            setCustomerId("", { patch: { search: grid.q, page: 1 }, keepOpen: true });
            setSiteId("", { patch: { search: grid.q, page: 1 }, keepOpen: true });
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel>Cliente</InputLabel>
            <Select
              label="Cliente"
              value={customerId}
              onChange={(e) => {
                const v = asId(e.target.value);
                setCustomerId(v, { patch: { search: grid.q, page: 1 }, keepOpen: true });
              }}
            >
              <MenuItem value="">Tutti</MenuItem>
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.display_name || c.name || c.code || `Cliente #${c.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth disabled={customerId === ""}>
            <InputLabel>Sito</InputLabel>
            <Select
              label="Sito"
              value={siteId}
              onChange={(e) => {
                const v = asId(e.target.value);
                setSiteId(v, { patch: { search: grid.q, page: 1 }, keepOpen: true });
              }}
            >
              <MenuItem value="">Tutti</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.display_name || s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </FilterChip>
      </EntityListCard>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: "100%", sm: 460 } } }}
      >
        <Stack sx={{ height: "100%", overflow: "hidden" }}>

          {/* ── HERO BANNER ── */}
          <Box sx={{
            background: "linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)",
            px: 2.5, pt: 2.25, pb: 2.25,
            position: "relative", overflow: "hidden", flexShrink: 0,
          }}>
            <Box sx={{ position:"absolute", top:-44, right:-44, width:130, height:130, borderRadius:"50%", bgcolor:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />
            <Box sx={{ position:"absolute", bottom:-26, left:52, width:90, height:90, borderRadius:"50%", bgcolor:"rgba(255,255,255,0.04)", pointerEvents:"none" }} />

            {/* badge + actions */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:1.25, position:"relative", zIndex:2 }}>
              <Chip size="small"
                label={detail?.is_primary ? "● Primario" : "● Non primario"}
                sx={{ bgcolor:"rgba(20,255,180,0.18)", color:"#a7f3d0", fontWeight:700, fontSize:10, letterSpacing:"0.07em", border:"1px solid rgba(167,243,208,0.3)", height:22 }}
              />
              <Stack direction="row" spacing={0.75}>
                <Can perm={PERMS.crm.contact.change}>
                  {detail?.deleted_at ? (
                    <Tooltip title="Ripristina"><span>
                      <IconButton size="small" onClick={doRestore} disabled={!detail || restoreBusy}
                        sx={{ color:"rgba(255,255,255,0.85)", bgcolor:"rgba(255,255,255,0.12)", borderRadius:1.5, "&:hover":{ bgcolor:"rgba(255,255,255,0.22)" } }}>
                        <RestoreFromTrashIcon fontSize="small" />
                      </IconButton>
                    </span></Tooltip>
                  ) : (
                    <Tooltip title="Modifica"><span>
                      <IconButton size="small" onClick={openEdit} disabled={!detail}
                        sx={{ color:"rgba(255,255,255,0.85)", bgcolor:"rgba(255,255,255,0.12)", borderRadius:1.5, "&:hover":{ bgcolor:"rgba(255,255,255,0.22)" } }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </span></Tooltip>
                  )}
                </Can>
                <Can perm={PERMS.crm.contact.delete}>
                  {!detail?.deleted_at && (
                    <Tooltip title="Elimina"><span>
                      <IconButton size="small" onClick={() => setDeleteDlgOpen(true)} disabled={!detail || deleteBusy}
                        sx={{ color:"rgba(255,255,255,0.85)", bgcolor:"rgba(255,255,255,0.12)", borderRadius:1.5, "&:hover":{ bgcolor:"rgba(239,68,68,0.28)", color:"#fca5a5" } }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span></Tooltip>
                  )}
                </Can>
                <Tooltip title="Chiudi">
                  <IconButton size="small" onClick={closeDrawer}
                    sx={{ color:"rgba(255,255,255,0.85)", bgcolor:"rgba(255,255,255,0.12)", borderRadius:1.5, "&:hover":{ bgcolor:"rgba(255,255,255,0.22)" } }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* name + customer/site */}
            <Box sx={{ position:"relative", zIndex:1 }}>
              {detail?.deleted_at && <Chip size="small" color="error" label="Eliminato" sx={{ mb:0.75, height:20, fontSize:10 }} />}
              <Typography sx={{ color:"#fff", fontSize:26, fontWeight:900, letterSpacing:"-0.025em", lineHeight:1.1, mb:0.5 }}>
                {detail?.name || (selectedId ? `Contatto #${selectedId}` : "Contatto")}
              </Typography>
              <Typography variant="body2" sx={{ color:"rgba(255,255,255,0.58)" }}>
                {[customerLabel(detail), siteLabel(detail)].filter(Boolean).join(" · ") || " "}
              </Typography>
              {detail?.department && (
                <Typography variant="caption" sx={{ color:"rgba(255,255,255,0.45)", display:"block", mt:0.25 }}>
                  {detail.department}
                </Typography>
              )}
            </Box>
          </Box>

          {detailLoading && <LinearProgress sx={{ height:2 }} />}

          {/* ── SCROLLABLE BODY ── */}
          <Box sx={{ flex:1, overflowY:"auto", px:2.5, py:2, display:"flex", flexDirection:"column", gap:1.5 }}>
            {detailLoading ? (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ py:2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" sx={{ opacity:0.7 }}>Caricamento…</Typography>
              </Stack>
            ) : detail ? (
              <>
                {/* Quick nav */}
                <Stack direction="row" spacing={1} sx={{ flexWrap:"wrap" }}>
                  {detail.customer && (
                    <Button size="small" variant="outlined"
                      onClick={() => navigate(`/customers${buildQuery({ open: detail.customer })}`)}>
                      Apri cliente
                    </Button>
                  )}
                  {detail.site && (
                    <Button size="small" variant="outlined"
                      onClick={() => navigate(`/sites${buildQuery({ open: detail.site, customer: detail.customer ?? "" })}`)}>
                      Apri sito
                    </Button>
                  )}
                  <Button size="small" variant="outlined"
                    onClick={() => navigate(`/inventory${buildQuery({ customer: detail.customer ?? "", site: detail.site ?? "" })}`)}>
                    Apri inventario
                  </Button>
                </Stack>

                {/* Dati contatto */}
                <Box sx={{ bgcolor:"#f8fafc", border:"1px solid", borderColor:"grey.200", borderRadius:2, p:1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"block", mb:1 }}>
                    Dati contatto
                  </Typography>
                  <Stack spacing={0.75}>
                    {([
                      { label:"Nome",     value: detail.name,        mono: false },
                      { label:"Email",    value: detail.email,       mono: true  },
                      { label:"Telefono", value: detail.phone,       mono: true  },
                      { label:"Reparto",  value: detail.department,  mono: false },
                      { label:"Cliente",  value: customerLabel(detail), mono: false },
                      { label:"Sito",     value: siteLabel(detail),  mono: false },
                    ] as { label: string; value?: string | null; mono: boolean }[]).filter(r => r.value).map((r) => (
                      <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="caption" sx={{ color:"text.disabled", minWidth:70 }}>{r.label}</Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight:600, fontFamily: r.mono ? "monospace" : undefined }}>
                            {r.value}
                          </Typography>
                          {r.mono && r.value && (
                            <Tooltip title="Copia">
                              <IconButton size="small" onClick={async () => { await copyToClipboard(r.value!); toast.success("Copiato ✅"); }}>
                                <ContentCopyIcon sx={{ fontSize:13 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                {/* Note */}
                {detail.notes && (
                  <Box sx={{ bgcolor:"#fafafa", border:"1px solid", borderColor:"grey.100", borderRadius:2, p:1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"block", mb:0.75 }}>
                      Note
                    </Typography>
                    <Typography variant="body2" sx={{ color:"text.secondary", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                      {detail.notes}
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <Typography variant="body2" sx={{ opacity:0.7 }}>Nessun dettaglio disponibile.</Typography>
            )}
          </Box>
        </Stack>
      </Drawer>

      <ConfirmActionDialog
        open={bulkRestoreDlgOpen}
        busy={restoreBusy}
        title="Ripristinare i contatti selezionati?"
        description={`Verranno ripristinati ${selectedCount} contatti dal cestino.`}
        confirmText="Ripristina"
        confirmColor="success"
        onClose={() => setBulkRestoreDlgOpen(false)}
        onConfirm={async () => {
          const ok = await doBulkRestore();
          if (ok) setBulkRestoreDlgOpen(false);
        }}
      />

      <ConfirmDeleteDialog
        open={deleteDlgOpen}
        busy={deleteBusy}
        title="Confermi eliminazione contatto?"
        description="Il contatto verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />

      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {dlgMode === "create" ? "Nuovo contatto" : "Modifica contatto"}
        </DialogTitle>
        <DialogContent>
          {dlgErrors._error ? (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              {dlgErrors._error}
            </Typography>
          ) : null}
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth error={Boolean(dlgErrors.customer)}>
              <InputLabel>Cliente</InputLabel>
              <Select
                label="Cliente"
                value={form.customer}
                onChange={async (e) => {
                  const v = asId(e.target.value);
                  setForm((f) => ({ ...f, customer: v, site: "" }));
                  await loadSitesForCustomer(v);
                }}
              >
                <MenuItem value="">Seleziona…</MenuItem>
                {customers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.display_name || c.name || c.code || `Cliente #${c.id}`}
                  </MenuItem>
                ))}
              </Select>
              {dlgErrors.customer ? <FormHelperText>{dlgErrors.customer}</FormHelperText> : null}
            </FormControl>

            <FormControl size="small" fullWidth disabled={form.customer === ""} error={Boolean(dlgErrors.site)}>
              <InputLabel>Sito</InputLabel>
              <Select
                label="Sito"
                value={form.site}
                onChange={(e) => setForm((f) => ({ ...f, site: asId(e.target.value) }))}
              >
                <MenuItem value="">(nessuno)</MenuItem>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.display_name || s.name}
                  </MenuItem>
                ))}
              </Select>
              {dlgErrors.site ? <FormHelperText>{dlgErrors.site}</FormHelperText> : null}
            </FormControl>

            <TextField
              size="small"
              label="Nome"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={Boolean(dlgErrors.name)}
              helperText={dlgErrors.name || ""}
              fullWidth
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                size="small"
                label="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                error={Boolean(dlgErrors.email)}
                helperText={dlgErrors.email || ""}
                fullWidth
              />
              <TextField
                size="small"
                label="Telefono"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                error={Boolean(dlgErrors.phone)}
                helperText={dlgErrors.phone || ""}
                fullWidth
              />
            </Stack>

            <TextField
              size="small"
              label="Reparto"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              error={Boolean(dlgErrors.department)}
              helperText={dlgErrors.department || ""}
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={form.is_primary}
                  onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                />
              }
              label="Contatto primario"
            />
            {dlgErrors.is_primary ? (
              <Typography variant="caption" color="error">
                {dlgErrors.is_primary}
              </Typography>
            ) : null}

            <TextField
              size="small"
              label="Note"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              error={Boolean(dlgErrors.notes)}
              helperText={dlgErrors.notes || ""}
              fullWidth
              multiline
              minRows={4}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDlgOpen(false)} disabled={dlgSaving}>
            Annulla
          </Button>
          <Button variant="contained" onClick={save} disabled={dlgSaving}>
            {dlgSaving ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
