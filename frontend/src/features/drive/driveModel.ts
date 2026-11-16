// Drive (restyle "Campo sterile", anteprima design-previews/d-base.html, variante A).

export type FileKind = 'pdf' | 'img' | 'doc' | 'xls' | 'ppt' | 'zip' | 'txt' | 'mail' | 'other'

const EXT: Record<string, FileKind> = {
  pdf: 'pdf',
  jpg: 'img', jpeg: 'img', png: 'img', gif: 'img', bmp: 'img', webp: 'img', tif: 'img', tiff: 'img', heic: 'img', svg: 'img',
  doc: 'doc', docx: 'doc', odt: 'doc', rtf: 'doc',
  xls: 'xls', xlsx: 'xls', ods: 'xls', csv: 'xls',
  ppt: 'ppt', pptx: 'ppt', odp: 'ppt',
  zip: 'zip', rar: 'zip', '7z': 'zip', gz: 'zip', tar: 'zip', tgz: 'zip',
  txt: 'txt', log: 'txt', md: 'txt', json: 'txt', xml: 'txt', ini: 'txt', cfg: 'txt', conf: 'txt', sql: 'txt', sh: 'txt', ps1: 'txt', bat: 'txt',
  eml: 'mail', msg: 'mail',
}

/** Tipo di file dall'estensione (ripiego sul MIME). */
export function kindOf(name: string, mime?: string | null): FileKind {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (EXT[ext]) return EXT[ext]
  if (mime?.startsWith('image/')) return 'img'
  if (mime === 'application/pdf') return 'pdf'
  if (mime?.startsWith('text/')) return 'txt'
  return 'other'
}

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'Documento PDF', img: 'Immagine', doc: 'Documento di testo', xls: 'Foglio di calcolo', ppt: 'Presentazione',
  zip: 'Archivio compresso', txt: 'File di testo', mail: 'Messaggio email', other: 'File',
}

export const extOf = (name: string) => (name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '')

const MSH = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export function dshort(iso?: string | null, withYear = false): string {
  if (!iso) return ''
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MSH[d.getMonth()]}${withYear || d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`
}
export function rel(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5)
  return days <= 0 ? 'oggi' : days === 1 ? 'ieri' : days < 7 ? `${days} giorni fa` : dshort(iso)
}

/** Riga dell'audit tradotta in una frase breve per il pannello. */
export type AuditRow = { id: number; created_at: string; action: string; actor_username?: string | null; changes?: unknown; subject?: string | null }
export function describeEvent(e: AuditRow, kind: 'file' | 'folder'): { icon: 'upload' | 'folder' | 'file' | 'building' | 'chat' | 'trash' | 'restore' | 'wrench'; text: string } {
  const it = kind === 'file' ? 'lo' : 'la'
  if (e.action === 'create') return { icon: kind === 'file' ? 'upload' : 'folder', text: kind === 'file' ? 'lo ha caricato' : "l'ha creata" }
  if (e.action === 'delete') return { icon: 'trash', text: `${it} ha spostat${kind === 'file' ? 'o' : 'a'} nel cestino` }
  if (e.action === 'restore') return { icon: 'restore', text: `${it} ha ripristinat${kind === 'file' ? 'o' : 'a'}` }
  const ch = (e.changes && typeof e.changes === 'object' ? e.changes : {}) as Record<string, { from?: unknown; to?: unknown }>
  const keys = Object.keys(ch)
  if (keys.includes('name')) return { icon: 'file', text: `${it} ha rinominat${kind === 'file' ? 'o' : 'a'}${ch.name?.from ? ` da «${String(ch.name.from)}»` : ''}` }
  if (keys.includes('folder') || keys.includes('parent') || /move/i.test(e.subject ?? '')) return { icon: 'folder', text: `${it} ha spostat${kind === 'file' ? 'o' : 'a'}` }
  if (keys.includes('customers')) return { icon: 'building', text: 'ha aggiornato i clienti collegati' }
  if (keys.includes('notes')) return { icon: 'chat', text: 'ha modificato la nota' }
  return { icon: 'wrench', text: `${it} ha modificat${kind === 'file' ? 'o' : 'a'}` }
}
