import * as React from 'react'
import { Box, Button, ButtonBase, IconButton, Tooltip, Typography } from '@mui/material'
import { buildQuery } from '@shared/utils/nav'
import { CampoIcon, RecordEmpty, RecordLoader, RecordRow, RecordRows, RecordSection, SectionCount, SoftTag, recordMono as mono } from '../../ui/campo'

/*
 * Sezioni di record collegati comuni alle finestre anagrafiche (Cliente, Sito, Contatto):
 * issue aperte, inventari con il filtro per tipo, persone con chiamata ed email.
 * `go` apre un percorso dell'app (la finestra lo blocca se ci sono modifiche in sospeso).
 */

const INV_PREVIEW = 6

export type LinkedIssue = { id: number; title: string; status: string; status_label: string; site?: number | null; site_name?: string | null; inventory_name?: string | null }
export type LinkedInventory = { id: number; site?: number | null; site_name?: string | null; site_display_name?: string | null; name?: string | null; hostname?: string | null; knumber?: string | null; type_label?: string | null; local_ip?: string | null; has_active_issue?: boolean }
export type LinkedPerson = { id: number; name: string; email?: string | null; phone?: string | null; department?: string | null; is_primary?: boolean; site?: number | null; site_name?: string | null; site_display_name?: string | null }

const issueTone = (s: string): 'warning' | 'neutral' | 'info' => (s === 'in_progress' ? 'warning' : s === 'waiting' ? 'neutral' : 'info')
const typeTone = (t?: string | null) => { const k = (t || '').toLowerCase(); return (/server|storage|nas/.test(k) ? 'sky' : /modal|ct|rm|ecograf|mammo|dr\b/.test(k) ? 'mint' : /rete|router|switch|firewall|vpn/.test(k) ? 'sand' : 'neutral') as 'sky' | 'mint' | 'sand' | 'neutral' }

/** Ancora per i conteggi della testata (`<id>-<sezione>`), con margine per lo scorrimento. */
export function Anchor({ id, children }: { id: string; children: React.ReactNode }) {
  return <Box id={id} sx={{ scrollMarginTop: 16 }}>{children}</Box>
}

export function IssuesSection({ issues, go, onNew, showSite = true }: { issues: LinkedIssue[] | null; go: (path: string) => void; onNew?: () => void; showSite?: boolean }) {
  return (
    <RecordSection title={<>Issue aperte<SectionCount n={issues?.length} /></>} end={onNew ? <Button size="small" onClick={onNew}>+ Nuova issue</Button> : undefined}>
      {!issues ? <RecordLoader /> : issues.length ? (
        <RecordRows>
          {issues.map((i) => (
            <RecordRow key={i.id} lead={<Box component="span" sx={{ ...mono, fontSize: 12 }}>#{i.id}</Box>} leadWidth={52}
              title={i.title} sub={[showSite ? i.site_name : null, i.inventory_name].filter(Boolean).join(' · ') || undefined}
              end={<SoftTag tone={issueTone(i.status)}>{i.status_label}</SoftTag>}
              onClick={() => go(`/issues${buildQuery({ open: i.id })}`)} />
          ))}
        </RecordRows>
      ) : <RecordEmpty>Nessuna issue aperta.</RecordEmpty>}
    </RecordSection>
  )
}

export function InventoriesSection({ invs, go, onOpen, showSite = true, emptyText, resetKey }: { invs: LinkedInventory[] | null; go: (path: string) => void; onOpen?: (i: LinkedInventory) => void; showSite?: boolean; emptyText: string; resetKey: unknown }) {
  const [type, setType] = React.useState('')
  const [all, setAll] = React.useState(false)
  React.useEffect(() => { setType(''); setAll(false) }, [resetKey])
  const types = [...new Set((invs ?? []).map((i) => i.type_label).filter((x): x is string => Boolean(x)))].sort()
  const filtered = (invs ?? []).filter((i) => !type || i.type_label === type)
  const shown = all ? filtered : filtered.slice(0, INV_PREVIEW)
  return (
    <RecordSection title={<>Inventari<SectionCount n={invs?.length} /></>}
      end={types.length > 1 ? (
        <Box role="group" aria-label="Tipo di inventario" sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px', p: '2px', borderRadius: '7px', bgcolor: 'archie.neutralBg' }}>
          {['', ...types].map((t) => (
            <ButtonBase key={t || 'all'} aria-pressed={type === t} onClick={() => { setType(t); setAll(false) }} sx={{
              height: 24, px: 1, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, color: type === t ? 'text.primary' : 'text.secondary',
              bgcolor: type === t ? 'background.paper' : 'transparent', boxShadow: type === t ? (th) => `0 1px 2px rgb(16 40 34 / .12), inset 0 0 0 1px ${th.palette.divider}` : 'none',
            }}>{t || 'Tutti'}</ButtonBase>
          ))}
        </Box>
      ) : undefined}>
      {!invs ? <RecordLoader /> : shown.length ? (
        <>
          <RecordRows>
            {shown.map((i) => (
              <RecordRow key={i.id} lead={<SoftTag tone={typeTone(i.type_label)}>{i.type_label || 'Inventario'}</SoftTag>} leadWidth={96}
                title={i.name || i.hostname || i.knumber || `Inventario #${i.id}`}
                sub={[i.hostname && i.hostname !== i.name ? i.hostname : null, i.local_ip].filter(Boolean).join(' · ') || undefined}
                end={<>{i.has_active_issue ? <Tooltip title="Ha issue aperte"><Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'info.main' }} /></Tooltip> : null}{showSite ? <span>{i.site_display_name || i.site_name || ''}</span> : null}</>}
                onClick={() => (onOpen ? onOpen(i) : go(`/inventory${buildQuery({ open: i.id })}`))} />
            ))}
          </RecordRows>
          {filtered.length > INV_PREVIEW ? (
            <Button size="small" sx={{ mt: 1 }} onClick={() => setAll((v) => !v)}>{all ? 'Mostra meno' : `Mostra tutti i ${filtered.length}`}</Button>
          ) : null}
        </>
      ) : <RecordEmpty>{type ? 'Nessun inventario di questo tipo.' : emptyText}</RecordEmpty>}
    </RecordSection>
  )
}

/** Persone compatte (colonna laterale o sezione): nome che apre il contatto, chiamata ed email a destra. */
export function PeopleList({ people, primaryId, go, onOpen, showSite = true }: { people: LinkedPerson[]; primaryId?: number | null; go: (path: string) => void; onOpen?: (id: number) => void; showSite?: boolean }) {
  return (
    <Box sx={{ display: 'grid', gap: '2px' }}>
      {people.map((c) => {
        const primary = c.id === primaryId || (primaryId == null && c.is_primary)
        return (
          <Box key={c.id} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 1, py: 0.5 }}>
            <ButtonBase onClick={() => (onOpen ? onOpen(c.id) : go(`/contacts${buildQuery({ open: c.id })}`))} sx={{ display: 'grid', justifyItems: 'start', justifyContent: 'stretch', textAlign: 'left', minWidth: 0, lineHeight: 1.3, '&:hover .rr-title': { color: 'primary.main' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing, borderRadius: '4px' } }}>
              <Typography className="rr-title" noWrap component="span" sx={{ fontSize: 13, fontWeight: 550, maxWidth: '100%', display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                {c.name}{primary ? <Box component="span" sx={{ fontSize: 10.5, fontWeight: 600, px: 0.75, borderRadius: '4px', bgcolor: 'archie.field', color: 'primary.main' }}>primario</Box> : null}
              </Typography>
              <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'text.secondary', maxWidth: '100%' }}>
                {[c.department, showSite ? c.site_display_name || c.site_name : null, c.phone].filter(Boolean).join(' · ') || '—'}
              </Typography>
            </ButtonBase>
            <Box sx={{ display: 'inline-flex' }}>
              {c.phone ? <Tooltip title={c.phone}><IconButton size="small" component="a" href={`tel:${c.phone.replace(/\s/g, '')}`} aria-label={`Chiama ${c.name}`} sx={{ width: 28, height: 28 }}><CampoIcon name="phone" size={15} /></IconButton></Tooltip> : null}
              {c.email ? <Tooltip title={c.email}><IconButton size="small" component="a" href={`mailto:${c.email}`} aria-label={`Scrivi a ${c.name}`} sx={{ width: 28, height: 28 }}><CampoIcon name="mail" size={15} /></IconButton></Tooltip> : null}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

/** Mappa con indirizzo e collegamento alle mappe. */
export function WhereBlock({ address, line1, line2, map }: { address: string; line1: string; line2?: string; map: React.ReactNode }) {
  return (
    <>
      <Box sx={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>{map}</Box>
      <Typography sx={{ mt: 1.25, fontSize: 12.5, fontWeight: 550 }}>{line1}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        {line2 ? `${line2} · ` : ''}
        <Box component="a" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" sx={{ color: 'primary.main' }}>Apri nelle mappe</Box>
      </Typography>
    </>
  )
}
