import * as React from 'react'
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
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  type CustomFieldDefinition,
  type CustomFieldEntity,
  getCustomFieldValue,
  setCustomFieldValue,
} from '../hooks/useCustomFieldDefinitions'
import { useCustomFieldDefinitions } from '../hooks/useCustomFieldDefinitions'

function asNumberOrEmpty(v: string): number | '' {
  const s = String(v)
  if (!s.trim()) return ''
  const n = Number(s)
  return Number.isFinite(n) ? n : ''
}

function selectOptions(def: CustomFieldDefinition): { value: string; label: string }[] {
  const opt = def.options
  if (!opt) return []
  if (Array.isArray(opt)) return opt.map((x) => ({ value: String(x), label: String(x) }))
  if (typeof opt === 'object') {
    return Object.entries(opt as Record<string, unknown>).map(([k, v]) => ({
      value: String(k),
      label: String(v),
    }))
  }
  return []
}

export default function CustomFieldsEditor(props: {
  entity: CustomFieldEntity
  value: Record<string, unknown> | null | undefined
  onChange: (v: Record<string, unknown>) => void
  disabled?: boolean
  title?: string
  mode?: 'inline' | 'accordion'
  defaultExpanded?: boolean
  errors?: Record<string, string | undefined>
  onClearFieldError?: (key: string) => void
  formError?: string
}) {
  const {
    entity,
    value,
    onChange,
    disabled,
    title,
    mode = 'inline',
    defaultExpanded = false,
    errors,
    onClearFieldError,
    formError,
  } = props
  const { defs, loading } = useCustomFieldDefinitions(entity)

  const activeDefs = React.useMemo(() => {
    return (defs ?? [])
      .filter((d) => d && d.is_active !== false)
      .slice()
      .sort(
        (a, b) =>
          Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
          String(a.label).localeCompare(String(b.label)),
      )
  }, [defs])

  const renderBody = () => {
    if (loading && activeDefs.length === 0) {
      return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Caricamento campi custom…
          </Typography>
        </Stack>
      )
    }

    if (activeDefs.length === 0) return null

    return (
      <Stack spacing={1.25} sx={{ mt: 1 }}>
        {activeDefs.map((def) => {
          const raw = getCustomFieldValue(value, def)
          const fieldError = errors?.[def.key]

          if (def.field_type === 'boolean') {
            const checked = Boolean(raw)
            return (
              <FormControl key={def.id} disabled={disabled} error={Boolean(fieldError)}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={checked}
                      onChange={(e) => {
                        const next = setCustomFieldValue(value, def, e.target.checked)
                        onChange(next)
                        onClearFieldError?.(def.key)
                      }}
                    />
                  }
                  label={def.label + (def.required ? ' *' : '')}
                />
                <FormHelperText>{fieldError || def.help_text || ' '}</FormHelperText>
              </FormControl>
            )
          }

          if (def.field_type === 'select') {
            const opts = selectOptions(def)
            const v = raw == null ? '' : String(raw)
            return (
              <FormControl
                key={def.id}
                size="small"
                fullWidth
                disabled={disabled}
                error={Boolean(fieldError)}
              >
                <InputLabel>{def.label + (def.required ? ' *' : '')}</InputLabel>
                <Select
                  label={def.label + (def.required ? ' *' : '')}
                  value={v}
                  onChange={(e) => {
                    const nextVal = String(e.target.value || '')
                    const next = setCustomFieldValue(value, def, nextVal || undefined)
                    onChange(next)
                    onClearFieldError?.(def.key)
                  }}
                >
                  <MenuItem value="">(vuoto)</MenuItem>
                  {opts.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{fieldError || def.help_text || ' '}</FormHelperText>
              </FormControl>
            )
          }

          if (def.field_type === 'number') {
            const v = raw == null ? '' : String(raw)
            return (
              <TextField
                key={def.id}
                size="small"
                type="number"
                error={Boolean(fieldError)}
                label={def.label + (def.required ? ' *' : '')}
                value={v}
                onChange={(e) => {
                  const num = asNumberOrEmpty(e.target.value)
                  const next = setCustomFieldValue(value, def, num === '' ? undefined : num)
                  onChange(next)
                  onClearFieldError?.(def.key)
                }}
                fullWidth
                disabled={disabled}
                helperText={fieldError || def.help_text || ' '}
              />
            )
          }

          if (def.field_type === 'date') {
            const v = raw == null ? '' : String(raw)
            return (
              <TextField
                key={def.id}
                size="small"
                label={def.label + (def.required ? ' *' : '')}
                type="date"
                error={Boolean(fieldError)}
                value={v}
                onChange={(e) => {
                  const nextVal = e.target.value
                  const next = setCustomFieldValue(value, def, nextVal || undefined)
                  onChange(next)
                  onClearFieldError?.(def.key)
                }}
                fullWidth
                disabled={disabled}
                helperText={fieldError || def.help_text || ' '}
                InputLabelProps={{ shrink: true }}
              />
            )
          }

          // default: text
          const v = raw == null ? '' : String(raw)
          return (
            <TextField
              key={def.id}
              size="small"
              label={def.label + (def.required ? ' *' : '')}
              value={v}
              type={def.is_sensitive ? 'password' : 'text'}
              error={Boolean(fieldError)}
              onChange={(e) => {
                const nextVal = e.target.value
                const next = setCustomFieldValue(value, def, nextVal || undefined)
                onChange(next)
                onClearFieldError?.(def.key)
              }}
              fullWidth
              disabled={disabled}
              helperText={fieldError || def.help_text || ' '}
            />
          )
        })}
      </Stack>
    )
  }

  const body = renderBody()
  if (!body) return null

  if (mode === 'accordion') {
    return (
      <Accordion
        disableGutters
        elevation={0}
        defaultExpanded={defaultExpanded}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 1.5, minHeight: 35 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, opacity: 0.85 }}>
            {title ?? 'Campi custom'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5 }}>
          {formError ? (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
              {formError}
            </Typography>
          ) : null}
          {body}
        </AccordionDetails>
      </Accordion>
    )
  }

  // inline
  return (
    <Box>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 600, opacity: 0.75 }}>
        {title ?? 'Campi custom'}
      </Typography>
      {formError ? (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
          {formError}
        </Typography>
      ) : null}
      {body}
    </Box>
  )
}
