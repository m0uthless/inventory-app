import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { CampoIcon } from '../../../ui/campo'
import { useToast } from '@shared/ui/toast'
import type { WikiAttachment } from '../WikiAttachmentsTab'
import type { WikiLink } from '../WikiLinkedCustomersTab'

export type TocItem = { id: string; text: string; level: 2 | 3 }

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sezione'

const COPY_SVG = '<svg class="i" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>'
const TICK_SVG = '<svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'

/**
 * Testo dell'articolo (HTML già sanificato dal backend con /render/), arricchito sul posto:
 * - id ai titoli e indice (onToc);
 * - pulsante Copia sui blocchi di codice;
 * - elenchi numerati di primo livello come passi da spuntare (solo su questo dispositivo, non salvati);
 * - link interni /wiki/... aperti senza ricaricare la pagina.
 */
export function ProseContent({ html, onToc }: { html: string; onToc: (items: TocItem[]) => void }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const toast = useToast()

  React.useEffect(() => {
    const root = ref.current
    if (!root) return
    // L'HTML (già sanificato dal backend) lo inseriamo qui e non con dangerouslySetInnerHTML:
    // così un nuovo render del genitore non cancella id, pulsanti e spunte aggiunti sotto.
    root.innerHTML = html
    const used = new Set<string>()
    const toc: TocItem[] = []
    root.querySelectorAll('h2, h3').forEach((h) => {
      const text = (h.textContent ?? '').trim()
      if (!text) return
      let id = slug(text); let n = 2
      while (used.has(id)) id = `${slug(text)}-${n++}`
      used.add(id); h.id = id
      toc.push({ id, text, level: h.tagName === 'H2' ? 2 : 3 })
    })
    onToc(toc)
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.parentElement?.classList.contains('w-code')) return
      const wrap = document.createElement('div'); wrap.className = 'w-code'
      pre.replaceWith(wrap); wrap.appendChild(pre)
      const btn = document.createElement('button')
      btn.type = 'button'; btn.className = 'w-copy w-copy-btn'; btn.title = 'Copia'; btn.setAttribute('aria-label', 'Copia il blocco')
      btn.innerHTML = COPY_SVG
      wrap.appendChild(btn)
    })
    Array.from(root.querySelectorAll('ol')).filter((ol) => !ol.parentElement?.closest('li')).forEach((ol) => {
      ol.classList.add('w-steps')
      Array.from(ol.children).forEach((li, i) => {
        if (li.querySelector(':scope > .w-step')) return
        const b = document.createElement('button')
        b.type = 'button'; b.className = 'w-step'; b.setAttribute('aria-pressed', 'false')
        b.title = 'Segna come fatto (solo su questo dispositivo)'; b.setAttribute('aria-label', `Passo ${i + 1}`)
        b.innerHTML = `<span>${i + 1}</span>${TICK_SVG}`
        li.insertBefore(b, li.firstChild)
        // Il testo del passo va nella seconda colonna anche se non è racchiuso in un <p>.
        Array.from(li.childNodes).forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            const p = document.createElement('p'); node.replaceWith(p); p.appendChild(node)
          }
        })
      })
    })
  }, [html, onToc])

  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    const step = t.closest('.w-step')
    if (step) {
      const li = step.parentElement!
      const on = !li.classList.contains('is-done')
      li.classList.toggle('is-done', on); step.setAttribute('aria-pressed', String(on))
      return
    }
    const copy = t.closest('.w-copy-btn')
    if (copy) {
      const text = copy.parentElement?.querySelector('pre')?.textContent ?? ''
      navigator.clipboard?.writeText(text).then(() => toast.success('Copiato'), () => toast.error('Copia non riuscita'))
      return
    }
    const a = t.closest('a') as HTMLAnchorElement | null
    if (a && !e.metaKey && !e.ctrlKey && a.getAttribute('href')?.startsWith('/wiki/')) {
      e.preventDefault(); navigate(a.getAttribute('href')!)
    }
  }

  return <div ref={ref} className="w-prose-html" onClick={onClick} />
}

/** Indice "In questa pagina" che segue lo scorrimento. */
export function TocList({ items }: { items: TocItem[] }) {
  const [active, setActive] = React.useState<string | null>(items[0]?.id ?? null)
  React.useEffect(() => {
    if (!items.length) return
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setActive(vis[0].target.id)
    }, { rootMargin: '0px 0px -70% 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [items])
  return (
    <ol>
      {items.map((i) => (
        <li key={i.id} style={i.level === 3 ? { paddingLeft: 10 } : undefined}>
          <a href={`#${i.id}`} className={active === i.id ? 'is-on' : undefined}
            onClick={(e) => { e.preventDefault(); document.getElementById(i.id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); setActive(i.id) }}>
            {i.text}
          </a>
        </li>
      ))}
    </ol>
  )
}

/** Scheda "Collegata a": clienti collegati alla pagina. */
export function LinksCard({ links, canEdit, onAdd, onRemove }: { links: WikiLink[]; canEdit: boolean; onAdd?: () => void; onRemove: (id: number) => void }) {
  const navigate = useNavigate()
  return (
    <section className="w-rail-s">
      <h4>Collegata a <span>{links.length}</span></h4>
      {links.length ? (
        <ul className="w-links">
          {links.map((l) => (
            <li key={l.id} className="w-link-row">
              <a href={l.entity_path ?? '#'} className="w-ent" onClick={(e) => { if (!l.entity_path) { e.preventDefault(); return } if (e.metaKey || e.ctrlKey) return; e.preventDefault(); navigate(l.entity_path) }}>
                <CampoIcon name="building" size={15} /><span>{l.entity_label ?? `Cliente #${l.entity_id}`}</span><small>cliente</small>
              </a>
              {canEdit ? <button type="button" className="w-x" aria-label={`Scollega ${l.entity_label ?? 'cliente'}`} title="Scollega" onClick={() => onRemove(l.id)}><CampoIcon name="x" size={13} /></button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="w-rail-none">Nessun cliente collegato.</p>}
      {canEdit && onAdd ? <button type="button" className="link-btn" onClick={onAdd}><CampoIcon name="plus" size={14} />Collega un cliente</button> : null}
    </section>
  )
}

const fmtSize = (b?: number | null) => (!b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`)

/** Scheda "Allegati": elenco, caricamento ed eliminazione. */
export function AttachmentsCard({ items, canEdit, uploading, inputRef, onUpload, onDelete }: {
  items: WikiAttachment[]
  canEdit: boolean
  uploading: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDelete: (id: number) => void
}) {
  return (
    <section className="w-rail-s">
      <h4>Allegati <span>{items.length}</span></h4>
      {items.length ? (
        <ul className="w-files">
          {items.map((a) => (
            <li key={a.id} className="w-link-row">
              <a href={a.download_url ?? a.file_url ?? '#'} target="_blank" rel="noreferrer" title={a.filename}>
                <CampoIcon name="file" size={15} /><span>{a.filename}</span><small>{fmtSize(a.size_bytes)}</small>
              </a>
              {canEdit ? <button type="button" className="w-x" aria-label={`Elimina ${a.filename}`} title="Elimina" onClick={() => onDelete(a.id)}><CampoIcon name="x" size={13} /></button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="w-rail-none">Nessun allegato.</p>}
      {canEdit ? (
        <>
          <input ref={inputRef} type="file" hidden onChange={onUpload} />
          <button type="button" className="link-btn" disabled={uploading} onClick={() => inputRef.current?.click()}><CampoIcon name="upload" size={14} />{uploading ? 'Caricamento…' : 'Carica un file'}</button>
        </>
      ) : null}
    </section>
  )
}
