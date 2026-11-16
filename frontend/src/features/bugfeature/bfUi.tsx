import * as React from 'react'
import { Box, Button, ButtonBase, Link, TextField, Typography } from '@mui/material'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import DoneRoundedIcon from '@mui/icons-material/DoneRounded'
import { CampoDialog, CampoIcon, DetailSection, FloatingDetail, Pill, QuickForm, SelectPill } from '../../ui/campo'
import { agoLabel } from '../../utils/agoLabel'
import {
  KIND_LABEL, KIND_TONE, REJECT_REASONS, SECTIONS, STATUS_LABEL, appendReason, closedBy, firstLine, firstName, initials, sectionLabel,
  type ReportKind, type ReportRow, type ReportStatus,
} from './bfModel'

const STATUS_TONE: Record<ReportStatus, { bg: string; fg: string }> = {
  open: { bg: 'info.light', fg: 'info.main' }, resolved: { bg: 'success.light', fg: 'success.main' }, rejected: { bg: 'archie.neutralBg', fg: 'text.secondary' },
}
export const KindIcon = ({ kind, size = 15 }: { kind: ReportKind; size?: number }) =>
  kind === 'bug' ? <BugReportOutlinedIcon sx={{ fontSize: size }} /> : <LightbulbOutlinedIcon sx={{ fontSize: size }} />

const badge = { display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' } as const

export function KindBadge({ kind }: { kind: ReportKind }) {
  return <Box component="span" sx={{ ...badge, pl: 0.75, bgcolor: KIND_TONE[kind].bg, color: KIND_TONE[kind].fg }}><KindIcon kind={kind} size={14} />{KIND_LABEL[kind]}</Box>
}

export function StatusBadge({ status, onDark }: { status: ReportStatus; onDark?: boolean }) {
  const t = STATUS_TONE[status]
  return <Box component="span" sx={{ ...badge, fontWeight: 550, bgcolor: t.bg, color: t.fg, ...(onDark && status === 'rejected' ? { bgcolor: 'rgba(255,255,255,.14)', color: '#fff' } : {}) }}>{STATUS_LABEL[status]}</Box>
}

function Ava({ name }: { name?: string | null }) {
  return <Box component="span" aria-hidden sx={{ display: 'inline-grid', placeItems: 'center', flex: 'none', width: 22, height: 22, borderRadius: '50%', bgcolor: 'archie.neutralBg', color: 'text.secondary', fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>{initials(name)}</Box>
}

/** Screenshot come miniatura (o grande nel dettaglio). */
export function Shot({ src, big }: { src: string; big?: boolean }) {
  return (
    <Box component="img" src={src} alt="" loading="lazy" sx={{
      display: 'block', width: '100%', height: big ? 'auto' : 70, maxHeight: big ? 320 : undefined, objectFit: big ? 'contain' : 'cover', objectPosition: 'top left',
      borderRadius: '6px', border: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2',
    }} />
  )
}

/** Scheda della bacheca. */
export function ReportCard({ r, selected, onOpen }: { r: ReportRow; selected: boolean; onOpen: () => void }) {
  const c = closedBy(r)
  return (
    <ButtonBase onClick={onOpen} aria-pressed={selected} sx={{
      display: 'grid', gap: 1, width: '100%', textAlign: 'left', justifyContent: 'stretch', justifyItems: 'stretch', alignItems: 'start', p: '10px 12px', border: '1px solid', borderColor: selected ? 'archie.fieldLine' : 'divider', borderRadius: '8px',
      bgcolor: 'background.paper', boxShadow: selected ? (t) => `inset 0 0 0 1px ${t.palette.archie.fieldLine}` : 'none', '&:hover': { borderColor: selected ? 'archie.fieldLine' : 'text.disabled' },
      '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
    }}>
      {r.screenshot_url ? <Shot src={r.screenshot_url} /> : null}
      <Typography sx={{ fontSize: 13, fontWeight: 550, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{firstLine(r.description)}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, fontSize: 11.5, color: 'text.secondary' }}>
        <Box component="span" sx={{ bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.75, lineHeight: '18px' }}>{sectionLabel(r.section, r.section_label)}</Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }} title={r.created_by_full_name ?? undefined}><Ava name={r.created_by_full_name} />{agoLabel(r.created_at)}</Box>
      </Box>
      {c ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 11.5, color: 'text.secondary' }}>
          <StatusBadge status={r.status} /> da {firstName(c.by)} · {agoLabel(c.at)}
        </Box>
      ) : null}
    </ButtonBase>
  )
}

/** Colonna della bacheca. */
export function BoardColumn({ title, tone, icon, count, children, footer }: {
  title: string; tone: { bg: string; fg: string }; icon: React.ReactNode; count: number; children: React.ReactNode; footer?: React.ReactNode
}) {
  return (
    <Box component="section" aria-label={title} sx={{ bgcolor: 'archie.surface2', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 1.25, minWidth: 0 }}>
      <Box component="header" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5, pb: 1.25 }}>
        <Box component="span" sx={{ width: 26, height: 26, borderRadius: '7px', display: 'grid', placeItems: 'center', bgcolor: tone.bg, color: tone.fg }}>{icon}</Box>
        <Typography component="h2" sx={{ fontSize: 13, fontWeight: 650, flex: 1 }}>{title}</Typography>
        <Box component="span" sx={{ fontSize: 11, fontWeight: 600, bgcolor: 'background.paper', color: 'text.secondary', borderRadius: '5px', px: 0.75, lineHeight: '18px' }}>{count}</Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 1 }}>{children}</Box>
      {footer}
    </Box>
  )
}


// ── Caricamento immagini (trascina, sfoglia, incolla) ──────────────────────

function ImageDrop({ file, onFile, label = "Trascina qui l'immagine" }: { file: File | null; onFile: (f: File | null) => void; label?: string }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [over, setOver] = React.useState(false)
  const preview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  if (file && preview) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
        <Box component="img" src={preview} alt="" sx={{ width: 64, height: 44, objectFit: 'cover', borderRadius: '4px', border: '1px solid', borderColor: 'divider' }} />
        <Typography noWrap sx={{ flex: 1, fontSize: 13 }}>{file.name}</Typography>
        <Button size="small" variant="text" onClick={() => onFile(null)}>Rimuovi</Button>
      </Box>
    )
  }
  return (
    <ButtonBase onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) onFile(f) }}
      sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1.25, width: '100%', p: '10px 12px', border: '1px dashed', borderColor: over ? 'primary.main' : 'divider', borderRadius: '8px', bgcolor: over ? 'archie.field' : 'transparent', fontSize: 13, color: 'text.secondary', textAlign: 'left' }}>
      <CampoIcon name="upload" size={16} />
      <span><Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>{label}</Box>, sfoglia o incollala con Ctrl+V</span>
      <input ref={ref} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </ButtonBase>
  )
}

const imageFromPaste = (e: React.ClipboardEvent) => Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/')) ?? null

// ── Dialogo "Segnala" ──────────────────────────────────────────────────────

export type NewReport = { kind: ReportKind; section: string; description: string; screenshot: File | null }

export function ReportDialog({ open, busy, onClose, onSubmit }: { open: boolean; busy: boolean; onClose: () => void; onSubmit: (v: NewReport) => void }) {
  // Inserimento rapido: la frase principale come titolo, i dettagli sotto; al salvataggio diventano
  // un unico testo (la bacheca usa la prima riga come titolo).
  const [v, setV] = React.useState<NewReport>({ kind: 'bug', section: 'dashboard', description: '', screenshot: null })
  const [head, setHead] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => { if (open) { setV({ kind: 'bug', section: 'dashboard', description: '', screenshot: null }); setHead('') } }, [open])
  const bug = v.kind === 'bug'
  return (
    <QuickForm
      dialogLabel="Segnala" open={open} onClose={onClose} mode="create" saving={busy} canSubmit={Boolean(head.trim())} submitLabel="Invia"
      onSubmit={() => onSubmit({ ...v, description: [head.trim(), v.description.trim()].filter(Boolean).join('\n\n') })}
      crumb={{ icon: <BugReportOutlinedIcon />, label: 'Bug e feature' }}
      title={{ value: head, onChange: setHead, placeholder: bug ? 'Cosa non funziona?' : 'Cosa ti servirebbe?', label: bug ? 'Cosa non funziona' : 'Cosa ti servirebbe', maxLength: 200 }}
      description={{
        value: v.description, onChange: (d) => setV((x) => ({ ...x, description: d })), label: 'Dettagli',
        placeholder: bug ? 'Cosa stavi facendo, cosa ti aspettavi e cosa è successo invece…' : 'Cosa vorresti fare e perché ti sarebbe utile…',
      }}
      onPaste={(e) => { const f = imageFromPaste(e); if (f) { e.preventDefault(); setV((x) => ({ ...x, screenshot: f })) } }}
      footerStart={<Typography sx={{ fontSize: 12, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>Ti avvisiamo quando viene gestita.</Typography>}
      pills={
        <>
          <SelectPill placeholder="Tipo" value={v.kind} onChange={(k) => k && setV((x) => ({ ...x, kind: k as ReportKind }))}
            options={(['bug', 'feature'] as ReportKind[]).map((k) => ({
              value: k, label: KIND_LABEL[k], sub: k === 'bug' ? 'non funziona' : 'un\'idea',
              node: <><Box component="span" sx={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: '5px', bgcolor: KIND_TONE[k].bg, color: KIND_TONE[k].fg }}><KindIcon kind={k} size={14} /></Box>{KIND_LABEL[k]}</>,
            }))}
            render={(o) => <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>{o.node}</Box>} />
          <SelectPill icon={<CampoIcon name="pin" size={15} />} placeholder="Dove" title="Sezione di Archie" value={v.section}
            options={SECTIONS.map((x) => ({ value: x.value, label: x.label }))} onChange={(x) => x && setV((y) => ({ ...y, section: String(x) }))} />
          <Pill icon={<CampoIcon name="upload" size={15} />} placeholder="Screenshot" label={v.screenshot?.name}
            title="Scegli un'immagine, oppure incollala con Ctrl+V" onClick={() => fileRef.current?.click()} />
          {v.screenshot ? <Pill icon={<CampoIcon name="x" size={14} />} placeholder="Togli lo screenshot" onClick={() => setV((x) => ({ ...x, screenshot: null }))} /> : null}
          <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) setV((x) => ({ ...x, screenshot: f })); e.target.value = '' }} />
        </>
      }
    />
  )
}

// ── Dialogo "Rifiuta" ──────────────────────────────────────────────────────

export function RejectDialog({ open, busy, onClose, onSubmit }: { open: boolean; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = React.useState('')
  React.useEffect(() => { if (open) setReason('') }, [open])
  return (
    <CampoDialog open={open} onClose={onClose} busy={busy} labelId="bf-reject-title" title="Rifiuta la segnalazione" sub="Il motivo arriva a chi l'ha aperta."
      footer={<>
        <Box sx={{ flex: 1 }} />
        <Button variant="text" onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" color="error" disabled={!reason.trim() || busy} onClick={() => onSubmit(reason.trim())}>Rifiuta</Button>
      </>}>
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>Motivi frequenti</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {REJECT_REASONS.map((q) => (
            <ButtonBase key={q} onClick={() => setReason((r) => appendReason(r, q))} sx={{ minHeight: 28, px: 1.25, py: 0.5, borderRadius: '14px', border: '1px solid', borderColor: 'divider', fontSize: 12.5, color: 'text.secondary', textAlign: 'left', '&:hover': { color: 'text.primary', borderColor: 'text.disabled' } }}>{q}</ButtonBase>
          ))}
        </Box>
      </Box>
      <TextField label="Motivo" required multiline minRows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
    </CampoDialog>
  )
}

// ── Dettaglio ──────────────────────────────────────────────────────────────

const fullDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export function ReportDetail({ r, busy, position, onPrev, onNext, onClose, onResolve, onReject, onReopen, onUpload }: {
  r: ReportRow; busy: boolean; position?: string; onPrev?: () => void; onNext?: () => void; onClose: () => void
  onResolve: () => void; onReject: () => void; onReopen: () => void; onUpload: (f: File) => void
}) {
  const c = closedBy(r)
  const callout = (bg: string, fg: string, title: string, body?: string | null) => (
    <Box sx={{ p: '10px 12px', borderRadius: '8px', bgcolor: bg }}>
      <Typography sx={{ fontSize: 13, fontWeight: 650, color: fg }}>{title}</Typography>
      {body ? <Typography sx={{ fontSize: 13, mt: 0.25, whiteSpace: 'pre-wrap' }}>{body}</Typography> : null}
    </Box>
  )
  const ev = (icon: React.ReactNode, who: React.ReactNode, at?: string | null) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13 }}>
      <Box component="span" sx={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'archie.neutralBg', color: 'text.secondary', flex: 'none' }}>{icon}</Box>
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{who}</Box>
      <Typography component="time" sx={{ fontSize: 12, color: 'text.secondary' }}>{fullDate(at)}</Typography>
    </Box>
  )
  return (
    <FloatingDetail open onClose={onClose} ariaLabel="Dettaglio segnalazione"
      idLabel={`#${r.id}`} status={<StatusBadge status={r.status} onDark />}
      title={firstLine(r.description)} subtitle={`${KIND_LABEL[r.kind]} · ${sectionLabel(r.section, r.section_label)} · ${agoLabel(r.created_at)}`}
      position={position} onPrev={onPrev} onNext={onNext}
      footer={r.can_resolve ? (r.status === 'open' ? (
        <>
          <Button variant="outlined" color="error" disabled={busy} onClick={onReject}>Rifiuta</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" disabled={busy} onClick={onResolve} startIcon={<DoneRoundedIcon sx={{ fontSize: 17 }} />}>Segna come risolta</Button>
        </>
      ) : (<><Box sx={{ flex: 1 }} /><Button variant="outlined" disabled={busy} onClick={onReopen}>Riapri</Button></>)) : undefined}>
      <Box sx={{ display: 'grid', gap: 2.25 }}>
        {r.status === 'rejected' ? callout('archie.neutralBg', 'text.primary', `Rifiutata da ${c?.by ?? '—'} · ${agoLabel(c?.at)}`, r.rejection_reason) : null}
        {r.status === 'resolved' ? callout('success.light', 'success.main', `Risolta da ${c?.by ?? '—'} · ${agoLabel(c?.at)}`, "Chi l'ha segnalata ha ricevuto la notifica.") : null}
        <DetailSection title="Descrizione" end={<KindBadge kind={r.kind} />}>
          <Typography sx={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.description}</Typography>
        </DetailSection>
        {r.screenshot_url ? (
          <DetailSection title="Screenshot" end={<Link href={r.screenshot_url} target="_blank" rel="noopener" underline="hover" sx={{ fontSize: 12.5, fontWeight: 550 }}>Apri a tutto schermo</Link>}>
            <Shot src={r.screenshot_url} big />
          </DetailSection>
        ) : r.can_upload_screenshot && r.status === 'open' ? (
          <DetailSection title="Screenshot">
            <Box onPaste={(e: React.ClipboardEvent) => { const f = imageFromPaste(e); if (f) { e.preventDefault(); onUpload(f) } }}>
              <ImageDrop file={null} onFile={(f) => { if (f) onUpload(f) }} label="Aggiungi uno screenshot" />
            </Box>
          </DetailSection>
        ) : null}
        <DetailSection title="Storia">
          <Box sx={{ display: 'grid', gap: 1 }}>
            {ev(<CampoIcon name="plus" size={12} />, <><b style={{ fontWeight: 600 }}>{r.created_by_full_name ?? '—'}</b> l'ha aperta</>, r.created_at)}
            {c ? ev(r.status === 'resolved' ? <DoneRoundedIcon sx={{ fontSize: 13 }} /> : <CampoIcon name="x" size={12} />, <><b style={{ fontWeight: 600 }}>{c.by ?? '—'}</b> l'ha {r.status === 'resolved' ? 'risolta' : 'rifiutata'}</>, c.at) : null}
          </Box>
        </DetailSection>
      </Box>
    </FloatingDetail>
  )
}
