import * as React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CloseIcon from "@mui/icons-material/Close";
import LinearProgress from "@mui/material/LinearProgress";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import WifiOutlinedIcon from "@mui/icons-material/WifiOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";

import { Can } from "../auth/Can";
import { useExportCsv } from "../ui/useExportCsv";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { useAuth } from "../auth/AuthProvider";

import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";

import { useLocation, useNavigate } from "react-router-dom";
import { useServerGrid } from "../hooks/useServerGrid";
import { useUrlNumberParam } from "../hooks/useUrlParam";
import { api } from "../api/client";
import { buildDrfListParams, includeDeletedParams } from "../api/drf";
import type { ApiPage } from "../api/drf";
import { useDrfList } from "../hooks/useDrfList";
import { useToast } from "../ui/toast";
import { apiErrorToFieldErrors, apiErrorToMessage } from "../api/error";
import { buildQuery } from "../utils/nav";
import { emptySelectionModel, selectionSize, selectionToNumberIds } from "../utils/gridSelection";
import ConfirmDeleteDialog from "../ui/ConfirmDeleteDialog";
import ConfirmActionDialog from "../ui/ConfirmActionDialog";
import { PERMS } from "../auth/perms";
import EntityListCard from "../ui/EntityListCard";
import CustomFieldsEditor from "../ui/CustomFieldsEditor";
import { getInventoryTypeIcon, INVENTORY_TYPE_ICON_COLOR } from "../ui/inventoryTypeIcon";
import FilterChip from "../ui/FilterChip";

type LookupItem = { id: number; label: string; key?: string };

type CustomerItem = { id: number; code: string; name: string };
type SiteItem = { id: number; name: string; display_name?: string | null };

type InventoryRow = {
  id: number;
  customer_code?: string;
  customer_name?: string;
  site_name?: string;
  hostname?: string | null;
  knumber?: string | null;
  serial_number?: string | null;
  type_key?: string | null;
  type_label?: string | null;
  status_label?: string | null;
  local_ip?: string | null;
  srsa_ip?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type InventoryDetail = {
  id: number;

  customer: number;
  customer_code?: string;
  customer_name?: string;

  site?: number | null;
  site_name?: string;
  site_display_name?: string | null;

  name: string;

  knumber?: string | null;
  serial_number?: string | null;

  hostname?: string | null;
  local_ip?: string | null;
  srsa_ip?: string | null;

  type?: number | null;
  type_key?: string | null;
  type_label?: string | null;

  status: number;
  status_label?: string | null;

  os_user?: string | null;
  os_pwd?: string | null;
  app_usr?: string | null;
  app_pwd?: string | null;
  vnc_pwd?: string | null;

  manufacturer?: string | null;
  model?: string | null;
  warranty_end_date?: string | null;

  notes?: string | null;

  custom_fields?: Record<string, any> | null;

  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type InventoryForm = {
  customer: number | "";
  site: number | "";
  status: number | "";
  type: number | "";

  name: string;
  knumber: string;
  serial_number: string;

  hostname: string;
  local_ip: string;
  srsa_ip: string;

  os_user: string;
  os_pwd: string;
  app_usr: string;
  app_pwd: string;
  vnc_pwd: string;

  manufacturer: string;
  model: string;
  warranty_end_date: string;

  custom_fields: Record<string, any>;
  notes: string;
};

// ── REGOLE CAMPI PER TIPO INVENTARIO ─────────────────────────────────────────
// Per ogni tipo, elenca i campi DISABILITATI nel form di creazione/modifica.
// Campo non elencato = sempre abilitato.
// Aggiungi nuovi tipi o modifica i profili senza toccare il codice del form.
// ─────────────────────────────────────────────────────────────────────────────

type InventoryFieldName =
  | "hostname" | "local_ip" | "srsa_ip"          // rete
  | "os_user"  | "os_pwd"                         // credenziali OS
  | "app_usr"  | "app_pwd"                        // credenziali app
  | "vnc_pwd"                                     // VNC
  | "manufacturer" | "model" | "warranty_end_date"; // hardware

// ── Profili riusabili ─────────────────────────────────────────────────────────
const PROFILE_MANAGEMENT: InventoryFieldName[] = [
  "vnc_pwd", "app_usr", "app_pwd",
];
const PROFILE_LOAD_BALANCER: InventoryFieldName[] = [
  "vnc_pwd", "os_user", "os_pwd", "app_usr", "app_pwd",
];
const PROFILE_STORAGE: InventoryFieldName[] = [
  "vnc_pwd", "os_user", "os_pwd",
];

// ── Mappa tipo → campi disabilitati ──────────────────────────────────────────
const TYPE_DISABLED_FIELDS: Partial<Record<string, InventoryFieldName[]>> = {
  management:    PROFILE_MANAGEMENT,
  management1:   PROFILE_MANAGEMENT,
  management2:   PROFILE_MANAGEMENT,
  management3:   PROFILE_MANAGEMENT,
  management4:   PROFILE_MANAGEMENT,
  load_balancer1: PROFILE_LOAD_BALANCER,
  load_balancer2: PROFILE_LOAD_BALANCER,
  storage:        PROFILE_STORAGE,
  // Aggiungi altri tipi qui, es:
  // robot:       ["vnc_pwd", "app_usr", "app_pwd"],
};

const asId = (v: unknown): number | "" => {
  const s = String(v);
  return s === "" ? "" : Number(s);
};

async function copyToClipboard(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function KNumberPlate(props: { knumber: string; digits?: number }) {
  const { knumber, digits = 9 } = props;

  // solo cifre, poi pad a sinistra
  const clean = (knumber ?? "").replace(/\D/g, "");
  const padded = clean.slice(-digits).padStart(digits, "0");

  const blue = "#1e56ff";
  const strokeW = 6;

  const leftPad = 22;
  const topPad = 18;
  const gap = 10;
  const boxW = 74;
  const boxH = 74;

  const rowW = digits * boxW + (digits - 1) * gap;
  const frameW = leftPad * 2 + rowW;

  // spazio sotto per logo
const brandGap = 34;
const brandSize = 36;

// altezza solo per le caselle (cornice blu qui dentro)
const boxesAreaH = topPad + boxH + 18;

// testo sotto al bordo blu (fuori cornice)
const brandY = boxesAreaH + brandGap;

// altezza totale SVG (caselle + logo)
const frameH = brandY + 28;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${frameW} ${frameH}`}
      role="img"
      aria-label={`K-Number ${padded}`}
      style={{ display: "block", maxWidth: 980 }}
    >
{/* bordo blu SOLO attorno alle caselle */}
<rect
  x={strokeW / 2}
  y={strokeW / 2}
  width={frameW - strokeW}
  height={boxesAreaH - strokeW}
  rx="6"
  fill="white"
  stroke={blue}
  strokeWidth={strokeW}
/>
      {/* boxes + digits */}
      {Array.from({ length: digits }).map((_, i) => {
        const x = leftPad + i * (boxW + gap);
        const digit = padded[i] ?? " ";
        return (
          <g key={i}>
            <rect
              x={x}
              y={topPad}
              width={boxW}
              height={boxH}
              fill="white"
              stroke="black"
              strokeWidth="4"
            />
            <text
              x={x + boxW / 2}
              y={topPad + boxH / 2 + 18}
              textAnchor="middle"
              fontSize="52"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight="800"
              fill="black"
            >
              {digit}
            </text>
          </g>
        );
      })}

      <text
        x={leftPad}
        y={brandY}
        fontSize={brandSize}
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fill={blue}
      >
        PHILIPS
      </text>
    </svg>
  );
}


function SecretRow(props: { label: string; value?: string | null; onCopy?: () => void }) {
  const { label, value, onCopy } = props;
  const [show, setShow] = React.useState(false);
  const v = value ?? "";

  const timerRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    // auto-hide dopo 30s quando visibile
    if (!show) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (v) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setShow(false), 30_000);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [show, v]);

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75 }}>
      <Box sx={{ width: 120, opacity: 0.7 }}>
        <Typography variant="body2">{label}</Typography>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            wordBreak: "break-word",
          }}
        >
          {v ? (show ? v : "•".repeat(Math.min(v.length, 12))) : "—"}
        </Typography>
      </Box>

      {v ? (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={show ? "Nascondi" : "Mostra (30s)"}>
            <IconButton size="small" onClick={() => setShow((s) => !s)}>
              {show ? <VisibilityOffIcon fontSize="inherit" /> : <VisibilityIcon fontSize="inherit" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Copia">
            <IconButton size="small" onClick={onCopy} disabled={!onCopy}>
              <ContentCopyIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : (
        <Box sx={{ width: 68 }} />
      )}
    </Stack>
  );
}

function PasswordField(props: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; helperText?: string }) {
  const { label, value, onChange, disabled, helperText } = props;
  const [show, setShow] = React.useState(false);

  return (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      disabled={disabled}
      helperText={helperText}
      type={show ? "text" : "password"}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <Tooltip title={show ? "Nascondi" : "Mostra"}>
              <IconButton edge="end" onClick={() => setShow((s) => !s)} size="small">
                {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ),
      }}
    />
  );
}

const cols: GridColDef<InventoryRow>[] = [
  {
    field: "type_label",
    headerName: "Tipo",
    width: 200,
    sortable: true,
    renderCell: (p) => {
      const Icon = getInventoryTypeIcon(p.row?.type_key);
      const label = (p.value as any) ?? "—";
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, height: "100%" }}>
          <Box
            sx={{
              width: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon sx={{ color: INVENTORY_TYPE_ICON_COLOR, fontSize: 20, display: "block" }} />
          </Box>

          <Typography variant="body2" noWrap sx={{ lineHeight: 1.2 }}>
            {label || "—"}
          </Typography>
        </Box>
      );
    },
  },
  { field: "customer_name", headerName: "Cliente", width: 220 },
  { field: "site_name", headerName: "Sito", width: 180 },

  { field: "hostname", headerName: "Hostname", flex: 1, minWidth: 180 },
  { field: "knumber", headerName: "K#", width: 140 },
  { field: "serial_number", headerName: "Seriale", width: 180 },

  { field: "status_label", headerName: "Stato", width: 160 },
  { field: "local_ip", headerName: "IP locale", width: 160 },
  { field: "srsa_ip", headerName: "IP SRSA", width: 160 },
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

export default function Inventory() {
  const toast = useToast();
  const { exporting, exportCsv } = useExportCsv();
  const { hasPerm } = useAuth();
  const canViewSecrets = hasPerm(PERMS.inventory.inventory.view_secrets);

  const navigate = useNavigate();
  const loc = useLocation();
  const grid = useServerGrid({
    defaultOrdering: "hostname",
    allowedOrderingFields: ["customer_name", "site_name", "hostname", "knumber", "serial_number", "type_label", "status_label", "local_ip", "srsa_ip", "deleted_at"],
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
      return { title: "Cestino vuoto", subtitle: "Non ci sono inventari eliminati." };
    }
    if (!grid.search.trim()) {
      return { title: "Nessun inventario", subtitle: "Crea un nuovo inventario o cambia i filtri.", action: (
        <Can perm={PERMS.inventory.inventory.add}>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}>
            Crea inventario
          </Button>
        </Can>
      ) };
    }
    return { title: "Nessun risultato", subtitle: "Prova a cambiare ricerca o filtri." };
  }, [grid.view, grid.search]);


  const [customerId, setCustomerId] = useUrlNumberParam("customer");
  const [siteId, setSiteId] = useUrlNumberParam("site");
  const [typeId, setTypeId] = useUrlNumberParam("type");

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: { customer_name: 'customer__name', site_name: 'site__name', type_label: 'type__label', status_label: 'status__label' },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(customerId !== "" ? { customer: customerId } : {}),
          ...(siteId !== "" ? { site: siteId } : {}),
          ...(typeId !== "" ? { type: typeId } : {}),
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
      typeId,
    ]
  );

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<InventoryRow>(
    "/inventories/",
    listParams,
    (e: unknown) => toast.error(apiErrorToMessage(e))
  );

  const [customers, setCustomers] = React.useState<CustomerItem[]>([]);
  const [filterSites, setFilterSites] = React.useState<SiteItem[]>([]);
  const [statuses, setStatuses] = React.useState<LookupItem[]>([]);
  const [types, setTypes] = React.useState<LookupItem[]>([]);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<InventoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // delete/restore
  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [restoreBusy, setRestoreBusy] = React.useState(false);

  // CRUD dialog
  const [dlgOpen, setDlgOpen] = React.useState(false);
  const [dlgMode, setDlgMode] = React.useState<"create" | "edit">("create");
  const [dlgSaving, setDlgSaving] = React.useState(false);
  const [dlgId, setDlgId] = React.useState<number | null>(null);
  const [dlgSites, setDlgSites] = React.useState<SiteItem[]>([]);
  const [form, setForm] = React.useState<InventoryForm>({
    customer: "",
    site: "",
    status: "",
    type: "",
    name: "",
    knumber: "",
    serial_number: "",
    hostname: "",
    local_ip: "",
    srsa_ip: "",
    os_user: "",
    os_pwd: "",
    app_usr: "",
    app_pwd: "",
    vnc_pwd: "",
    manufacturer: "",
    model: "",
    warranty_end_date: "",
    custom_fields: {},
    notes: "",
  });

  const [formErrors, setFormErrors] = React.useState<Record<string, string | undefined>>({});

  // Campi disabilitati in base al tipo selezionato
  const selectedTypeKey = React.useMemo(
    () => (form.type !== "" ? types.find((t) => t.id === form.type)?.key ?? null : null),
    [form.type, types]
  );
  const disabledFields = React.useMemo((): Set<InventoryFieldName> => {
    const fields = TYPE_DISABLED_FIELDS[selectedTypeKey ?? ""] ?? [];
    return new Set(fields);
  }, [selectedTypeKey]);
  const df = (f: InventoryFieldName) => disabledFields.has(f);
  const dfHelp = (f: InventoryFieldName) =>
    df(f) ? "Non applicabile per questo tipo" : undefined;

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CustomerItem>>("/customers/", { params: { ordering: "name", page_size: 500 } });
      setCustomers(res.data.results ?? []);
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    }
  }, [toast]);

  const loadLookups = React.useCallback(async () => {
    try {
      const [st, ty] = await Promise.all([
        api.get<LookupItem[]>("/inventory-statuses/"),
        api.get<LookupItem[]>("/inventory-types/"),
      ]);
      setStatuses(st.data ?? []);
      setTypes(ty.data ?? []);
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    }
  }, [toast]);

  const loadFilterSites = React.useCallback(async () => {
    try {
      const params: any = { ordering: "name", page_size: 500 };
      if (customerId !== "") params.customer = customerId;
      const res = await api.get<ApiPage<SiteItem>>("/sites/", { params });
      setFilterSites(res.data.results ?? []);
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    }
  }, [customerId, toast]);

  const loadSitesForDialogCustomer = React.useCallback(async (cust: number | "") => {
    try {
      if (cust === "") {
        setDlgSites([]);
        return;
      }
      const res = await api.get<ApiPage<SiteItem>>("/sites/", { params: { ordering: "name", page_size: 500, customer: cust } });
      setDlgSites(res.data.results ?? []);
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    }
  }, [toast]);

  const loadDetail = React.useCallback(async (id: number, forceIncludeDeleted?: boolean) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const inc = forceIncludeDeleted ?? grid.includeDeleted;
      const incParams = includeDeletedParams(inc);
      const res = await api.get<InventoryDetail>(`/inventories/${id}/`, incParams ? { params: incParams } : undefined);
      setDetail(res.data);
    } catch (e) {
      toast.error(apiErrorToMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }, [toast, grid.includeDeleted]);

  React.useEffect(() => {
    loadCustomers();
    loadLookups();
  }, [loadCustomers, loadLookups]);

  // Keep siteId when initial URL has both customer+site; reset only when customer changes later
  const prevCustomerRef = React.useRef(customerId);
  React.useEffect(() => {
    loadFilterSites();
    if (prevCustomerRef.current !== customerId) {
      setSiteId("", { patch: { page: 1 }, keepOpen: true });
      prevCustomerRef.current = customerId;
    }
  }, [customerId, loadFilterSites, setSiteId]);

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
      await api.post(`/inventories/${id}/restore/`);
      toast.success("Inventario ripristinato ✅");
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

  const columns = React.useMemo<GridColDef<InventoryRow>[]>(() => {
    const actionsCol: GridColDef<InventoryRow> = {
      field: "__row_actions",
      headerName: "",
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => {
        const r = p.row as InventoryRow;
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

            <Can perm={PERMS.inventory.inventory.change}>
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

  const closeDrawer = () => {
    setDrawerOpen(false);
    grid.setOpenId(null);
    if (returnTo) navigate(returnTo, { replace: true });
  };

  const openCreateOnceRef = React.useRef(false);

  const openCreate = async () => {
    const preCustomer = customerId !== "" ? customerId : "";
    setDlgMode("create");
    setDlgId(null);
    setForm({
      customer: preCustomer,
      site: "",
      status: "",
      type: "",
      name: "",
      knumber: "",
      serial_number: "",
      hostname: "",
      local_ip: "",
      srsa_ip: "",
      os_user: "",
      os_pwd: "",
      app_usr: "",
      app_pwd: "",
      vnc_pwd: "",
      manufacturer: "",
      model: "",
      warranty_end_date: "",
      custom_fields: {},
      notes: "",
    });
    setDlgOpen(true);
    await loadSitesForDialogCustomer(preCustomer);
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
      status: (detail.status ?? "") as any,
      type: (detail.type ?? "") as any,
      name: detail.name ?? "",
      knumber: detail.knumber ?? "",
      serial_number: detail.serial_number ?? "",
      hostname: detail.hostname ?? "",
      local_ip: detail.local_ip ?? "",
      srsa_ip: detail.srsa_ip ?? "",
      os_user: detail.os_user ?? "",
      os_pwd: detail.os_pwd ?? "",
      app_usr: detail.app_usr ?? "",
      app_pwd: detail.app_pwd ?? "",
      vnc_pwd: detail.vnc_pwd ?? "",
      manufacturer: detail.manufacturer ?? "",
      model: detail.model ?? "",
      warranty_end_date: detail.warranty_end_date ?? "",
      custom_fields: (detail.custom_fields as any) ?? {},
      notes: detail.notes ?? "",
    });

    setDlgOpen(true);
    setFormErrors({});
    await loadSitesForDialogCustomer(cust);
  };

  const save = async () => {
    const errs: { customer?: string; status?: string; name?: string } = {};
    if (form.customer === "") errs.customer = "Obbligatorio";
    if (form.status === "") errs.status = "Obbligatorio";
    if (!String(form.name).trim()) errs.name = "Obbligatorio";
    setFormErrors(errs);
    if (Object.keys(errs).length) {
      toast.warning("Compila i campi obbligatori.");
      return;
    }

    const payload: any = {
      customer: Number(form.customer),
      site: form.site === "" ? null : Number(form.site),
      status: Number(form.status),
      type: form.type === "" ? null : Number(form.type),

      name: form.name.trim(),
      knumber: (form.knumber || "").trim() || null,
      serial_number: (form.serial_number || "").trim() || null,

      hostname: (form.hostname || "").trim() || null,
      local_ip: (form.local_ip || "").trim() || null,
      srsa_ip: (form.srsa_ip || "").trim() || null,

      os_user: (form.os_user || "").trim() || null,
      os_pwd: (form.os_pwd || "").trim() || null,
      app_usr: (form.app_usr || "").trim() || null,
      app_pwd: (form.app_pwd || "").trim() || null,
      vnc_pwd: (form.vnc_pwd || "").trim() || null,

      manufacturer: (form.manufacturer || "").trim() || null,
      model: (form.model || "").trim() || null,
      warranty_end_date: (form.warranty_end_date || "").trim() || null,

      custom_fields: form.custom_fields && Object.keys(form.custom_fields).length ? form.custom_fields : null,
      notes: (form.notes || "").trim() || null,
    };

    setDlgSaving(true);
    try {
      let id: number;
      if (dlgMode === "create") {
        const res = await api.post<InventoryDetail>("/inventories/", payload);
        id = res.data.id;
        toast.success("Inventario creato ✅");
      } else {
        if (!dlgId) return;
        const res = await api.patch<InventoryDetail>(`/inventories/${dlgId}/`, payload);
        id = res.data.id;
        toast.success("Inventario aggiornato ✅");
      }

      setDlgOpen(false);
      reloadList();
      openDrawer(id);
    } catch (e) {
      const fe = apiErrorToFieldErrors(e);
      if (fe) {
        setFormErrors((prev) => ({ ...prev, ...fe } as any));
        toast.error(fe._error || "Controlla i campi evidenziati.");
      } else {
        toast.error(apiErrorToMessage(e));
      }
    } finally {
      setDlgSaving(false);
    }
  };

  const doDelete = async () => {
    if (!detail) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/inventories/${detail.id}/`);
      toast.success("Inventario eliminato ✅");

      // per poterlo vedere subito nel drawer dopo il delete:
      grid.setViewMode("all", { keepOpen: true });
      reloadList();
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
    await api.post(`/inventory/bulk_restore/`, { ids });
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

const doRestore = async () => {
    if (!detail) return;
    setRestoreBusy(true);
    try {
      await api.post(`/inventories/${detail.id}/restore/`);
      toast.success("Inventario ripristinato ✅");
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
          Inventari
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
          onReset: () => grid.reset(["customer", "site", "type"]),
          rightActions: (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadOutlinedIcon />}
                disabled={exporting}
                onClick={() => exportCsv({
                  url: "/inventories/",
                  params: { search: grid.q, ordering: grid.ordering, ...includeDeletedParams(grid.includeDeleted) },
                  filename: "inventario",
                  columns: [
                    { label: "K-Number",       getValue: (r: any) => r.knumber },
                    { label: "Hostname",        getValue: (r: any) => r.hostname },
                    { label: "Seriale",         getValue: (r: any) => r.serial_number },
                    { label: "Tipo",            getValue: (r: any) => r.type_label },
                    { label: "Stato",           getValue: (r: any) => r.status_label },
                    { label: "Cliente",         getValue: (r: any) => r.customer_name },
                    { label: "Sito",            getValue: (r: any) => r.site_display_name || r.site_name },
                    { label: "Note",            getValue: (r: any) => r.notes },
                  ],
                })}
                sx={{ borderColor: "grey.300", color: "text.secondary" }}
              >
                {exporting ? "Esportazione…" : "Esporta CSV"}
              </Button>
              <Can perm={PERMS.inventory.inventory.change}>
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
            <Can perm={PERMS.inventory.inventory.add}>
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
          activeCount={(customerId !== "" ? 1 : 0) + (siteId !== "" ? 1 : 0) + (typeId !== "" ? 1 : 0)}
          onReset={() => {
            setCustomerId("", { patch: { search: grid.q, page: 1 }, keepOpen: true });
            setSiteId("", { patch: { search: grid.q, page: 1 }, keepOpen: true });
            setTypeId("", { patch: { search: grid.q, page: 1 }, keepOpen: true });
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
                  {c.code} — {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
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
              {filterSites.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.display_name || s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Tipo</InputLabel>
            <Select
              label="Tipo"
              value={typeId}
              onChange={(e) => {
                const v = asId(e.target.value);
                setTypeId(v, { patch: { search: grid.q, page: 1 }, keepOpen: true });
              }}
            >
              <MenuItem value="">Tutti</MenuItem>
              {types.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </FilterChip>
      </EntityListCard>

      <Drawer anchor="right" open={drawerOpen} onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: "100%", sm: 460 } } }}>
        <Stack sx={{ height: "100%", overflow: "hidden" }}>

          {/* ── HERO BANNER ── */}
          <Box sx={{
            background: "linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)",
            px: 2.5, pt: 2.25, pb: 2.25,
            position: "relative", overflow: "hidden", flexShrink: 0,
          }}>
            <Box sx={{ position:"absolute", top:-44, right:-44, width:130, height:130, borderRadius:"50%", bgcolor:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />
            <Box sx={{ position:"absolute", bottom:-26, left:52, width:90, height:90, borderRadius:"50%", bgcolor:"rgba(255,255,255,0.04)", pointerEvents:"none" }} />

            {/* row 1: status chip + actions */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:1.25, position:"relative", zIndex:2 }}>
              <Chip size="small"
                label={`● ${detail?.status_label ?? "—"}`}
                sx={{ bgcolor:"rgba(20,255,180,0.18)", color:"#a7f3d0", fontWeight:700, fontSize:10, letterSpacing:"0.07em", border:"1px solid rgba(167,243,208,0.3)", height:22 }}
              />
              <Stack direction="row" spacing={0.75}>
                <Can perm={PERMS.inventory.inventory.change}>
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
                <Can perm={PERMS.inventory.inventory.delete}>
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

            {/* row 2: type icon + hostname + customer/site */}
            <Box sx={{ position:"relative", zIndex:1 }}>
              {detail?.deleted_at && <Chip size="small" color="error" label="Eliminato" sx={{ mb:0.75, height:20, fontSize:10 }} />}
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb:0.5 }}>
                {(() => {
                  const TypeIcon = getInventoryTypeIcon(detail?.type_key);
                  return (
                    <Box sx={{
                      width:44, height:44, borderRadius:2, flexShrink:0,
                      bgcolor:"rgba(255,255,255,0.15)", backdropFilter:"blur(4px)",
                      border:"1px solid rgba(255,255,255,0.2)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <TypeIcon sx={{ fontSize:26, color:"rgba(255,255,255,0.9)" }} />
                    </Box>
                  );
                })()}
                <Typography sx={{ color:"#fff", fontSize:24, fontWeight:900, letterSpacing:"-0.025em", lineHeight:1.15 }}>
                  {detail?.hostname || detail?.knumber || (selectedId ? `Inventario #${selectedId}` : "Inventario")}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color:"rgba(255,255,255,0.58)" }}>
                {[detail?.customer_name, detail?.site_display_name || detail?.site_name].filter(Boolean).join(" · ") || " "}
              </Typography>
              {detail?.type_label && (
                <Typography variant="caption" sx={{ color:"rgba(255,255,255,0.45)", display:"block", mt:0.25 }}>
                  {detail.type_label}
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
<Button
  size="small"
  variant="outlined"
  onClick={() =>
    navigate(
      `/customers${buildQuery({
        open: detail.customer,
        return: loc.pathname + loc.search,
      })}`
    )
  }
>
  Apri cliente
</Button>
{detail.site && (
  <Button
    size="small"
    variant="outlined"
    onClick={() =>
      navigate(
        `/sites${buildQuery({
          customer: detail.customer,
          open: detail.site,
          return: loc.pathname + loc.search,
        })}`
      )
    }
  >
    Apri sito
  </Button>
                  )}
                  <Button size="small" variant="outlined"
                    onClick={() => navigate(`/inventory${buildQuery({ customer: detail.customer, site: detail.site ?? "" })}`)}>
                    Lista filtrata
                  </Button>
                </Stack>

                {/* ── K-Number ── */}
                {detail.knumber && (
                  <Box sx={{ bgcolor:"#f8fafc", border:"1px solid", borderColor:"grey.200", borderRadius:2, p:1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"block", mb:1 }}>
                      K-Number
                    </Typography>
                    <KNumberPlate knumber={detail.knumber} digits={9} />
                  </Box>
                )}

                {/* ── Identificazione ── */}
                {[detail.name, detail.knumber, detail.serial_number, detail.site_display_name || detail.site_name].some(Boolean) && (
                  <Box sx={{ bgcolor:"#f8fafc", border:"1px solid", borderColor:"grey.200", borderRadius:2, p:1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:1 }}>
                      <FingerprintIcon sx={{ fontSize:14, color:"text.disabled" }} />
                      Identificazione
                    </Typography>
                    <Stack divider={<Box sx={{ borderBottom:"1px solid", borderColor:"grey.50" }} />}>
                      {[
                        { label:"Nome",     value: detail.name,      mono: false, copy: true  },
                        { label:"Sito",     value: detail.site_display_name || detail.site_name, mono: false, copy: false },
                        { label:"K-number", value: detail.knumber,   mono: true,  copy: true  },
                        { label:"Seriale",  value: detail.serial_number, mono: true, copy: true },
                      ].filter(r => r.value).map(r => (
                        <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py:0.75 }}>
                          <Typography variant="caption" sx={{ color:"text.disabled", minWidth:80 }}>{r.label}</Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight:600, fontFamily: r.mono ? "monospace" : undefined, fontSize: r.mono ? 12 : undefined }}>
                              {r.value}
                            </Typography>
                            {r.copy && r.value && (
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
                )}

                {/* ── Rete ── */}
                {[detail.hostname, detail.local_ip, detail.srsa_ip].some(Boolean) && (
                  <Box sx={{ bgcolor:"#f8fafc", border:"1px solid", borderColor:"grey.200", borderRadius:2, p:1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:1 }}>
                      <WifiOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                      Rete
                    </Typography>
                    <Stack divider={<Box sx={{ borderBottom:"1px solid", borderColor:"grey.50" }} />}>
                      {[
                        { label:"Hostname", value: detail.hostname },
                        { label:"IP locale", value: detail.local_ip },
                        { label:"IP SRSA",   value: detail.srsa_ip },
                      ].filter(r => r.value).map(r => (
                        <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py:0.75 }}>
                          <Typography variant="caption" sx={{ color:"text.disabled", minWidth:80 }}>{r.label}</Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight:600, fontFamily:"monospace", fontSize:12 }}>{r.value}</Typography>
                            <Tooltip title="Copia">
                              <IconButton size="small" onClick={async () => { await copyToClipboard(r.value!); toast.success("Copiato ✅"); }}>
                                <ContentCopyIcon sx={{ fontSize:13 }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* ── Credenziali ── */}
                {(canViewSecrets
                    ? [detail.os_user, detail.os_pwd, detail.app_usr, detail.app_pwd, detail.vnc_pwd]
                    : [detail.os_user, detail.app_usr]
                  ).some(Boolean) && (
                  <Box sx={{ bgcolor:"#f8fafc", border:"1px solid", borderColor:"grey.200", borderRadius:2, p:1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:1 }}>
                      <LockOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                      Credenziali
                    </Typography>
                    {!canViewSecrets && (
                      <Typography variant="caption" sx={{ color:"text.disabled", fontStyle:"italic", display:"block", mb:0.5 }}>
                        Password non visibili (permessi insufficienti)
                      </Typography>
                    )}
                    <Stack divider={<Box sx={{ borderBottom:"1px solid", borderColor:"grey.50" }} />}>
                      {detail.os_user && (
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py:0.75 }}>
                          <Typography variant="caption" sx={{ color:"text.disabled", minWidth:100 }}>Utente OS</Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight:600, fontFamily:"monospace", fontSize:12 }}>{detail.os_user}</Typography>
                            <Tooltip title="Copia"><IconButton size="small" onClick={async () => { await copyToClipboard(detail.os_user!); toast.success("Copiato ✅"); }}><ContentCopyIcon sx={{ fontSize:13 }} /></IconButton></Tooltip>
                          </Stack>
                        </Stack>
                      )}
                      {canViewSecrets && detail.os_pwd && (
                        <Box sx={{ py:0.75 }}>
                          <SecretRow label="Password OS" value={detail.os_pwd} onCopy={async () => { await copyToClipboard(detail.os_pwd!); toast.success("Copiato ✅"); }} />
                        </Box>
                      )}
                      {detail.app_usr && (
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py:0.75 }}>
                          <Typography variant="caption" sx={{ color:"text.disabled", minWidth:100 }}>Utente App</Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight:600, fontFamily:"monospace", fontSize:12 }}>{detail.app_usr}</Typography>
                            <Tooltip title="Copia"><IconButton size="small" onClick={async () => { await copyToClipboard(detail.app_usr!); toast.success("Copiato ✅"); }}><ContentCopyIcon sx={{ fontSize:13 }} /></IconButton></Tooltip>
                          </Stack>
                        </Stack>
                      )}
                      {canViewSecrets && detail.app_pwd && (
                        <Box sx={{ py:0.75 }}>
                          <SecretRow label="Password App" value={detail.app_pwd} onCopy={async () => { await copyToClipboard(detail.app_pwd!); toast.success("Copiato ✅"); }} />
                        </Box>
                      )}
                      {canViewSecrets && detail.vnc_pwd && (
                        <Box sx={{ py:0.75 }}>
                          <SecretRow label="Password VNC" value={detail.vnc_pwd} onCopy={async () => { await copyToClipboard(detail.vnc_pwd!); toast.success("Copiato ✅"); }} />
                        </Box>
                      )}
                    </Stack>
                  </Box>
                )}

                {/* ── Hardware + custom fields ── */}
                {[detail.manufacturer, detail.model, detail.warranty_end_date,
                  ...Object.values(detail.custom_fields ?? {})].some(v => v !== "" && v !== null && v !== undefined) && (
                  <Box sx={{ bgcolor:"#f8fafc", border:"1px solid", borderColor:"grey.200", borderRadius:2, p:1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight:700, color:"text.disabled", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:0.75, mb:1 }}>
                      <MemoryOutlinedIcon sx={{ fontSize:14, color:"text.disabled" }} />
                      Hardware
                    </Typography>
                    <Stack divider={<Box sx={{ borderBottom:"1px solid", borderColor:"grey.50" }} />}>
                      {[
                        { label:"Produttore",    value: detail.manufacturer },
                        { label:"Modello",       value: detail.model },
                        { label:"Fine garanzia", value: detail.warranty_end_date, mono: true },
                      ].filter(r => r.value).map(r => (
                        <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py:0.75 }}>
                          <Typography variant="caption" sx={{ color:"text.disabled", minWidth:100 }}>{r.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight:600, fontFamily: r.mono ? "monospace" : undefined, fontSize: r.mono ? 12 : undefined }}>{r.value}</Typography>
                        </Stack>
                      ))}
                      {detail.custom_fields && typeof detail.custom_fields === "object" &&
                        Object.entries(detail.custom_fields as Record<string, any>)
                          .filter(([, v]) => v !== "" && v !== null && v !== undefined)
                          .map(([k, v]) => (
                            <Stack key={k} direction="row" alignItems="center" justifyContent="space-between" sx={{ py:0.75 }}>
                              <Typography variant="caption" sx={{ color:"text.disabled", minWidth:100 }}>{k}</Typography>
                              <Typography variant="body2" sx={{ fontWeight:600, maxWidth:220, textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{String(v)}</Typography>
                            </Stack>
                          ))
                      }
                    </Stack>
                  </Box>
                )}

                {/* ── Note ── */}
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
            ) : (
              <Typography variant="body2" sx={{ opacity:0.7 }}>Nessun dettaglio disponibile.</Typography>
            )}
          </Box>
        </Stack>
      </Drawer>

      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{dlgMode === "create" ? "Nuovo inventario" : "Modifica inventario"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <FormControl size="small" fullWidth required error={Boolean(formErrors.customer)}>
                <InputLabel required>Cliente</InputLabel>
                <Select
                  label="Cliente"
                  value={form.customer}
                  onChange={async (e) => {
                    const v = asId(e.target.value);
                    setForm((f) => ({ ...f, customer: v, site: "" }));
                    setFormErrors((e) => ({ ...e, customer: undefined }));
                    await loadSitesForDialogCustomer(v);
                  }}
                >
                  <MenuItem value="">Seleziona…</MenuItem>
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.customer ? (
                  <FormHelperText>{formErrors.customer}</FormHelperText>
                ) : null}
              </FormControl>

              <FormControl size="small" fullWidth disabled={form.customer === ""}>
                <InputLabel>Sito</InputLabel>
                <Select label="Sito" value={form.site} onChange={(e) => setForm((f) => ({ ...f, site: asId(e.target.value) }))}>
                  <MenuItem value="">(nessuno)</MenuItem>
                  {dlgSites.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.display_name || s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <FormControl size="small" fullWidth required error={Boolean(formErrors.status)}>
                <InputLabel required>Stato</InputLabel>
                <Select label="Stato" value={form.status} onChange={(e) => {
                    const v = asId(e.target.value);
                    setForm((f) => ({ ...f, status: v }));
                    setFormErrors((er) => ({ ...er, status: undefined }));
                  }}>
                  <MenuItem value="">Seleziona…</MenuItem>
                  {statuses.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.status ? (
                  <FormHelperText>{formErrors.status}</FormHelperText>
                ) : null}
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select label="Tipo" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: asId(e.target.value) }))}>
                  <MenuItem value="">(nessuno)</MenuItem>
                  {types.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <TextField
              size="small"
              label="Nome"
              required
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                setFormErrors((er) => ({ ...er, name: undefined }));
              }}
              error={Boolean(formErrors.name)}
              helperText={formErrors.name || " "}
              fullWidth
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="K-number" value={form.knumber} onChange={(e) => { setForm((f) => ({ ...f, knumber: e.target.value })); setFormErrors((er) => ({ ...er, knumber: undefined })); }} error={Boolean(formErrors.knumber)} helperText={(formErrors.knumber as any) || " "} fullWidth />
              <TextField size="small" label="Seriale" value={form.serial_number} onChange={(e) => { setForm((f) => ({ ...f, serial_number: e.target.value })); setFormErrors((er) => ({ ...er, serial_number: undefined })); }} error={Boolean(formErrors.serial_number)} helperText={(formErrors.serial_number as any) || " "} fullWidth />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Hostname" value={form.hostname} onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))} fullWidth disabled={df("hostname")} helperText={dfHelp("hostname")} />
              <TextField size="small" label="IP locale" value={form.local_ip} onChange={(e) => setForm((f) => ({ ...f, local_ip: e.target.value }))} fullWidth disabled={df("local_ip")} helperText={dfHelp("local_ip")} />
              <TextField size="small" label="SRSA IP" value={form.srsa_ip} onChange={(e) => setForm((f) => ({ ...f, srsa_ip: e.target.value }))} fullWidth disabled={df("srsa_ip")} helperText={dfHelp("srsa_ip")} />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Utente OS" value={form.os_user} onChange={(e) => setForm((f) => ({ ...f, os_user: e.target.value }))} fullWidth disabled={df("os_user")} helperText={dfHelp("os_user")} />
              {canViewSecrets ? (
                <PasswordField label="Password OS" value={form.os_pwd} onChange={(v) => setForm((f) => ({ ...f, os_pwd: v }))} disabled={df("os_pwd")} helperText={dfHelp("os_pwd")} />
              ) : (
                <TextField size="small" label="Password OS" value="" fullWidth disabled helperText="Non autorizzato" />
              )}
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Utente App" value={form.app_usr} onChange={(e) => setForm((f) => ({ ...f, app_usr: e.target.value }))} fullWidth disabled={df("app_usr")} helperText={dfHelp("app_usr")} />
              {canViewSecrets ? (
                <PasswordField label="Password App" value={form.app_pwd} onChange={(v) => setForm((f) => ({ ...f, app_pwd: v }))} disabled={df("app_pwd")} helperText={dfHelp("app_pwd")} />
              ) : (
                <TextField size="small" label="Password App" value="" fullWidth disabled helperText="Non autorizzato" />
              )}
              {canViewSecrets ? (
                <PasswordField
                  label="Password VNC"
                  value={form.vnc_pwd}
                  onChange={(v) => setForm((f) => ({ ...f, vnc_pwd: v }))}
                  disabled={df("vnc_pwd")}
                  helperText={dfHelp("vnc_pwd")}
                />
              ) : (
                <TextField size="small" label="Password VNC" value="" fullWidth disabled helperText="Non autorizzato" />
              )}
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Produttore" value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} fullWidth disabled={df("manufacturer")} helperText={dfHelp("manufacturer")} />
              <TextField size="small" label="Modello" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} fullWidth disabled={df("model")} helperText={dfHelp("model")} />
              <TextField size="small" label="Fine garanzia (YYYY-MM-DD)" value={form.warranty_end_date} onChange={(e) => setForm((f) => ({ ...f, warranty_end_date: e.target.value }))} fullWidth disabled={df("warranty_end_date")} helperText={dfHelp("warranty_end_date")} />
            </Stack>

            <CustomFieldsEditor
              entity="inventory"
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

      <ConfirmActionDialog
        open={bulkRestoreDlgOpen}
        busy={restoreBusy}
        title="Ripristinare gli inventari selezionati?"
        description={`Verranno ripristinati ${selectedCount} inventari dal cestino.`}
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
        description="L’inventario verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />
    </Stack>
  );
}
