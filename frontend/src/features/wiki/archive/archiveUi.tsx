import * as React from 'react'
import { Box, Button } from '@mui/material'
import { useTheme, type Theme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { CampoIcon, PageHead, type CampoIconName } from '../../../ui/campo'
import { archiveVars, catColor, catIcon, cVars, r1, rel, snippetOf, type WikiCategory, type WikiPageRow } from './archiveModel'
import './archive.css'

/** Radice dell'archivio: ambito degli stili e variabili del tema. */
export function ArchiveRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = useTheme()
  return <div className={`wa${t.palette.mode === 'dark' ? ' is-dark' : ''}${className ? ` ${className}` : ''}`} style={archiveVars(t)}>{children}</div>
}

/** Evidenzia le parole cercate (testo semplice, niente HTML in ingresso). */
export function Mark({ text, term }: { text: string; term: string }) {
  const words = term.trim().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!words.length) return <>{text}</>
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'gi'))
  return <>{parts.map((s, i) => (i % 2 ? <mark key={i}>{s}</mark> : <React.Fragment key={i}>{s}</React.Fragment>))}</>
}

const secsSx = {
  display: 'flex', gap: '2px', p: '3px', borderRadius: '10px', bgcolor: 'archie.frame',
  '& button': {
    display: 'inline-flex', alignItems: 'center', gap: '7px', height: 30, px: '12px', border: 0, borderRadius: '7px', bgcolor: 'transparent',
    font: 'inherit', fontSize: 13, fontWeight: 550, color: 'text.secondary', cursor: 'pointer',
  },
  '& button:hover': { color: 'text.primary' },
  '& button[aria-current="page"]': { bgcolor: 'background.paper', color: 'text.primary', boxShadow: (t: Theme) => `0 1px 2px rgb(0 0 0 / .08), 0 0 0 1px ${t.palette.divider}` },
  '& button:focus-visible': { outline: 'none', boxShadow: (t: Theme) => t.palette.archie.focusRing },
  '@media (max-width: 860px)': { '& button': { px: '8px' } },
}

// ── Testata con le sezioni (Pagine · Query · Statistiche) ────────────────────

type Section = 'pages' | 'queries' | 'stats'
const SECTIONS: { key: Section; label: string; path: string; icon: CampoIconName }[] = [
  { key: 'pages', label: 'Pagine', path: '/wiki', icon: 'book' },
  { key: 'queries', label: 'Query', path: '/wiki/queries', icon: 'columns' },
  { key: 'stats', label: 'Statistiche', path: '/wiki/stats', icon: 'activity' },
]

export function WikiHead({ section, actions, canQueries = true }: { section: Section; actions?: React.ReactNode; canQueries?: boolean }) {
  const navigate = useNavigate()
  return (
    <PageHead
      title="Wiki"
      inline={
        <Box component="nav" aria-label="Sezioni della Wiki" sx={secsSx}>
          {SECTIONS.filter((s) => s.key !== 'queries' || canQueries).map((s) => (
            <button key={s.key} type="button" aria-current={section === s.key ? 'page' : undefined} onClick={() => navigate(s.path)}>
              <CampoIcon name={s.icon} size={15} />{s.label}
            </button>
          ))}
        </Box>
      }
      actions={actions}
    />
  )
}

// ── Linguette delle cartelle ─────────────────────────────────────────────────

/**
 * Riga di linguette sempre nello stesso ordine; la cartella aperta resta al suo posto.
 * mode: 'nav' (pagina della cartella), 'art' (articolo: la linguetta aperta torna all'elenco),
 * 'edit' (sposta la pagina nella cartella cliccata).
 */
export function FolderTabs({ cats, active, counts, mode, onPick }: {
  cats: WikiCategory[]
  active: number
  counts?: Record<number, number>
  mode: 'nav' | 'art' | 'edit'
  onPick: (id: number) => void
}) {
  return (
    <div className="w-open-tabs" role={mode === 'edit' ? 'radiogroup' : 'tablist'} aria-label={mode === 'edit' ? 'Cartella della pagina' : 'Cartelle'}>
      {cats.map((c) => {
        const color = catColor(c)
        const n = counts?.[c.id]
        if (c.id === active) {
          const inner = <><span className="w-fold-ico"><CampoIcon name={catIcon(c.name)} size={17} /></span><h2>{c.name}</h2><small>{mode === 'edit' ? 'cartella della pagina' : n != null ? `${n} ${n === 1 ? 'pagina' : 'pagine'}` : ''}</small></>
          return mode === 'art'
            ? <button key={c.id} type="button" className="w-open-tab" role="tab" aria-selected="true" style={cVars(color)} onClick={() => onPick(c.id)} title={`Torna alla cartella ${c.name}`}>{inner}</button>
            : <div key={c.id} className="w-open-tab" role={mode === 'edit' ? 'radio' : 'tab'} aria-checked={mode === 'edit' ? true : undefined} aria-selected={mode === 'edit' ? undefined : true} style={cVars(color)}>{inner}</div>
        }
        return (
          <button key={c.id} type="button" className="w-side-tab" style={cVars(color)}
            role={mode === 'edit' ? 'radio' : 'tab'} aria-checked={mode === 'edit' ? false : undefined} aria-selected={mode === 'edit' ? undefined : false}
            title={mode === 'edit' ? `Sposta la pagina in ${c.name}` : `${c.name}${n != null ? ` · ${n} pagine` : ''}`} onClick={() => onPick(c.id)}>
            <CampoIcon name={catIcon(c.name)} size={15} /><span>{c.name}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Cartella aperta: linguette + fondo nel colore della cartella. */
export function OpenFolder({ color, tabs, children, className, label }: { color: string; tabs: React.ReactNode; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <section className={`w-open${className ? ` ${className}` : ''}`} style={cVars(color)} aria-label={label}>
      {tabs}
      <div className="w-open-in">{children}</div>
    </section>
  )
}

/** Stella e voto medio. */
export function StarIcon({ on = true, size = 13 }: { on?: boolean; size?: number }) {
  return (
    <svg className={`i star${on ? ' on' : ''}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function ClipIcon() {
  return (
    <svg className="i" viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" />
    </svg>
  )
}

/** Scheda di una pagina (vista "Tutte le pagine" e risultati di ricerca). */
export function PageCard({ p, cat, term, onOpen }: { p: WikiPageRow; cat?: WikiCategory; term?: string; onOpen: () => void }) {
  const t = term?.trim() ?? ''
  return (
    <li>
      <a href={`/wiki/${p.id}`} className="w-card" onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); onOpen() }}>
        <span className="w-card-top">
          {p.kb_code ? <span className="w-mono-s">{p.kb_code}</span> : null}
          {cat ? <span className="w-cat"><span className="w-sw" style={cVars(catColor(cat))} />{cat.name}</span> : null}
          {!p.is_published ? <span className="w-draft">Bozza</span> : null}
        </span>
        <span className="w-card-t"><Mark text={p.title} term={t} /></span>
        <span className="w-card-s">{t ? <Mark text={snippetOf(p, t)} term={t} /> : p.summary}</span>
        {(p.tags ?? []).length ? <span className="w-card-x">{(p.tags ?? []).slice(0, 3).map((tag) => <span key={tag} className="w-tag">{tag}</span>)}</span> : null}
        <span className="w-card-f">
          <span>{rel(p.updated_at)}{p.updated_by_username ? ` · ${p.updated_by_username}` : ''}</span>
          <span className="w-card-n">
            <span title="Letture"><CampoIcon name="eye" size={13} />{p.view_count ?? 0}</span>
            {p.rating_count ? <span title={`${r1(p.average_rating)} su 5 · ${p.rating_count} voti`}><StarIcon />{r1(p.average_rating)}</span> : null}
            {p.attachment_count ? <span title="Allegati"><ClipIcon />{p.attachment_count}</span> : null}
          </span>
        </span>
      </a>
    </li>
  )
}

/** Pulsante principale della testata secondo la sezione. */
export function HeadAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button variant="contained" startIcon={<CampoIcon name="plus" size={16} />} onClick={onClick}>{label}</Button>
}

