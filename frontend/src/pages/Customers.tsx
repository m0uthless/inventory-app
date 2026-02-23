import * as React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
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
  LinearProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import CloseIcon from "@mui/icons-material/Close";

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
import { useExportCsv } from "../ui/useExportCsv";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import MonitorOutlinedIcon from "@mui/icons-material/MonitorOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import ConfirmDeleteDialog from "../ui/ConfirmDeleteDialog";
import ConfirmActionDialog from "../ui/ConfirmActionDialog";
import { PERMS } from "../auth/perms";
import EntityListCard from "../ui/EntityListCard";
import StatusChip from "../ui/StatusChip";
import CustomFieldsEditor from "../ui/CustomFieldsEditor";
import LeafletMap from "../ui/LeafletMap";
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

function CustomerSitesTab(props: { customerId: number; includeDeleted: boolean; onlyDeleted: boolean; onCount?: (n: number) => void }) {
  const { customerId, includeDeleted, onlyDeleted, onCount } = props;
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

  React.useEffect(() => { onCount?.(rowCount); }, [rowCount, onCount]);

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
        <List dense disablePadding sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
          {rows.map((s, idx) => {
            const label = s.display_name || s.name || `Sito #${s.id}`;
            const q = { open: s.id, customer: customerId, ...(s.deleted_at ? { view: "all" } : viewQuery(includeDeleted, onlyDeleted)) };
            return (
              <ListItem key={s.id} disablePadding
                sx={{ bgcolor: idx % 2 === 1 ? 'rgba(15,118,110,0.03)' : 'transparent' }}>
                <ListItemButton onClick={() => navigate(`/sites${buildQuery(q)}`)}
                  sx={{ py: 0.75, opacity: s.deleted_at ? 0.55 : 1,
                    textDecoration: s.deleted_at ? 'line-through' : 'none' }}>
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{ noWrap: true, variant: 'body2', sx: { fontWeight: 600 } }}
                  />
                  {s.deleted_at ? <Chip size="small" color="error" label="Eliminato" sx={{ ml: 1 }} /> : null}
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

function CustomerInventoriesTab(props: { customerId: number; includeDeleted: boolean; onlyDeleted: boolean; onCount?: (n: number) => void }) {
  const { customerId, includeDeleted, onlyDeleted, onCount } = props;
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

  React.useEffect(() => { onCount?.(rowCount); }, [rowCount, onCount]);

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Clienti
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
        <List dense disablePadding sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
          {rows.map((inv, idx) => {
            const name = inv.hostname || inv.knumber || inv.serial_number || `#${inv.id}`;
            const label = [inv.type_label, name].filter(Boolean).join(' · ');
            const q = { open: inv.id, customer: customerId, site: inv.site ?? '', ...(inv.deleted_at ? { view: "all" } : viewQuery(includeDeleted, onlyDeleted)) };
            return (
              <ListItem key={inv.id} disablePadding
                sx={{ bgcolor: idx % 2 === 1 ? 'rgba(15,118,110,0.03)' : 'transparent' }}>
                <ListItemButton onClick={() => navigate(`/inventory${buildQuery(q)}`)}
                  sx={{ py: 0.75, opacity: inv.deleted_at ? 0.55 : 1,
                    textDecoration: inv.deleted_at ? 'line-through' : 'none' }}>
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{ noWrap: true, variant: 'body2', sx: { fontWeight: 600 } }}
                  />
                  {inv.deleted_at ? <Chip size="small" color="error" label="Eliminato" sx={{ ml: 1 }} /> : null}
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


// ─── CustomerDriveTab ─────────────────────────────────────────────────────────

type DriveMini = {
  id: number;
  name: string;
  mime_type?: string;
  size_human?: string;
  updated_at: string;
  kind: "file" | "folder";
};

function CustomerDriveTab({ customerId }: { customerId: number }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = React.useState<DriveMini[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [total, setTotal] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get("/drive-folders/", { params: { customer: customerId, page_size: 15, ordering: "name" } }),
      api.get("/drive-files/",   { params: { customer: customerId, page_size: 15, ordering: "name" } }),
    ]).then(([fRes, fiRes]) => {
      if (cancelled) return;
      const folders: DriveMini[] = (fRes.data?.results ?? fRes.data ?? []).map((f: any) => ({ ...f, kind: "folder" as const }));
      const files: DriveMini[]   = (fiRes.data?.results ?? fiRes.data ?? []).map((f: any) => ({ ...f, kind: "file" as const }));
      setItems([...folders, ...files]);
      setTotal((fRes.data?.count ?? 0) + (fiRes.data?.count ?? 0));
    }).catch((e: unknown) => toast.error(apiErrorToMessage(e)))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerId]);

  function fileEmoji(mime?: string) {
    if (!mime) return "📁";
    if (mime.startsWith("image/")) return "🖼️";
    if (mime === "application/pdf") return "📄";
    return "📝";
  }

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>File Drive</Typography>
          <Chip size="small" label={total} />
        </Stack>
        <ActionButton tone="secondary" onClick={() => navigate("/drive")}>
          Apri Drive
        </ActionButton>
      </Stack>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
        </Stack>
      ) : items.length ? (
        <List dense disablePadding sx={{ borderRadius: 2, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
          {items.map((item, idx) => (
            <ListItem key={`${item.kind}-${item.id}`} disablePadding
              sx={{ bgcolor: idx % 2 === 1 ? "rgba(15,118,110,0.03)" : "transparent" }}>
              <ListItemText
                sx={{ px: 1.5, py: 0.75 }}
                primary={
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <span style={{ fontSize: 14 }}>{item.kind === "folder" ? "📁" : fileEmoji(item.mime_type)}</span>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, flex: 1 }}>{item.name}</Typography>
                    {item.size_human && (
                      <Typography variant="caption" sx={{ color: "text.disabled", flexShrink: 0 }}>{item.size_human}</Typography>
                    )}
                  </Stack>
                }
              />
            </ListItem>
          ))}
          {total > items.length && (
            <ListItem disablePadding>
              <ListItemButton onClick={() => navigate("/drive")} sx={{ py: 0.75, justifyContent: "center" }}>
                <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 600 }}>
                  + altri {total - items.length} elementi
                </Typography>
              </ListItemButton>
            </ListItem>
          )}
        </List>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>Nessun file collegato.</Typography>
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
  const { exporting, exportCsv } = useExportCsv();

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
  const [sitesCount, setSitesCount] = React.useState<number | null>(null);
  const [invCount, setInvCount] = React.useState<number | null>(null);
  const [driveCount, setDriveCount] = React.useState<number | null>(null);

  // Fetch all KPI counts whenever detail changes (don't wait for tabs to render)
  React.useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    Promise.all([
      api.get("/sites/",         { params: { customer: detail.id, page_size: 1 } }),
      api.get("/inventories/",   { params: { customer: detail.id, page_size: 1 } }),
      api.get("/drive-files/",   { params: { customer: detail.id, page_size: 1 } }),
      api.get("/drive-folders/", { params: { customer: detail.id, page_size: 1 } }),
    ]).then(([sitesRes, invRes, filesRes, foldersRes]) => {
      if (cancelled) return;
      setSitesCount(Number(sitesRes.data?.count ?? 0));
      setInvCount(Number(invRes.data?.count ?? 0));
      setDriveCount(Number(filesRes.data?.count ?? 0) + Number(foldersRes.data?.count ?? 0));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [detail]);

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
    if (typeof v !== "string" || !v.trim()) return null;
    // Append city to improve Nominatim geocoding accuracy
    const parts = [v.trim(), detail?.city?.trim()].filter(Boolean);
    return parts.join(", ");
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
    setSitesCount(null);
    setInvCount(null);
    setDriveCount(null);
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
          Lista di tutti i clienti presenti nel Site-Repo.
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
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadOutlinedIcon />}
                disabled={exporting}
                onClick={() => exportCsv({
                  url: "/customers/",
                  params: { search: grid.q, ordering: grid.ordering, ...includeDeletedParams(grid.includeDeleted) },
                  filename: "clienti",
                  columns: [
                    { label: "Codice",    getValue: (r: any) => r.code },
                    { label: "Nome",      getValue: (r: any) => r.display_name || r.name },
                    { label: "P.IVA",     getValue: (r: any) => r.vat_number },
                    { label: "Città",     getValue: (r: any) => r.city },
                    { label: "Stato",     getValue: (r: any) => r.status_label },
                    { label: "Note",      getValue: (r: any) => r.notes },
                  ],
                })}
                sx={{ borderColor: "grey.300", color: "text.secondary" }}
              >
                {exporting ? "Esportazione…" : "Esporta CSV"}
              </Button>
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
            </Stack>
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
            {/* decorative blobs */}
            <Box sx={{ position:"absolute", top:-44, right:-44, width:130, height:130, borderRadius:"50%", bgcolor:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />
            <Box sx={{ position:"absolute", bottom:-26, left:52, width:90, height:90, borderRadius:"50%", bgcolor:"rgba(255,255,255,0.04)", pointerEvents:"none" }} />

            {/* row 1: status badge + action icons */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, position:"relative", zIndex:2 }}>
              <Chip
                size="small"
                label={`● ${detail?.status_label ?? "—"}`}
                sx={{
                  bgcolor: "rgba(20,255,180,0.18)",
                  color: "#a7f3d0",
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: "0.07em",
                  border: "1px solid rgba(167,243,208,0.3)",
                  height: 22,
                }}
              />
              <Stack direction="row" spacing={0.75}>
                <Can perm={PERMS.crm.customer.change}>
                  {detail?.deleted_at ? (
                    <Tooltip title="Ripristina">
                      <span>
                        <IconButton size="small" onClick={doRestore} disabled={!detail || restoreBusy}
                          sx={{ color:"rgba(255,255,255,0.85)", bgcolor:"rgba(255,255,255,0.12)", borderRadius:1.5,
                            "&:hover":{ bgcolor:"rgba(255,255,255,0.22)" } }}>
                          <RestoreFromTrashIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Modifica">
                      <span>
                        <IconButton size="small" onClick={openEdit} disabled={!detail}
                          sx={{ color:"rgba(255,255,255,0.85)", bgcolor:"rgba(255,255,255,0.12)", borderRadius:1.5,
                            "&:hover":{ bgcolor:"rgba(255,255,255,0.22)" } }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Can>
                <Can perm={PERMS.crm.customer.delete}>
                  {!detail?.deleted_at && (
                    <Tooltip title="Elimina">
                      <span>
                        <IconButton size="small" onClick={() => setDeleteDlgOpen(true)} disabled={!detail || deleteBusy}
                          sx={{ color:"rgba(255,255,255,0.85)", bgcolor:"rgba(255,255,255,0.12)", borderRadius:1.5,
                            "&:hover":{ bgcolor:"rgba(239,68,68,0.28)", color:"#fca5a5" } }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Can>
                <Tooltip title="Chiudi">
                  <IconButton size="small" onClick={closeDrawer}
                    sx={{ color:"rgba(255,255,255,0.85)", bgcolor:"rgba(255,255,255,0.12)", borderRadius:1.5,
                      "&:hover":{ bgcolor:"rgba(255,255,255,0.22)" } }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* row 2: name + city */}
            <Box sx={{ position:"relative", zIndex:1, mb: 2 }}>
              {detail?.deleted_at && (
                <Chip size="small" color="error" label="Eliminato" sx={{ mb: 0.75, height:20, fontSize:10 }} />
              )}
              <Typography sx={{ color:"#fff", fontSize:26, fontWeight:900, letterSpacing:"-0.025em", lineHeight:1.1, mb:0.5 }}>
                {detail?.display_name || (selectedId ? `Cliente #${selectedId}` : "Cliente")}
              </Typography>
              {detail?.city && (
                <Typography variant="body2" sx={{ color:"rgba(255,255,255,0.58)" }}>
                  📍 {detail.city}
                </Typography>
              )}
            </Box>

          </Box>

          {/* ── TABS ── */}
          {detailLoading ? (
            <LinearProgress sx={{ height:2 }} />
          ) : null}

          <Box sx={{ borderBottom:"1px solid", borderColor:"divider", px:2.5 }}>
            <Tabs value={drawerTab} onChange={(_, v) => setDrawerTab(v)}>
              <Tab label="Dettagli" sx={{ fontSize:13, minWidth:0, px:1.5 }} />
              <Tab label={sitesCount != null ? `Siti (${sitesCount})` : "Siti"} sx={{ fontSize:13, minWidth:0, px:1.5 }} />
              <Tab label={invCount != null ? `Inventari (${invCount})` : "Inventari"} sx={{ fontSize:13, minWidth:0, px:1.5 }} />
              <Tab label={driveCount != null ? `Drive (${driveCount})` : "Drive"} sx={{ fontSize:13, minWidth:0, px:1.5 }} />
            </Tabs>
          </Box>

          {/* ── SCROLLABLE CONTENT ── */}
          <Box sx={{ flex:1, overflowY:"auto", px:2.5, py:2, display:"flex", flexDirection:"column", gap:1.5 }}>
            {!detail && !detailLoading ? (
              <Typography variant="body2" sx={{ opacity:0.6 }}>Nessun dettaglio disponibile.</Typography>
            ) : null}

            {/* TAB 0 — Dettagli */}
            {drawerTab === 0 && detail && (
              <>
                {/* Contatto primario */}
                <Box sx={{ bgcolor:"#f8fafc", border:"1px solid", borderColor:"grey.200", borderRadius:2, p:1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:1 }}>
                    <PersonOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                    Contatto primario
                  </Typography>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight:700, color:"text.primary" }}>
                        {detail.primary_contact_name || "—"}
                      </Typography>
                      <Typography variant="caption" sx={{ color:"text.secondary" }}>
                        {detail.primary_contact_email || ""}
                      </Typography>
                    </Box>
                    {detail.primary_contact_phone && (
                      <Chip size="small" label={detail.primary_contact_phone}
                        sx={{ bgcolor:"#f0fdf4", color:"#0f766e", border:"1px solid #bbf7d0", fontWeight:600, fontSize:11 }} />
                    )}
                  </Stack>
                </Box>

                {/* Informazioni (P.IVA + tutti i custom fields) */}
                <Box sx={{ bgcolor:"#f8fafc", border:"1px solid", borderColor:"grey.200", borderRadius:2, p:1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:1 }}>
                    <MonitorOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                    Informazioni
                  </Typography>
                  <Stack divider={<Box sx={{ borderBottom:"1px solid", borderColor:"grey.50" }} />}>
                    {detail.vat_number && (
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py:0.75 }}>
                        <Typography variant="caption" sx={{ color:"text.disabled" }}>P.IVA</Typography>
                        <Typography variant="body2" sx={{ fontWeight:600, fontFamily:"monospace", fontSize:12 }}>{detail.vat_number}</Typography>
                      </Stack>
                    )}
                    {detail.custom_fields && typeof detail.custom_fields === "object" &&
                      Object.entries(detail.custom_fields as Record<string, any>)
                        .filter(([k, v]) => v !== "" && v !== null && v !== undefined && k.trim().toLowerCase() !== "indirizzo")
                        .map(([k, v]) => (
                          <Stack key={k} direction="row" justifyContent="space-between" alignItems="center" sx={{ py:0.75 }}>
                            <Typography variant="caption" sx={{ color:"text.disabled" }}>{k}</Typography>
                            <Typography variant="body2" sx={{ fontWeight:600, maxWidth:220, textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {String(v)}
                            </Typography>
                          </Stack>
                        ))
                    }
                  </Stack>
                </Box>

                {/* Indirizzo + mappa */}
                {address && (
                  <Box sx={{ bgcolor:"#fff", borderRadius:2, border:"1px solid", borderColor:"grey.200", overflow:"hidden" }}>
                    <Box sx={{ px:1.75, pt:1.5, pb:1.25 }}>
                      <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:0.5 }}>
                        <LocationOnOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                        Indirizzo
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight:600, color:"text.primary" }}>{address}</Typography>
                    </Box>
                    <Box sx={{ borderTop:"1px solid", borderColor:"grey.100" }}>
                      <LeafletMap address={address} height={320} zoom={15} />
                    </Box>
                  </Box>
                )}

                {/* Note */}
                <Box sx={{ bgcolor:"#fafafa", border:"1px solid", borderColor:"grey.100", borderRadius:2, p:1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:0.75 }}>
                    <NotesOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                    Note
                  </Typography>
                  <Typography variant="body2" sx={{ color:"text.secondary", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                    {detail.notes || "—"}
                  </Typography>
                </Box>
              </>
            )}

            {/* TAB 1 — Siti */}
            {drawerTab === 1 && detail && (
              <CustomerSitesTab customerId={detail.id} includeDeleted={grid.includeDeleted} onlyDeleted={grid.onlyDeleted} onCount={setSitesCount} />
            )}

            {/* TAB 2 — Inventari */}
            {drawerTab === 2 && detail && (
              <CustomerInventoriesTab customerId={detail.id} includeDeleted={grid.includeDeleted} onlyDeleted={grid.onlyDeleted} onCount={setInvCount} />
            )}

            {/* TAB 3 — Drive */}
            {drawerTab === 3 && detail && (
              <CustomerDriveTab customerId={detail.id} />
            )}
          </Box>

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
