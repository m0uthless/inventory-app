import * as React from "react";

import {
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { useNavigate } from "react-router-dom";

import { buildDrfListParams } from "../api/drf";
import { apiErrorToMessage } from "../api/error";
import { useDrfList } from "../hooks/useDrfList";
import { buildQuery } from "../utils/nav";
import { useToast } from "./toast";
import AuditActionChip from "./AuditActionChip";
import type { AuditEventRow } from "../types/audit";

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("it-IT", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function summarizeChanges(changes: any): string {
  if (!changes || typeof changes !== "object") return "";
  const keys = Object.keys(changes);
  if (!keys.length) return "";
  const first = keys.slice(0, 4);
  const rest = keys.length - first.length;
  return rest > 0 ? `${first.join(", ")} +${rest}` : first.join(", ");
}

type Props = {
  appLabel: string;
  model: string;
  objectId: string | number;
  title?: string;
  pageSize?: number;
};

/**
 * Compact "Attività" tab for entity drawers.
 * Fetches latest audit events filtered by (app_label, model, object_id).
 */
export default function AuditEventsTab({ appLabel, model, objectId, title = "Attività", pageSize = 20 }: Props) {
  const toast = useToast();
  const navigate = useNavigate();

  const params = React.useMemo(
    () =>
      buildDrfListParams({
        page0: 0,
        pageSize,
        ordering: "-created_at",
        extra: {
          app_label: appLabel,
          model,
          object_id: String(objectId),
        },
      }),
    [appLabel, model, objectId, pageSize]
  );

  const { rows, rowCount, loading } = useDrfList<AuditEventRow>("/audit-events/", params, (e: unknown) =>
    toast.error(apiErrorToMessage(e))
  );

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
          {title}
        </Typography>

        <Button
          size="small"
          variant="outlined"
          startIcon={<OpenInNewIcon />}
          onClick={() => navigate(`/audit${buildQuery({ app_label: appLabel, model, object_id: String(objectId) })}`)}
        >
          Vedi tutto
        </Button>
      </Stack>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Caricamento…
          </Typography>
        </Stack>
      ) : rowCount === 0 ? (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Nessuna attività registrata.
        </Typography>
      ) : (
        <List dense disablePadding sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
          {rows.map((ev, idx) => {
            const who = ev.actor_username || ev.actor_email || "—";
            const when = fmtDateTime(ev.created_at);
            const ch = summarizeChanges(ev.changes);

            return (
              <ListItem
                key={ev.id}
                divider={idx < rows.length - 1}
                sx={{ py: 1, alignItems: "flex-start" }}
              >
                <Box sx={{ pt: 0.2, pr: 1 }}>
                  <AuditActionChip action={ev.action} />
                </Box>

                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {who}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.65 }} noWrap>
                        {when}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Typography variant="body2" sx={{ opacity: 0.75 }} noWrap>
                      {ch || ev.path || "—"}
                    </Typography>
                  }
                  primaryTypographyProps={{ component: "div" }}
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Stack>
  );
}
