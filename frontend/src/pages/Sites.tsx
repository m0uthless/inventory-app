import * as React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import CloseIcon from "@mui/icons-material/Close";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";

import { useLocation, useNavigate } from "react-router-dom";
import { useServerGrid } from "../hooks/useServerGrid";
import { useUrlNumberParam } from "../hooks/useUrlParam";
import { api } from "../api/client";
import { buildDrfListParams, includeDeletedParams } from "../api/drf";
import type { ApiPage } from "../api/drf";
import { useDrfList } from "../hooks/useDrfList";
import { useToast } from "../ui/toast";
import { useAuth } from "../auth/AuthProvider";
import { Can } from "../auth/Can";
import { apiErrorToFieldErrors, apiErrorToMessage } from "../api/error";
import { buildQuery } from "../utils/nav";
import { emptySelectionModel, selectionSize, selectionToNumberIds } from "../utils/gridSelection";
import ConfirmDeleteDialog from "../ui/ConfirmDeleteDialog";
import ConfirmActionDialog from "../ui/ConfirmActionDialog";
import { PERMS } from "../auth/perms";
import EntityListCard from "../ui/EntityListCard";
import StatusChip from "../ui/StatusChip";
import FilterChip from "../ui/FilterChip";
import CustomFieldsEditor from "../ui/CustomFieldsEditor";
import LeafletMap from "../ui/LeafletMap";

type LookupItem = { id: number; label: string; key?: string };

type CustomerItem = {
  id: number;
  code?: string;
  name?: string;
  display_name?: string | null;
};

type SiteRow = {
  id: number;
  name: string;
  display_name?: string | null;

  customer?: number | null;
  customer_code?: string | null;
  customer_name?: string | null;
  customer_display_name?: string | null;

  status?: number | null;
  status_label?: string | null;

  city?: string | null;
  postal_code?: string | null;
  address_line1?: string | null;

  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type SiteDetail = SiteRow & {
  province?: string | null;
  country?: string | null;
  custom_fields?: Record<string, any> | null;
  deleted_at?: string | null;
};

type SiteForm = {
  customer: number | "";
  status: number | "";
  name: string;
  display_name: string;
  address_line1: string;
  city: string;
  postal_code: string;
  province: string;
  country: string;
  custom_fields: Record<string, any>;
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


type ContactMini = {
  id: number;
  customer?: number;
  site?: number | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  is_primary?: boolean | null;
  deleted_at?: string | null;
};

type InventoryMini = {
  id: number;
  customer: number;
  site?: number | null;
  hostname?: string | null;
  knumber?: string | null;
  serial_number?: string | null;
  type_label?: string | null;
  status_label?: string | null;
  deleted_at?: string | null;
};

function viewQuery(includeDeleted: boolean, onlyDeleted: boolean) {
  if (onlyDeleted) return { view: "deleted" };
  if (includeDeleted) return { view: "all" };
  return {};
}

function SiteContactsTab(props: { customerId: number; siteId: number; includeDeleted: boolean; onlyDeleted: boolean; onCount?: (n: number) => void }) {
  const { customerId, siteId, includeDeleted, onlyDeleted, onCount } = props;
  const toast = useToast();
  const navigate = useNavigate();

  const params = React.useMemo(
    () =>
      buildDrfListParams({
        page0: 0,
        pageSize: 25,
        ordering: '-is_primary,name',
        includeDeleted,
        onlyDeleted,
        extra: { customer: customerId, site: siteId },
      }),
    [customerId, siteId, includeDeleted, onlyDeleted]
  );

  const { rows, rowCount, loading } = useDrfList<ContactMini>('/contacts/', params, (e: unknown) =>
    toast.error(apiErrorToMessage(e))
  );
  React.useEffect(() => { onCount?.(rowCount); }, [rowCount, onCount]);

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Contatti
          </Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        <Button
          size="small"
          variant="outlined"
          onClick={() =>
            navigate(
              `/contacts${buildQuery({ customer: customerId, site: siteId, ...viewQuery(includeDeleted, onlyDeleted) })}`
            )
          }
        >
          Apri lista
        </Button>
      </Stack>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Caricamento…
          </Typography>
        </Stack>
      ) : rows.length ? (
        <List dense disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          {rows.map((c, idx) => {
            const label = c.name || c.email || c.phone || `Contatto #${c.id}`;
            const secParts = [c.email || '', c.phone || '', c.department || ''].filter(Boolean);
            const secondary = secParts.length ? secParts.join(' • ') : undefined;
            const q = {
              open: c.id,
              customer: customerId,
              site: siteId,
              ...(c.deleted_at ? { view: "all" } : viewQuery(includeDeleted, onlyDeleted)),
            };
            return (
              <ListItem key={c.id} disablePadding divider={idx < rows.length - 1}>
                <ListItemButton
                  onClick={() => navigate(`/contacts${buildQuery(q)}`)}
                sx={{
                  py: 1,
                  ...(c.deleted_at
                    ? { opacity: 0.65, textDecoration: 'line-through' as const }
                    : null),
                }}
              >
                <ListItemText
                  primary={
                    <span>
                      {label}
                      {c.is_primary ? '  ★' : ''}
                    </span>
                  }
                  secondary={secondary}
                  primaryTypographyProps={{ noWrap: true, sx: { fontWeight: 600 } }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
                {c.deleted_at ? <Chip size="small" color="error" label="Eliminato" /> : null}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          —
        </Typography>
      )}
    </Stack>
  );
}

function SiteInventoriesTab(props: { customerId: number; siteId: number; includeDeleted: boolean; onlyDeleted: boolean; onCount?: (n: number) => void }) {
  const { customerId, siteId, includeDeleted, onlyDeleted, onCount } = props;
  const toast = useToast();
  const navigate = useNavigate();

  const params = React.useMemo(
    () =>
      buildDrfListParams({
        page0: 0,
        pageSize: 25,
        ordering: 'hostname',
        includeDeleted,
        onlyDeleted,
        extra: { customer: customerId, site: siteId },
      }),
    [customerId, siteId, includeDeleted, onlyDeleted]
  );

  const { rows, rowCount, loading } = useDrfList<InventoryMini>('/inventories/', params, (e: unknown) =>
    toast.error(apiErrorToMessage(e))
  );
  React.useEffect(() => { onCount?.(rowCount); }, [rowCount, onCount]);

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Inventari
          </Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        <Button
          size="small"
          variant="outlined"
          onClick={() =>
            navigate(
              `/inventory${buildQuery({ customer: customerId, site: siteId, ...viewQuery(includeDeleted, onlyDeleted) })}`
            )
          }
        >
          Apri lista
        </Button>
      </Stack>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Caricamento…
          </Typography>
        </Stack>
      ) : rows.length ? (
        <List dense disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          {rows.map((inv, idx) => {
            const primary = inv.hostname || inv.knumber || inv.serial_number || `Inventario #${inv.id}`;
            const secParts = [inv.type_label || '', inv.status_label || ''].filter(Boolean);
            const secondary = secParts.length ? secParts.join(' • ') : undefined;
            const q = {
              open: inv.id,
              customer: customerId,
              site: siteId,
              ...(inv.deleted_at ? { view: "all" } : viewQuery(includeDeleted, onlyDeleted)),
            };
            return (
              <ListItem key={inv.id} disablePadding divider={idx < rows.length - 1}>
                <ListItemButton
                  onClick={() => navigate(`/inventory${buildQuery(q)}`)}
                sx={{
                  py: 1,
                  ...(inv.deleted_at
                    ? { opacity: 0.65, textDecoration: 'line-through' as const }
                    : null),
                }}
              >
                <ListItemText
                  primary={primary}
                  secondary={secondary}
                  primaryTypographyProps={{ noWrap: true, sx: { fontWeight: 600 } }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
                {inv.deleted_at ? <Chip size="small" color="error" label="Eliminato" /> : null}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          —
        </Typography>
      )}
    </Stack>
  );
}


const cols: GridColDef<SiteRow>[] = [
  {
    field: "display_name",
    headerName: "Sito",
    flex: 1,
    minWidth: 280,
    valueGetter: (v, row) => {
      void v;
      return row.display_name || row.name || "—";
    },
  },
  {
    field: "customer_display_name",
    headerName: "Cliente",
    width: 220,
    valueGetter: (v, row) => {
      void v;
      return row.customer_display_name || row.customer_name || row.customer_code || "—";
    },
  },
  { field: "city", headerName: "Città", width: 160 },
  { field: "postal_code", headerName: "CAP", width: 120 },
  {
    field: "status_label",
    headerName: "Stato",
    width: 170,
    renderCell: (p) => <StatusChip statusId={(p.row as any).status} label={(p.value as string) || "—"} />,
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

export default function Sites() {
  const { hasPerm } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const loc = useLocation();
  const grid = useServerGrid({
    defaultOrdering: "display_name",
    allowedOrderingFields: ["display_name", "customer_display_name", "city", "postal_code", "status_label", "deleted_at"],
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
      return { title: "Cestino vuoto", subtitle: "Non ci sono siti eliminati." };
    }
    if (!grid.search.trim()) {
      return { title: "Nessun sito", subtitle: "Crea un nuovo sito o cambia i filtri." , action: (
        <Can perm={PERMS.crm.site.add}>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } } )}>
            Crea sito
          </Button>
        </Can>
      ) };

    }
    return { title: "Nessun risultato", subtitle: "Prova a cambiare ricerca o filtri." };
  }, [grid.view, grid.search]);


  // filters (URL)
  const [customerId, setCustomerId] = useUrlNumberParam("customer");

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: { display_name: 'name', customer_display_name: 'customer__name', status_label: 'status__label' },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(customerId !== "" ? { customer: customerId } : {}),
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
    ]
  );

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<SiteRow>(
    "/sites/",
    listParams,
    (e: unknown) => toast.error(apiErrorToMessage(e))
  );

  // lookups
  const [customers, setCustomers] = React.useState<CustomerItem[]>([]);
  const [statuses, setStatuses] = React.useState<LookupItem[]>([]);

  // drawer
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<SiteDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState(0);
  const [invCount,  setInvCount]  = React.useState<number | null>(null);
  const [contactCount, setContactCount] = React.useState<number | null>(null);

  // Address for map
  const siteAddress = React.useMemo(() => {
    if (!detail) return null;
    const parts = [detail.address_line1?.trim(), detail.city?.trim()].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }, [detail]);

  // Fetch counts when detail loads
  React.useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    setInvCount(null); setContactCount(null);
    Promise.all([
      api.get("/inventories/", { params: { site: detail.id, page_size: 1 } }),
      api.get("/contacts/",    { params: { site: detail.id, page_size: 1 } }),
    ]).then(([invRes, ctRes]) => {
      if (cancelled) return;
      setInvCount(Number(invRes.data?.count ?? 0));
      setContactCount(Number(ctRes.data?.count ?? 0));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [detail]);

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
  const [form, setForm] = React.useState<SiteForm>({
    customer: "",
    status: "",
    name: "",
    display_name: "",
    address_line1: "",
    city: "",
    postal_code: "",
    province: "",
    country: "IT",
    custom_fields: {},
    notes: "",
  });

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CustomerItem>>("/customers/", { params: { page_size: 500, ordering: "name" } });
      setCustomers(res.data.results ?? []);
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    }
  }, [toast]);

  const loadStatuses = React.useCallback(async () => {
    try {
      const res = await api.get<LookupItem[]>("/site-statuses/");
      setStatuses((res.data ?? []).slice().sort((a, b) => a.label.localeCompare(b.label)));
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    }
  }, [toast]);

  const loadDetail = React.useCallback(
    async (id: number, forceIncludeDeleted?: boolean) => {
      setDetailLoading(true);
      setDetail(null);
      try {
        const inc = forceIncludeDeleted ?? grid.includeDeleted;
        const incParams = includeDeletedParams(inc);
        const res = await api.get<SiteDetail>(`/sites/${id}/`, incParams ? { params: incParams } : undefined);
        setDetail(res.data);
      } catch (e) {
        toast.error(apiErrorToMessage(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [toast, grid.includeDeleted]
  );

  // If opened from global Search, we can return back to the Search results on close.
  const returnTo = React.useMemo(() => {
    return new URLSearchParams(loc.search).get("return");
  }, [loc.search]);

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
    setInvCount(null); setContactCount(null);
    grid.setOpenId(null);
    if (returnTo) navigate(returnTo, { replace: true });
  }, [grid, returnTo, navigate]);

  const doDelete = React.useCallback(async () => {
    if (!selectedId) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/sites/${selectedId}/`);
      toast.success("Sito eliminato ✅");
      setDeleteDlgOpen(false);
      closeDrawer();
      grid.setViewMode("all", { keepOpen: true });
      // list will refresh automatically via URL change
      reloadList();
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }, [selectedId, toast, closeDrawer, grid, reloadList]);

  const doBulkRestore = async (): Promise<boolean> => {
  const ids = selectedIds.filter((n) => Number.isFinite(n));
  if (!ids.length) return false;
  setRestoreBusy(true);
  try {
    await api.post(`/sites/bulk_restore/`, { ids });
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
      await api.post(`/sites/${selectedId}/restore/`);
      toast.success("Sito ripristinato ✅");
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
    loadStatuses();
  }, [loadCustomers, loadStatuses]);

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
    setDrawerTab(0);
    loadDetail(id);
  }, [grid.openId, loadDetail]);

  const openDrawer = (id: number) => {
    setSelectedId(id);
    setDrawerOpen(true);
    setDrawerTab(0);
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
      await api.post(`/sites/${id}/restore/`);
      toast.success("Sito ripristinato ✅");
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
  }, [detail]);

  const columns = React.useMemo<GridColDef<SiteRow>[]>(() => {
    const actionsCol: GridColDef<SiteRow> = {
      field: "__row_actions",
      headerName: "",
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => {
        const r = p.row as SiteRow;
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

            <Can perm={PERMS.crm.site.change}>
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

  const openCreateOnceRef = React.useRef(false);

  const openCreate = () => {
    setDlgMode("create");
    setDlgId(null);
    setDlgErrors({});
    setForm({
      customer: customerId !== "" ? customerId : "",
      status: "",
      name: "",
      display_name: "",
      address_line1: "",
      city: "",
      postal_code: "",
      province: "",
      country: "IT",
      custom_fields: {},
      notes: "",
    });
    setDlgOpen(true);
  };

  React.useEffect(() => {
    const st: any = (loc as any).state;
    if (!st?.openCreate || openCreateOnceRef.current) return;
    openCreateOnceRef.current = true;
    openCreate();
    navigate(loc.pathname + loc.search, { replace: true, state: {} });
  }, [loc, navigate]);

  const openEdit = () => {
    if (!detail) return;
    setDlgMode("edit");
    setDlgId(detail.id);
    setDlgErrors({});
    setForm({
      customer: (detail.customer ?? "") as any,
      status: (detail.status ?? "") as any,
      name: detail.name ?? "",
      display_name: detail.display_name ?? "",
      address_line1: detail.address_line1 ?? "",
      city: detail.city ?? "",
      postal_code: detail.postal_code ?? "",
      province: detail.province ?? "",
      country: detail.country ?? "IT",
      custom_fields: (detail.custom_fields as any) ?? {},
      notes: detail.notes ?? "",
    });
    setDlgOpen(true);
  };

  const save = async () => {
    setDlgErrors({});
    if (form.customer === "" || form.status === "" || !String(form.name).trim()) {
      toast.warning("Compila almeno Cliente, Stato e Nome.");
      return;
    }

    const payload: any = {
      customer: Number(form.customer),
      status: Number(form.status),
      name: form.name.trim(),
      display_name: (form.display_name || "").trim() || form.name.trim(),
      address_line1: (form.address_line1 || "").trim() || null,
      city: (form.city || "").trim() || null,
      postal_code: (form.postal_code || "").trim() || null,
      province: (form.province || "").trim() || null,
      country: (form.country || "").trim() || "IT",
      notes: (form.notes || "").trim() || null,
    };

    setDlgSaving(true);
    try {
      let id: number;
      if (dlgMode === "create") {
        const res = await api.post<SiteDetail>("/sites/", payload);
        id = res.data.id;
        toast.success("Sito creato ✅");
      } else {
        if (!dlgId) return;
        const res = await api.patch<SiteDetail>(`/sites/${dlgId}/`, payload);
        id = res.data.id;
        toast.success("Sito aggiornato ✅");
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

  const customerLabel = (s: SiteDetail | null) =>
    s?.customer_display_name || s?.customer_name || s?.customer_code || "";

  return (
    <Stack spacing={2}>
<Box>
  <Typography variant="h5">
    Siti
  </Typography>
  <Typography variant="body2" sx={{ opacity: 0.7 }}>
    Lista di tutti i multi-site legati a un cliente.
  </Typography>
</Box>
      <EntityListCard
        toolbar={{
          q: grid.q,
          onQChange: grid.setQ,
          viewMode: grid.view,
          onViewModeChange: (v) => grid.setViewMode(v, { keepOpen: true }),
          onReset: () => grid.reset(["customer"]),
          rightActions: (
            <Can perm={PERMS.crm.site.change}>
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

          createButton: hasPerm(PERMS.crm.site.add) ? (
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
          activeCount={customerId !== "" ? 1 : 0}
          onReset={() => {
            setCustomerId("", { patch: { search: grid.q, page: 1 }, keepOpen: true });
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
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}>
            <Box sx={{ position:"absolute", top:-44, right:-44, width:130, height:130, borderRadius:"50%", bgcolor:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />
            <Box sx={{ position:"absolute", bottom:-26, left:52, width:90, height:90, borderRadius:"50%", bgcolor:"rgba(255,255,255,0.04)", pointerEvents:"none" }} />

            {/* row 1: status + actions */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, position:"relative", zIndex:2 }}>
              <Chip
                size="small"
                label={`● ${detail?.status_label ?? "—"}`}
                sx={{ bgcolor:"rgba(20,255,180,0.18)", color:"#a7f3d0", fontWeight:700, fontSize:10, letterSpacing:"0.07em", border:"1px solid rgba(167,243,208,0.3)", height:22 }}
              />
              <Stack direction="row" spacing={0.75}>
                <Can perm={PERMS.crm.site.change}>
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
                <Can perm={PERMS.crm.site.delete}>
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

            {/* row 2: name + city */}
            <Box sx={{ position:"relative", zIndex:1 }}>
              {detail?.deleted_at && <Chip size="small" color="error" label="Eliminato" sx={{ mb:0.75, height:20, fontSize:10 }} />}
              <Typography sx={{ color:"#fff", fontSize:26, fontWeight:900, letterSpacing:"-0.025em", lineHeight:1.1, mb:0.5 }}>
                {detail?.display_name || detail?.name || (selectedId ? `Sito #${selectedId}` : "Sito")}
              </Typography>
              {detail?.city && (
                <Typography variant="body2" sx={{ color:"rgba(255,255,255,0.58)" }}>
                  📍 {detail.city}{detail.postal_code ? ` ${detail.postal_code}` : ""}
                </Typography>
              )}
            </Box>

          </Box>

          {/* ── TABS ── */}
          {detailLoading ? <LinearProgress sx={{ height:2 }} /> : null}
          <Box sx={{ borderBottom:"1px solid", borderColor:"divider", px:2.5 }}>
            <Tabs value={drawerTab} onChange={(_, v) => setDrawerTab(v)}>
              <Tab label="Dettagli"  sx={{ fontSize:13, minWidth:0, px:1.5 }} />
              <Tab label={contactCount != null ? `Contatti (${contactCount})` : "Contatti"} sx={{ fontSize:13, minWidth:0, px:1.5 }} />
              <Tab label={invCount    != null ? `Inventari (${invCount})`    : "Inventari"} sx={{ fontSize:13, minWidth:0, px:1.5 }} />
            </Tabs>
          </Box>

          {/* ── SCROLLABLE CONTENT ── */}
          <Box sx={{ flex:1, overflowY:"auto", px:2.5, py:2, display:"flex", flexDirection:"column", gap:1.5 }}>

          {detailLoading ? (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py:2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ opacity:0.7 }}>Caricamento…</Typography>
            </Stack>
          ) : detail ? (
            <>
              {/* TAB 0 — Dettagli */}
              {drawerTab === 0 && (
                <>
                  {/* Contact card */}
                  <Box sx={{ bgcolor:"#f8fafc", border:"1px solid", borderColor:"grey.200", borderRadius:2, p:1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:1 }}>
                      <BusinessOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                      Identificazione
                    </Typography>
                    <Stack spacing={0.5}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="caption" sx={{ color:"text.disabled" }}>Nome</Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight:600 }}>{detail.name || "—"}</Typography>
                          {detail.name && (
                            <Tooltip title="Copia"><IconButton size="small" onClick={async () => { await copyToClipboard(detail.name); toast.success("Copiato ✅"); }}>
                              <ContentCopyIcon sx={{ fontSize:13 }} />
                            </IconButton></Tooltip>
                          )}
                        </Stack>
                      </Stack>
                      {detail.display_name && detail.display_name !== detail.name && (
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color:"text.disabled" }}>Nome visualizzato</Typography>
                          <Typography variant="body2" sx={{ fontWeight:600 }}>{detail.display_name}</Typography>
                        </Stack>
                      )}
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="caption" sx={{ color:"text.disabled" }}>Cliente</Typography>
                        <Typography variant="body2" sx={{ fontWeight:600 }}>{customerLabel(detail) || "—"}</Typography>
                      </Stack>
                    </Stack>
                  </Box>

                  {/* Indirizzo + mappa */}
                  {siteAddress && (
                    <Box sx={{ bgcolor:"#fff", borderRadius:2, border:"1px solid", borderColor:"grey.200", overflow:"hidden" }}>
                      <Box sx={{ px:1.75, pt:1.5, pb:1.25 }}>
                        <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:0.5 }}>
                          <LocationOnOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                          Indirizzo
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight:600, color:"text.primary" }}>{siteAddress}</Typography>
                      </Box>
                      <Box sx={{ borderTop:"1px solid", borderColor:"grey.100" }}>
                        <LeafletMap address={siteAddress} height={320} zoom={15} />
                      </Box>
                    </Box>
                  )}

                  {/* Note */}
                  {detail.notes && (
                    <Box sx={{ bgcolor:"#fafafa", border:"1px solid", borderColor:"grey.100", borderRadius:2, p:1.75 }}>
                      <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:0.75 }}>
                        <NotesOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                        Note
                      </Typography>
                      <Typography variant="body2" sx={{ color:"text.secondary", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                        {detail.notes}
                      </Typography>
                    </Box>
                  )}
                </>
              )}

              {/* TAB 1 — Contatti */}
              {drawerTab === 1 && (
                <SiteContactsTab
                  customerId={detail.customer ?? 0}
                  siteId={detail.id}
                  includeDeleted={grid.includeDeleted}
                  onlyDeleted={grid.onlyDeleted}
                  onCount={setContactCount}
                />
              )}

              {/* TAB 2 — Inventari */}
              {drawerTab === 2 && (
                <SiteInventoriesTab
                  customerId={detail.customer ?? 0}
                  siteId={detail.id}
                  includeDeleted={grid.includeDeleted}
                  onlyDeleted={grid.onlyDeleted}
                  onCount={setInvCount}
                />
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
        title="Ripristinare i siti selezionati?"
        description={`Verranno ripristinati ${selectedCount} siti dal cestino.`}
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
        title="Confermi eliminazione?"
        description="Il sito verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />



      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dlgMode === "create" ? "Nuovo sito" : "Modifica sito"}</DialogTitle>
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
                onChange={(e) => setForm((f) => ({ ...f, customer: asId(e.target.value) }))}
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

            <FormControl size="small" fullWidth error={Boolean(dlgErrors.status)}>
              <InputLabel>Stato</InputLabel>
              <Select
                label="Stato"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: asId(e.target.value) }))}
              >
                <MenuItem value="">Seleziona…</MenuItem>
                {statuses.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
              {dlgErrors.status ? <FormHelperText>{dlgErrors.status}</FormHelperText> : null}
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
            <TextField
              size="small"
              label="Nome visualizzato"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              error={Boolean(dlgErrors.display_name)}
              helperText={dlgErrors.display_name || "Se vuoto, verrà usato Nome."}
              fullWidth
            />

            <TextField
              size="small"
              label="Indirizzo"
              value={form.address_line1}
              onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
              error={Boolean(dlgErrors.address_line1)}
              helperText={dlgErrors.address_line1 || ""}
              fullWidth
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                size="small"
                label="Città"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                error={Boolean(dlgErrors.city)}
                helperText={dlgErrors.city || ""}
                fullWidth
              />
              <TextField
                size="small"
                label="CAP"
                value={form.postal_code}
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                error={Boolean(dlgErrors.postal_code)}
                helperText={dlgErrors.postal_code || ""}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                size="small"
                label="Provincia"
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                error={Boolean(dlgErrors.province)}
                helperText={dlgErrors.province || ""}
                fullWidth
              />
              <TextField
                size="small"
                label="Paese"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                error={Boolean(dlgErrors.country)}
                helperText={dlgErrors.country || ""}
                fullWidth
              />
            </Stack>

            <CustomFieldsEditor
              entity="site"
              value={form.custom_fields}
              onChange={(v) => setForm((f) => ({ ...f, custom_fields: v }))}
              mode="accordion"
            />
            {dlgErrors.custom_fields ? (
              <Typography variant="caption" color="error">
                {dlgErrors.custom_fields}
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
