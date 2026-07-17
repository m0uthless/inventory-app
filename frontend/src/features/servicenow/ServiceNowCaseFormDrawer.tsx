/**
 * ServiceNowCaseFormDrawer — form create/edit ServiceNow Case in DrawerShell.
 * Flusso principale: upload screenshot → estrazione OCR server-side
 * (POST /servicenow-cases/extract/, non salva nulla) → form precompilato
 * ed editabile → conferma/correzione → salvataggio.
 */
import * as React from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'

import { DrawerShell } from '@shared/ui/DrawerShell'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { isRecord } from '@shared/utils/guards'
import type { ServiceNowCaseRow } from '../../pages/ServiceNowCases'
import { todayISO } from './absenceShared'

// Ora corrente "HH:MM" (locale) — usata per precompilare l'ora apertura
// quando la data selezionata/estratta è oggi.
function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type ServiceNowCaseForm = {
  number: string
  account: string
  priority: string
  category: string
  case_type: number | ''
  opened_date: string      // ISO "YYYY-MM-DD" o ''
  opened_time: string      // "HH:MM" o '' — richiesta se opened_date è impostata
  short_description: string
  assigned_to: number | null
  external_url: string
}

type UserOption = { id: number; username: string; full_name?: string; is_philips: boolean; is_servicenow_technician: boolean }
type CaseTypeOption = { id: number; name: string; category: string }

const PRIORITY_OPTIONS = [
  { value: '1', label: '1 - Critical' },
  { value: '2', label: '2 - High' },
  { value: '3', label: '3 - Moderate' },
  { value: '4', label: '4 - Low' },
]

const CATEGORY_OPTIONS = [
  { value: 'philips', label: 'Philips' },
  { value: 'biotron', label: 'Biotron' },
]

const EMPTY_FORM: ServiceNowCaseForm = {
  number: '',
  account: '',
  priority: '3',
  category: 'biotron',
  case_type: '',
  opened_date: '',
  opened_time: '',
  short_description: '',
  assigned_to: null,
  external_url: '',
}

type ExtractResponse = {
  number: string | null
  account: string | null
  priority: string | null
  priority_raw: string | null
  opened_date: string | null
  short_description: string | null
  warnings: string[]
}

// ─── Helper campo ─────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ServiceNowCaseFormDrawerProps {
  open: boolean
  onClose: () => void
  onSave: (form: ServiceNowCaseForm, screenshotFile: File | null) => Promise<void>
  /** Se presente → modalità modifica, altrimenti creazione. */
  initial: ServiceNowCaseRow | null
  saving: boolean
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ServiceNowCaseFormDrawer({ open, onClose, onSave, initial, saving }: ServiceNowCaseFormDrawerProps) {
  const isEdit = initial !== null
  const toast = useToast()
  const [form, setForm] = React.useState<ServiceNowCaseForm>(EMPTY_FORM)

  // File caricato: in ref (non in state) per sopravvivere ai re-render senza perdere il riferimento binario
  const screenshotFileRef = React.useRef<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = React.useState<string | null>(null)
  const [extracting, setExtracting] = React.useState(false)
  const [extractWarnings, setExtractWarnings] = React.useState<string[]>([])

  // Reset form all'apertura
  React.useEffect(() => {
    if (!open) return
    screenshotFileRef.current = null
    setExtractWarnings([])
    if (initial) {
      setForm({
        number: initial.number,
        account: initial.account,
        priority: initial.priority,
        category: initial.category,
        case_type: initial.case_type,
        opened_date: initial.opened_date ?? '',
        opened_time: initial.opened_time ?? '',
        short_description: initial.short_description,
        assigned_to: initial.assigned_to,
        external_url: initial.external_url ?? '',
      })
      setScreenshotPreviewUrl(initial.screenshot_url)
    } else {
      setForm(EMPTY_FORM)
      setScreenshotPreviewUrl(null)
    }
  }, [open, initial])

  // Type disponibili per la categoria selezionata (fonte: /servicenow-case-types/)
  const [caseTypeOptions, setCaseTypeOptions] = React.useState<CaseTypeOption[]>([])

  React.useEffect(() => {
    if (!open) return
    api.get<CaseTypeOption[]>('/servicenow-case-types/', { params: { category: form.category } })
      .then((r) => setCaseTypeOptions(r.data))
      .catch(() => setCaseTypeOptions([]))
  }, [open, form.category])

  // Cambio categoria manuale (toggle) → azzero il type e l'assegnatario
  // selezionati, dato che le opzioni disponibili per entrambi cambiano
  // insieme alla categoria.
  const handleCategoryChange = (value: string) => {
    setForm((prev) => ({ ...prev, category: value, case_type: '', assigned_to: null }))
  }

  // Lista utenti per assegnazione — stessa fonte dati di Issues (/users/).
  // Endpoint non paginato (pagination_class=None): la risposta è un array
  // semplice, non l'oggetto {results, count} che si aspetta useDrfList.
  const [userRows, setUserRows] = React.useState<UserOption[]>([])

  const toUserOption = (v: unknown): UserOption | null => {
    if (!isRecord(v)) return null
    const id = Number(v['id'])
    if (!Number.isFinite(id)) return null
    const username = typeof v['username'] === 'string' ? v['username'] : ''
    const full_name = typeof v['full_name'] === 'string' ? v['full_name'] : ''
    const is_philips = v['is_philips'] === true
    const is_servicenow_technician = v['is_servicenow_technician'] !== false
    return { id, username, full_name, is_philips, is_servicenow_technician }
  }

  React.useEffect(() => {
    api
      .get('/users/', { params: { page_size: 200 } })
      .then((r) => {
        const payload: unknown = r.data
        const list: unknown[] = Array.isArray(payload)
          ? payload
          : isRecord(payload) && Array.isArray(payload['results'])
            ? (payload['results'] as unknown[])
            : []
        setUserRows(list.map(toUserOption).filter((x): x is UserOption => Boolean(x)))
      })
      .catch(() => {})
  }, [])

  // Tecnici assenti (ferie/malattia/ecc.) nella data (e ora, se orario) di
  // apertura selezionata: non devono essere proponibili in "Assegnato a".
  // Un'assenza a giornata intera esclude sempre; un permesso orario esclude
  // solo se l'ora apertura inserita rientra nella fascia registrata.
  const [absentUserIds, setAbsentUserIds] = React.useState<Set<number>>(new Set())

  React.useEffect(() => {
    if (!form.opened_date) { setAbsentUserIds(new Set()); return }
    api
      .get<{ user: number; is_hourly: boolean; time_from: string | null; time_to: string | null }[]>(
        '/technician-absences/', { params: { date_from: form.opened_date, date_to: form.opened_date } },
      )
      .then((r) => {
        const openedTime = form.opened_time || null
        const excluded = r.data.filter((a) => {
          if (!a.is_hourly) return true
          if (!openedTime || !a.time_from || !a.time_to) return false
          return a.time_from.slice(0, 5) <= openedTime && openedTime <= a.time_to.slice(0, 5)
        })
        setAbsentUserIds(new Set(excluded.map((a) => a.user)))
      })
      .catch(() => setAbsentUserIds(new Set()))
  }, [form.opened_date, form.opened_time])

  // Se il tecnico assegnato risulta assente nella data selezionata (es. la
  // data apertura è stata cambiata dopo l'assegnazione), l'assegnazione va
  // rimossa: non deve restare un case assegnato a un tecnico in ferie.
  React.useEffect(() => {
    if (form.assigned_to !== null && absentUserIds.has(form.assigned_to)) {
      setForm((prev) => ({ ...prev, assigned_to: null }))
      toast.error('Il tecnico assegnato risulta assente in questa data: assegnazione rimossa')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absentUserIds])

  const set = <K extends keyof ServiceNowCaseForm>(k: K, v: ServiceNowCaseForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  // Applica una nuova data apertura con la regola per l'ora: se la data è
  // oggi, precompila con l'ora attuale (comunque editabile); se è una data
  // diversa, l'ora va inserita manualmente (azzerata per evitare di lasciare
  // per sbaglio un vecchio orario riferito a un altro giorno).
  const applyOpenedDate = (newDate: string) => {
    setForm((prev) => ({
      ...prev,
      opened_date: newDate,
      opened_time: newDate && newDate === todayISO() ? nowHHMM() : '',
    }))
  }

  const isSm = { size: 'small' as const, fullWidth: true }

  // ── Upload + estrazione OCR ───────────────────────────────────────────────
  // Logica condivisa tra upload da file system e incolla (Ctrl+V) da clipboard.
  const processScreenshotFile = async (file: File) => {
    screenshotFileRef.current = file
    setScreenshotPreviewUrl(URL.createObjectURL(file))
    setExtractWarnings([])
    setExtracting(true)

    try {
      const fd = new FormData()
      fd.append('screenshot', file)
      const res = await api.post<ExtractResponse>('/servicenow-cases/extract/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const d = res.data
      setForm((prev) => {
        const opened_date = d.opened_date ?? prev.opened_date
        // Stessa regola del campo manuale: data estratta = oggi → ora attuale
        // come default; data diversa → ora da inserire manualmente.
        const opened_time = d.opened_date
          ? (d.opened_date === todayISO() ? nowHHMM() : '')
          : prev.opened_time
        return {
          ...prev,
          number: d.number ?? prev.number,
          account: d.account ?? prev.account,
          priority: d.priority ?? prev.priority,
          opened_date,
          opened_time,
          short_description: d.short_description ?? prev.short_description,
        }
      })
      if (d.warnings?.length) {
        setExtractWarnings(d.warnings)
      } else {
        toast.success('Campi estratti dallo screenshot ✅ — controlla e correggi se serve')
      }
    } catch (err) {
      toast.error(apiErrorToMessage(err))
      setExtractWarnings(['Estrazione automatica non riuscita: compila i campi manualmente.'])
    } finally {
      setExtracting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return
    await processScreenshotFile(file)
  }

  // Incolla screenshot da clipboard (Ctrl+V) mentre il drawer è aperto.
  // Attivo solo se il paste contiene un'immagine, altrimenti non interferisce
  // con il normale incolla di testo nei campi del form.
  React.useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void processScreenshotFile(file)
          }
          break
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])


  const title    = isEdit ? initial!.number : 'Nuovo ServiceNow Case'
  const subtitle = isEdit ? initial!.account : undefined

  const canSave = Boolean(
    form.number.trim() && form.account.trim() && form.priority && form.category && form.case_type !== '',
  ) && (!form.opened_date || Boolean(form.opened_time)) && !extracting

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width={420}
      gradient="teal"
      title={title}
      subtitle={subtitle}
      statusLabel={isEdit ? '● Modifica' : '● Nuovo'}
    >
      <Stack spacing={1.5}>

        {/* Upload screenshot */}
        <FormField label={isEdit ? 'Screenshot (sostituisci)' : 'Screenshot ServiceNow'}>
          <Stack spacing={1}>
            <Button
              variant="outlined"
              size="small"
              component="label"
              startIcon={extracting ? <CircularProgress size={14} /> : <UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
              disabled={extracting}
            >
              {extracting ? 'Estrazione in corso…' : 'Carica screenshot'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFileChange}
              />
            </Button>

            {screenshotPreviewUrl && (
              <Box
                component="img"
                src={screenshotPreviewUrl}
                alt="Anteprima screenshot"
                sx={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
              />
            )}

            {!screenshotPreviewUrl && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.disabled' }}>
                <ImageOutlinedIcon sx={{ fontSize: 18 }} />
                <Typography variant="caption">Nessuno screenshot caricato — oppure incolla con Ctrl+V</Typography>
              </Box>
            )}

            {extractWarnings.length > 0 && (
              <Alert severity="warning" sx={{ fontSize: '0.75rem' }}>
                <Stack spacing={0.25}>
                  {extractWarnings.map((w, i) => <span key={i}>{w}</span>)}
                </Stack>
              </Alert>
            )}
          </Stack>
        </FormField>

        <Divider />

        {/* Numero + Account */}
        <FormField label="Numero case *">
          <TextField
            {...isSm}
            value={form.number}
            onChange={(e) => set('number', e.target.value)}
            error={!form.number.trim()}
            placeholder="es. CS0628228"
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />
        </FormField>

        <FormField label="Account *">
          <TextField
            {...isSm}
            value={form.account}
            onChange={(e) => set('account', e.target.value)}
            error={!form.account.trim()}
          />
        </FormField>

        {/* Categoria */}
        <FormField label="Categoria *">
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={form.category}
            onChange={(_e, v) => v && handleCategoryChange(v)}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value}>{o.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </FormField>

        {/* Type + Priorità */}
        <Stack direction="row" spacing={1}>
          <FormField label="Type *">
            <TextField
              {...isSm}
              select
              value={form.case_type}
              onChange={(e) => set('case_type', Number(e.target.value))}
              error={form.case_type === ''}
            >
              {caseTypeOptions.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </TextField>
          </FormField>
          <FormField label="Priorità *">
            <TextField {...isSm} select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
          </FormField>
        </Stack>

        {/* Data + ora apertura */}
        <Stack direction="row" spacing={1}>
          <FormField label="Data apertura">
            <TextField
              {...isSm}
              type="date"
              value={form.opened_date}
              onChange={(e) => applyOpenedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </FormField>
          <FormField label={form.opened_date ? 'Ora apertura *' : 'Ora apertura'}>
            <TextField
              {...isSm}
              type="time"
              value={form.opened_time}
              onChange={(e) => set('opened_time', e.target.value)}
              error={Boolean(form.opened_date) && !form.opened_time}
              disabled={!form.opened_date}
              helperText={Boolean(form.opened_date) && !form.opened_time ? 'Obbligatoria' : ' '}
              InputLabelProps={{ shrink: true }}
            />
          </FormField>
        </Stack>

        {/* Descrizione breve */}
        <FormField label="Descrizione breve">
          <TextField
            {...isSm}
            multiline
            minRows={2}
            maxRows={5}
            value={form.short_description}
            onChange={(e) => set('short_description', e.target.value)}
          />
        </FormField>

        {/* URL esterno (facoltativo) */}
        <FormField label="URL">
          <TextField
            {...isSm}
            value={form.external_url}
            onChange={(e) => set('external_url', e.target.value)}
            placeholder="https://..."
          />
        </FormField>

        <Divider />

        {/* Assegnato a */}
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Assegnazione
        </Typography>

        <FormField label="Assegnato a">
          <TextField
            {...isSm}
            select
            value={form.assigned_to ?? ''}
            onChange={(e) => set('assigned_to', e.target.value === '' ? null : Number(e.target.value))}
          >
            <MenuItem value=""><em>Nessuno</em></MenuItem>
            {userRows
              .filter((u) => u.is_servicenow_technician && (form.category === 'philips' ? u.is_philips : !u.is_philips) && !absentUserIds.has(u.id))
              .map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 20, height: 20, fontSize: '0.65rem' }}>{u.username.charAt(0).toUpperCase()}</Avatar>
                    <Typography variant="body2">
                      {(u.full_name || u.username).trim()}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
          </TextField>
          {absentUserIds.size > 0 && (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
              {absentUserIds.size === 1 ? '1 tecnico assente' : `${absentUserIds.size} tecnici assenti`} in questa data non {absentUserIds.size === 1 ? 'è proponibile' : 'sono proponibili'}.
            </Typography>
          )}
        </FormField>

        <Divider />

        {/* Azioni */}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button variant="text" size="small" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => void onSave(form, screenshotFileRef.current)}
            disabled={saving || !canSave}
          >
            {isEdit ? 'Salva modifiche' : 'Crea case'}
          </Button>
        </Stack>

      </Stack>
    </DrawerShell>
  )
}
