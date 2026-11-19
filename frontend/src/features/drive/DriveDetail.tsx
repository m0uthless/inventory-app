import * as React from 'react'
import { Autocomplete, Box, Button, Dialog, IconButton, ListItemIcon, Menu, MenuItem, TextField, Tooltip } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoIcon, type DetailMenuItem } from '../../ui/campo'
import type { BreadcrumbItem, CustomerMini, DrawerItem, DriveAccessRule, DriveFile, DriveFolder } from '../../pages/drive/types'
import { FileIcon, FolderIcon } from './DriveIcons'
import { KIND_LABEL, describeEvent, dshort, extOf, kindOf, rel, type AuditRow } from './driveModel'

type Props = {
  item: DrawerItem | null
  customers: CustomerMini[]
  siblings: DriveFile[]
  canChange: boolean
  canDelete: boolean
  canSeeAudit: boolean
  /** La × del pannello: lo nasconde (schermo largo) o toglie la selezione (schermo stretto). */
  onClose: () => void
  /** Anteprima del file a tutto schermo. */
  onFull: (f: DriveFile) => void
  onOpenFolder: (id: number | null) => void
  onOpenFile: (f: DriveFile) => void
  onRename: (item: DrawerItem) => void
  onMove: (item: DrawerItem) => void
  onDelete: (item: DrawerItem) => void
  /** Il pannello ha modificato clienti o note: aggiorna la riga nell'elenco. */
  onChanged: (item: DrawerItem) => void
}

/**
 * Pannello fisso del file o della cartella, a destra dell'elenco (anteprima design-previews/drv-base.html, variante B):
 * il clic su una riga lo riempie; sotto i 1500 px si apre sopra l'elenco, su mobile a tutto schermo.
 */
export default function DriveDetail(p: Props) {
  const toast = useToast()
  const { item } = p
  const [crumbs, setCrumbs] = React.useState<BreadcrumbItem[]>([])
  const [events, setEvents] = React.useState<AuditRow[] | null>(null)
  const [editNotes, setEditNotes] = React.useState<string | null>(null)
  const [addingCustomer, setAddingCustomer] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [menuEl, setMenuEl] = React.useState<HTMLElement | null>(null)

  const isFile = item?.kind === 'file'
  const id = item?.data.id
  const parentId = item ? (item.kind === 'file' ? item.data.folder : item.data.parent) : null

  React.useEffect(() => {
    setEditNotes(null); setAddingCustomer(false); setMenuEl(null)
    if (parentId == null) { setCrumbs([]); return }
    let alive = true
    api.get<BreadcrumbItem[]>(`/drive-folders/${parentId}/breadcrumb/`).then((r) => { if (alive) setCrumbs(r.data ?? []) }).catch(() => { if (alive) setCrumbs([]) })
    return () => { alive = false }
  }, [parentId, id])

  React.useEffect(() => {
    if (!item || !p.canSeeAudit) { setEvents(null); return }
    let alive = true
    api.get<{ results: AuditRow[] }>('/audit-events/', { params: { app_label: 'drive', model: isFile ? 'drivefile' : 'drivefolder', object_id: String(item.data.id), ordering: '-created_at', page_size: 8 } })
      .then((r) => { if (alive) setEvents(r.data.results ?? []) }).catch(() => { if (alive) setEvents([]) })
    return () => { alive = false }
  }, [item, isFile, p.canSeeAudit])

  if (!item) {
    return (
      <aside className="d-pane is-empty" aria-label="Dettagli">
        <div className="d-pane-h"><b>Dettagli</b><Tooltip title="Chiudi il pannello"><IconButton size="small" aria-label="Chiudi il pannello" onClick={p.onClose}><CampoIcon name="x" size={16} /></IconButton></Tooltip></div>
        <div className="d-pane-none"><CampoIcon name="file" size={22} /><span>Seleziona un file o una cartella per vederne i dettagli.</span></div>
      </aside>
    )
  }
  const d = item.data
  const url = isFile ? `/drive-files/${d.id}/` : `/drive-folders/${d.id}/`
  const file = isFile ? (d as DriveFile) : null
  const folder = !isFile ? (d as DriveFolder) : null
  const kind = file ? kindOf(file.name, file.mime_type) : null
  const ext = file ? extOf(file.name) : ''
  const linked = p.customers.filter((c) => d.customers.includes(c.id))
  const access: DriveAccessRule[] = d.access ?? []

  const patch = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    try {
      const r = await api.patch(url, body)
      p.onChanged({ kind: item.kind, data: { ...d, ...r.data } } as DrawerItem)
      toast.success(ok)
      return true
    } catch (e) {
      toast.error(apiErrorToMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const copyLink = () => {
    const link = `${window.location.origin}/drive?${isFile ? `file=${d.id}` : `cartella=${d.id}`}`
    navigator.clipboard?.writeText(link).then(() => toast.success('Link copiato: chi lo apre deve avere accesso alla cartella'), () => toast.error('Copia non riuscita'))
  }
  const download = () => window.open(`/api/drive-files/${d.id}/download/`, '_blank')

  const menu: DetailMenuItem[] = []
  if (p.canChange) {
    menu.push({ label: 'Rinomina…', icon: <CampoIcon name="file" size={16} />, onClick: () => p.onRename(item) })
    menu.push({ label: 'Sposta in…', icon: <CampoIcon name="folder" size={16} />, onClick: () => p.onMove(item) })
  }
  if (p.canDelete) menu.push({ label: 'Sposta nel cestino', icon: <CampoIcon name="trash" size={16} />, onClick: () => p.onDelete(item), danger: true })

  const where = [{ id: null as number | null, name: 'Drive' }, ...crumbs.map((c) => ({ id: c.id as number | null, name: c.name }))]

  return (
    <aside className="d-pane" aria-label={isFile ? 'Dettagli del file' : 'Dettagli della cartella'}>
      <div className="d-pane-h">
        {file ? <FileIcon kind={kind!} ext={ext} size={28} /> : <FolderIcon size={24} badge={access.length ? 'lock' : d.customers.length ? 'customer' : null} />}
        <b title={d.name}>{d.name}</b>
        <Tooltip title="Chiudi il pannello"><IconButton size="small" aria-label="Chiudi il pannello" onClick={p.onClose}><CampoIcon name="x" size={16} /></IconButton></Tooltip>
      </div>
      <div className="d-pane-body">
      <div className={`d-fd-prev t-${file ? kind : 'folder'}`}>
        {file && file.is_image ? <img src={`/api/drive-files/${d.id}/preview/`} alt={`Anteprima di ${d.name}`} loading="lazy" />
          : file && file.is_pdf ? <iframe src={`/api/drive-files/${d.id}/preview/`} title={`Anteprima di ${d.name}`} />
            : file ? <span className="d-noprev"><FileIcon kind={kind!} ext={ext} size={72} /><small>Nessuna anteprima per i file {ext ? `.${ext}` : 'di questo tipo'}: si apre dopo averlo scaricato</small></span>
              : <span className="d-noprev"><FolderIcon size={64} /><small>{folder!.children_count} {folder!.children_count === 1 ? 'cartella' : 'cartelle'} · {folder!.files_count} file</small></span>}
        {file && file.is_previewable ? <button type="button" className="d-fd-open" onClick={() => p.onFull(file)}><CampoIcon name="eye" size={14} />Tutto schermo</button> : null}
      </div>
      <div className="d-fd-acts">
        {file ? <Button variant="contained" startIcon={<CampoIcon name="download" size={16} />} onClick={download}>Scarica</Button>
          : <Button variant="contained" startIcon={<CampoIcon name="folder" size={16} />} onClick={() => p.onOpenFolder(d.id)}>Apri la cartella</Button>}
        <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="copy" size={16} />} onClick={copyLink}>Copia link</Button>
        {menu.length ? <>
          <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenuEl(e.currentTarget)}><CampoIcon name="more" size={17} /></IconButton></Tooltip>
          <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            {menu.map((m) => <MenuItem key={m.label} onClick={() => { setMenuEl(null); m.onClick() }} sx={m.danger ? { color: 'error.main' } : undefined}><ListItemIcon sx={m.danger ? { color: 'error.main' } : undefined}>{m.icon}</ListItemIcon>{m.label}</MenuItem>)}
          </Menu>
        </> : null}
      </div>
      <section className="d-fd-sec">
        <h4>Dettagli</h4>
        <dl className="d-props">
          <div><dt>Tipo</dt><dd>{file ? <>{KIND_LABEL[kind!]}{ext ? <span className="d-ext">.{ext}</span> : null}</> : 'Cartella'}</dd></div>
          {file ? <div><dt>Dimensione</dt><dd>{file.size_human}</dd></div> : <div><dt>Contenuto</dt><dd>{folder!.children_count} cartelle · {folder!.files_count} file</dd></div>}
          <div><dt>Percorso</dt><dd className="d-path">{where.map((w, i) => <React.Fragment key={w.id ?? 'root'}>{i ? <span>/</span> : null}<button type="button" onClick={() => p.onOpenFolder(w.id)}>{w.name}</button></React.Fragment>)}</dd></div>
          <div><dt>{file ? 'Caricato' : 'Creata'}</dt><dd>{dshort(d.created_at, true)}{d.created_by_name ? ` · ${d.created_by_name}` : ''}</dd></div>
          <div><dt>Modificato</dt><dd>{dshort(d.updated_at, true)} · {rel(d.updated_at)}{d.updated_by_name ? ` · ${d.updated_by_name}` : ''}</dd></div>
        </dl>
      </section>

      <section className="d-fd-sec">
        <h4>Clienti <span>{linked.length}</span></h4>
        <div className="d-fd-chips">
          {linked.map((c) => (
            <span key={c.id} className="d-cust is-big"><CampoIcon name="building" size={14} />{c.display_name}
              {p.canChange ? <button type="button" aria-label={`Scollega ${c.display_name}`} disabled={busy} onClick={() => void patch({ customers: d.customers.filter((x) => x !== c.id) }, 'Cliente scollegato')}><CampoIcon name="x" size={12} /></button> : null}
            </span>
          ))}
          {p.canChange && !addingCustomer ? <button type="button" className="d-add" onClick={() => setAddingCustomer(true)}><CampoIcon name="plus" size={14} />Collega un cliente</button> : null}
          {!linked.length && !p.canChange ? <span className="none">Nessun cliente</span> : null}
        </div>
        {addingCustomer ? (
          <Box sx={{ mt: 1 }}>
            <Autocomplete size="small" autoFocus openOnFocus options={p.customers.filter((c) => !d.customers.includes(c.id))} getOptionLabel={(o) => o.display_name}
              onChange={(_e, v) => { if (v) void patch({ customers: [...d.customers, v.id] }, `Collegato a ${v.display_name}`).then(() => setAddingCustomer(false)) }}
              onBlur={() => setAddingCustomer(false)}
              renderInput={(params) => <TextField {...params} autoFocus placeholder="Cerca il cliente…" />} noOptionsText="Nessun cliente" />
          </Box>
        ) : null}
        {linked.length ? <p className="d-fd-note">{isFile ? 'Il file compare' : 'La cartella compare'} anche filtrando il Drive per cliente.</p> : null}
      </section>

      <section className="d-fd-sec">
        <h4>Chi può vederlo</h4>
        {access.length ? access.map((r) => (
          <div key={`${r.level}-${r.id}`} className="d-vis is-locked">
            <CampoIcon name="lock" size={18} />
            <div>
              <b>Solo i gruppi {r.groups.map((g) => <span key={g} className="d-grp">{g}</span>)}</b>
              <small>{r.level === 'file' ? 'Regola impostata su questo file.' : r.id === d.id ? 'Regola di questa cartella: vale per tutto quello che contiene.' : `Regola della cartella «${r.name}»: vale per tutto quello che contiene.`}</small>
            </div>
          </div>
        )) : (
          <div className="d-vis"><CampoIcon name="users" size={18} /><div><b>Tutti gli utenti di Archie</b><small>Nessuna restrizione {isFile ? 'sul file né sulle cartelle che lo contengono' : 'su questa cartella né su quelle che la contengono'}.</small></div></div>
        )}
      </section>

      <section className="d-fd-sec">
        <h4>Note</h4>
        {editNotes !== null ? (
          <div className="d-notes-edit">
            <textarea autoFocus value={editNotes} onChange={(e) => setEditNotes(e.target.value)} aria-label="Nota" placeholder="Es. dove si trova, a cosa serve, chi l'ha chiesto" />
            <div>
              <Button size="small" color="inherit" onClick={() => setEditNotes(null)} disabled={busy}>Annulla</Button>
              <Button size="small" variant="contained" disabled={busy} onClick={() => void patch({ notes: editNotes.trim() || null }, 'Nota salvata').then((ok) => ok && setEditNotes(null))}>Salva</Button>
            </div>
          </div>
        ) : (
          <>
            {d.notes ? <p className="d-notes">{d.notes}</p> : !p.canChange ? <span className="none">Nessuna nota</span> : null}
            {p.canChange ? <button type="button" className="d-add" onClick={() => setEditNotes(d.notes ?? '')}><CampoIcon name={d.notes ? 'file' : 'plus'} size={14} />{d.notes ? 'Modifica la nota' : 'Aggiungi una nota'}</button> : null}
          </>
        )}
      </section>

      {p.canSeeAudit ? (
        <section className="d-fd-sec">
          <h4>Attività</h4>
          {events === null ? <span className="none">Caricamento…</span> : events.length ? (
            <ol className="d-tl2">
              {events.map((e) => {
                const ev = describeEvent(e, isFile ? 'file' : 'folder')
                return <li key={e.id}><i><CampoIcon name={ev.icon} size={14} /></i><span><b>{e.actor_username ?? 'Sistema'}</b> {ev.text}</span><time>{rel(e.created_at)}</time></li>
              })}
            </ol>
          ) : <span className="none">Nessuna attività registrata.</span>}
        </section>
      ) : null}

      {file && p.siblings.length ? (
        <section className="d-fd-sec">
          <h4>Nella stessa cartella</h4>
          <ul className="d-sibs">
            {p.siblings.slice(0, 4).map((s) => (
              <li key={s.id}><button type="button" onClick={() => p.onOpenFile(s)}><FileIcon kind={kindOf(s.name, s.mime_type)} ext={extOf(s.name)} size={24} /><span className="d-n"><b>{s.name}</b><small>{s.size_human} · {rel(s.updated_at)}</small></span></button></li>
            ))}
          </ul>
        </section>
      ) : null}
      </div>
    </aside>
  )
}

/** Anteprima del file a tutto schermo (doppio clic o Invio sul file, o «Tutto schermo» nel pannello). */
export function DriveFullPreview({ file, onClose }: { file: DriveFile | null; onClose: () => void }) {
  const kind = file ? kindOf(file.name, file.mime_type) : null
  const ext = file ? extOf(file.name) : ''
  return (
    <Dialog open={Boolean(file)} onClose={onClose} fullScreen aria-label={file ? `Anteprima di ${file.name}` : undefined}
      PaperProps={{ sx: { bgcolor: 'rgb(10 20 18 / .97)', backgroundImage: 'none', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 1.5, p: { xs: 1.5, md: '16px 24px 24px' } } }}>
      {file ? <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: '#fff', minWidth: 0 }}>
          <FileIcon kind={kind!} ext={ext} size={28} />
          <Box component="b" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 15 }}>{file.name}</Box>
          <Button variant="contained" startIcon={<CampoIcon name="download" size={16} />} onClick={() => window.open(`/api/drive-files/${file.id}/download/`, '_blank')}>Scarica</Button>
          <IconButton aria-label="Chiudi l'anteprima" onClick={onClose} sx={{ color: '#fff' }}><CampoIcon name="x" /></IconButton>
        </Box>
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 0, '& img': { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }, '& iframe': { width: '100%', height: '100%', border: 0, bgcolor: '#fff', borderRadius: '6px' } }}>
          {file.is_image ? <img src={`/api/drive-files/${file.id}/preview/`} alt={`Anteprima di ${file.name}`} />
            : file.is_pdf ? <iframe src={`/api/drive-files/${file.id}/preview/`} title={`Anteprima di ${file.name}`} />
              : <Box sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, color: 'rgb(255 255 255 / .8)', fontSize: 13 }}><FileIcon kind={kind!} ext={ext} size={88} />Nessuna anteprima per i file {ext ? `.${ext}` : 'di questo tipo'}: si apre dopo averlo scaricato.</Box>}
        </Box>
      </> : null}
    </Dialog>
  )
}
