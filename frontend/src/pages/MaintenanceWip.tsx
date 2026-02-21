import * as React from "react";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { GridColDef, GridRenderCellParams, GridRowSelectionModel } from "@mui/x-data-grid";

import { useServerGrid } from "../hooks/useServerGrid";
import { useUrlNumberParam, useUrlStringParam } from "../hooks/useUrlParam";
import { useDrfList } from "../hooks/useDrfList";
import { buildDrfListParams } from "../api/drf";
import { api } from "../api/client";
import { useToast } from "../ui/toast";
import { apiErrorToMessage } from "../api/error";
import { Can } from "../auth/Can";
import { PERMS } from "../auth/perms";
import EntityListCard from "../ui/EntityListCard";
import CustomFieldsEditor from "../ui/CustomFieldsEditor";
import CustomFieldsDisplay from "../ui/CustomFieldsDisplay";
import FilterChip from "../ui/FilterChip";
import DetailDrawerHeader from "../ui/DetailDrawerHeader";
import ConfirmDeleteDialog from "../ui/ConfirmDeleteDialog";
import { emptySelectionModel } from "../utils/gridSelection";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LookupItem   = { id: number; label: string };
type CustomerItem = { id: number; code: string; name: string };
type PlanRow = {
  id: number;
  customer: number;
  customer_code?: string | null;
  customer_name?: string | null;
  inventory_types: number[];
  inventory_type_labels?: string[];
  covered_count?: number;
  title: string;
  schedule_type: string;
  interval_value?: number | null;
  interval_unit?: string | null;
  fixed_month?: number | null;
  fixed_day?: number | null;
  next_due_date: string;
  last_done_date?: string | null;
  alert_days_before: number;
  is_active: boolean;
  notes?: string | null;
  custom_fields?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type PlanForm = {
  customer: number | "";
  inventory_types: number[];
  title: string;
  schedule_type: "interval" | "fixed_date";
  interval_value: number | "";
  interval_unit: "days" | "weeks" | "months" | "years" | "";
  fixed_month: number | "";
  fixed_day: number | "";
  next_due_date: string;
  next_due_date_auto: boolean;
  alert_days_before: number | "";
  is_active: boolean;
  notes: string;
  custom_fields: Record<string, any>;
};

type NotifRow = {
  id: number;
  due_date: string;
  sent_at: string;
  status: string;
  recipient_internal: string;
  recipient_tech: string;
  error_message?: string | null;
  customer_code?: string | null;
  customer_name?: string | null;
  inventory_hostname?: string | null;
  plan_title?: string | null;
};

type TechRow = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  notes?: string | null;
  deleted_at?: string | null;
};


type EventRow = {
  id: number;
  plan: number;
  plan_title?: string | null;
  inventory: number;
  inventory_hostname?: string | null;
  customer_code?: string | null;
  customer_name?: string | null;
  site_name?: string | null;
  performed_at: string;
  result: string;
  tech: number;
  tech_name?: string | null;
  notes?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EventForm = {
  plan: number | "";
  inventory: number | "";
  performed_at: string;
  result: "ok" | "ko" | "partial" | "";
  tech: number | "";
  notes: string;
};

type TechForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  notes: string;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const UNIT_IT: Record<string, string> = {
  days: "giorni", weeks: "settimane", months: "mesi", years: "anni",
};

function formatSchedule(row: {
  schedule_type: string;
  interval_value?: number | null; interval_unit?: string | null;
  fixed_month?: number | null;   fixed_day?: number | null;
}) {
  if (row.schedule_type === "interval" && row.interval_value && row.interval_unit)
    return `ogni ${row.interval_value} ${UNIT_IT[row.interval_unit] ?? row.interval_unit}`;
  if (row.schedule_type === "fixed_date" && row.fixed_day && row.fixed_month)
    return `${String(row.fixed_day).padStart(2, "0")}/${String(row.fixed_month).padStart(2, "0")} ogni anno`;
  return row.schedule_type;
}

async function copyText(t: string) { try { await navigator.clipboard.writeText(t); } catch { /**/ } }

function FieldRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  const v = value ?? "";
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75 }}>
      <Box sx={{ width: 130, flexShrink: 0, opacity: 0.6 }}>
        <Typography variant="body2">{label}</Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2"
          sx={{ fontFamily: mono ? "ui-monospace,monospace" : undefined, wordBreak: "break-word" }}>
          {v || "—"}
        </Typography>
      </Box>
      {v
        ? <Tooltip title="Copia"><IconButton size="small" onClick={() => copyText(v)}>
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          </IconButton></Tooltip>
        : <Box sx={{ width: 32 }} />}
    </Stack>
  );
}

const GRID_SX = {
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
} as const;

const DW = { xs: "100%", sm: 560 } as const;

// -----------------------------------------------------------------------------
// API: compute next_due_date
// -----------------------------------------------------------------------------

async function fetchComputedDueDate(
  scheduleType: string,
  intervalValue: number | "",
  intervalUnit: string,
  fixedMonth: number | "",
  fixedDay: number | "",
): Promise<string | null> {
  try {
    const params: Record<string, any> = { schedule_type: scheduleType };
    if (scheduleType === "interval") {
      if (!intervalValue || !intervalUnit) return null;
      params.interval_value = intervalValue;
      params.interval_unit = intervalUnit;
    } else {
      if (!fixedMonth || !fixedDay) return null;
      params.fixed_month = fixedMonth;
      params.fixed_day = fixedDay;
    }
    const res = await api.get<{ next_due_date: string }>(
      "/maintenance-plans/compute-due-date/", { params }
    );
    return res.data.next_due_date ?? null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// PIANI
// -----------------------------------------------------------------------------

const PLAN0: PlanForm = {
  customer: "",
  inventory_types: [],
  title: "",
  schedule_type: "interval",
  interval_value: "", interval_unit: "months",
  fixed_month: "", fixed_day: "",
  next_due_date: "", next_due_date_auto: true,
  alert_days_before: 14,
  is_active: true, notes: "",
  custom_fields: {},
};

function PlansTab() {
  const toast = useToast();
  const grid = useServerGrid({
    defaultOrdering: "next_due_date",
    allowedOrderingFields: ["next_due_date", "title", "updated_at"],
  });

  const [customerId, setCustomerId] = useUrlNumberParam("p_customer");
  const [dueFilter, setDue]         = useUrlStringParam("p_due");
  const [actFilter, setAct]         = useUrlStringParam("p_active");

  const { rows: customers } = useDrfList<CustomerItem>("/customers/", { ordering: "name", page_size: 500 });
  const { rows: invTypes }  = useDrfList<LookupItem>("/inventory-types/", { ordering: "label", page_size: 200 });

  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering,
    page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted, onlyDeleted: grid.onlyDeleted,
    extra: {
      ...(customerId ? { customer: customerId } : {}),
      ...(dueFilter  ? { due: dueFilter }       : {}),
      ...(actFilter  ? { is_active: actFilter }  : {}),
    },
  }), [grid.search, grid.ordering, grid.paginationModel, grid.includeDeleted, grid.onlyDeleted, customerId, dueFilter, actFilter]);

  const { rows, rowCount, loading, reload } = useDrfList<PlanRow>(
    "/maintenance-plans/", listParams,
    (e) => toast.error(apiErrorToMessage(e))
  );

  const openId = grid.openId;
  const [detail,   setDetail]  = React.useState<PlanRow | null>(null);
  const [dlLoading, setDlLd]   = React.useState(false);
  const [events,   setEvents]  = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!openId) { setDetail(null); setEvents([]); return; }
    setDlLd(true); setDetail(null); setEvents([]);
    Promise.all([
      api.get<PlanRow>(`/maintenance-plans/${openId}/`),
      api.get<{ results: any[] }>("/maintenance-events/", {
        params: { plan: openId, ordering: "-performed_at", page_size: 5 },
      }),
    ]).then(([p, e]) => { setDetail(p.data); setEvents(e.data.results ?? []); })
      .catch(() => {}).finally(() => setDlLd(false));
  }, [openId]);

  // CRUD state
  const [dlgOpen,   setDlgOpen]   = React.useState(false);
  const [dlgMode,   setDlgMode]   = React.useState<"create" | "edit">("create");
  const [dlgId,     setDlgId]     = React.useState<number | null>(null);
  const [dlgSave,   setDlgSave]   = React.useState(false);
  const [form,      setForm]      = React.useState<PlanForm>(PLAN0);
  const [delDlg,    setDelDlg]    = React.useState(false);
  const [delBusy,   setDelBusy]   = React.useState(false);
  const [resBusy,   setResBusy]   = React.useState(false);
  const [sel,       setSel]       = React.useState(emptySelectionModel());
  const [computing, setComputing] = React.useState(false);

  const ff = (p: Partial<PlanForm>) => setForm((x) => ({ ...x, ...p }));

  const autoCompute = React.useCallback(async (f: PlanForm) => {
    if (!f.next_due_date_auto) return;
    setComputing(true);
    const d = await fetchComputedDueDate(
      f.schedule_type, f.interval_value, f.interval_unit, f.fixed_month, f.fixed_day,
    );
    setComputing(false);
    if (d) setForm((x) => ({ ...x, next_due_date: d }));
  }, []);

  const scheduleKey = `${form.schedule_type}|${form.interval_value}|${form.interval_unit}|${form.fixed_month}|${form.fixed_day}`;
  const prevKey = React.useRef(scheduleKey);
  React.useEffect(() => {
    if (prevKey.current === scheduleKey) return;
    prevKey.current = scheduleKey;
    if (form.next_due_date_auto) void autoCompute(form);
  }, [scheduleKey, form.next_due_date_auto]);

  const openCreate = () => {
    setDlgMode("create"); setDlgId(null); setForm(PLAN0);
    prevKey.current = ""; setDlgOpen(true);
  };

  const openEdit = () => {
    if (!detail) return;
    setDlgMode("edit"); setDlgId(detail.id);
    const f: PlanForm = {
      customer: detail.customer ?? "",
      inventory_types: detail.inventory_types ?? [],
      title: detail.title ?? "",
      schedule_type: (detail.schedule_type as any) ?? "interval",
      interval_value: detail.interval_value ?? "",
      interval_unit: (detail.interval_unit as any) ?? "months",
      fixed_month: detail.fixed_month ?? "",
      fixed_day: detail.fixed_day ?? "",
      next_due_date: detail.next_due_date ?? "",
      next_due_date_auto: false,
      alert_days_before: detail.alert_days_before ?? 14,
      is_active: detail.is_active ?? true,
      notes: detail.notes ?? "",
      custom_fields: (detail.custom_fields as any) ?? {},
    };
    setForm(f);
    prevKey.current = `${f.schedule_type}|${f.interval_value}|${f.interval_unit}|${f.fixed_month}|${f.fixed_day}`;
    setDlgOpen(true);
  };

  const save = async () => {
    if (!form.customer)               { toast.warning("Seleziona un cliente."); return; }
    if (!form.inventory_types.length) { toast.warning("Seleziona almeno un tipo di inventario."); return; }
    if (!form.title.trim())           { toast.warning("Inserisci un titolo."); return; }
    if (!form.next_due_date)          { toast.warning("La data prevista è obbligatoria."); return; }
    if (form.schedule_type === "interval" && (!form.interval_value || !form.interval_unit))
      { toast.warning("Specifica valore e unità dell'intervallo."); return; }
    if (form.schedule_type === "fixed_date" && (!form.fixed_month || !form.fixed_day))
      { toast.warning("Specifica giorno e mese per la scadenza fissa."); return; }

    const payload: any = {
      customer: Number(form.customer),
      inventory_types: form.inventory_types,
      title: form.title.trim(),
      schedule_type: form.schedule_type,
      interval_value: form.schedule_type === "interval"   ? Number(form.interval_value) || null : null,
      interval_unit:  form.schedule_type === "interval"   ? form.interval_unit || null          : null,
      fixed_month:    form.schedule_type === "fixed_date" ? Number(form.fixed_month) || null    : null,
      fixed_day:      form.schedule_type === "fixed_date" ? Number(form.fixed_day)   || null    : null,
      next_due_date: form.next_due_date,
      alert_days_before: Number(form.alert_days_before) || 14,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
      custom_fields: Object.keys(form.custom_fields).length ? form.custom_fields : null,
    };

    setDlgSave(true);
    try {
      let id: number;
      if (dlgMode === "create") {
        const r = await api.post<PlanRow>("/maintenance-plans/", payload);
        id = r.data.id; toast.success("Piano creato ✅");
      } else {
        const r = await api.patch<PlanRow>(`/maintenance-plans/${dlgId}/`, payload);
        id = r.data.id; toast.success("Piano aggiornato ✅");
      }
      setDlgOpen(false); reload(); grid.setOpenId(id);
    } catch (e) { toast.error(apiErrorToMessage(e)); }
    finally { setDlgSave(false); }
  };

  const doDelete = async () => {
    if (!detail) return; setDelBusy(true);
    try {
      await api.delete(`/maintenance-plans/${detail.id}/`);
      toast.success("Piano eliminato ✅");
      grid.setViewMode("all", { keepOpen: true }); reload();
    } catch (e) { toast.error(apiErrorToMessage(e)); }
    finally { setDelBusy(false); setDelDlg(false); }
  };

  const doRestore = async () => {
    if (!detail) return; setResBusy(true);
    try {
      await api.post(`/maintenance-plans/${detail.id}/restore/`);
      toast.success("Piano ripristinato ✅"); reload();
      const r = await api.get<PlanRow>(`/maintenance-plans/${detail.id}/`); setDetail(r.data);
    } catch (e) { toast.error(apiErrorToMessage(e)); }
    finally { setResBusy(false); }
  };

  const columns: GridColDef<PlanRow>[] = React.useMemo(() => [
    { field: "customer_code",         headerName: "Cliente",         width: 90 },
    { field: "customer_name",         headerName: "",                width: 180 },
    { field: "inventory_type_labels", headerName: "Tipi inventario", flex: 1, minWidth: 200,
      valueGetter: (_v, row) => (row.inventory_type_labels ?? []).join(", ") || "—" },
    { field: "title",         headerName: "Piano",          width: 230 },
    { field: "covered_count", headerName: "Inventari",      width: 90,
      valueGetter: (_v, row) => row.covered_count ?? "—" },
    { field: "next_due_date", headerName: "Prossima scad.", width: 150 },
    { field: "last_done_date", headerName: "Ultima eseguita", width: 140 },
    { field: "is_active",     headerName: "Attivo",         width: 76,
      valueGetter: (_v, row) => row.is_active ? "Sì" : "No" },
    {
      field: "_act", headerName: "", width: 80, sortable: false, resizable: false,
      renderCell: (p: GridRenderCellParams<PlanRow>) => (
        <Box className="row-actions" sx={{ display: "flex", gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
          <Can perm={PERMS.maintenance.plan.change}>
            <Tooltip title="Modifica">
              <IconButton size="small" onClick={() => { grid.setOpenId(p.row.id); setTimeout(openEdit, 50); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Can>
          <Can perm={PERMS.maintenance.plan.delete}>
            <Tooltip title="Elimina">
              <IconButton size="small" color="error" onClick={() => { grid.setOpenId(p.row.id); setDelDlg(true); }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Can>
        </Box>
      ),
    },
  ], [detail]);

  const fcnt = [customerId, dueFilter, actFilter].filter(Boolean).length;
  const selectedTypeLabels = invTypes.filter((t) => form.inventory_types.includes(t.id)).map((t) => t.label);

  return (
    <>
      <EntityListCard
        toolbar={{
          q: grid.q, onQChange: grid.setQ,
          viewMode: grid.view, onViewModeChange: (v) => grid.setViewMode(v, { keepOpen: true }),
          onReset: () => { grid.reset(["p_customer","p_due","p_active"]); setCustomerId(""); setDue(""); setAct(""); },
          createButton: (
            <Can perm={PERMS.maintenance.plan.add}>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Nuovo</Button>
            </Can>
          ),
        }}
        grid={{
          rows, columns, loading, rowCount,
          paginationModel: grid.paginationModel, onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel, onSortModelChange: grid.onSortModelChange,
          onRowClick: (id) => grid.setOpenId(id),
          columnVisibilityModel: { deleted_at: grid.view === "deleted" },
          checkboxSelection: grid.view === "deleted",
          rowSelectionModel: sel, onRowSelectionModelChange: (m) => setSel(m as GridRowSelectionModel),
          sx: GRID_SX,
        }}
      >
        <FilterChip activeCount={fcnt}
          onReset={() => { setCustomerId(""); setDue(""); setAct(""); }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Cliente</InputLabel>
            <Select label="Cliente" value={customerId === "" ? "" : String(customerId)}
              onChange={(e) => setCustomerId(e.target.value === "" ? "" : Number(e.target.value))}>
              <MenuItem value="">Tutti</MenuItem>
              {customers.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Scadenza</InputLabel>
            <Select label="Scadenza" value={dueFilter} onChange={(e) => setDue(e.target.value)}>
              <MenuItem value="">Tutte</MenuItem>
              <MenuItem value="overdue">Scaduti</MenuItem>
              <MenuItem value="next7">Prossimi 7 giorni</MenuItem>
              <MenuItem value="next30">Prossimi 30 giorni</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Stato</InputLabel>
            <Select label="Stato" value={actFilter} onChange={(e) => setAct(e.target.value)}>
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="true">Attivi</MenuItem>
              <MenuItem value="false">Non attivi</MenuItem>
            </Select>
          </FormControl>
        </FilterChip>
      </EntityListCard>

      {/* Drawer dettaglio */}
      <Drawer anchor="right" open={Boolean(openId)} onClose={() => grid.setOpenId(null)}
        PaperProps={{ sx: { width: DW } }}>
        <Stack sx={{ p: 2 }} spacing={1.5}>
          <DetailDrawerHeader
            title={detail?.title ?? (openId ? `Piano #${openId}` : "Piano")}
            subtitle={detail?.customer_code ? `${detail.customer_code} — ${detail.customer_name}` : undefined}
            onClose={() => grid.setOpenId(null)} divider={false}
            actions={<>
              <Can perm={PERMS.maintenance.plan.change}>
                {detail?.deleted_at
                  ? <Tooltip title="Ripristina"><span>
                      <IconButton onClick={doRestore} disabled={resBusy}><RestoreFromTrashIcon /></IconButton>
                    </span></Tooltip>
                  : <Tooltip title="Modifica"><span>
                      <IconButton onClick={openEdit} disabled={!detail}><EditIcon /></IconButton>
                    </span></Tooltip>}
              </Can>
              <Can perm={PERMS.maintenance.plan.delete}>
                {!detail?.deleted_at && <Tooltip title="Elimina"><span>
                  <IconButton onClick={() => setDelDlg(true)} disabled={!detail || delBusy}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </span></Tooltip>}
              </Can>
            </>}
          />
          <Divider />
          {dlLoading
            ? <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
              </Stack>
            : detail ? (<>
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  <Chip size="small" label={detail.is_active ? "Attivo" : "Non attivo"}
                    color={detail.is_active ? "success" : "default"} />
                  {detail.deleted_at && <Chip size="small" label="Eliminato" color="error" />}
                </Stack>

                <Typography variant="subtitle2" sx={{ opacity: 0.6, mt: 0.5 }}>Copertura</Typography>
                <FieldRow label="Tipi inventario" value={(detail.inventory_type_labels ?? []).join(", ")} />
                <FieldRow label="Inventari attivi" value={detail.covered_count != null ? String(detail.covered_count) : "—"} />

                <Divider />
                <Typography variant="subtitle2" sx={{ opacity: 0.6 }}>Pianificazione</Typography>
                <FieldRow label="Tipo"    value={detail.schedule_type === "interval" ? "Intervallo" : "Data fissa"} />
                <FieldRow label="Cadenza" value={formatSchedule(detail)} />
                <FieldRow label="Prossima" value={detail.next_due_date} />
                <FieldRow label="Ultima eseguita" value={detail.last_done_date ?? "—"} />
                <FieldRow label="Allerta" value={`${detail.alert_days_before} giorni prima`} />

                {detail.notes && <>
                  <Divider />
                  <Typography variant="subtitle2" sx={{ opacity: 0.6 }}>Note</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{detail.notes}</Typography>
                </>}

                <CustomFieldsDisplay entity="maintenance_plan" value={detail.custom_fields} />

                {events.length > 0 && <>
                  <Divider />
                  <Typography variant="subtitle2" sx={{ opacity: 0.6 }}>Ultimi rapportini</Typography>
                  <Stack spacing={0.5}>
                    {events.map((e: any) => (
                      <Box key={e.id} sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {e.performed_at} · {e.result?.toUpperCase()}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>{e.tech_name ?? ""}</Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ opacity: 0.7, fontSize: 12 }}>
                          {e.inventory_hostname ?? ""}
                        </Typography>
                        {e.notes && <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.25 }}>{e.notes}</Typography>}
                      </Box>
                    ))}
                  </Stack>
                </>}
              </>)
            : <Typography variant="body2" sx={{ opacity: 0.6 }}>Nessun dettaglio disponibile.</Typography>}
        </Stack>
      </Drawer>

      {/* Dialog crea / modifica */}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dlgMode === "create" ? "Nuovo piano" : "Modifica piano"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>

            <FormControl size="small" fullWidth required>
              <InputLabel>Cliente *</InputLabel>
              <Select label="Cliente *"
                value={form.customer === "" ? "" : String(form.customer)}
                onChange={(e) => ff({ customer: e.target.value === "" ? "" : Number(e.target.value) })}>
                <MenuItem value="">—</MenuItem>
                {customers.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth required>
              <InputLabel>Tipi inventario *</InputLabel>
              <Select
                multiple
                label="Tipi inventario *"
                value={form.inventory_types}
                onChange={(e) => {
                  const v = e.target.value;
                  ff({ inventory_types: typeof v === "string" ? v.split(",").map(Number) : (v as number[]) });
                }}
                input={<OutlinedInput label="Tipi inventario *" />}
                renderValue={() => selectedTypeLabels.join(", ")}
              >
                {invTypes.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    <Checkbox checked={form.inventory_types.includes(t.id)} size="small" />
                    <ListItemText primary={t.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField size="small" label="Titolo *" value={form.title} fullWidth
              onChange={(e) => ff({ title: e.target.value })} />

            <FormControl size="small" fullWidth>
              <InputLabel>Tipo pianificazione</InputLabel>
              <Select label="Tipo pianificazione" value={form.schedule_type}
                onChange={(e) => ff({ schedule_type: e.target.value as "interval" | "fixed_date" })}>
                <MenuItem value="interval">Intervallo</MenuItem>
                <MenuItem value="fixed_date">Data fissa</MenuItem>
              </Select>
            </FormControl>

            {form.schedule_type === "interval" && (
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Ogni *" type="number" inputProps={{ min: 1 }}
                  value={form.interval_value}
                  onChange={(e) => ff({ interval_value: e.target.value === "" ? "" : Number(e.target.value) })}
                  sx={{ flex: 1 }} />
                <FormControl size="small" sx={{ flex: 2 }}>
                  <InputLabel>Unità *</InputLabel>
                  <Select label="Unità *" value={form.interval_unit}
                    onChange={(e) => ff({ interval_unit: e.target.value as any })}>
                    <MenuItem value="days">Giorni</MenuItem>
                    <MenuItem value="weeks">Settimane</MenuItem>
                    <MenuItem value="months">Mesi</MenuItem>
                    <MenuItem value="years">Anni</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}

            {form.schedule_type === "fixed_date" && (
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Giorno *" type="number" inputProps={{ min: 1, max: 31 }}
                  value={form.fixed_day}
                  onChange={(e) => ff({ fixed_day: e.target.value === "" ? "" : Number(e.target.value) })}
                  sx={{ flex: 1 }} />
                <TextField size="small" label="Mese *" type="number" inputProps={{ min: 1, max: 12 }}
                  value={form.fixed_month}
                  onChange={(e) => ff({ fixed_month: e.target.value === "" ? "" : Number(e.target.value) })}
                  sx={{ flex: 1 }} />
              </Stack>
            )}

            <Box>
              <FormControlLabel
                control={
                  <Switch size="small" checked={form.next_due_date_auto}
                    onChange={(e) => {
                      ff({ next_due_date_auto: e.target.checked });
                      if (e.target.checked) void autoCompute({ ...form, next_due_date_auto: true });
                    }} />
                }
                label={
                  <Typography variant="body2">
                    Calcola data automaticamente
                    {computing && <CircularProgress size={10} sx={{ ml: 0.75 }} />}
                  </Typography>
                }
              />
              <TextField size="small" label="Data prevista *" type="date" fullWidth
                value={form.next_due_date} InputLabelProps={{ shrink: true }}
                disabled={form.next_due_date_auto && Boolean(form.next_due_date)}
                onChange={(e) => ff({ next_due_date: e.target.value, next_due_date_auto: false })}
                helperText={form.next_due_date_auto
                  ? "Calcolata: 01/01 + intervallo − 1 giorno (es. 6 mesi → 30/06)"
                  : "Inserita manualmente"} />
            </Box>

            <TextField size="small" label="Giorni allerta" type="number" inputProps={{ min: 0 }}
              value={form.alert_days_before} fullWidth
              onChange={(e) => ff({ alert_days_before: e.target.value === "" ? "" : Number(e.target.value) })} />

            <FormControlLabel
              control={<Switch checked={form.is_active} onChange={(e) => ff({ is_active: e.target.checked })} />}
              label="Attivo" />

            <TextField size="small" label="Note" value={form.notes} fullWidth multiline minRows={2}
              onChange={(e) => ff({ notes: e.target.value })} />

            <CustomFieldsEditor
              entity="maintenance_plan"
              value={form.custom_fields}
              onChange={(v) => ff({ custom_fields: v })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDlgOpen(false)}>Annulla</Button>
          <Button variant="contained" onClick={save} disabled={dlgSave || computing}>
            {dlgSave ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog open={delDlg} title="Elimina piano"
        description={`Eliminare il piano "${detail?.title}"? L'operazione è reversibile dal cestino.`}
        busy={delBusy} onConfirm={doDelete} onClose={() => setDelDlg(false)} />
    </>
  );
}

// -----------------------------------------------------------------------------
// NOTIFICHE (read-only)
// -----------------------------------------------------------------------------

function NotificationsTab() {
  const toast = useToast();
  const grid = useServerGrid({ defaultOrdering: "-sent_at", allowedOrderingFields: ["sent_at","due_date","updated_at"] });

  const [customerId, setCustomerId] = useUrlNumberParam("n_customer");
  const [statusF,    setStatusF]    = useUrlStringParam("n_status");

  const { rows: customers } = useDrfList<CustomerItem>("/customers/", { ordering: "name", page_size: 500 });

  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering,
    page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    extra: {
      ...(customerId ? { customer: customerId } : {}),
      ...(statusF    ? { status:   statusF }    : {}),
    },
  }), [grid.search, grid.ordering, grid.paginationModel, customerId, statusF]);

  const { rows, rowCount, loading } = useDrfList<NotifRow>(
    "/maintenance-notifications/", listParams,
    (e) => toast.error(apiErrorToMessage(e))
  );
  const openId = grid.openId;
  const detail = rows.find((r) => r.id === openId) ?? null;

  const columns: GridColDef<NotifRow>[] = React.useMemo(() => [
    { field: "due_date", headerName: "Scadenza", width: 130 },
    { field: "status",   headerName: "Stato",    width: 100,
      renderCell: (p) => <Chip size="small" label={p.value} color={p.value === "sent" ? "success" : "error"} /> },
    { field: "customer_code",      headerName: "Cliente",    width: 90 },
    { field: "inventory_hostname", headerName: "Inventario", width: 200 },
    { field: "plan_title",         headerName: "Piano",      flex: 1, minWidth: 220 },
    { field: "sent_at",            headerName: "Inviata",    width: 180,
      valueGetter: (_v, row) => row.sent_at ? new Date(row.sent_at).toLocaleString("it-IT") : "—" },
  ], []);

  const fcnt = [customerId, statusF].filter(Boolean).length;

  return (
    <>
      <EntityListCard
        toolbar={{
          q: grid.q, onQChange: grid.setQ,
          onReset: () => { grid.reset(["n_customer","n_status"]); setCustomerId(""); setStatusF(""); },
        }}
        grid={{
          rows, columns, loading, rowCount,
          paginationModel: grid.paginationModel, onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel, onSortModelChange: grid.onSortModelChange,
          onRowClick: (id) => grid.setOpenId(id), sx: GRID_SX,
        }}
      >
        <FilterChip activeCount={fcnt} onReset={() => { setCustomerId(""); setStatusF(""); }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Cliente</InputLabel>
            <Select label="Cliente" value={customerId === "" ? "" : String(customerId)}
              onChange={(e) => setCustomerId(e.target.value === "" ? "" : Number(e.target.value))}>
              <MenuItem value="">Tutti</MenuItem>
              {customers.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Stato</InputLabel>
            <Select label="Stato" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="sent">Inviata</MenuItem>
              <MenuItem value="failed">Fallita</MenuItem>
            </Select>
          </FormControl>
        </FilterChip>
      </EntityListCard>

      <Drawer anchor="right" open={Boolean(openId)} onClose={() => grid.setOpenId(null)}
        PaperProps={{ sx: { width: DW } }}>
        <Stack sx={{ p: 2 }} spacing={1.5}>
          <DetailDrawerHeader
            title={detail?.plan_title ?? (openId ? `Notifica #${openId}` : "Notifica")}
            subtitle={detail?.customer_code ? `${detail.customer_code} — ${detail.inventory_hostname ?? ""}` : ""}
            onClose={() => grid.setOpenId(null)} />
          <Divider />
          {detail ? (<>
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              <Chip size="small" label={detail.status} color={detail.status === "sent" ? "success" : "error"} />
              <Chip size="small" label={`Scadenza: ${detail.due_date}`} />
            </Stack>
            <Typography variant="subtitle2" sx={{ opacity: 0.6 }}>Destinatari</Typography>
            <FieldRow label="Interno" value={detail.recipient_internal} mono />
            <FieldRow label="Tecnico" value={detail.recipient_tech}     mono />
            <Divider />
            <Typography variant="subtitle2" sx={{ opacity: 0.6 }}>Invio</Typography>
            <FieldRow label="Data invio" value={detail.sent_at ? new Date(detail.sent_at).toLocaleString("it-IT") : ""} />
            {detail.error_message && <>
              <Divider />
              <Typography variant="subtitle2" sx={{ opacity: 0.6, color: "error.main" }}>Errore</Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{detail.error_message}</Typography>
            </>}
          </>) : (
            <Typography variant="body2" sx={{ opacity: 0.6 }}>Nessun dettaglio disponibile.</Typography>
          )}
        </Stack>
      </Drawer>
    </>
  );
}

// -----------------------------------------------------------------------------
// RAPPORTINI
// -----------------------------------------------------------------------------

const RESULT_COLORS: Record<string, "success" | "error" | "warning"> = {
  ok: "success", ko: "error", partial: "warning",
};
const RESULT_LABELS: Record<string, string> = {
  ok: "OK", ko: "KO", partial: "Parziale",
};

type InventoryItem = { id: number; hostname?: string | null; knumber?: string | null; type_label?: string | null };

const EVENT0: EventForm = {
  plan: "", inventory: "", performed_at: new Date().toISOString().slice(0, 10),
  result: "", tech: "", notes: "",
};

function EventsTab() {
  const toast = useToast();
  const grid = useServerGrid({
    defaultOrdering: "-performed_at",
    allowedOrderingFields: ["performed_at", "updated_at"],
  });

  const [customerId, setCustomerId] = useUrlNumberParam("ev_customer");
  const [resultF,    setResultF]    = useUrlStringParam("ev_result");
  const [planF,      setPlanF]      = useUrlNumberParam("ev_plan");

  const { rows: customers }  = useDrfList<CustomerItem>("/customers/", { ordering: "name", page_size: 500 });
  const { rows: allPlans }   = useDrfList<{ id: number; title: string; customer: number }>(
    "/maintenance-plans/", { ordering: "title", page_size: 500, is_active: "true" }
  );
  const { rows: allTechs }   = useDrfList<{ id: number; full_name: string; is_active: boolean }>(
    "/techs/", { ordering: "last_name", page_size: 500, is_active: "true" }
  );

  // Inventari caricati dinamicamente in base al piano selezionato nel form
  const [formInventories, setFormInventories] = React.useState<InventoryItem[]>([]);

  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering,
    page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted, onlyDeleted: grid.onlyDeleted,
    extra: {
      ...(customerId ? { customer: customerId } : {}),
      ...(resultF    ? { result: resultF }      : {}),
      ...(planF      ? { plan: planF }          : {}),
    },
  }), [grid.search, grid.ordering, grid.paginationModel, grid.includeDeleted, grid.onlyDeleted, customerId, resultF, planF]);

  const { rows, rowCount, loading, reload } = useDrfList<EventRow>(
    "/maintenance-events/", listParams,
    (e) => toast.error(apiErrorToMessage(e))
  );

  const openId = grid.openId;
  const [detail,  setDetail]  = React.useState<EventRow | null>(null);
  const [dlLoading, setDlLd]  = React.useState(false);
  React.useEffect(() => {
    if (!openId) { setDetail(null); return; }
    setDlLd(true);
    api.get<EventRow>(`/maintenance-events/${openId}/`)
      .then((r) => setDetail(r.data)).catch(() => {}).finally(() => setDlLd(false));
  }, [openId]);

  // CRUD state
  const [dlgOpen,  setDlgOpen]  = React.useState(false);
  const [dlgMode,  setDlgMode]  = React.useState<"create" | "edit">("create");
  const [dlgId,    setDlgId]    = React.useState<number | null>(null);
  const [dlgSave,  setDlgSave]  = React.useState(false);
  const [form,     setForm]     = React.useState<EventForm>(EVENT0);
  const [delDlg,   setDelDlg]   = React.useState(false);
  const [delBusy,  setDelBusy]  = React.useState(false);
  const [resBusy,  setResBusy]  = React.useState(false);
  const ff = (p: Partial<EventForm>) => setForm((x) => ({ ...x, ...p }));

  // Carica inventari del piano selezionato nel form
  React.useEffect(() => {
    if (!form.plan) { setFormInventories([]); return; }
    api.get<{ results: any[] }>("/inventories/", {
      params: { page_size: 500, ordering: "hostname" },
    }).then((r) => {
      // Filtra client-side per covered inventories — in mancanza di endpoint dedicato
      // mostriamo tutti gli inventory (il backend non espone covered list direttamente)
      setFormInventories(r.data.results ?? []);
    }).catch(() => {});
  }, [form.plan]);

  const openCreate = () => {
    setDlgMode("create"); setDlgId(null);
    setForm({ ...EVENT0, performed_at: new Date().toISOString().slice(0, 10) });
    setDlgOpen(true);
  };

  const openEdit = () => {
    if (!detail) return;
    setDlgMode("edit"); setDlgId(detail.id);
    setForm({
      plan:         detail.plan ?? "",
      inventory:    detail.inventory ?? "",
      performed_at: detail.performed_at ?? new Date().toISOString().slice(0, 10),
      result:       (detail.result as any) ?? "",
      tech:         detail.tech ?? "",
      notes:        detail.notes ?? "",
    });
    setDlgOpen(true);
  };

  const save = async () => {
    if (!form.plan)         { toast.warning("Seleziona un piano."); return; }
    if (!form.inventory)    { toast.warning("Seleziona un inventario."); return; }
    if (!form.performed_at) { toast.warning("Inserisci la data di esecuzione."); return; }
    if (!form.result)       { toast.warning("Seleziona il risultato."); return; }
    if (!form.tech)         { toast.warning("Seleziona un tecnico."); return; }

    const payload = {
      plan:         Number(form.plan),
      inventory:    Number(form.inventory),
      performed_at: form.performed_at,
      result:       form.result,
      tech:         Number(form.tech),
      notes:        form.notes.trim() || null,
    };

    setDlgSave(true);
    try {
      let id: number;
      if (dlgMode === "create") {
        const r = await api.post<EventRow>("/maintenance-events/", payload);
        id = r.data.id; toast.success("Rapportino creato ✅");
      } else {
        const r = await api.patch<EventRow>(`/maintenance-events/${dlgId}/`, payload);
        id = r.data.id; toast.success("Rapportino aggiornato ✅");
      }
      setDlgOpen(false); reload(); grid.setOpenId(id);
    } catch (e) { toast.error(apiErrorToMessage(e)); }
    finally { setDlgSave(false); }
  };

  const doDelete = async () => {
    if (!detail) return; setDelBusy(true);
    try {
      await api.delete(`/maintenance-events/${detail.id}/`);
      toast.success("Rapportino eliminato ✅");
      grid.setViewMode("all", { keepOpen: true }); reload();
    } catch (e) { toast.error(apiErrorToMessage(e)); }
    finally { setDelBusy(false); setDelDlg(false); }
  };

  const doRestore = async () => {
    if (!detail) return; setResBusy(true);
    try {
      await api.post(`/maintenance-events/${detail.id}/restore/`);
      toast.success("Rapportino ripristinato ✅"); reload();
      const r = await api.get<EventRow>(`/maintenance-events/${detail.id}/`); setDetail(r.data);
    } catch (e) { toast.error(apiErrorToMessage(e)); }
    finally { setResBusy(false); }
  };

  const columns: GridColDef<EventRow>[] = React.useMemo(() => [
    { field: "performed_at",      headerName: "Data",        width: 120 },
    { field: "result",            headerName: "Risultato",   width: 110,
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Chip size="small"
          label={RESULT_LABELS[p.value as string] ?? p.value}
          color={RESULT_COLORS[p.value as string] ?? "default"} />
      )},
    { field: "customer_code",     headerName: "Cliente",     width: 90 },
    { field: "plan_title",        headerName: "Piano",       flex: 1, minWidth: 200 },
    { field: "inventory_hostname",headerName: "Inventario",  width: 200 },
    { field: "tech_name",         headerName: "Tecnico",     width: 180 },
    {
      field: "_act", headerName: "", width: 80, sortable: false, resizable: false,
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Box className="row-actions" sx={{ display: "flex", gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
          <Can perm={PERMS.maintenance.event.change}>
            <Tooltip title="Modifica">
              <IconButton size="small" onClick={() => { grid.setOpenId(p.row.id); setTimeout(openEdit, 50); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Can>
          <Can perm={PERMS.maintenance.event.delete}>
            <Tooltip title="Elimina">
              <IconButton size="small" color="error" onClick={() => { grid.setOpenId(p.row.id); setDelDlg(true); }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Can>
        </Box>
      ),
    },
  ], [detail]);

  const fcnt = [customerId, resultF, planF].filter(Boolean).length;

  return (
    <>
      <EntityListCard
        toolbar={{
          q: grid.q, onQChange: grid.setQ,
          viewMode: grid.view, onViewModeChange: (v) => grid.setViewMode(v, { keepOpen: true }),
          onReset: () => { grid.reset(["ev_customer","ev_result","ev_plan"]); setCustomerId(""); setResultF(""); setPlanF(""); },
          createButton: (
            <Can perm={PERMS.maintenance.event.add}>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Nuovo</Button>
            </Can>
          ),
        }}
        grid={{
          rows, columns, loading, rowCount,
          paginationModel: grid.paginationModel, onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel, onSortModelChange: grid.onSortModelChange,
          onRowClick: (id) => grid.setOpenId(id),
          columnVisibilityModel: { deleted_at: grid.view === "deleted" },
          sx: GRID_SX,
        }}
      >
        <FilterChip activeCount={fcnt}
          onReset={() => { setCustomerId(""); setResultF(""); setPlanF(""); }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Cliente</InputLabel>
            <Select label="Cliente" value={customerId === "" ? "" : String(customerId)}
              onChange={(e) => setCustomerId(e.target.value === "" ? "" : Number(e.target.value))}>
              <MenuItem value="">Tutti</MenuItem>
              {customers.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Risultato</InputLabel>
            <Select label="Risultato" value={resultF} onChange={(e) => setResultF(e.target.value)}>
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="ok">OK</MenuItem>
              <MenuItem value="ko">KO</MenuItem>
              <MenuItem value="partial">Parziale</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Piano</InputLabel>
            <Select label="Piano" value={planF === "" ? "" : String(planF)}
              onChange={(e) => setPlanF(e.target.value === "" ? "" : Number(e.target.value))}>
              <MenuItem value="">Tutti</MenuItem>
              {allPlans.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.title}</MenuItem>)}
            </Select>
          </FormControl>
        </FilterChip>
      </EntityListCard>

      {/* Drawer dettaglio */}
      <Drawer anchor="right" open={Boolean(openId)} onClose={() => grid.setOpenId(null)}
        PaperProps={{ sx: { width: DW } }}>
        <Stack sx={{ p: 2 }} spacing={1.5}>
          <DetailDrawerHeader
            title={detail?.plan_title ?? (openId ? `Rapportino #${openId}` : "Rapportino")}
            subtitle={detail
              ? `${detail.customer_code ?? ""} · ${detail.inventory_hostname ?? ""} · ${detail.performed_at}`
              : undefined}
            onClose={() => grid.setOpenId(null)} divider={false}
            actions={<>
              <Can perm={PERMS.maintenance.event.change}>
                {detail?.deleted_at
                  ? <Tooltip title="Ripristina"><span>
                      <IconButton onClick={doRestore} disabled={resBusy}><RestoreFromTrashIcon /></IconButton>
                    </span></Tooltip>
                  : <Tooltip title="Modifica"><span>
                      <IconButton onClick={openEdit} disabled={!detail}><EditIcon /></IconButton>
                    </span></Tooltip>}
              </Can>
              <Can perm={PERMS.maintenance.event.delete}>
                {!detail?.deleted_at && <Tooltip title="Elimina"><span>
                  <IconButton onClick={() => setDelDlg(true)} disabled={!detail || delBusy}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </span></Tooltip>}
              </Can>
            </>}
          />
          <Divider />
          {dlLoading
            ? <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
              </Stack>
            : detail ? (<>
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  <Chip size="small"
                    label={RESULT_LABELS[detail.result] ?? detail.result}
                    color={RESULT_COLORS[detail.result] ?? "default"} />
                  {detail.deleted_at && <Chip size="small" label="Eliminato" color="error" />}
                </Stack>
                <Typography variant="subtitle2" sx={{ opacity: 0.6, mt: 0.5 }}>Esecuzione</Typography>
                <FieldRow label="Data"       value={detail.performed_at} />
                <FieldRow label="Tecnico"    value={detail.tech_name} />
                <Divider />
                <Typography variant="subtitle2" sx={{ opacity: 0.6 }}>Contesto</Typography>
                <FieldRow label="Piano"      value={detail.plan_title} />
                <FieldRow label="Cliente"    value={detail.customer_code ? `${detail.customer_code} — ${detail.customer_name}` : ""} />
                <FieldRow label="Inventario" value={detail.inventory_hostname} />
                <FieldRow label="Sito"       value={detail.site_name} />
                {detail.notes && <>
                  <Divider />
                  <Typography variant="subtitle2" sx={{ opacity: 0.6 }}>Note</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{detail.notes}</Typography>
                </>}
              </>)
            : <Typography variant="body2" sx={{ opacity: 0.6 }}>Nessun dettaglio disponibile.</Typography>}
        </Stack>
      </Drawer>

      {/* Dialog crea / modifica */}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dlgMode === "create" ? "Nuovo rapportino" : "Modifica rapportino"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>

            <FormControl size="small" fullWidth required>
              <InputLabel>Piano *</InputLabel>
              <Select label="Piano *"
                value={form.plan === "" ? "" : String(form.plan)}
                onChange={(e) => ff({ plan: e.target.value === "" ? "" : Number(e.target.value), inventory: "" })}>
                <MenuItem value="">—</MenuItem>
                {allPlans.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.title}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth required>
              <InputLabel>Inventario *</InputLabel>
              <Select label="Inventario *"
                value={form.inventory === "" ? "" : String(form.inventory)}
                onChange={(e) => ff({ inventory: e.target.value === "" ? "" : Number(e.target.value) })}
                disabled={!form.plan}>
                <MenuItem value="">—</MenuItem>
                {formInventories.map((i) => (
                  <MenuItem key={i.id} value={String(i.id)}>
                    {i.hostname || `#${i.id}`}{i.knumber ? ` · ${i.knumber}` : ""}{i.type_label ? ` (${i.type_label})` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField size="small" label="Data esecuzione *" type="date" fullWidth
              value={form.performed_at} InputLabelProps={{ shrink: true }}
              onChange={(e) => ff({ performed_at: e.target.value })} />

            <FormControl size="small" fullWidth required>
              <InputLabel>Risultato *</InputLabel>
              <Select label="Risultato *" value={form.result}
                onChange={(e) => ff({ result: e.target.value as any })}>
                <MenuItem value="">—</MenuItem>
                <MenuItem value="ok">OK</MenuItem>
                <MenuItem value="ko">KO</MenuItem>
                <MenuItem value="partial">Parziale</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth required>
              <InputLabel>Tecnico *</InputLabel>
              <Select label="Tecnico *"
                value={form.tech === "" ? "" : String(form.tech)}
                onChange={(e) => ff({ tech: e.target.value === "" ? "" : Number(e.target.value) })}>
                <MenuItem value="">—</MenuItem>
                {allTechs.map((t) => <MenuItem key={t.id} value={String(t.id)}>{t.full_name}</MenuItem>)}
              </Select>
            </FormControl>

            <TextField size="small" label="Note" value={form.notes} fullWidth multiline minRows={2}
              onChange={(e) => ff({ notes: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDlgOpen(false)}>Annulla</Button>
          <Button variant="contained" onClick={save} disabled={dlgSave}>
            {dlgSave ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog open={delDlg} title="Elimina rapportino"
        description={`Eliminare il rapportino del ${detail?.performed_at} per "${detail?.plan_title}"?`}
        busy={delBusy} onConfirm={doDelete} onClose={() => setDelDlg(false)} />
    </>
  );
}

// -----------------------------------------------------------------------------
// TECNICI
// -----------------------------------------------------------------------------

const TECH0: TechForm = { first_name: "", last_name: "", email: "", phone: "", is_active: true, notes: "" };

function TechsTab() {
  const toast = useToast();
  const grid = useServerGrid({ defaultOrdering: "last_name", allowedOrderingFields: ["last_name","first_name","updated_at"] });
  const [actF, setActF] = useUrlStringParam("tc_active");

  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering,
    page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted, onlyDeleted: grid.onlyDeleted,
    extra: { ...(actF ? { is_active: actF } : {}) },
  }), [grid.search, grid.ordering, grid.paginationModel, grid.includeDeleted, grid.onlyDeleted, actF]);

  const { rows, rowCount, loading, reload } = useDrfList<TechRow>(
    "/techs/", listParams,
    (e) => toast.error(apiErrorToMessage(e))
  );

  const openId = grid.openId;
  const [detail, setDetail] = React.useState<TechRow | null>(null);
  const [dlLd,   setDlLd]   = React.useState(false);
  React.useEffect(() => {
    if (!openId) { setDetail(null); return; }
    setDlLd(true);
    api.get<TechRow>(`/techs/${openId}/`).then((r) => setDetail(r.data)).catch(() => {}).finally(() => setDlLd(false));
  }, [openId]);

  const [dlgOpen, setDlgOpen] = React.useState(false);
  const [dlgMode, setDlgMode] = React.useState<"create" | "edit">("create");
  const [dlgId,   setDlgId]   = React.useState<number | null>(null);
  const [dlgSave, setDlgSave] = React.useState(false);
  const [form,    setForm]    = React.useState<TechForm>(TECH0);
  const [delDlg,  setDelDlg]  = React.useState(false);
  const [delBusy, setDelBusy] = React.useState(false);
  const [resBusy, setResBusy] = React.useState(false);
  const ff = (p: Partial<TechForm>) => setForm((x) => ({ ...x, ...p }));

  const openCreate = () => { setDlgMode("create"); setDlgId(null); setForm(TECH0); setDlgOpen(true); };
  const openEdit   = () => {
    if (!detail) return;
    setDlgMode("edit"); setDlgId(detail.id);
    setForm({ first_name: detail.first_name, last_name: detail.last_name,
      email: detail.email, phone: detail.phone ?? "", is_active: detail.is_active, notes: detail.notes ?? "" });
    setDlgOpen(true);
  };

  const save = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      toast.warning("Nome, cognome ed email sono obbligatori."); return;
    }
    const payload = { first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      email: form.email.trim(), phone: form.phone.trim() || null,
      is_active: form.is_active, notes: form.notes.trim() || null };
    setDlgSave(true);
    try {
      let id: number;
      if (dlgMode === "create") { const r = await api.post<TechRow>("/techs/", payload); id = r.data.id; toast.success("Tecnico creato ✅"); }
      else                      { const r = await api.patch<TechRow>(`/techs/${dlgId}/`, payload); id = r.data.id; toast.success("Tecnico aggiornato ✅"); }
      setDlgOpen(false); reload(); grid.setOpenId(id);
    } catch (e) { toast.error(apiErrorToMessage(e)); }
    finally { setDlgSave(false); }
  };

  const doDelete = async () => {
    if (!detail) return; setDelBusy(true);
    try { await api.delete(`/techs/${detail.id}/`); toast.success("Tecnico eliminato ✅"); grid.setViewMode("all", { keepOpen: true }); reload(); }
    catch (e) { toast.error(apiErrorToMessage(e)); }
    finally { setDelBusy(false); setDelDlg(false); }
  };

  const doRestore = async () => {
    if (!detail) return; setResBusy(true);
    try {
      await api.post(`/techs/${detail.id}/restore/`); toast.success("Tecnico ripristinato ✅"); reload();
      const r = await api.get<TechRow>(`/techs/${detail.id}/`); setDetail(r.data);
    } catch (e) { toast.error(apiErrorToMessage(e)); }
    finally { setResBusy(false); }
  };

  const columns: GridColDef<TechRow>[] = React.useMemo(() => [
    { field: "full_name", headerName: "Tecnico",   flex: 1, minWidth: 220 },
    { field: "email",     headerName: "Email",     width: 240 },
    { field: "phone",     headerName: "Telefono",  width: 160 },
    { field: "is_active", headerName: "Attivo",    width: 76, valueGetter: (_v, row) => row.is_active ? "Sì" : "No" },
    {
      field: "_act", headerName: "", width: 80, sortable: false, resizable: false,
      renderCell: (p: GridRenderCellParams<TechRow>) => (
        <Box className="row-actions" sx={{ display: "flex", gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
          <Can perm={PERMS.maintenance.tech.change}>
            <Tooltip title="Modifica">
              <IconButton size="small" onClick={() => { grid.setOpenId(p.row.id); setTimeout(openEdit, 50); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Can>
          <Can perm={PERMS.maintenance.tech.delete}>
            <Tooltip title="Elimina">
              <IconButton size="small" color="error" onClick={() => { grid.setOpenId(p.row.id); setDelDlg(true); }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Can>
        </Box>
      ),
    },
  ], [detail]);

  return (
    <>
      <EntityListCard
        toolbar={{
          q: grid.q, onQChange: grid.setQ,
          viewMode: grid.view, onViewModeChange: (v) => grid.setViewMode(v, { keepOpen: true }),
          onReset: () => { grid.reset(["tc_active"]); setActF(""); },
          createButton: (
            <Can perm={PERMS.maintenance.tech.add}>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Nuovo</Button>
            </Can>
          ),
        }}
        grid={{
          rows, columns, loading, rowCount,
          paginationModel: grid.paginationModel, onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel, onSortModelChange: grid.onSortModelChange,
          onRowClick: (id) => grid.setOpenId(id),
          columnVisibilityModel: { deleted_at: grid.view === "deleted" }, sx: GRID_SX,
        }}
      >
        <FilterChip activeCount={actF ? 1 : 0} onReset={() => setActF("")}>
          <FormControl size="small" fullWidth>
            <InputLabel>Stato</InputLabel>
            <Select label="Stato" value={actF} onChange={(e) => setActF(e.target.value)}>
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="true">Attivi</MenuItem>
              <MenuItem value="false">Non attivi</MenuItem>
            </Select>
          </FormControl>
        </FilterChip>
      </EntityListCard>

      <Drawer anchor="right" open={Boolean(openId)} onClose={() => grid.setOpenId(null)}
        PaperProps={{ sx: { width: DW } }}>
        <Stack sx={{ p: 2 }} spacing={1.5}>
          <DetailDrawerHeader
            title={detail?.full_name ?? (openId ? `Tecnico #${openId}` : "Tecnico")}
            subtitle={detail ? (detail.is_active ? "Attivo" : "Non attivo") : undefined}
            onClose={() => grid.setOpenId(null)} divider={false}
            actions={<>
              <Can perm={PERMS.maintenance.tech.change}>
                {detail?.deleted_at
                  ? <Tooltip title="Ripristina"><span>
                      <IconButton onClick={doRestore} disabled={resBusy}><RestoreFromTrashIcon /></IconButton>
                    </span></Tooltip>
                  : <Tooltip title="Modifica"><span>
                      <IconButton onClick={openEdit} disabled={!detail}><EditIcon /></IconButton>
                    </span></Tooltip>}
              </Can>
              <Can perm={PERMS.maintenance.tech.delete}>
                {!detail?.deleted_at && <Tooltip title="Elimina"><span>
                  <IconButton onClick={() => setDelDlg(true)} disabled={!detail || delBusy}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </span></Tooltip>}
              </Can>
            </>}
          />
          <Divider />
          {dlLd
            ? <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
              </Stack>
            : detail ? (<>
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  <Chip size="small" label={detail.is_active ? "Attivo" : "Non attivo"} color={detail.is_active ? "success" : "default"} />
                  {detail.deleted_at && <Chip size="small" label="Eliminato" color="error" />}
                </Stack>
                <Typography variant="subtitle2" sx={{ opacity: 0.6 }}>Contatti</Typography>
                <FieldRow label="Email"    value={detail.email} mono />
                <FieldRow label="Telefono" value={detail.phone} mono />
                {detail.notes && <>
                  <Divider />
                  <Typography variant="subtitle2" sx={{ opacity: 0.6 }}>Note</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{detail.notes}</Typography>
                </>}
              </>)
            : <Typography variant="body2" sx={{ opacity: 0.6 }}>Nessun dettaglio disponibile.</Typography>}
        </Stack>
      </Drawer>

      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dlgMode === "create" ? "Nuovo tecnico" : "Modifica tecnico"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="Nome *"    value={form.first_name} fullWidth onChange={(e) => ff({ first_name: e.target.value })} />
              <TextField size="small" label="Cognome *" value={form.last_name}  fullWidth onChange={(e) => ff({ last_name: e.target.value })} />
            </Stack>
            <TextField size="small" label="Email *"  type="email" value={form.email} fullWidth onChange={(e) => ff({ email: e.target.value })} />
            <TextField size="small" label="Telefono" value={form.phone} fullWidth onChange={(e) => ff({ phone: e.target.value })} />
            <FormControlLabel control={<Switch checked={form.is_active} onChange={(e) => ff({ is_active: e.target.checked })} />} label="Attivo" />
            <TextField size="small" label="Note" value={form.notes} fullWidth multiline minRows={2} onChange={(e) => ff({ notes: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDlgOpen(false)}>Annulla</Button>
          <Button variant="contained" onClick={save} disabled={dlgSave}>{dlgSave ? "Salvataggio…" : "Salva"}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog open={delDlg} title="Elimina tecnico"
        description={`Eliminare il tecnico "${detail?.full_name}"?`}
        busy={delBusy} onConfirm={doDelete} onClose={() => setDelDlg(false)} />
    </>
  );
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------

type TabKey = "plans" | "events" | "notifications" | "techs";

export default function Maintenance() {
  const [tabParam, setTabParam] = useUrlStringParam("tab");
  const tab: TabKey = (["plans","events","notifications","techs"].includes(tabParam) ? tabParam : "plans") as TabKey;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Manutenzione</Typography>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Piani per cliente, rapportini di esecuzione, notifiche e tecnici.
        </Typography>
      </Box>

      <Card sx={{ mb: 0 }}>
        <Box sx={{ px: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Tabs value={tab} onChange={(_, v) => setTabParam(v)} variant="scrollable" allowScrollButtonsMobile>
            <Tab value="plans"         label="Piani" />
            <Tab value="events"        label="Rapportini" />
            <Tab value="notifications" label="Notifiche" />
            <Tab value="techs"         label="Tecnici" />
          </Tabs>
        </Box>
      </Card>

      {tab === "plans"         && <PlansTab />}
      {tab === "events"        && <EventsTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "techs"         && <TechsTab />}
    </Stack>
  );
}
