import * as React from "react";
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useToast } from "./toast";
import {
  type CustomFieldEntity,
  normalizeKey,
  useCustomFieldDefinitions,
} from "../hooks/useCustomFieldDefinitions";

async function copyToClipboard(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export default function CustomFieldsDisplay(props: {
  entity: CustomFieldEntity;
  value: Record<string, any> | null | undefined;
  title?: string;
}) {
  const { entity, value, title } = props;
  const toast = useToast();
  const { defs, loading } = useCustomFieldDefinitions(entity);

  const cf = (value ?? {}) as Record<string, any>;

  const rows = React.useMemo(() => {
    const usedKeys = new Set<string>();
    const items: { label: string; value: string }[] = [];

    for (const d of defs ?? []) {
      const wanted = new Set<string>([normalizeKey(d.key)]);
      for (const a of d.aliases ?? []) wanted.add(normalizeKey(String(a)));

      for (const [k, v] of Object.entries(cf)) {
        if (wanted.has(normalizeKey(k))) {
          usedKeys.add(k);
          if (v === null || v === undefined || (typeof v === "string" && !v.trim())) continue;
          items.push({ label: d.label, value: typeof v === "string" ? v : JSON.stringify(v) });
          break;
        }
      }
    }

    // append unknown keys
    for (const [k, v] of Object.entries(cf)) {
      if (usedKeys.has(k)) continue;
      if (v === null || v === undefined || (typeof v === "string" && !v.trim())) continue;
      items.push({ label: k, value: typeof v === "string" ? v : JSON.stringify(v) });
    }

    return items;
  }, [cf, defs]);

  if (loading && rows.length === 0) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Caricamento campi custom…
        </Typography>
      </Stack>
    );
  }

  return (
    <Box>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="subtitle2" sx={{ mt: 0.5, opacity: 0.75 }}>
        {title ?? "Campi custom"}
      </Typography>

      {rows.length ? (
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          {rows.map((r) => (
            <Stack key={r.label} direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ minWidth: 140, opacity: 0.8 }}>
                {r.label}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: "break-word", flex: 1 }}>
                {r.value}
              </Typography>
              {r.value.trim() ? (
                <Tooltip title="Copia">
                  <IconButton
                    size="small"
                    onClick={async () => {
                      await copyToClipboard(r.value);
                      toast.success("Copiato ✅");
                    }}
                  >
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
          —
        </Typography>
      )}
    </Box>
  );
}
