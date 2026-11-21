import * as React from 'react'
import { Box, ButtonBase, CircularProgress, Dialog, InputBase, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { api } from '@shared/api/client'

import { NAV_GROUPS, type NavLeaf } from '../../layout/appNav'
import { CampoIcon } from '../../ui/campo'
import { buildSections, PALETTE_ACTIONS, type PaletteItem, type PalettePage } from './paletteModel'
import { pushRecent, readRecent, type SearchResult } from './searchModel'

type Props = {
  open: boolean
  onClose: () => void
  /** Stessa regola della sidebar: permessi e moduli spenti. */
  canAccess: (leaf: NavLeaf) => boolean
  hasPerm: (perm: string) => boolean
  /** Parola segreta digitata e confermata con Invio. */
  onEggTrigger?: () => void
}

const EGG_TRIGGER = 'supertennis'
const kbd = { px: 0.6, py: 0.1, border: '1px solid', borderColor: 'divider', borderRadius: '4px', fontSize: 11, fontFamily: 'inherit', color: 'text.secondary', bgcolor: 'archie.surface2' } as const

/**
 * Palette Ctrl K (anteprima design-previews/iss-base.html): ricerca a finestra con risultati raggruppati,
 * pagine e azioni «Nuovo…». Frecce per scegliere, Invio per aprire, Esc per chiudere.
 */
export default function CommandPalette({ open, onClose, canAccess, hasPerm, onEggTrigger }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [recent, setRecent] = React.useState<string[]>([])
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => { if (open) { setQ(''); setResults([]); setActive(0); setRecent(readRecent()) } }, [open])

  React.useEffect(() => {
    const term = q.trim()
    if (!open || term.length < 2) { setResults([]); setLoading(false); return }
    let alive = true
    setLoading(true)
    const t = window.setTimeout(() => {
      api.get<{ results: SearchResult[] }>('/search/', { params: { q: term, limit: 40 } })
        .then((r) => { if (alive) setResults(r.data.results ?? []) })
        .catch(() => { if (alive) setResults([]) })
        .finally(() => { if (alive) setLoading(false) })
    }, 180)
    return () => { alive = false; window.clearTimeout(t) }
  }, [q, open])

  const pages = React.useMemo<PalettePage[]>(() => NAV_GROUPS.flatMap((g) => g.items.filter(canAccess).flatMap((it) => [
    { label: it.label, path: it.path },
    ...(it.children ?? []).filter(canAccess).map((c) => ({ label: c.label, path: c.path, parent: it.label })),
  ])), [canAccess])
  const actions = React.useMemo(() => PALETTE_ACTIONS.filter((a) => (!a.perm || hasPerm(a.perm)) && canAccess({ label: a.label, path: a.path })), [hasPerm, canAccess])
  const sections = React.useMemo(() => buildSections({ q, results, pages, actions, recent }), [q, results, pages, actions, recent])
  const term = q.trim()
  const flat: PaletteItem[] = React.useMemo(() => [
    ...sections.flatMap((s) => s.items),
    ...(term ? [{ key: 'all', icon: 'search' as const, title: `Cerca «${term}» in tutto Archie`, path: `/search?search=${encodeURIComponent(term)}` }] : []),
  ], [sections, term])

  React.useEffect(() => { setActive(0) }, [q, results])
  React.useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView?.({ block: 'nearest' }) }, [active])

  const choose = (it: PaletteItem | undefined) => {
    if (term.toLowerCase() === EGG_TRIGGER) { onClose(); onEggTrigger?.(); return }
    if (!it) return
    if (term && it.key !== 'all') pushRecent(term)
    if (it.key === 'all' || it.recent) pushRecent(it.recent ?? term)
    onClose()
    navigate(it.path, it.state ? { state: it.state } : undefined)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(flat.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]) }
  }

  const indexOf = new Map(flat.map((it, i) => [it.key, i]))
  const row = (it: PaletteItem) => {
    const i = indexOf.get(it.key) ?? -1
    const on = i === active
    return (
      <ButtonBase key={it.key} data-idx={i} role="option" aria-selected={on} onMouseMove={() => setActive(i)} onClick={() => choose(it)}
        sx={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr) auto', alignItems: 'center', gap: 1.25, width: '100%', minHeight: 38, px: 1.25, py: 0.5, borderRadius: '6px', textAlign: 'left', bgcolor: on ? 'archie.field' : 'transparent' }}>
        <Box sx={{ color: on ? 'primary.main' : 'text.secondary', display: 'inline-flex' }}><CampoIcon name={it.icon} size={16} /></Box>
        <Typography noWrap sx={{ fontSize: 13.5, fontWeight: on ? 600 : 500 }}>{it.title}</Typography>
        {it.sub ? <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 260 }}>{it.sub}</Typography> : <span />}
      </ButtonBase>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={false}
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      slotProps={{ paper: { 'aria-label': 'Cerca in ARCHIE', sx: { width: 'min(600px, calc(100% - 32px))', m: 0, mt: '12vh', borderRadius: '10px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, height: 52, px: 1.75, borderBottom: '1px solid', borderColor: 'divider', color: 'text.secondary' }}>
        {loading ? <CircularProgress size={16} /> : <CampoIcon name="search" size={18} />}
        <InputBase autoFocus fullWidth value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Cerca clienti, siti, inventari, issue, pagine…" inputProps={{ 'aria-label': 'Cerca in ARCHIE', role: 'combobox', 'aria-expanded': true, 'aria-controls': 'palette-list' }}
          sx={{ fontSize: 15, color: 'text.primary' }} />
        <Box component="kbd" sx={kbd}>Esc</Box>
      </Box>
      <Box ref={listRef} id="palette-list" role="listbox" aria-label="Risultati" sx={{ maxHeight: '52vh', overflowY: 'auto', p: 0.75 }}>
        {sections.map((s) => (
          <Box key={s.label} role="group" aria-label={s.label}>
            <Typography sx={{ fontSize: 12, fontWeight: 550, color: 'text.secondary', px: 1.25, pt: 1.25, pb: 0.5 }}>{s.label}</Typography>
            {s.items.map(row)}
          </Box>
        ))}
        {term ? (
          <Box sx={{ mt: sections.length ? 0.5 : 0, pt: sections.length ? 0.5 : 0, borderTop: sections.length ? '1px solid' : 0, borderColor: 'divider' }}>
            {!sections.length && !loading && term.length >= 2 ? <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 1.25, py: 1.25 }}>Nessun risultato per «{term}».</Typography> : null}
            {row(flat[flat.length - 1])}
          </Box>
        ) : null}
        {!term && !sections.length ? <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 1.25, py: 1.5 }}>Scrivi per cercare in Archie.</Typography> : null}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, px: 1.75, py: 1, borderTop: '1px solid', borderColor: 'divider', fontSize: 12, color: 'text.secondary' }}>
        <span><Box component="kbd" sx={kbd}>↑</Box> <Box component="kbd" sx={kbd}>↓</Box> per scegliere</span>
        <span><Box component="kbd" sx={kbd}>Invio</Box> per aprire</span>
      </Box>
    </Dialog>
  )
}
