import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { apiGet } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { PERMS } from "../auth/perms";
import { useToast } from "../ui/toast";

type ApiPage<T> = {
  count: number;
  results: T[];
};

function extractResults<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  const d = data as { results?: unknown };
  if (Array.isArray(d.results)) return d.results as T[];
  return [];
}

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (!d) return "Errore.";
  if (typeof d === "string") return d;
  if (typeof d?.detail === "string") return d.detail;
  return "Errore.";
}

type SectionProps = {
  title: string;
  icon?: React.ReactNode;
  items: any[];
  onOpen: (id: number) => void;
  onViewAll: () => void;
  getPrimary: (x: any) => string;
  getSecondary?: (x: any) => string;
};

function Section({
  title,
  icon,
  items,
  onOpen,
  onViewAll,
  getPrimary,
  getSecondary,
}: SectionProps) {
  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          {icon ? <Box sx={{ display: "flex", alignItems: "center" }}>{icon}</Box> : null}
          <Typography variant="h6">{title}</Typography>
        </Stack>

        <Button
          size="small"
          variant="text"
          onClick={onViewAll}
          endIcon={<OpenInNewIcon fontSize="small" />}
        >
          Vedi tutto
        </Button>
      </Stack>

      <Divider sx={{ my: 1 }} />

      {items.length === 0 ? (
        <Typography sx={{ px: 0.5, py: 1 }} color="text.secondary">
          Nessun risultato.
        </Typography>
      ) : (
        <List dense disablePadding>
          {items.map((x) => (
            <ListItemButton
              key={String(x.id)}
              onClick={() => onOpen(Number(x.id))}
              sx={{ py: 1.1 }}
            >
              <ListItemText
                primary={getPrimary(x)}
                secondary={getSecondary ? getSecondary(x) : undefined}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}

export default function Search() {
  const nav = useNavigate();
  const toast = useToast();
  const { hasPerm } = useAuth();

  const [sp, setSp] = useSearchParams();
  const qParam = (sp.get("search") || sp.get("q") || "").trim();

  const [q, setQ] = React.useState(qParam);
  const [loading, setLoading] = React.useState(false);

  const [customers, setCustomers] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [contacts, setContacts] = React.useState<any[]>([]);
  const [inventories, setInventories] = React.useState<any[]>([]);
  const [driveFiles, setDriveFiles] = React.useState<any[]>([]);
  const [driveFolders, setDriveFolders] = React.useState<any[]>([]);
  const [maintenancePlans, setMaintenancePlans] = React.useState<any[]>([]);

  const canCustomers = hasPerm(PERMS.crm.customer.view);
  const canSites = hasPerm(PERMS.crm.site.view);
  const canContacts = hasPerm(PERMS.crm.contact.view);
  const canInventories = hasPerm(PERMS.inventory.inventory.view);
  const canDriveFiles = hasPerm(PERMS.drive.file.view);
  const canDriveFolders = hasPerm(PERMS.drive.folder.view);
  const canMaintenancePlans = hasPerm(PERMS.maintenance.plan.view);

  const hasAnySection =
    canCustomers ||
    canSites ||
    canContacts ||
    canInventories ||
    canDriveFiles ||
    canDriveFolders ||
    canMaintenancePlans;

  // keep local input in sync when URL changes (back/forward)
  React.useEffect(() => {
    setQ(qParam);
  }, [qParam]);

  const runSearch = React.useCallback(
    async (query: string) => {
      const term = query.trim();

      setLoading(true);
      try {
        if (!term) {
          setCustomers([]);
          setSites([]);
          setContacts([]);
          setInventories([]);
          setDriveFiles([]);
          setDriveFolders([]);
          setMaintenancePlans([]);
          return;
        }

        // IMPORTANT:
        // Don't call endpoints the user can't access.
        // The API layer shows a global toast on 403.
        if (!canCustomers) setCustomers([]);
        if (!canSites) setSites([]);
        if (!canContacts) setContacts([]);
        if (!canInventories) setInventories([]);
        if (!canDriveFiles) setDriveFiles([]);
        if (!canDriveFolders) setDriveFolders([]);
        if (!canMaintenancePlans) setMaintenancePlans([]);

        const params = { search: term, page: 1, page_size: 10 };

        const reqs = [
          {
            enabled: canCustomers,
            call: () => apiGet<ApiPage<any>>("/customers/", { params }),
            set: (data: unknown) => setCustomers(extractResults<any>(data)),
          },
          {
            enabled: canSites,
            call: () => apiGet<ApiPage<any>>("/sites/", { params }),
            set: (data: unknown) => setSites(extractResults<any>(data)),
          },
          {
            enabled: canContacts,
            call: () => apiGet<ApiPage<any>>("/contacts/", { params }),
            set: (data: unknown) => setContacts(extractResults<any>(data)),
          },
          {
            enabled: canInventories,
            call: () => apiGet<ApiPage<any>>("/inventories/", { params }),
            set: (data: unknown) => setInventories(extractResults<any>(data)),
          },
          {
            enabled: canDriveFiles,
            call: () => apiGet<ApiPage<any>>("/drive-files/", { params }),
            set: (data: unknown) => setDriveFiles(extractResults<any>(data)),
          },
          {
            enabled: canDriveFolders,
            call: () => apiGet<ApiPage<any>>("/drive-folders/", { params }),
            set: (data: unknown) => setDriveFolders(extractResults<any>(data)),
          },
          {
            enabled: canMaintenancePlans,
            call: () => apiGet<ApiPage<any>>("/maintenance-plans/", { params }),
            set: (data: unknown) => setMaintenancePlans(extractResults<any>(data)),
          },
        ] as const;

        const enabled = reqs.filter((r) => r.enabled);
        const settled = await Promise.allSettled(enabled.map((r) => r.call()));

        let hadNonAuthErrors = false;
        settled.forEach((s, idx) => {
          const r = enabled[idx];
          if (s.status === "fulfilled") {
            r.set(s.value);
            return;
          }

          // 401/403 are already handled globally by the API layer.
          const status = s.reason?.response?.status as number | undefined;
          if (status === 401 || status === 403) {
            r.set(null);
            return;
          }

          hadNonAuthErrors = true;
          r.set(null);
        });

        if (hadNonAuthErrors) {
          toast.error("Ricerca parziale: alcune sezioni non sono disponibili.");
        }
      } catch (e) {
        toast.error(errMsg(e));
      } finally {
        setLoading(false);
      }
    },
    [
      canContacts,
      canCustomers,
      canDriveFiles,
      canDriveFolders,
      canInventories,
      canMaintenancePlans,
      canSites,
      toast,
    ]
  );

  // auto-run when qParam changes
  React.useEffect(() => {
    runSearch(qParam);
  }, [qParam, runSearch]);

  const submit = React.useCallback(() => {
    const term = q.trim();

    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (term) {
          next.set("search", term);
          next.delete("q"); // legacy
        } else {
          next.delete("search");
          next.delete("q");
        }
        return next;
      },
      { replace: true }
    );
  }, [q, setSp]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Ricerca
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Cerca in clienti, siti, contatti, inventari, Drive e manutenzione.
      </Typography>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            fullWidth
            placeholder="Cerca…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                backgroundColor: "background.paper",
              },
            }}
          />

          <Button variant="contained" onClick={submit} disabled={loading}>
            Cerca
          </Button>

          <Button
            variant="text"
            onClick={() => {
              setQ("");
              setSp(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("q");
                  next.delete("search");
                  return next;
                },
                { replace: true }
              );
            }}
            disabled={loading}
          >
            Reimposta
          </Button>
        </Stack>
      </Paper>

      {!hasAnySection ? (
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography color="text.secondary">
            Non hai permessi sufficienti per effettuare la ricerca.
          </Typography>
        </Paper>
      ) : loading ? (
        <Paper sx={{ p: 4, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="center">
            <CircularProgress />
          </Stack>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {canCustomers ? (
            <Section
              title="Clienti"
              items={customers}
              onOpen={(id) => nav(`/customers?open=${id}`)}
              onViewAll={() =>
                nav(
                  qParam
                    ? `/customers?search=${encodeURIComponent(qParam)}`
                    : "/customers"
                )
              }
              getPrimary={(x) =>
                `${x.code ? `${x.code} — ` : ""}${x.name || "Cliente"}`
              }
              getSecondary={(x) =>
                x.status_label ? `Stato: ${x.status_label}` : ""
              }
            />
          ) : null}

          {canSites ? (
            <Section
              title="Siti"
              items={sites}
              onOpen={(id) => nav(`/sites?open=${id}`)}
              onViewAll={() =>
                nav(qParam ? `/sites?search=${encodeURIComponent(qParam)}` : "/sites")
              }
              getPrimary={(x) => x.display_name || x.name || "Sito"}
              getSecondary={(x) => [x.city, x.address].filter(Boolean).join(" • ")}
            />
          ) : null}

          {canContacts ? (
            <Section
              title="Contatti"
              items={contacts}
              onOpen={(id) => nav(`/contacts?open=${id}`)}
              onViewAll={() =>
                nav(
                  qParam
                    ? `/contacts?search=${encodeURIComponent(qParam)}`
                    : "/contacts"
                )
              }
              getPrimary={(x) =>
                x.name ||
                [x.first_name, x.last_name].filter(Boolean).join(" ") ||
                "Contatto"
              }
              getSecondary={(x) => [x.email, x.phone].filter(Boolean).join(" • ")}
            />
          ) : null}

          {canInventories ? (
            <Section
              title="Inventari"
              items={inventories}
              onOpen={(id) => nav(`/inventory?open=${id}`)}
              onViewAll={() =>
                nav(
                  qParam
                    ? `/inventory?search=${encodeURIComponent(qParam)}`
                    : "/inventory"
                )
              }
              getPrimary={(x) => x.hostname || x.name || "Inventario"}
              getSecondary={(x) =>
                [x.knumber, x.serial_number].filter(Boolean).join(" • ")
              }
            />
          ) : null}

          {canDriveFiles ? (
            <Section
              title="Drive: file"
              icon={<InsertDriveFileOutlinedIcon fontSize="small" />}
              items={driveFiles}
              onOpen={() => nav("/drive")}
              onViewAll={() => nav("/drive")}
              getPrimary={(x) => x.name}
              getSecondary={(x) =>
                [x.size_human, x.folder_name || "Root"].filter(Boolean).join(" • ")
              }
            />
          ) : null}

          {canDriveFolders ? (
            <Section
              title="Drive: cartelle"
              icon={<FolderIcon fontSize="small" />}
              items={driveFolders}
              onOpen={() => nav("/drive")}
              onViewAll={() => nav("/drive")}
              getPrimary={(x) => x.name}
              getSecondary={(x) => `${x.files_count ?? 0} file`}
            />
          ) : null}

          {canMaintenancePlans ? (
            <Section
              title="Manutenzione"
              icon={<BuildOutlinedIcon fontSize="small" />}
              items={maintenancePlans}
              onOpen={() => nav("/maintenance")}
              onViewAll={() => nav("/maintenance")}
              getPrimary={(x) => x.name || x.title || `Piano #${x.id}`}
              getSecondary={(x) =>
                [x.customer_name, x.status_label].filter(Boolean).join(" • ")
              }
            />
          ) : null}
        </Stack>
      )}
    </Box>
  );
}
