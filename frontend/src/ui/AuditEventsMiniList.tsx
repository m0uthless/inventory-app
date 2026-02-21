import * as React from "react";
import {
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { buildDrfListParams } from "../api/drf";
import { apiErrorToMessage } from "../api/error";
import { useDrfList } from "../hooks/useDrfList";
import { buildQuery } from "../utils/nav";
import { useToast } from "./toast";
import AuditActionChip from "./AuditActionChip";
import type { AuditEventRow } from "../types/audit";

function fmt(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

export default function AuditEventsMiniList(props: {
  appLabel: string;
  model: string;
  objectId: number | string;
  limit?: number;
  emptyLabel?: string;
}) {
  const { appLabel, model, objectId, limit = 15, emptyLabel = "Nessuna attività" } = props;
  const toast = useToast();
  const nav = useNavigate();

  const params = React.useMemo(
    () =>
      buildDrfListParams({
        page0: 0,
        pageSize: limit,
        ordering: "-created_at",
        extra: {
          app_label: appLabel,
          model,
          object_id: String(objectId),
        },
      }),
    [appLabel, model, objectId, limit]
  );

  const { rows, loading } = useDrfList<AuditEventRow>("/audit-events/", params, (e: unknown) =>
    toast.error(apiErrorToMessage(e))
  );

  if (loading) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Caricamento…
        </Typography>
      </Stack>
    );
  }

  if (!rows.length) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.7, py: 0.5 }}>
        {emptyLabel}
      </Typography>
    );
  }

  return (
    <List
      dense
      disablePadding
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}
    >
      {rows.map((ev, idx) => {
        const primary = ev.subject || ev.object_repr || `#${ev.object_id ?? ""}`;
        const secondary = [fmt(ev.created_at), ev.actor_username || ""].filter(Boolean).join(" • ");
        return (
          <ListItem key={ev.id} disablePadding divider={idx < rows.length - 1}>
            <ListItemButton
              onClick={() =>
                nav(
                  `/audit${buildQuery({
                    app_label: appLabel,
                    model,
                    object_id: String(objectId),
                    open: ev.id,
                  })}`
                )
              }
              sx={{ py: 1 }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <AuditActionChip action={ev.action} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                        {primary}
                      </Typography>
                    </Box>
                  </Stack>
                }
                secondary={secondary}
                secondaryTypographyProps={{ noWrap: true }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
