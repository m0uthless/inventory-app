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
import { useToast } from "../ui/toast";

type ApiPage<T> = { count: number; results: T[] };

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (!d) return "Errore.";
  if (typeof d === "string") return d;
  if (typeof d?.detail === "string") return d.detail;
  return "Errore.";
}

export default function Search() {
  const nav = useNavigate();
  const toast = useToast();
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
  const [maintenance, setMaintenance] = React.useState<any[]>([]);

  // keep local input in sync when URL changes (back/forward)
  React.useEffect(() => {
    setQ(qParam);
  }, [qParam]);

  const runSearch = React.useCallback(async (query: string) => {
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
        setMaintenance([]);
        return;
      }

      const params = { search: term, page: 1, page_size: 10 };

      const [c, s, ct, inv, df, dfo, mnt] = await Promise.all([
        apiGet<ApiPage<any>>("/customers/",       { params }),
        apiGet<ApiPage<any>>("/sites/",           { params }),
        apiGet<ApiPage<any>>("/contacts/",        { params }),
        apiGet<ApiPage<any>>("/inventories/",     { params }),
        apiGet<ApiPage<any>>("/drive-files/",     { params }),
        apiGet<ApiPage<any>>("/drive-folders/",   { params }),
        apiGet<ApiPage<any>>("/maintenance-plans/", { params }),
      ]);

      setCustomers(c.results || []);
      setSites(s.results || []);
      setContacts(ct.results || []);
      setInventories(inv.results || []);
      setDriveFiles(df.results || []);
      setDriveFolders(dfo.results || []);
      setMaintenance(mnt.results || []);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // auto-run when qParam changes
  React.useEffect(() => {
    runSearch(qParam);
  }, [qParam, runSearch]);

  const submit = React.useCallback(() => {
    const term = q.trim();
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      if (term) {
        next.set("search", term);
        next.delete("q"); // legacy
      } else {
        next.delete("search");
        next.delete("q");
      }
      return next;
    }, { replace: true });
  }, [q, setSp]);

  const Section = ({
    title,
    icon,
    items,
    onOpen,
    onViewAll,
    getPrimary,
    getSecondary,
  }: {
    title: string;
    icon?: React.ReactNode;
    items: any[];
    onOpen: (id: number) => void;
    onViewAll: () => void;
    getPrimary: (x: any) => string;
    getSecondary?: (x: any) => string;
  }) => (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        {icon}
        <Typography variant="subtitle1">{title}</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" endIcon={<OpenInNewIcon />} onClick={onViewAll}>
          Vedi tutto
        </Button>
      </Box>
      <Divider />
      {items.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Nessun risultato.
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {items.map((x) => (
            <ListItemButton
              key={x.id}
              onClick={() => onOpen(Number(x.id))}
              sx={{ py: 1.2 }}
            >
              <ListItemText
                primary={getPrimary(x)}
                secondary={getSecondary ? getSecondary(x) : undefined}
                primaryTypographyProps={{ fontWeight: 700 }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5">
          Ricerca
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Cerca in clienti, siti, contatti, inventari, Drive e manutenzione.
        </Typography>

        <TextField
          fullWidth
          placeholder="Cerca in tutta l'applicazione…"
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

        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Button variant="contained" onClick={submit}>
            Cerca
          </Button>
          <Button
            variant="text"
            onClick={() => {
              setQ("");
              setSp((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("q");
                next.delete("search");
                return next;
              }, { replace: true });
            }}
          >
            Reimposta
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          <Section
            title="Clienti"
            items={customers}
            onOpen={(id) => nav(`/customers?open=${id}`)}
            onViewAll={() => nav(qParam ? `/customers?search=${encodeURIComponent(qParam)}` : "/customers")}
            getPrimary={(x) => `${x.code ? x.code + " — " : ""}${x.name || "Cliente"}`}
            getSecondary={(x) => (x.status_label ? `Stato: ${x.status_label}` : "")}
          />

          <Section
            title="Siti"
            items={sites}
            onOpen={(id) => nav(`/sites?open=${id}`)}
            onViewAll={() => nav(qParam ? `/sites?search=${encodeURIComponent(qParam)}` : "/sites")}
            getPrimary={(x) => x.display_name || x.name || "Sito"}
            getSecondary={(x) => [x.city, x.address].filter(Boolean).join(" • ")}
          />

          <Section
            title="Contatti"
            items={contacts}
            onOpen={(id) => nav(`/contacts?open=${id}`)}
            onViewAll={() => nav(qParam ? `/contacts?search=${encodeURIComponent(qParam)}` : "/contacts")}
            getPrimary={(x) => x.name || [x.first_name, x.last_name].filter(Boolean).join(" ") || "Contatto"}
            getSecondary={(x) => [x.email, x.phone].filter(Boolean).join(" • ")}
          />

          <Section
            title="Inventari"
            items={inventories}
            onOpen={(id) => nav(`/inventory?open=${id}`)}
            onViewAll={() => nav(qParam ? `/inventory?search=${encodeURIComponent(qParam)}` : "/inventory")}
            getPrimary={(x) => x.hostname || x.name || "Inventario"}
            getSecondary={(x) => [x.knumber, x.serial_number].filter(Boolean).join(" • ")}
          />

          <Section
            title="Drive — File"
            icon={<InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: "text.disabled" }} />}
            items={driveFiles}
            onOpen={() => nav("/drive")}
            onViewAll={() => nav("/drive")}
            getPrimary={(x) => x.name}
            getSecondary={(x) => [x.size_human, x.folder_name || "Root"].filter(Boolean).join(" • ")}
          />

          <Section
            title="Drive — Cartelle"
            icon={<FolderIcon fontSize="small" sx={{ color: "#f59e0b" }} />}
            items={driveFolders}
            onOpen={() => nav("/drive")}
            onViewAll={() => nav("/drive")}
            getPrimary={(x) => x.name}
            getSecondary={(x) => `${x.files_count} file`}
          />

          <Section
            title="Manutenzione"
            icon={<BuildOutlinedIcon fontSize="small" sx={{ color: "text.disabled" }} />}
            items={maintenance}
            onOpen={() => nav("/maintenance")}
            onViewAll={() => nav("/maintenance")}
            getPrimary={(x) => x.name || x.title || `Piano #${x.id}`}
            getSecondary={(x) => [x.customer_name, x.status_label].filter(Boolean).join(" • ")}
          />
        </Stack>
      )}
    </Box>
  );
}
