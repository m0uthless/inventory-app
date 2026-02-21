import * as React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  type CustomFieldDefinition,
  type CustomFieldEntity,
  getCustomFieldValue,
  setCustomFieldValue,
} from "../hooks/useCustomFieldDefinitions";
import { useCustomFieldDefinitions } from "../hooks/useCustomFieldDefinitions";

function asNumberOrEmpty(v: string): number | "" {
  const s = String(v);
  if (!s.trim()) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : "";
}

function selectOptions(def: CustomFieldDefinition): { value: string; label: string }[] {
  const opt = def.options;
  if (!opt) return [];
  if (Array.isArray(opt)) return opt.map((x) => ({ value: String(x), label: String(x) }));
  if (typeof opt === "object") {
    return Object.entries(opt as Record<string, any>).map(([k, v]) => ({ value: String(k), label: String(v) }));
  }
  return [];
}

export default function CustomFieldsEditor(props: {
  entity: CustomFieldEntity;
  value: Record<string, any> | null | undefined;
  onChange: (v: Record<string, any>) => void;
  disabled?: boolean;
  title?: string;
  mode?: "inline" | "accordion";
  defaultExpanded?: boolean;
}) {
  const { entity, value, onChange, disabled, title, mode = "inline", defaultExpanded = false } = props;
  const { defs, loading } = useCustomFieldDefinitions(entity);

  const activeDefs = React.useMemo(() => {
    return (defs ?? [])
      .filter((d) => d && d.is_active !== false)
      .slice()
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || String(a.label).localeCompare(String(b.label)));
  }, [defs]);

  const renderBody = () => {
    if (loading && activeDefs.length === 0) {
      return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Caricamento campi custom…
          </Typography>
        </Stack>
      );
    }

    if (activeDefs.length === 0) return null;

    return (
      <Stack spacing={1.25} sx={{ mt: 1 }}>
        {activeDefs.map((def) => {
          const raw = getCustomFieldValue(value, def);

          if (def.field_type === "boolean") {
            const checked = Boolean(raw);
            return (
              <FormControl key={def.id} disabled={disabled}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={checked}
                      onChange={(e) => {
                        const next = setCustomFieldValue(value, def, e.target.checked);
                        onChange(next);
                      }}
                    />
                  }
                  label={def.label + (def.required ? " *" : "")}
                />
                {def.help_text ? <FormHelperText>{def.help_text}</FormHelperText> : null}
              </FormControl>
            );
          }

          if (def.field_type === "select") {
            const opts = selectOptions(def);
            const v = raw == null ? "" : String(raw);
            return (
              <FormControl key={def.id} size="small" fullWidth disabled={disabled}>
                <InputLabel>{def.label + (def.required ? " *" : "")}</InputLabel>
                <Select
                  label={def.label + (def.required ? " *" : "")}
                  value={v}
                  onChange={(e) => {
                    const nextVal = String(e.target.value || "");
                    const next = setCustomFieldValue(value, def, nextVal || undefined);
                    onChange(next);
                  }}
                >
                  <MenuItem value="">(vuoto)</MenuItem>
                  {opts.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
                {def.help_text ? <FormHelperText>{def.help_text}</FormHelperText> : null}
              </FormControl>
            );
          }

          if (def.field_type === "number") {
            const v = raw == null ? "" : String(raw);
            return (
              <TextField
                key={def.id}
                size="small"
                type="number"
                label={def.label + (def.required ? " *" : "")}
                value={v}
                onChange={(e) => {
                  const num = asNumberOrEmpty(e.target.value);
                  const next = setCustomFieldValue(value, def, num === "" ? undefined : num);
                  onChange(next);
                }}
                fullWidth
                disabled={disabled}
                helperText={def.help_text || " "}
              />
            );
          }

          if (def.field_type === "date") {
            const v = raw == null ? "" : String(raw);
            return (
              <TextField
                key={def.id}
                size="small"
                label={def.label + (def.required ? " *" : "")}
                type="date"
                value={v}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  const next = setCustomFieldValue(value, def, nextVal || undefined);
                  onChange(next);
                }}
                fullWidth
                disabled={disabled}
                helperText={def.help_text || " "}
                InputLabelProps={{ shrink: true }}
              />
            );
          }

          // default: text
          const v = raw == null ? "" : String(raw);
          return (
            <TextField
              key={def.id}
              size="small"
              label={def.label + (def.required ? " *" : "")}
              value={v}
              type={def.is_sensitive ? "password" : "text"}
              onChange={(e) => {
                const nextVal = e.target.value;
                const next = setCustomFieldValue(value, def, nextVal || undefined);
                onChange(next);
              }}
              fullWidth
              disabled={disabled}
              helperText={def.help_text || " "}
            />
          );
        })}
      </Stack>
    );
  };

  const body = renderBody();
  if (!body) return null;

  if (mode === "accordion") {
    return (
      <Accordion
        disableGutters
        elevation={0}
        defaultExpanded={defaultExpanded}
        sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 1.5, minHeight: 44 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, opacity: 0.85 }}>
            {title ?? "Campi custom"}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5 }}>{body}</AccordionDetails>
      </Accordion>
    );
  }

  // inline
  return (
    <Box>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 600, opacity: 0.75 }}>
        {title ?? "Campi custom"}
      </Typography>
      {body}
    </Box>
  );
}
