import * as React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import { Can } from "../auth/Can";
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
import { apiErrorToMessage } from "../api/error";
import { buildQuery } from "../utils/nav";
import { emptySelectionModel, selectionSize, selectionToNumberIds } from "../utils/gridSelection";
import DetailDrawerHeader from "../ui/DetailDrawerHeader";
import ConfirmDeleteDialog from "../ui/ConfirmDeleteDialog";
import ConfirmActionDialog from "../ui/ConfirmActionDialog";
import { PERMS } from "../auth/perms";
import EntityListCard from "../ui/EntityListCard";
import CustomFieldsEditor from "../ui/CustomFieldsEditor";
import CustomFieldsDisplay from "../ui/CustomFieldsDisplay";
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

const asId = (v: unknown): number | "" => {
  const s = String(v);
  return s === "" ? "" : Number(s);
};

async function copyToClipboard(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function FieldRow(props: { label: string; value?: string | null; mono?: boolean; onCopy?: () => void }) {
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

function PasswordField(props: { label: string; value: string; onChange: (v: string) => void }) {
  const { label, value, onChange } = props;
  const [show, setShow] = React.useState(false);

  return (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
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
      return { title: "Nessun inventario", subtitle: "Crea un nuovo inventario o cambia i filtri." };
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

  const [formErrors, setFormErrors] = React.useState<{ customer?: string; status?: string; name?: string }>({});

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

  const closeDrawer = () => {
    setDrawerOpen(false);
    grid.setOpenId(null);
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
      toast.error(apiErrorToMessage(e));
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

      <Drawer anchor="right" open={drawerOpen} onClose={closeDrawer} PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}>
        <Stack sx={{ p: 2 }} spacing={1.5}>
          <DetailDrawerHeader
            title={detail?.hostname || detail?.knumber || (selectedId ? `Inventario #${selectedId}` : "Inventario")}
            subtitle={detail?.customer_code ? `${detail.customer_code} — ${detail.customer_name}` : undefined}
            onClose={closeDrawer}
            actions={
              <>
                <Can perm={PERMS.inventory.inventory.change}>
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

                <Can perm={PERMS.inventory.inventory.change}>
                  <Tooltip title="Modifica">
                    <span>
                      <IconButton onClick={openEdit} disabled={!detail || Boolean(detail?.deleted_at)}>
                        <EditIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Can>

                <Can perm={PERMS.inventory.inventory.delete}>
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
                {detail.type_label ? <Chip size="small" label={detail.type_label} /> : null}
                {detail.status_label ? <Chip size="small" label={detail.status_label} /> : null}
              </Stack>

              {/* Deep-links */}
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  onClick={() =>
                    window.open(
                      `/inventory${buildQuery({
                        open: detail.id,
                        customer: detail.customer,
                        site: detail.site ?? "",
                        ...(detail.deleted_at ? { view: "all" } : {}),
                      })}`,
                      "_blank"
                    )
                  }
                >
                  Apri in nuova scheda
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/customers${buildQuery({ open: detail.customer })}`)}
                >
                  Apri cliente
                </Button>

                {detail.site ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/sites${buildQuery({ open: detail.site, customer: detail.customer })}`)}
                  >
                    Apri sito
                  </Button>
                ) : null}

                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/inventory${buildQuery({ customer: detail.customer, site: detail.site ?? "" })}`)}
                >
                  Apri lista (filtrata)
                </Button>
              </Stack>

              <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Identificazione
              </Typography>

              <FieldRow
                label="Nome"
                value={detail.name || ""}
                onCopy={async () => {
                  await copyToClipboard(detail.name);
                  toast.success("Copiato ✅");
                }}
              />

              <FieldRow
                label="Sito"
                value={detail.site_display_name || detail.site_name || ""}
                onCopy={async () => {
                  const v = detail.site_display_name || detail.site_name || "";
                  if (v) {
                    await copyToClipboard(v);
                    toast.success("Copiato ✅");
                  }
                }}
              />
              <FieldRow
                label="K-number"
                value={detail.knumber}
                mono
                onCopy={async () => {
                  if (detail.knumber) {
                    await copyToClipboard(detail.knumber);
                    toast.success("Copiato ✅");
                  }
                }}
              />
              <FieldRow
                label="Seriale"
                value={detail.serial_number}
                mono
                onCopy={async () => {
                  if (detail.serial_number) {
                    await copyToClipboard(detail.serial_number);
                    toast.success("Copiato ✅");
                  }
                }}
              />

              <Divider />

              <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Rete
              </Typography>
              <FieldRow
                label="Hostname"
                value={detail.hostname}
                mono
                onCopy={async () => {
                  if (detail.hostname) {
                    await copyToClipboard(detail.hostname);
                    toast.success("Copiato ✅");
                  }
                }}
              />
              <FieldRow
                label="IP locale"
                value={detail.local_ip}
                mono
                onCopy={async () => {
                  if (detail.local_ip) {
                    await copyToClipboard(detail.local_ip);
                    toast.success("Copiato ✅");
                  }
                }}
              />
              <FieldRow
                label="IP SRSA"
                value={detail.srsa_ip}
                mono
                onCopy={async () => {
                  if (detail.srsa_ip) {
                    await copyToClipboard(detail.srsa_ip);
                    toast.success("Copiato ✅");
                  }
                }}
              />

              <Divider />

              <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Credenziali
              </Typography>
              {!canViewSecrets ? (
                <Typography variant="body2" sx={{ opacity: 0.7, fontStyle: "italic", mt: 0.5 }}>
                  Non autorizzato a visualizzare le password.
                </Typography>
              ) : null}
              <FieldRow
                label="Utente OS"
                value={detail.os_user}
                mono
                onCopy={async () => {
                  if (detail.os_user) {
                    await copyToClipboard(detail.os_user);
                    toast.success("Copiato ✅");
                  }
                }}
              />
              {canViewSecrets ? (
                <SecretRow
                  label="Password OS"
                  value={detail.os_pwd}
                  onCopy={async () => {
                    if (detail.os_pwd) {
                      await copyToClipboard(detail.os_pwd);
                      toast.success("Copiato ✅");
                    }
                  }}
                />
              ) : (
                <FieldRow label="Password OS" value="Non autorizzato" mono />
              )}
              <FieldRow
                label="Utente App"
                value={detail.app_usr}
                mono
                onCopy={async () => {
                  if (detail.app_usr) {
                    await copyToClipboard(detail.app_usr);
                    toast.success("Copiato ✅");
                  }
                }}
              />
              {canViewSecrets ? (
                <SecretRow
                  label="Password App"
                  value={detail.app_pwd}
                  onCopy={async () => {
                    if (detail.app_pwd) {
                      await copyToClipboard(detail.app_pwd);
                      toast.success("Copiato ✅");
                    }
                  }}
                />
              ) : (
                <FieldRow label="Password App" value="Non autorizzato" mono />
              )}
              {canViewSecrets ? (
                <SecretRow
                  label="Password VNC"
                  value={detail.vnc_pwd}
                  onCopy={async () => {
                    if (detail.vnc_pwd) {
                      await copyToClipboard(detail.vnc_pwd);
                      toast.success("Copiato ✅");
                    }
                  }}
                />
              ) : (
                <FieldRow label="Password VNC" value="Non autorizzato" mono />
              )}

              <Divider />

              <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Hardware
              </Typography>
              <FieldRow label="Produttore" value={detail.manufacturer ?? ""} />
              <FieldRow label="Modello" value={detail.model ?? ""} />
              <FieldRow label="Fine garanzia" value={detail.warranty_end_date ?? ""} mono />

              <CustomFieldsDisplay entity="inventory" value={detail.custom_fields} />

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
              <TextField size="small" label="K-number" value={form.knumber} onChange={(e) => setForm((f) => ({ ...f, knumber: e.target.value }))} fullWidth />
              <TextField size="small" label="Seriale" value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} fullWidth />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Hostname" value={form.hostname} onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))} fullWidth />
              <TextField size="small" label="IP locale" value={form.local_ip} onChange={(e) => setForm((f) => ({ ...f, local_ip: e.target.value }))} fullWidth />
              <TextField size="small" label="SRSA IP" value={form.srsa_ip} onChange={(e) => setForm((f) => ({ ...f, srsa_ip: e.target.value }))} fullWidth />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Utente OS" value={form.os_user} onChange={(e) => setForm((f) => ({ ...f, os_user: e.target.value }))} fullWidth />
              {canViewSecrets ? (
                <PasswordField label="Password OS" value={form.os_pwd} onChange={(v) => setForm((f) => ({ ...f, os_pwd: v }))} />
              ) : (
                <TextField size="small" label="Password OS" value="" fullWidth disabled helperText="Non autorizzato" />
              )}
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Utente App" value={form.app_usr} onChange={(e) => setForm((f) => ({ ...f, app_usr: e.target.value }))} fullWidth />
              {canViewSecrets ? (
                <PasswordField label="Password App" value={form.app_pwd} onChange={(v) => setForm((f) => ({ ...f, app_pwd: v }))} />
              ) : (
                <TextField size="small" label="Password App" value="" fullWidth disabled helperText="Non autorizzato" />
              )}
              {canViewSecrets ? (
                <PasswordField label="Password VNC" value={form.vnc_pwd} onChange={(v) => setForm((f) => ({ ...f, vnc_pwd: v }))} />
              ) : (
                <TextField size="small" label="Password VNC" value="" fullWidth disabled helperText="Non autorizzato" />
              )}
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Produttore" value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} fullWidth />
              <TextField size="small" label="Modello" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} fullWidth />
              <TextField size="small" label="Fine garanzia (YYYY-MM-DD)" value={form.warranty_end_date} onChange={(e) => setForm((f) => ({ ...f, warranty_end_date: e.target.value }))} fullWidth />
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
