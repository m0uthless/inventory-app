import * as React from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";

import type { GridColDef } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { buildDrfListParams } from "../api/drf";
import { apiErrorToMessage } from "../api/error";
import { useServerGrid } from "../hooks/useServerGrid";
import { useUrlNumberParam, useUrlStringParam } from "../hooks/useUrlParam";
import { useDrfList } from "../hooks/useDrfList";
import DetailDrawerHeader from "../ui/DetailDrawerHeader";
import ServerDataGrid from "../ui/ServerDataGrid";
import { useToast } from "../ui/toast";
import AuditActionChip, { type AuditAction } from "../ui/AuditActionChip";
import AuditDiffTable from "../ui/AuditDiffTable";
import FilterChip from "../ui/FilterChip";
import { buildQuery } from "../utils/nav";

type AuditEvent = {
  id: number;
  created_at: string;
  action: AuditAction;
  actor: number | null;
  actor_username?: string | null;
  actor_email?: string | null;
  content_type_app?: string;
  content_type_model?: string;
  object_id?: string;
  object_repr?: string;
  subject?: string;
  changes?: any;
  path?: string | null;
  method?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

type AuditEntity = { app_label: string; model: string };

type AuditActor = {
  id: number;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  label: string;
};

const ENTITY_LABELS: Record<string, string> = {
  "crm.customer": "Clienti",
  "crm.site": "Siti",
  "crm.contact": "Contatti",
  "inventory.inventory": "Inventari",
  "maintenance.maintenanceplan": "Piani manutenzione",
  "maintenance.maintenanceevent": "Eventi manutenzione",
  "maintenance.maintenancetemplate": "Template manutenzione",
  "maintenance.maintenancenotification": "Notifiche manutenzione",
  "maintenance.tech": "Tecnici",
  "wiki.wikipage": "Wiki pagine",
  "wiki.wikicategory": "Wiki categorie",
  "wiki.wikiattachment": "Wiki allegati",
  "wiki.wikilink": "Wiki link",
  "custom_fields.customfielddefinition": "Campi custom",
  "auth.user": "Utenti (login)",
};

function fmt(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

async function copyToClipboard(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function openEntityPath(ev: AuditEvent) {
  const app = (ev.content_type_app || "").toLowerCase();
  const model = (ev.content_type_model || "").toLowerCase();
  const oid = ev.object_id ? Number(ev.object_id) : NaN;
  if (!Number.isFinite(oid)) return null;

  if (app === "crm" && model === "customer") return `/customers${buildQuery({ open: oid })}`;
  if (app === "crm" && model === "site") return `/sites${buildQuery({ open: oid })}`;
  if (app === "crm" && model === "contact") return `/contacts${buildQuery({ open: oid })}`;
  if (app === "inventory" && model === "inventory") return `/inventory${buildQuery({ open: oid })}`;
  return null;
}

function entityKey(app?: string, model?: string): string {
  const a = (app || "").toLowerCase();
  const m = (model || "").toLowerCase();
  if (!a || !m) return "";
  return `${a}.${m}`;
}

function entityLabel(key: string): string {
  return ENTITY_LABELS[key] || key || "—";
}
function isAuditChanges(v: any): v is Record<string, { from: unknown; to: unknown }> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v as Record<string, any>);
  if (!entries.length) return false;
  // Heuristic: at least one entry contains {from,to}.
  return entries.some(([, ch]) => ch && typeof ch === "object" && "from" in ch && "to" in ch);
}


const cols: GridColDef<AuditEvent>[] = [
  {
    field: "created_at",
    headerName: "Quando",
    width: 190,
    sortable: true,
    valueGetter: (v) => v,
    renderCell: (p) => <span>{fmt(p.value as any)}</span>,
  },
  {
    field: "action",
    headerName: "Azione",
    width: 140,
    sortable: true,
    renderCell: (p) => <AuditActionChip action={String(p.value || "")} />,
  },
  {
    field: "subject",
    headerName: "Oggetto",
    flex: 1,
    minWidth: 280,
    sortable: false,
    valueGetter: (_v, row) => row.subject || row.object_repr || row.object_id || "—",
  },
  {
    field: "actor_username",
    headerName: "Utente",
    width: 180,
    sortable: false,
    valueGetter: (_v, row) => row.actor_username || "—",
  },
  {
    field: "content_type_model",
    headerName: "Tipo",
    width: 200,
    sortable: false,
    valueGetter: (_v, row) => {
      const k = entityKey(row.content_type_app, row.content_type_model);
      return entityLabel(k);
    },
  },
];

export default function Audit() {
  const toast = useToast();
  const nav = useNavigate();

  const grid = useServerGrid({
    defaultOrdering: "-created_at",
    allowedOrderingFields: ["created_at", "action"],
    defaultPageSize: 25,
  });

  // filters
  const [action, setAction] = useUrlStringParam("action");
  const [appLabel, setAppLabel] = useUrlStringParam("app_label");
  const [model, setModel] = useUrlStringParam("model");
  const [objectId, setObjectId] = useUrlStringParam("object_id");
  const [actor, setActor] = useUrlNumberParam("actor");
  const [createdAfter, setCreatedAfter] = useUrlStringParam("created_after");
  const [createdBefore, setCreatedBefore] = useUrlStringParam("created_before");

  // entities (for dropdown)
  const [entities, setEntities] = React.useState<AuditEntity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setEntitiesLoading(true);
      try {
        const res = await api.get<AuditEntity[]>("/audit-events/entities/");
        if (!alive) return;
        const raw = Array.isArray(res.data) ? res.data : [];
        // stable sorting: known entities first (by label), then by key
        const sorted = [...raw].sort((a, b) => {
          const ka = entityKey(a.app_label, a.model);
          const kb = entityKey(b.app_label, b.model);
          const la = ENTITY_LABELS[ka] ? 0 : 1;
          const lb = ENTITY_LABELS[kb] ? 0 : 1;
          if (la !== lb) return la - lb;
          const na = entityLabel(ka).toLowerCase();
          const nb = entityLabel(kb).toLowerCase();
          if (na !== nb) return na.localeCompare(nb);
          return ka.localeCompare(kb);
        });
        setEntities(sorted);
      } catch {
        // non-blocking
      } finally {
        if (alive) setEntitiesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // actors autocomplete
  const [actorOptions, setActorOptions] = React.useState<AuditActor[]>([]);
  const [actorInput, setActorInput] = React.useState("");
  const [actorsLoading, setActorsLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const t = window.setTimeout(async () => {
      setActorsLoading(true);
      try {
        const res = await api.get<AuditActor[]>("/audit-events/actors/", {
          params: actorInput.trim() ? { q: actorInput.trim() } : {},
        });
        if (!alive) return;
        setActorOptions(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (alive) setActorOptions([]);
      } finally {
        if (alive) setActorsLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [actorInput]);

  // ensure the selected actor is present in options (so the label is nice)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (actor === "") return;
      if (actorOptions.some((o) => o.id === actor)) return;
      try {
        const res = await api.get<AuditActor[]>("/audit-events/actors/", { params: { id: actor } });
        if (!alive) return;
        const arr = Array.isArray(res.data) ? res.data : [];
        if (arr.length) setActorOptions((prev) => [...arr, ...prev]);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [actor, actorOptions]);

  const selectedActor = React.useMemo(() => {
    if (actor === "") return null;
    return actorOptions.find((o) => o.id === actor) || { id: actor, label: `#${actor}` };
  }, [actor, actorOptions]);

  const selectedEntityKey = React.useMemo(() => entityKey(appLabel, model), [appLabel, model]);

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        extra: {
          ...(action.trim() ? { action: action.trim() } : {}),
          ...(appLabel.trim() ? { app_label: appLabel.trim() } : {}),
          ...(model.trim() ? { model: model.trim() } : {}),
          ...(objectId.trim() ? { object_id: objectId.trim() } : {}),
          ...(actor !== "" ? { actor } : {}),
          ...(createdAfter.trim() ? { created_after: createdAfter.trim() } : {}),
          ...(createdBefore.trim() ? { created_before: createdBefore.trim() } : {}),
        },
      }),
    [
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      action,
      appLabel,
      model,
      objectId,
      actor,
      createdAfter,
      createdBefore,
    ]
  );

  const { rows, rowCount, loading } = useDrfList<AuditEvent>("/audit-events/", listParams, (e: unknown) =>
    toast.error(apiErrorToMessage(e))
  );

  // drawer
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<AuditEvent | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const loadDetail = React.useCallback(
    async (id: number) => {
      setDetailLoading(true);
      setDetail(null);
      try {
        const res = await api.get<AuditEvent>(`/audit-events/${id}/`);
        setDetail(res.data);
      } catch (e) {
        toast.error(apiErrorToMessage(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [toast]
  );

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

  const closeDrawer = () => {
    setDrawerOpen(false);
    grid.setOpenId(null);
  };

  const resetFilters = () => {
    // Clear URL-managed filters + reset grid state (search/page/ordering).
    grid.reset(["action", "app_label", "model", "object_id", "actor", "created_after", "created_before"]);
  };

  // quanti filtri nel chip sono attivi
  const chipActiveCount =
    (action.trim() ? 1 : 0) +
    (selectedEntityKey ? 1 : 0) +
    (actor !== "" ? 1 : 0) +
    (objectId.trim() ? 1 : 0);

  // sx riutilizzabile per i TextField piccoli della toolbar
  const inputSx = {
    fontSize: 12,
    "& .MuiInputLabel-root": { fontSize: 12 },
    "& .MuiInputBase-input": { fontSize: 12, py: "6px" },
    "& .MuiOutlinedInput-root": { fontSize: 12 },
  } as const;

  return (
    <Stack spacing={2}>
      <Typography variant="h5">
        Audit
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7 }}>
        Log degli eventi di sistema.
      </Typography>

      <Card>
        <CardContent sx={{ pt: 1.5, pb: 2, "&:last-child": { pb: 2 } }}>
          <Stack spacing={1.5}>
            {/* ── Toolbar principale ─────────────────────────────────────── */}
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", md: "center" }}
              flexWrap="wrap"
            >
              {/* Cerca — uguale a ListToolbar / Customers */}
              <TextField
                size="small"
                label="Cerca"
                placeholder="Cerca"
                value={grid.q}
                onChange={(e) => grid.setQ(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: { xs: "100%", md: 220 }, ...inputSx }}
              />

              {/* Da */}
              <TextField
                size="small"
                label="Da"
                type="datetime-local"
                value={createdAfter}
                onChange={(e) => setCreatedAfter(e.target.value, { patch: { page: 1 }, keepOpen: true })}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", md: 200 }, ...inputSx }}
              />

              {/* A */}
              <TextField
                size="small"
                label="A"
                type="datetime-local"
                value={createdBefore}
                onChange={(e) => setCreatedBefore(e.target.value, { patch: { page: 1 }, keepOpen: true })}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", md: 200 }, ...inputSx }}
              />

              {/* FilterChip — tutti gli altri filtri */}
              <FilterChip
                activeCount={chipActiveCount}
                onReset={() => {
                  setAction("", { patch: { page: 1 }, keepOpen: true });
                  setAppLabel("", { patch: { page: 1 }, keepOpen: true });
                  setModel("", { patch: { page: 1 }, keepOpen: true });
                  setObjectId("", { patch: { page: 1 }, keepOpen: true });
                  setActor("", { patch: { page: 1 }, keepOpen: true });
                }}
              >
                {/* Azione */}
                <FormControl size="small" fullWidth>
                  <InputLabel>Azione</InputLabel>
                  <Select
                    label="Azione"
                    value={action}
                    onChange={(e) => setAction(String(e.target.value), { patch: { page: 1 }, keepOpen: true })}
                  >
                    <MenuItem value="">Tutte</MenuItem>
                    <MenuItem value="create">Creato</MenuItem>
                    <MenuItem value="update">Modificato</MenuItem>
                    <MenuItem value="delete">Eliminato</MenuItem>
                    <MenuItem value="restore">Ripristinato</MenuItem>
                    <MenuItem value="login">Login</MenuItem>
                    <MenuItem value="login_failed">Login fallito</MenuItem>
                    <MenuItem value="logout">Logout</MenuItem>
                  </Select>
                </FormControl>

                {/* Entità */}
                <FormControl size="small" fullWidth>
                  <InputLabel>Entità</InputLabel>
                  <Select
                    label="Entità"
                    value={selectedEntityKey}
                    onChange={(e) => {
                      const v = String(e.target.value);
                      if (!v) {
                        setAppLabel("", { patch: { page: 1 }, keepOpen: true });
                        setModel("", { patch: { page: 1 }, keepOpen: true });
                        return;
                      }
                      const [a, m] = v.split(".");
                      setAppLabel(a || "", { patch: { page: 1 }, keepOpen: true });
                      setModel(m || "", { patch: { page: 1 }, keepOpen: true });
                    }}
                  >
                    <MenuItem value="">Tutte</MenuItem>
                    {entitiesLoading ? (
                      <MenuItem value="" disabled>Caricamento…</MenuItem>
                    ) : (
                      entities.map((e) => {
                        const k = entityKey(e.app_label, e.model);
                        return (
                          <MenuItem key={k} value={k}>
                            {entityLabel(k)}
                          </MenuItem>
                        );
                      })
                    )}
                  </Select>
                </FormControl>

                {/* Utente */}
                <Autocomplete<AuditActor>
                  options={actorOptions}
                  loading={actorsLoading}
                  value={selectedActor}
                  onChange={(_e, v) => setActor(v ? v.id : "", { patch: { page: 1 }, keepOpen: true })}
                  inputValue={actorInput}
                  onInputChange={(_e, v) => setActorInput(v)}
                  getOptionLabel={(o) => o.label}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Utente"
                      placeholder="Cerca…"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {actorsLoading ? <CircularProgress size={14} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  fullWidth
                />

                {/* Object ID */}
                <TextField
                  size="small"
                  label="Object ID"
                  value={objectId}
                  onChange={(e) => setObjectId(e.target.value, { patch: { page: 1 }, keepOpen: true })}
                  fullWidth
                />
              </FilterChip>

              {/* Reset — tutto a destra */}
              <Box sx={{ ml: { md: "auto" } }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={resetFilters}
                  sx={{ fontSize: 12, whiteSpace: "nowrap" }}
                >
                  Reimposta
                </Button>
              </Box>
            </Stack>

            <Divider />

            <ServerDataGrid
              rows={rows}
              columns={cols}
              loading={loading}
              rowCount={rowCount}
              paginationModel={grid.paginationModel}
              onPaginationModelChange={grid.onPaginationModelChange}
              sortModel={grid.sortModel}
              onSortModelChange={grid.onSortModelChange}
              onRowClick={openDrawer}
              height={680}
              deletedField="__never__"
              showGridToolbar={false}
              sx={{
                "--DataGrid-rowHeight": "36px",
                "--DataGrid-headerHeight": "44px",
                "& .MuiDataGrid-cell": { py: 0.25 },
                "& .MuiDataGrid-columnHeader": { py: 0.75 },
                "& .MuiDataGrid-row:nth-of-type(even)": { backgroundColor: "rgba(69,127,121,0.03)" },
                "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(69,127,121,0.06)" },
                "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "rgba(69,127,121,0.10) !important" },
                "& .MuiDataGrid-row.Mui-selected:hover": { backgroundColor: "rgba(69,127,121,0.14) !important" },
              } as any}
            />
          </Stack>
        </CardContent>
      </Card>

      <Drawer anchor="right" open={drawerOpen} onClose={closeDrawer} PaperProps={{ sx: { width: { xs: "100%", sm: 620 } } }}>
        <Stack sx={{ p: 2 }} spacing={1.5}>
          <DetailDrawerHeader
            title={selectedId ? `Evento #${selectedId}` : "Evento"}
            subtitle={detail ? fmt(detail.created_at) : undefined}
            onClose={closeDrawer}
            actions={
              detail ? (
                <Tooltip title="Copia ID">
                  <span>
                    <IconButton onClick={() => copyToClipboard(String(detail.id))}>
                      <ContentCopyIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : undefined
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
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <AuditActionChip action={detail.action} size="medium" />
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  {entityLabel(entityKey(detail.content_type_app, detail.content_type_model))}
                </Typography>
                {detail.object_id ? (
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    • ID: {detail.object_id}
                  </Typography>
                ) : null}
              </Stack>

              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
                  Oggetto
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {detail.subject || detail.object_repr || "—"}
                </Typography>

                <Typography variant="subtitle2" sx={{ opacity: 0.85, mt: 1 }}>
                  Utente
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {detail.actor_username || "—"}
                  {detail.actor_email ? ` (${detail.actor_email})` : ""}
                </Typography>

                <Typography variant="subtitle2" sx={{ opacity: 0.85, mt: 1 }}>
                  Richiesta
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {detail.method || "—"} {detail.path || ""}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  IP: {detail.ip_address || "—"}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.75, wordBreak: "break-word" }}>
                  UA: {detail.user_agent || "—"}
                </Typography>

                <Typography variant="subtitle2" sx={{ opacity: 0.85, mt: 1 }}>
                  Modifiche
                </Typography>
                {detail.changes ? (
                  isAuditChanges(detail.changes) ? (
                    <AuditDiffTable changes={detail.changes} emptyLabel="Nessuna differenza registrata." />
                  ) : (
                    <Box
                      component="pre"
                      sx={{
                        m: 0,
                        p: 1.25,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        backgroundColor: "rgba(0,0,0,0.02)",
                        fontSize: 12,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {JSON.stringify(detail.changes, null, 2)}
                    </Box>
                  )
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    —
                  </Typography>
                )}

                {openEntityPath(detail) ? (
                  <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                    <Tooltip title="Apri oggetto">
                      <IconButton onClick={() => nav(openEntityPath(detail) as string)}>
                        <OpenInNewIcon />
                      </IconButton>
                    </Tooltip>
                    {detail.path ? (
                      <Tooltip title="Copia path">
                        <IconButton onClick={() => copyToClipboard(String(detail.path))}>
                          <ContentCopyIcon />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              —
            </Typography>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}
