import * as React from "react";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { useToast } from "../ui/toast";
import { apiErrorToMessage } from "../api/error";

type SearchResult = {
  kind: string;
  id: number;
  title: string;
  subtitle?: string | null;
};

type SearchResponse = {
  q: string;
  results: SearchResult[];
};

const KIND_LABEL: Record<string, string> = {
  inventory: "Inventario",
  customer: "Clienti",
  site: "Siti",
  contact: "Contatti",
  drive_folder: "Drive · Cartelle",
  drive_file: "Drive · File",
  maintenance_plan: "Manutenzione",
  wiki_page: "Wiki",
};

function groupByKind(results: SearchResult[]): Record<string, SearchResult[]> {
  return results.reduce((acc, r) => {
    (acc[r.kind] ||= []).push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);
}

export default function Search() {
  const toast = useToast();
  const navigate = useNavigate();
  const loc = useLocation();
  const [sp, setSp] = useSearchParams();

  const q = (sp.get("q") ?? sp.get("search") ?? "").trim();

  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult[]>([]);

  const returnTo = React.useMemo(() => {
    // return to *this* search page (keep whatever params are there)
    return loc.pathname + loc.search;
  }, [loc.pathname, loc.search]);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!q) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const resp = await api.get<SearchResponse>("/search/", { params: { q } });
        if (!cancelled) setResults(resp.data.results ?? []);
      } catch (e) {
        if (!cancelled) toast.error(apiErrorToMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [q, toast]);

  const groups = React.useMemo(() => groupByKind(results), [results]);

  const openInModule = (r: SearchResult) => {
    const encodedReturn = encodeURIComponent(returnTo);

    if (r.kind === "inventory") {
      navigate(`/inventory?search=${encodeURIComponent(q)}&open=${r.id}&return=${encodedReturn}`);
      return;
    }
    if (r.kind === "customer") {
      navigate(`/customers?search=${encodeURIComponent(q)}&open=${r.id}&return=${encodedReturn}`);
      return;
    }
    if (r.kind === "site") {
      navigate(`/sites?search=${encodeURIComponent(q)}&open=${r.id}&return=${encodedReturn}`);
      return;
    }
    if (r.kind === "contact") {
      navigate(`/contacts?search=${encodeURIComponent(q)}&open=${r.id}&return=${encodedReturn}`);
      return;
    }

    // For the other modules we don't have drawer deep-links yet.
    // Keep behavior simple for now.
    toast.error("Deep-link drawer non ancora attivo per questo tipo di risultato.");
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={700}>Ricerca</Typography>

        <TextField
          label="Cerca"
          value={q}
          onChange={(e) => {
            const next = e.target.value;
            const nextParams = new URLSearchParams(sp);
            nextParams.set("q", next);
            nextParams.delete("search");
            setSp(nextParams, { replace: true });
          }}
          placeholder="Cliente, sito, inventario…"
          size="small"
        />

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {q && results.length === 0 ? (
              <Typography color="text.secondary">Nessun risultato per “{q}”.</Typography>
            ) : null}

            {Object.entries(KIND_LABEL).map(([kind, label]) => {
              const items = groups[kind] ?? [];
              if (!items.length) return null;
              return (
                <Card key={kind} variant="outlined">
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                      {label}
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <List dense disablePadding>
                      {items.map((r) => (
                        <ListItemButton
                          key={`${r.kind}-${r.id}`}
                          onClick={() => openInModule(r)}
                          sx={{ borderRadius: 1 }}
                        >
                          <ListItemText
                            primary={r.title}
                            secondary={r.subtitle ?? undefined}
                            primaryTypographyProps={{ fontWeight: 600 }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
