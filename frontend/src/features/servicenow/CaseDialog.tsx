/**
 * CaseDialog — crea o modifica un caso ServiceNow (dialogo Campo sterile).
 * Flusso principale: upload screenshot → estrazione OCR server-side
 * (POST /servicenow-cases/extract/, non salva nulla) → form precompilato
 * ed editabile → conferma/correzione → salvataggio.
 */
import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress, TextField, Typography } from '@mui/material'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { isRecord } from '@shared/utils/guards'
import { initialsOf, type ServiceNowCaseRow } from './snModel'
import { CampoDialog, CampoIcon } from '../../ui/campo'
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

const CATEGORY_OPTIONS = [
  { value: 'philips', label: 'Philips' },
  { value: 'biotron', label: 'Biotron' },
]

const EMPTY_FORM: ServiceNowCaseForm = {
  number: '',
  account: '',
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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CaseDialogProps {
  open: boolean
  onClose: () => void
  onSave: (form: ServiceNowCaseForm, screenshotFile: File | null) => Promise<void>
  /** Se presente → modalità modifica, altrimenti creazione. */
  initial: ServiceNowCaseRow | null
  saving: boolean
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CaseDialog({ open, onClose, onSave, initial, saving }: CaseDialogProps) {
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
          opened_date,
          opened_time,
          short_description: d.short_description ?? prev.short_description,
        }
      })
      if (d.warnings?.length) {
        setExtractWarnings(d.warnings)
      } else {
        toast.success('Campi estratti dallo screenshot — controlla e correggi se serve')
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


  const canSave = Boolean(
    form.number.trim() && form.account.trim() && form.category && form.case_type !== '',
  ) && (!form.opened_date || Boolean(form.opened_time)) && !extracting

  const techs = userRows.filter((u) => u.is_servicenow_technician && (form.category === 'philips' ? u.is_philips : !u.is_philips))
  const chip = (on: boolean) => ({
    height: 30, px: 1.25, gap: 0.75, borderRadius: '15px', border: '1px solid', fontSize: 12.5,
    borderColor: on ? 'archie.fieldLine' : 'divider', bgcolor: on ? 'archie.field' : 'background.paper', color: on ? 'primary.main' : 'text.primary', fontWeight: on ? 600 : 400,
    '&.Mui-disabled': { color: 'text.disabled' },
  })
  const seg = (on: boolean) => ({ height: 28, px: 1.25, borderRadius: '5px', fontSize: 12.5, fontWeight: on ? 600 : 400, color: on ? 'primary.main' : 'text.secondary', bgcolor: on ? 'archie.field' : 'transparent' })

  return (
    <CampoDialog open={open} onClose={onClose} busy={saving} labelId="sn-case-title" width={560}
      title={isEdit ? `Modifica ${initial!.number}` : 'Nuovo caso'}
      sub={isEdit ? initial!.account : extracting ? 'Sto leggendo lo screenshot…' : screenshotPreviewUrl ? 'Controlla i campi letti dallo screenshot e completa.' : 'Incolla lo screenshot del caso: numero, account, data e descrizione si compilano da soli.'}
      footer={<>
        <Box sx={{ flex: 1 }} />
        <Button variant="text" onClick={onClose} disabled={saving}>Annulla</Button>
        <Button variant="contained" onClick={() => void onSave(form, screenshotFileRef.current)} disabled={saving || !canSave}>{isEdit ? 'Salva' : 'Crea caso'}</Button>
      </>}>
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
      {screenshotPreviewUrl ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="img" src={screenshotPreviewUrl} alt="Screenshot del caso" sx={{ width: 96, height: 56, objectFit: 'cover', objectPosition: 'top left', borderRadius: '6px', border: '1px solid', borderColor: 'divider', flex: 'none' }} />
          <Typography sx={{ flex: 1, fontSize: 13, color: extracting ? 'text.secondary' : extractWarnings.length ? 'warning.main' : 'success.main', display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {extracting ? <><CircularProgress size={14} />Lettura in corso…</> : extractWarnings.length ? extractWarnings.join(' ') : 'Campi letti dallo screenshot'}
          </Typography>
          <Button size="small" variant="text" onClick={() => fileInputRef.current?.click()} disabled={extracting}>Cambia</Button>
        </Box>
      ) : (
        <ButtonBase onClick={() => fileInputRef.current?.click()} disabled={extracting} sx={{
          display: 'grid', justifyItems: 'center', gap: 0.5, py: 3, px: 2, borderRadius: '12px', border: '1.5px dashed', borderColor: 'archie.borderStrong', bgcolor: 'archie.surface2', color: 'text.secondary',
          '&:hover': { borderColor: 'archie.fieldLine', bgcolor: 'archie.field' },
        }}>
          <Box component="span" sx={{ color: 'primary.main', display: 'inline-flex' }}><CampoIcon name="upload" size={24} /></Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>Incolla lo screenshot</Typography>
          <Typography sx={{ fontSize: 12.5 }}>Ctrl+V, oppure clicca per sceglierlo · puoi anche compilare a mano</Typography>
        </ButtonBase>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <TextField label="Numero" required value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="es. CS0628228"
          slotProps={{ htmlInput: { style: { fontFamily: '"Geist Mono", ui-monospace, monospace' } } }} />
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Categoria</Typography>
          <Box role="radiogroup" aria-label="Categoria" sx={{ display: 'inline-flex', gap: '2px', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '7px' }}>
            {CATEGORY_OPTIONS.map((o) => <ButtonBase key={o.value} role="radio" aria-checked={form.category === o.value} onClick={() => handleCategoryChange(o.value)} sx={seg(form.category === o.value)}>{o.label}</ButtonBase>)}
          </Box>
        </Box>
      </Box>
      <TextField label="Account" required value={form.account} onChange={(e) => set('account', e.target.value)} />
      <TextField label="Descrizione breve" multiline minRows={2} maxRows={5} value={form.short_description} onChange={(e) => set('short_description', e.target.value)} />
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Type <Box component="span" sx={{ color: 'error.main' }}>*</Box></Typography>
        <Box role="radiogroup" aria-label="Type" sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px', p: '2px', border: '1px solid', borderColor: form.case_type === '' ? 'warning.main' : 'divider', borderRadius: '7px' }}>
          {caseTypeOptions.map((o) => <ButtonBase key={o.id} role="radio" aria-checked={form.case_type === o.id} onClick={() => set('case_type', o.id)} sx={seg(form.case_type === o.id)}>{o.name}</ButtonBase>)}
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <TextField type="date" label="Aperto il" value={form.opened_date} onChange={(e) => applyOpenedDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="time" label="Ora" value={form.opened_time} onChange={(e) => set('opened_time', e.target.value)} disabled={!form.opened_date}
          required={Boolean(form.opened_date)} error={Boolean(form.opened_date) && !form.opened_time} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>
      <TextField label="Link al caso" value={form.external_url} onChange={(e) => set('external_url', e.target.value)} placeholder="https://…" />
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>Assegna a</Typography>
        <Box role="radiogroup" aria-label="Assegna a" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          <ButtonBase role="radio" aria-checked={form.assigned_to === null} onClick={() => set('assigned_to', null)} sx={chip(form.assigned_to === null)}>Nessuno</ButtonBase>
          {techs.map((u) => {
            const away = absentUserIds.has(u.id)
            const on = form.assigned_to === u.id
            return (
              <ButtonBase key={u.id} role="radio" aria-checked={on} disabled={away} title={away ? 'Assente in questa data' : ''} onClick={() => set('assigned_to', u.id)} sx={{ ...chip(on), pl: 0.5 }}>
                <Box component="span" sx={{ display: 'inline-grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%', fontSize: 9, fontWeight: 700, bgcolor: (t) => t.palette.archie.tints.mint.bg, color: (t) => t.palette.archie.tints.mint.ink }}>{initialsOf(u.full_name || u.username)}</Box>
                {(u.full_name || u.username).trim().split(/\s+/)[0]}
                {away ? <Box component="span" sx={{ fontSize: 10.5, fontWeight: 600, px: 0.5, borderRadius: '4px', bgcolor: (t) => t.palette.archie.tints.peach.bg, color: (t) => t.palette.archie.tints.peach.ink }}>assente</Box> : null}
              </ButtonBase>
            )
          })}
        </Box>
        {absentUserIds.size ? <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.75 }}>Chi è assente in questa data non si può scegliere.</Typography> : null}
      </Box>
    </CampoDialog>
  )
}
