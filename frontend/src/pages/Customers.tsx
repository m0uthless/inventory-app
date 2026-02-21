import * as React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
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

import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Can } from "../auth/Can";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";

import { useLocation, useNavigate } from "react-router-dom";
import { useServerGrid } from "../hooks/useServerGrid";
import { useUrlNumberParam, useUrlStringParam } from "../hooks/useUrlParam";
import { api } from "../api/client";
import { buildDrfListParams, includeDeletedParams } from "../api/drf";
import { useDrfList } from "../hooks/useDrfList";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useToast } from "../ui/toast";
import { apiErrorToMessage } from "../api/error";
import { buildQuery } from "../utils/nav";
import { emptySelectionModel, selectionSize, selectionToNumberIds } from "../utils/gridSelection";
import ActionButton from "../ui/ActionButton";
import DetailDrawerHeader from "../ui/DetailDrawerHeader";
import ConfirmDeleteDialog from "../ui/ConfirmDeleteDialog";
import ConfirmActionDialog from "../ui/ConfirmActionDialog";
import { PERMS } from "../auth/perms";
import EntityListCard from "../ui/EntityListCard";
import StatusChip from "../ui/StatusChip";
import CustomFieldsEditor from "../ui/CustomFieldsEditor";
import FilterChip from "../ui/FilterChip";

type LookupItem = { id: number; label: string; key?: string };

type CustomerRow = {
  id: number;
  code: string;
  name: string;
  display_name: string;

  // Convenience/computed fields from API
  city?: string | null;
  primary_contact_id?: number | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  vat_number?: string | null;
  tax_code?: string | null;

  status?: number | null;
  status_label?: string | null;

  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type CustomerDetail = CustomerRow & {
  tags?: string[] | null;
  custom_fields?: Record<string, any> | null;
  deleted_at?: string | null;
};

type CustomerForm = {
  status: number | "";
  name: string;
  display_name: string;
  vat_number: string;
  tax_code: string;
  custom_fields: Record<string, any>;
  notes: string;
};

const asId = (v: unknown): number | "" => {
  const s = String(v);
  return s === "" ? "" : Number(s);
};

async function copyToClipboard(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function FieldRow(props: { label: string; value?: string | null; mono?: boolean }) {
  const { label, value, mono } = props;
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
    </Stack>
  );
}
type SiteMini = {
  id: number;
  name?: string | null;
  display_name?: string | null;
  city?: string | null;
  status?: number | null;
  status_label?: string | null;
  deleted_at?: string | null;
};

type InventoryMini = {
  id: number;
  customer: number;
  site?: number | null;
  hostname?: string | null;
  knumber?: string | null;
  serial_number?: string | null;
  site_name?: string | null;
  site_display_name?: string | null;
  type_label?: string | null;
  status_label?: string | null;
  deleted_at?: string | null;
};

function viewQuery(includeDeleted: boolean, onlyDeleted: boolean) {
  if (onlyDeleted) return { view: "deleted" };
  if (includeDeleted) return { view: "all" };
  return {};
}

function CustomerSitesTab(props: { customerId: number; includeDeleted: boolean; onlyDeleted: boolean }) {
  const { customerId, includeDeleted, onlyDeleted } = props;
  const toast = useToast();
  const navigate = useNavigate();

  const params = React.useMemo(
    () =>
      buildDrfListParams({
        page0: 0,
        pageSize: 25,
        ordering: 'name',
        includeDeleted,
        onlyDeleted,
        extra: { customer: customerId },
      }),
    [customerId, includeDeleted, onlyDeleted]
  );

  const { rows, rowCount, loading } = useDrfList<SiteMini>('/sites/', params, (e: unknown) =>
    toast.error(apiErrorToMessage(e))
  );

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Siti
          </Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        <ActionButton
          tone="secondary"
          onClick={() => navigate(`/sites${buildQuery({ customer: customerId, ...viewQuery(includeDeleted, onlyDeleted) })}`)}
        >
          Apri lista
        </ActionButton>
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
          {rows.map((s, idx) => {
            const label = s.display_name || s.name || `Sito #${s.id}`;
            const secParts = [s.city || '', s.status_label || ''].filter(Boolean);
            const secondary = secParts.length ? secParts.join(' • ') : undefined;
            const q = {
              open: s.id,
              customer: customerId,
              ...(s.deleted_at ? { view: "all" } : viewQuery(includeDeleted, onlyDeleted)),
            };
            return (
              <ListItem key={s.id} disablePadding divider={idx < rows.length - 1}>
                <ListItemButton
                  onClick={() => navigate(`/sites${buildQuery(q)}`)}
                sx={{
                  py: 1,
                  ...(s.deleted_at
                    ? { opacity: 0.65, textDecoration: 'line-through' as const }
                    : null),
                }}
              >
                <ListItemText
                  primary={label}
                  secondary={secondary}
                  primaryTypographyProps={{ noWrap: true, sx: { fontWeight: 600 } }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
                {s.deleted_at ? <Chip size="small" color="error" label="Eliminato" /> : null}
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

function CustomerInventoriesTab(props: { customerId: number; includeDeleted: boolean; onlyDeleted: boolean }) {
  const { customerId, includeDeleted, onlyDeleted } = props;
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
        extra: { customer: customerId },
      }),
    [customerId, includeDeleted, onlyDeleted]
  );

  const { rows, rowCount, loading } = useDrfList<InventoryMini>('/inventories/', params, (e: unknown) =>
    toast.error(apiErrorToMessage(e))
  );

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Inventari
          </Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        <ActionButton
          tone="secondary"
          onClick={() => navigate(`/inventory${buildQuery({ customer: customerId, ...viewQuery(includeDeleted, onlyDeleted) })}`)}
        >
          Apri lista
        </ActionButton>
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
            const secParts = [inv.type_label || '', inv.status_label || '', inv.site_display_name || inv.site_name || ''].filter(Boolean);
            const secondary = secParts.length ? secParts.join(' • ') : undefined;
            const q = {
              open: inv.id,
              customer: customerId,
              site: inv.site ?? '',
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

const cols: GridColDef<CustomerRow>[] = [
  { field: "display_name", headerName: "Cliente", flex: 1, minWidth: 260},
  {
    field: "status_label",
    headerName: "Stato",
    width: 170,
    renderCell: (p) => <StatusChip statusId={(p.row as any).status} label={(p.value as string) || "—"} />,
  },
  { field: "city", headerName: "Città", width: 170 },
  {
    field: "primary_contact_name",
    headerName: "Contatto primario",
    width: 230,
    renderCell: (p) => {
      const r = p.row;
      const name = r.primary_contact_name || "";
      const email = r.primary_contact_email || "";
      const phone = r.primary_contact_phone || "";
      const tooltip = [email, phone].filter(Boolean).join(" · ");
      const label = name || email || phone || "—";
      return tooltip ? (
        <Tooltip title={tooltip} arrow>
          <span>{label}</span>
        </Tooltip>
      ) : (
        <span>{label}</span>
      );
    },
  },
  { field: "vat_number", headerName: "P.IVA", width: 160 },
  { field: "tax_code", headerName: "Codice fiscale", width: 170 },
  {
    field: "deleted_at",
    headerName: "Eliminato il",
    width: 190,
    sortable: true,
    renderCell: (p) => <span>{fmtTs(p.value as any)}</span>,
  },
  // { field: "updated_at", headerName: "Aggiornato", width: 180 },
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

export default function Customers() {
  const toast = useToast();
  const navigate = useNavigate();
  const loc = useLocation();
  const grid = useServerGrid({
    defaultOrdering: "display_name",
    allowedOrderingFields: ["display_name", "status_label", "city", "primary_contact_name", "vat_number", "tax_code", "deleted_at"],
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
      return { title: "Cestino vuoto", subtitle: "Non ci sono clienti eliminati." };
    }
    if (!grid.search.trim()) {
      return { title: "Nessun cliente", subtitle: "Crea un nuovo cliente o cambia i filtri." };
    }
    return { title: "Nessun risultato", subtitle: "Prova a cambiare ricerca o filtri." };
  }, [grid.view, grid.search]);


  const [statusId, setStatusId] = useUrlNumberParam("status");
  const [city, setCity] = useUrlStringParam("city");
  const [statuses, setStatuses] = React.useState<LookupItem[]>([]);

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: { display_name: "name", status_label: "status__label" },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(statusId !== "" ? { status: statusId } : {}),
          ...(city.trim() ? { city: city.trim() } : {}),
        },
      }),
    [
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      grid.includeDeleted,
      grid.onlyDeleted,
      statusId,
      city,
    ]
  );

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<CustomerRow>(
    "/customers/",
    listParams,
    (e: unknown) => toast.error(apiErrorToMessage(e))
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState(0);

const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false);
const [deleteBusy, setDeleteBusy] = React.useState(false);
const [restoreBusy, setRestoreBusy] = React.useState(false);

  // CRUD dialog
  const [dlgOpen, setDlgOpen] = React.useState(false);
  const [dlgMode, setDlgMode] = React.useState<"create" | "edit">("create");
  const [dlgSaving, setDlgSaving] = React.useState(false);
  const [dlgId, setDlgId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<CustomerForm>({
    status: "",
    name: "",
    display_name: "",
    vat_number: "",
    tax_code: "",
    custom_fields: {},
    notes: "",
  });

  const address = React.useMemo(() => {
    const cf = detail?.custom_fields ?? null;
    if (!cf || typeof cf !== "object") return null;
    const key = Object.keys(cf).find((k) => k.trim().toLowerCase() === "indirizzo");
    if (!key) return null;
    const v = (cf as any)[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  }, [detail]);

  const loadDetail = React.useCallback(async (id: number, forceIncludeDeleted?: boolean) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const inc = forceIncludeDeleted ?? grid.includeDeleted;
      const incParams = includeDeletedParams(inc);
      const res = await api.get<CustomerDetail>(`/customers/${id}/`, incParams ? { params: incParams } : undefined);
      setDetail(res.data);
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }, [toast, grid.includeDeleted]);

  const loadStatuses = React.useCallback(async () => {
  try {
    const res = await api.get("/customer-statuses/");
    const data = res.data;

    // supporta sia array che paginato { results: [...] }
    const items = Array.isArray(data) ? data : (data.results ?? []);
    setStatuses(items);
  } catch (e) {
    toast.error(apiErrorToMessage(e));
  }
}, [toast]);


  React.useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

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

  // Row hover actions helpers — DEVONO stare dentro il componente (Rules of Hooks)
  const pendingEditIdRef = React.useRef<number | null>(null);
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
      await api.post(`/customers/${id}/restore/`);
      toast.success("Cliente ripristinato ✅");
      reloadList();
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    } finally {
      setRestoreBusy(false);
    }
  };

  // Quando il detail viene caricato a seguito di un click su un'azione di riga,
  // apre il dialog di modifica o eliminazione appropriato.
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

const columns = React.useMemo<GridColDef<CustomerRow>[]>(() => {
  const actionsCol: GridColDef<CustomerRow> = {
    field: "__row_actions",
    headerName: "",
    width: 120,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    align: "right",
    headerAlign: "right",
    renderCell: (p) => {
      const r = p.row as CustomerRow;
      const isDeleted = Boolean(r.deleted_at);
      return (
        <Box
          className="row-actions"
          onClick={(e) => e.stopPropagation()}
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "flex-end",
            gap: 0.25,
          }}
        >
          <Tooltip title="Apri" arrow>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDrawer(r.id); }}>
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Can perm={PERMS.crm.customer.change}>
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

  // keep original columns + add actions at the end
  return [...cols, actionsCol];
}, [openDrawer, restoreBusy, deleteBusy, grid.view]);


  const closeDrawer = () => {
    setDrawerOpen(false);
    grid.setOpenId(null);
  };

  const openCreateOnceRef = React.useRef(false);

  const openCreate = () => {
    setDlgMode("create");
    setDlgId(null);
    setForm({ status: "", name: "", display_name: "", vat_number: "", tax_code: "", custom_fields: {}, notes: "" });
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
    setForm({
      status: (detail.status ?? "") as any,
      name: detail.name ?? "",
      display_name: detail.display_name ?? "",
      vat_number: detail.vat_number ?? "",
      tax_code: detail.tax_code ?? "",
      custom_fields: (detail.custom_fields as any) ?? {},
      notes: detail.notes ?? "",
    });
    setDlgOpen(true);
  };

  const save = async () => {
    if (form.status === "" || !String(form.name).trim()) {
      toast.warning("Compila almeno Status e Name.");
      return;
    }

    const payload: any = {
      status: Number(form.status),
      name: form.name.trim(),
      display_name: (form.display_name || "").trim() || form.name.trim(),
      vat_number: (form.vat_number || "").trim() || null,
      tax_code: (form.tax_code || "").trim() || null,
      custom_fields: form.custom_fields && Object.keys(form.custom_fields).length ? form.custom_fields : null,
      notes: (form.notes || "").trim() || null,
    };

    setDlgSaving(true);
    try {
      let id: number;
      if (dlgMode === "create") {
        const res = await api.post<CustomerDetail>("/customers/", payload);
        id = res.data.id;
        toast.success("Cliente creato ✅");
      } else {
        if (!dlgId) return;
        const res = await api.patch<CustomerDetail>(`/customers/${dlgId}/`, payload);
        id = res.data.id;
        toast.success("Cliente aggiornato ✅");
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
const doDelete = async () => {
  if (!detail) return;
  setDeleteBusy(true);
  try {
    await api.delete(`/customers/${detail.id}/`);
    toast.success("Cliente eliminato ✅");

    // per poterlo vedere subito nel drawer dopo il delete:
    grid.setViewMode("all", { keepOpen: true });
    await loadDetail(detail.id, true);
  } catch (e) {
    toast.error(apiErrorToMessage(e));
  } finally {
    setDeleteBusy(false);
    setDeleteDlgOpen(false);
  }
};

const doBulkRestore = async (): Promise<boolean> => {
  const ids = selectedIds.filter((n) => Number.isFinite(n));
  if (!ids.length) return false;
  setRestoreBusy(true);
  try {
    await api.post(`/customers/bulk_restore/`, { ids });
    toast.success(`Ripristinati ${ids.length} elementi ✅`);
    setSelectionModel(emptySelectionModel());
    reloadList();
    return true;
  } catch (e) {
    toast.error(apiErrorToMessage(e));
  } finally {
    setRestoreBusy(false);
  }
  return false;
};

const doRestore = async () => {
  if (!detail) return;
  setRestoreBusy(true);
  try {
    await api.post(`/customers/${detail.id}/restore/`);
    toast.success("Cliente ripristinato ✅");
    reloadList();
    await loadDetail(detail.id);
  } catch (e) {
    toast.error(apiErrorToMessage(e));
  } finally {
    setRestoreBusy(false);
  }
};


  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">
          Clienti
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
          onReset: () => grid.reset(["status", "city"]),
          rightActions: (
            <Can perm={PERMS.crm.customer.change}>
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
          createButton: (
            <Can perm={PERMS.crm.customer.add}>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreate}
                sx={{ width: { xs: "100%", md: "auto" } }}
              >
                Nuovo
              </Button>
            </Can>
          ),
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

          sx: {
            // compact-ish density + zebra soft (no prop changes needed)
            "--DataGrid-rowHeight": "36px",
            "--DataGrid-headerHeight": "44px",
            "& .MuiDataGrid-cell": { py: 0.25 },
            "& .MuiDataGrid-columnHeader": { py: 0.75 },
            "& .MuiDataGrid-row:nth-of-type(even)": { backgroundColor: "rgba(69,127,121,0.03)" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(69,127,121,0.06)" },
            "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "rgba(69,127,121,0.10) !important" },
            "& .MuiDataGrid-row.Mui-selected:hover": { backgroundColor: "rgba(69,127,121,0.14) !important" },
            // hover actions: visible ONLY when hovering the row with mouse
            "& .row-actions": { opacity: 0, pointerEvents: "none", transition: "opacity 140ms ease" },
            "& .MuiDataGrid-row:hover .row-actions": { opacity: 1, pointerEvents: "auto" },
          } as any,
        }}
      >
        <FilterChip
          activeCount={(statusId !== "" ? 1 : 0) + (city.trim() ? 1 : 0)}
          onReset={() => {
            setStatusId("", { patch: { search: grid.q, page: 1 }, keepOpen: true });
            setCity("", { patch: { search: grid.q, page: 1 }, keepOpen: true });
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel>Stato</InputLabel>
            <Select
              label="Stato"
              value={statusId === "" ? "" : String(statusId)}
              onChange={(e: SelectChangeEvent) => {
                const v = asId(e.target.value);
                setStatusId(v, { patch: { search: grid.q, page: 1 }, keepOpen: true });
              }}
            >
              <MenuItem value="">Tutti</MenuItem>
              {statuses.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Città"
            value={city}
            onChange={(e) =>
              setCity(e.target.value, { patch: { search: grid.q, page: 1 }, keepOpen: true })
            }
            fullWidth
          />
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
            title={detail?.display_name || (selectedId ? `Cliente #${selectedId}` : "Cliente")}
            subtitle={detail?.code ? detail.code : undefined}
            onClose={closeDrawer}
            divider={false}
            actions={
              <>
                <Can perm={PERMS.crm.customer.change}>
                  {detail?.deleted_at ? (
                    <Tooltip title="Ripristina">
                      <span>
                        <IconButton onClick={doRestore} disabled={!detail || restoreBusy}>
                          <RestoreFromTrashIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null}
                </Can>

                <Can perm={PERMS.crm.customer.change}>
                  <Tooltip title="Modifica">
                    <span>
                      <IconButton onClick={openEdit} disabled={!detail || Boolean(detail?.deleted_at)}>
                        <EditIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Can>

                <Can perm={PERMS.crm.customer.delete}>
                  {!detail?.deleted_at ? (
                    <Tooltip title="Elimina">
                      <span>
                        <IconButton onClick={() => setDeleteDlgOpen(true)} disabled={!detail || deleteBusy}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null}
                </Can>
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
                {detail.deleted_at ? <Chip size="small" color="error" label="Eliminato" /> : null}
                {detail.vat_number ? <Chip size="small" label={`P.IVA: ${detail.vat_number}`} /> : null}
                {detail.tax_code ? <Chip size="small" label={`CF: ${detail.tax_code}`} /> : null}
              </Stack>

              <Tabs
                value={drawerTab}
                onChange={(_, v) => setDrawerTab(v)}
                variant="fullWidth"
                sx={{ mt: 0.5 }}
              >
                <Tab label="Dettagli" />
                <Tab label="Siti" />
                <Tab label="Inventari" />
              </Tabs>

              <Box sx={{ display: drawerTab === 0 ? "block" : "none" }}>
                <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Dettagli
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center">
                <FieldRow label="Codice" value={detail.code} mono />
                <Tooltip title="Copia">
                  <IconButton
                    size="small"
                    onClick={async () => {
                      await copyToClipboard(detail.code);
                      toast.success("Copiato ✅");
                    }}
                  >
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <FieldRow label="Nome" value={detail.name} />
              <FieldRow label="Nome visualizzato" value={detail.display_name} />
              {detail.deleted_at ? <FieldRow label="Eliminato il" value={detail.deleted_at} mono /> : null}
              <FieldRow label="P.IVA" value={detail.vat_number ?? ""} mono />
              <FieldRow label="Codice fiscale" value={detail.tax_code ?? ""} mono />

              {detail.custom_fields && Object.keys(detail.custom_fields).length > 0 ? (
                <Stack>
                  {Object.entries(detail.custom_fields).map(([k, v]) => (
                    <Stack key={k} direction="row" spacing={1} alignItems="center">
                      <FieldRow label={k} value={typeof v === "string" ? v : JSON.stringify(v)} />
                      {typeof v === "string" && v.trim() ? (
                        <Tooltip title="Copia">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              await copyToClipboard(v);
                              toast.success("Copiato ✅");
                            }}
                          >
                            <ContentCopyIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  —
                </Typography>
              )}

              {/* Google Maps if custom field "Indirizzo" exists */}
              {address ? (
                <>
                  
                  
                  <Box
                    sx={{
                      borderRadius: 2,
                      overflow: "hidden",
                      border: "1px solid",
                      borderColor: "divider",
                      height: 260,
                    }}
                  >
                    <iframe
                      title="Google Maps"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                    />
                  </Box>

                  
                </>
              ) : null}

              <Divider />

              <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Note
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {detail.notes || "—"}
              </Typography>
              </Box>

              <Box sx={{ display: drawerTab === 1 ? "block" : "none" }}>
                <CustomerSitesTab customerId={detail.id} includeDeleted={grid.includeDeleted} onlyDeleted={grid.onlyDeleted} />
              </Box>

              <Box sx={{ display: drawerTab === 2 ? "block" : "none" }}>
                <CustomerInventoriesTab customerId={detail.id} includeDeleted={grid.includeDeleted} onlyDeleted={grid.onlyDeleted} />
              </Box>
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
        title="Ripristinare i clienti selezionati?"
        description={`Verranno ripristinati ${selectedCount} clienti dal cestino.`}
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
        description={
          detail?.code
            ? `Il cliente verrà spostato nel cestino e potrà essere ripristinato.\n\n${detail.code} • ${detail.display_name}`
            : "Il cliente verrà spostato nel cestino e potrà essere ripristinato."
        }
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />

      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dlgMode === "create" ? "Nuovo cliente" : "Modifica cliente"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
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
            </FormControl>

            <TextField size="small" label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} fullWidth />
            <TextField
              size="small"
              label="Nome visualizzato"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              helperText="Se vuoto, verrà usato Nome."
              fullWidth
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="P.IVA" value={form.vat_number} onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))} fullWidth />
              <TextField size="small" label="Codice fiscale" value={form.tax_code} onChange={(e) => setForm((f) => ({ ...f, tax_code: e.target.value }))} fullWidth />
            </Stack>

            <CustomFieldsEditor
              entity="customer"
              value={form.custom_fields}
              onChange={(v) => setForm((f) => ({ ...f, custom_fields: v }))}
              mode="accordion"
            />

            <TextField size="small" label="Note" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} fullWidth multiline minRows={4} />
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
