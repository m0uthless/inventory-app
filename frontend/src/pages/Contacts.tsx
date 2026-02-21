import * as React from "react";

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
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
import { apiErrorToMessage } from "../api/error";
import { useAuth } from "../auth/AuthProvider";
import { Can } from "../auth/Can";
import { buildQuery } from "../utils/nav";
import { emptySelectionModel, selectionSize, selectionToNumberIds } from "../utils/gridSelection";
import { useToast } from "../ui/toast";

import DetailDrawerHeader from "../ui/DetailDrawerHeader";
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

function FieldRow(props: {
  label: string;
  value?: string | null;
  mono?: boolean;
  onCopy?: () => void | Promise<void>;
}) {
  const { label, value, mono, onCopy } = props;
  const v = value ?? "";
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75 }}>
      <Box sx={{ width: 120, opacity: 0.7 }}>
        <Typography variant="body2">{label}</Typography>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" : undefined,
            wordBreak: "break-word",
          }}
        >
          {v || "—"}
        </Typography>
      </Box>

      {v && onCopy ? (
        <Tooltip title="Copia">
          <IconButton size="small" onClick={onCopy}>
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      ) : (
        <Box sx={{ width: 36 }} />
      )}
    </Stack>
  );
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
      return { title: "Nessun contatto", subtitle: "Crea un nuovo contatto o cambia i filtri." };
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

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
    grid.setOpenId(null);
  }, [grid]);

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
      toast.error(apiErrorToMessage(e));
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
          Filtri condivisibili via URL e drawer dettagli.
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
        PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}
      >
        <Stack sx={{ p: 2 }} spacing={1.5}>
          <DetailDrawerHeader
            title={detail?.name || (selectedId ? `Contatto #${selectedId}` : "Contatto")}
            subtitle={`${customerLabel(detail)}${siteLabel(detail) ? ` • ${siteLabel(detail)}` : ""}`}
            onClose={closeDrawer}
            actions={
              <>
                {hasPerm(PERMS.crm.contact.change) && detail?.deleted_at ? (
                  <Tooltip title="Ripristina">
                    <span>
                      <IconButton onClick={doRestore} disabled={!detail || restoreBusy}>
                        <RestoreFromTrashIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null}

                {hasPerm(PERMS.crm.contact.change) ? (
                  <Tooltip title="Modifica">
                    <span>
                      <IconButton onClick={openEdit} disabled={!detail || Boolean(detail?.deleted_at)}>
                        <EditIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null}

                {hasPerm(PERMS.crm.contact.delete) && !detail?.deleted_at ? (
                  <Tooltip title="Elimina">
                    <span>
                      <IconButton onClick={() => setDeleteDlgOpen(true)} disabled={!detail || deleteBusy}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null}
              </>
            }
          />

          {detailLoading ? (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Caricamento…
              </Typography>
            </Stack>
          ) : detail ? (
            <>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {detail.is_primary ? (
                  <Chip size="small" label="Primario" />
                ) : (
                  <Chip size="small" variant="outlined" label="Non primario" />
                )}
                {detail.department ? <Chip size="small" label={detail.department} /> : null}
              </Stack>

              {/* Deep links */}
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {detail.customer ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/customers${buildQuery({ open: detail.customer })}`)}
                  >
                    Apri cliente
                  </Button>
                ) : null}

                {detail.site ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      navigate(`/sites${buildQuery({ open: detail.site, customer: detail.customer ?? "" })}`)
                    }
                  >
                    Apri sito
                  </Button>
                ) : null}

                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    navigate(
                      `/inventory${buildQuery({
                        customer: detail.customer ?? "",
                        site: detail.site ?? "",
                      })}`
                    )
                  }
                >
                  Apri inventario
                </Button>
              </Stack>

              <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Dettagli
              </Typography>

              <FieldRow
                label="Nome"
                value={detail.name ?? ""}
                onCopy={
                  detail.name
                    ? async () => {
	                        await copyToClipboard(detail.name ?? "");
                        toast.success("Copiato ✅");
                      }
                    : undefined
                }
              />

              <FieldRow
                label="Email"
                value={detail.email ?? ""}
                mono
                onCopy={
                  detail.email
                    ? async () => {
                        await copyToClipboard(detail.email ?? "");
                        toast.success("Copiato ✅");
                      }
                    : undefined
                }
              />

              <FieldRow
                label="Telefono"
                value={detail.phone ?? ""}
                mono
                onCopy={
                  detail.phone
                    ? async () => {
                        await copyToClipboard(detail.phone ?? "");
                        toast.success("Copiato ✅");
                      }
                    : undefined
                }
              />

              <FieldRow label="Reparto" value={detail.department ?? ""} />
              <FieldRow label="Cliente" value={customerLabel(detail)} />
              <FieldRow label="Sito" value={siteLabel(detail)} />

              <Divider />

              <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Note
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {detail.notes || "—"}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Nessun dettaglio disponibile.
            </Typography>
          )}
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
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
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
            </FormControl>

            <FormControl size="small" fullWidth disabled={form.customer === ""}>
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
            </FormControl>

            <TextField
              size="small"
              label="Nome"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                size="small"
                label="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                fullWidth
              />
              <TextField
                size="small"
                label="Telefono"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                fullWidth
              />
            </Stack>

            <TextField
              size="small"
              label="Reparto"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
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

            <TextField
              size="small"
              label="Note"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
