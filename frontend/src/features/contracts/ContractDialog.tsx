import * as React from 'react'
import { Box, Button, ButtonBase, Dialog, IconButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'

import { api } from '@shared/api/client'
import { apiErrorToFormFeedback } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoIcon } from '../../ui/campo'
import DevicePicker from '../devices/DevicePicker'
import { ContractStatusBadge } from './contractUi'
import { dShort } from './contractModel'
import {
  TYPE_CARDS, emptyForm, endOf, formFromContract, nextCode, toPayload, validate,
  type ContractForm, type FormErrors,
} from './contractForm'
import {
  AmountPreview, CodeTitle, CustomerField, Group, NotesField, PdfField, PeriodFields, PeriodPreview,
  SellerCompany, StatusChips, TypeCards, TypeChips, ValueBilling,
} from './ContractFormParts'
import { CONTRACT_STATUS_OPTIONS, type CompanyOption, type ContractDetail, type CustomerOption, type Seller } from './types'

export type ContractDialogProps = {
  open: boolean
  /** Contratto da modificare («Scheda unica»); `null` = creazione («Passi»). */
  contract: ContractDetail | null
  /** Cliente preimpostato in creazione (es. filtro cliente attivo). */
  initialCustomer?: number | null
  customers: CustomerOption[]
  sellers: Seller[]
  /** Scelte per la Società (`/customer-statuses/`). */
  companies: CompanyOption[]
  /** `contracts.view_contract_value`: senza, valore e PDF non sono né mostrati né inviati. */
  canViewValue: boolean
  onClose: () => void
  onSaved: (c: ContractDetail) => void
}

const STEPS = ['Cliente e tipo', 'Periodo', 'Valore e documenti'] as const
const STEP_FIELDS: (keyof FormErrors)[][] = [
  ['customer', 'contract_type', 'seller', 'company'],
  ['start_date', 'end_date', 'reminder_days'],
  ['code', 'title', 'total_value', 'billing_freq', 'devices', 'notes', 'status'],
]
const stepOf = (errs: FormErrors) => Math.max(0, STEP_FIELDS.findIndex((fs) => fs.some((k) => errs[k])))

/**
 * Dialogo del contratto (anteprima design-previews/ct-base.html):
 * creazione a tre passi, modifica come scheda unica con riepilogo che si aggiorna.
 */
export default function ContractDialog({ open, contract, initialCustomer = null, customers, sellers, companies, canViewValue, onClose, onSaved }: ContractDialogProps) {
  const toast = useToast()
  const theme = useTheme()
  const narrow = useMediaQuery(theme.breakpoints.down('sm'))
  const edit = Boolean(contract)
  const [f, setF] = React.useState<ContractForm>(() => emptyForm(initialCustomer))
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [step, setStep] = React.useState(0)
  const [pdf, setPdf] = React.useState<File | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setErrors({}); setStep(0); setPdf(null)
    if (contract) { setF(formFromContract(contract)); return }
    setF(emptyForm(initialCustomer))
    // Avviso di rinnovo proposto: quello delle Impostazioni di Archie (senza risposta resta 90).
    api.get<{ reminder_days: number }>('/contracts/defaults/')
      .then((r) => { const n = r.data?.reminder_days; if (Number.isInteger(n)) setF((x) => ({ ...x, reminder_days: n })) })
      .catch(() => {})
    // Codice proposto: il successivo dell'ultimo dell'anno.
    const year = new Date().getFullYear()
    api.get<{ results?: { code: string }[] }>('/contracts/', { params: { search: String(year), ordering: '-code', page_size: 1 } })
      .then((r) => setF((x) => (x.code ? x : { ...x, code: nextCode(r.data.results?.[0]?.code, year) })))
      .catch(() => setF((x) => (x.code ? x : { ...x, code: nextCode(null, year) })))
    // Reinizializza solo all'apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = React.useCallback(<K extends keyof ContractForm>(k: K, v: ContractForm[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    setErrors((e) => (e[k as keyof FormErrors] ? { ...e, [k]: undefined } : e))
  }, [])

  const custName = (id: number | null) => { const c = customers.find((x) => x.id === id); return c ? c.display_name || c.name || `#${c.id}` : contract?.customer_name ?? '' }
  const typeLabel = TYPE_CARDS.find((t) => t.value === f.contract_type)?.label ?? ''
  const autoTitle = typeLabel && f.customer != null ? `${typeLabel} — ${custName(f.customer)}` : ''
  const title = f.titleTouched ? f.title : autoTitle
  const parts = { f, set, errors }

  const save = async (status?: ContractForm['status']) => {
    const form = status ? { ...f, status } : f
    const errs = validate(form, title, canViewValue)
    if (Object.keys(errs).length) { setErrors(errs); if (!edit) setStep(stepOf(errs)); return }
    setSaving(true)
    try {
      const payload = toPayload(form, title, canViewValue)
      const res = contract
        ? await api.patch<ContractDetail>(`/contracts/${contract.id}/`, payload)
        : await api.post<ContractDetail>('/contracts/', payload)
      let saved = res.data
      if (!contract && pdf && canViewValue) {
        try {
          const fd = new FormData(); fd.append('file', pdf)
          saved = (await api.post<ContractDetail>(`/contracts/${saved.id}/document/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data
        } catch { toast.warning('Contratto creato, ma il PDF non è stato caricato: riprova dalla scheda.') }
      }
      toast.success(contract ? 'Contratto aggiornato' : form.status === 'bozza' ? 'Bozza salvata' : 'Contratto creato')
      onSaved(saved)
    } catch (e) {
      const fb = apiErrorToFormFeedback(e)
      if (fb.hasFieldErrors) { setErrors(fb.fieldErrors as FormErrors); if (!edit) setStep(stepOf(fb.fieldErrors as FormErrors)); toast.warning(fb.message) } else toast.error(fb.message)
    } finally { setSaving(false) }
  }

  const next = () => {
    const errs = validate(f, title, canViewValue, STEP_FIELDS[step])
    if (Object.keys(errs).length) { setErrors(errs); return }
    setStep((s) => s + 1)
  }

  const head = (sub: string) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: '16px 18px 12px', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="h2" id="ct-dlg-title" sx={{ fontSize: 16, fontWeight: 650 }}>{edit ? 'Modifica contratto' : 'Nuovo contratto'}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{sub}</Typography>
      </Box>
      <IconButton size="small" aria-label="Chiudi" onClick={onClose} disabled={saving} sx={{ mt: -0.5, mr: -0.75 }}><CampoIcon name="x" size={16} /></IconButton>
    </Box>
  )
  const foot = (children: React.ReactNode) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' }, p: '12px 18px', borderTop: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }}>{children}</Box>
  )
  const devices = (
    <DevicePicker customerId={f.customer} value={f.devices} onChange={(ids) => set('devices', ids)} allowCreate
      initialOptions={contract?.devices_detail} label="Device collegati (facoltativo)" error={Boolean(errors.devices)} helperText={errors.devices} />
  )

  // ── Creazione: tre passi ──────────────────────────────────────────
  const steps = (
    <>
      {head(`${STEPS[step]} · passo ${step + 1} di 3`)}
      <Box component="nav" aria-label="Passi" sx={{ display: 'flex', p: '12px 18px', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }}>
        {STEPS.map((s, i) => {
          const done = i < step; const cur = i === step
          return (
            <ButtonBase key={s} disabled={i > step} onClick={() => setStep(i)} aria-current={cur ? 'step' : undefined} sx={{
              flex: 1, justifyContent: 'flex-start', gap: 1, minWidth: 0, color: cur ? 'text.primary' : 'text.secondary', borderRadius: '6px',
              '&::before': i ? { content: '""', width: 18, height: 2, borderRadius: 1, mr: 0.25, flex: 'none', bgcolor: done || cur ? 'primary.main' : 'archie.borderStrong' } : undefined,
              '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
            }}>
              <Box component="span" sx={{
                width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', fontSize: 11, fontWeight: 700,
                bgcolor: done ? 'primary.main' : 'transparent', color: done ? 'primary.contrastText' : cur ? 'primary.main' : 'text.secondary',
                boxShadow: (t) => (done ? 'none' : cur ? `inset 0 0 0 2px ${t.palette.primary.main}, 0 0 0 4px ${t.palette.archie.field}` : `inset 0 0 0 2px ${t.palette.archie.borderStrong}`),
              }}>{done ? <CheckIcon sx={{ fontSize: 13 }} /> : i + 1}</Box>
              {narrow ? null : <Box component="b" sx={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</Box>}
            </ButtonBase>
          )
        })}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: '18px', display: 'grid', gap: 1.75, alignContent: 'start' }}>
        {step === 0 ? (
          <>
            <CustomerField {...parts} customers={customers} autoFocus />
            <TypeCards {...parts} />
            <SellerCompany {...parts} sellers={sellers} companies={companies} customers={customers} />
          </>
        ) : step === 1 ? (
          <>
            <PeriodFields {...parts} />
            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'archie.surface2', display: 'grid', gap: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                <Typography component="b" sx={{ fontSize: 15, fontWeight: 650 }}>{dShort(f.start_date)} → {dShort(endOf(f))}</Typography>
              </Box>
              <PeriodPreview f={f} />
            </Box>
          </>
        ) : (
          <>
            <CodeTitle {...parts} title={title} autoTitle={autoTitle} />
            <ValueBilling {...parts} canViewValue={canViewValue} />
            {canViewValue ? <AmountPreview f={f} compact /> : null}
            {devices}
            {canViewValue ? <PdfField file={pdf} onFile={setPdf} /> : null}
            <NotesField {...parts} />
          </>
        )}
      </Box>
      {foot(
        <>
          {step ? (
            <Box title={[custName(f.customer), typeLabel, step > 1 ? `${dShort(f.start_date)} → ${dShort(endOf(f))}` : ''].filter(Boolean).join(' · ')}
              sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
              <b>{custName(f.customer)}</b> · {typeLabel}{step > 1 ? <> · {dShort(f.start_date)} → {dShort(endOf(f))}</> : null}
            </Box>
          ) : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Il resto si completa nei passi successivi</Typography>}
          {step ? null : <Box sx={{ flex: 1 }} />}
          {step ? <Button color="inherit" onClick={() => setStep((s) => s - 1)} disabled={saving} startIcon={<CampoIcon name="chevL" size={15} />}>Indietro</Button>
            : <Button color="inherit" onClick={onClose}>Annulla</Button>}
          {step < 2 ? <Button variant="contained" onClick={next} endIcon={<CampoIcon name="chevR" size={15} />}>Avanti</Button> : (
            <>
              <Button variant="outlined" color="inherit" disabled={saving} onClick={() => void save('bozza')} sx={{ flex: 'none', whiteSpace: 'nowrap' }}>Salva come bozza</Button>
              <Button variant="contained" disabled={saving} startIcon={<CheckIcon />} onClick={() => void save('attivo')} sx={{ flex: 'none', whiteSpace: 'nowrap' }}>{saving ? 'Salvataggio…' : 'Crea contratto'}</Button>
            </>
          )}
        </>,
      )}
    </>
  )

  // ── Modifica: scheda unica con riepilogo ──────────────────────────
  const sheet = (
    <>
      {head('Modifica a sinistra: a destra vedi subito periodo, avviso di rinnovo e rate.')}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box sx={(t) => ({
          display: 'grid', gridTemplateColumns: '1fr', minHeight: '100%',
          [t.breakpoints.up('md')]: {
            gridTemplateColumns: 'minmax(0,1fr) 300px',
            background: `linear-gradient(to left, ${t.palette.archie.surface2} 299px, ${t.palette.divider} 299px 300px, transparent 300px)`,
          },
        })}>
          <Box sx={{ p: '16px 18px 20px' }}>
            <Group first n={1} title="Cliente e contratto">
              <CustomerField {...parts} customers={customers} fallbackName={contract?.customer_name} />
              <TypeChips {...parts} />
              <StatusChips {...parts} />
              <SellerCompany {...parts} sellers={sellers} companies={companies} customers={customers} />
              <CodeTitle {...parts} title={title} autoTitle={autoTitle} />
            </Group>
            <Group n={2} title="Periodo"><PeriodFields {...parts} /></Group>
            <Group n={3} title={canViewValue ? 'Valore' : 'Fatturazione'}><ValueBilling {...parts} canViewValue={canViewValue} /></Group>
            <Group n={4} title="Collegamenti" aside="tutto facoltativo">{devices}<NotesField {...parts} /></Group>
          </Box>
          <Box component="aside" aria-live="polite" sx={{ p: 2, display: 'grid', gap: 1.25, alignContent: 'start', position: { md: 'sticky' }, top: 0, alignSelf: 'start', bgcolor: { xs: 'archie.surface2', md: 'transparent' }, borderTop: { xs: '1px solid', md: 0 }, borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 650, color: 'text.secondary' }}>Come apparirà</Typography>
            <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 1.5, display: 'grid', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.code || '—'}</Box>
                <ContractStatusBadge status={f.status} label={CONTRACT_STATUS_OPTIONS.find((o) => o.value === f.status)?.label ?? ''} />
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 650, lineHeight: 1.3, color: title ? 'text.primary' : 'text.disabled' }}>{title || 'Titolo del contratto'}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{[custName(f.customer) || 'Cliente da scegliere', typeLabel || null, sellers.find((s) => s.id === f.seller)?.name ?? null].filter(Boolean).join(' · ')}</Typography>
              <PeriodPreview f={f} narrow />
            </Box>
            {canViewValue ? (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 650, color: 'text.secondary', mt: 0.5 }}>Importo</Typography>
                <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 1.5 }}><AmountPreview f={f} /></Box>
              </>
            ) : null}
          </Box>
        </Box>
      </Box>
      {foot(
        <>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}><Box component="span" sx={{ color: 'error.main' }}>*</Box> obbligatori</Typography>
          <Box sx={{ flex: 1 }} />
          <Button color="inherit" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button variant="contained" disabled={saving} startIcon={<CheckIcon />} onClick={() => void save()}>{saving ? 'Salvataggio…' : 'Salva modifiche'}</Button>
        </>,
      )}
    </>
  )

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullScreen={narrow} aria-labelledby="ct-dlg-title"
      slotProps={{ paper: { sx: { width: edit ? 900 : 680, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: narrow ? 0 : '12px', ...(narrow ? { maxWidth: '100vw', maxHeight: '100vh' } : {}) } } }}>
      {edit ? sheet : steps}
    </Dialog>
  )
}
