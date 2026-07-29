import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtDate(ts?: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Mappa tipo file → colore, condivisa da FileTypeIcon e fileIconBg
const FILE_TYPE_COLOR = {
  image: { bg: '#f0fdf4', fg: '#16a34a' },
  pdf: { bg: '#fff1f2', fg: '#dc2626' },
  other: { bg: '#eff6ff', fg: '#2563eb' },
} as const
type FileTypeKey = keyof typeof FILE_TYPE_COLOR

export function fileTypeKey(mime?: string): FileTypeKey {
  if (mime?.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  return 'other'
}

export function FileTypeIcon({ mime, size = 20 }: { mime?: string; ext?: string; size?: number }) {
  const key = fileTypeKey(mime)
  const color = FILE_TYPE_COLOR[key].fg

  if (key === 'image') return <ImageOutlinedIcon sx={{ fontSize: size, color }} />
  if (key === 'pdf') return <PictureAsPdfOutlinedIcon sx={{ fontSize: size, color }} />
  return <InsertDriveFileOutlinedIcon sx={{ fontSize: size, color }} />
}

export function fileIconBg(mime?: string) {
  const key = fileTypeKey(mime)
  return { bg: FILE_TYPE_COLOR[key].bg, color: FILE_TYPE_COLOR[key].fg }
}

// ─── Upload constraints ─────────────────────────────────────────────────────────

export const MAX_UPLOAD_MB = 25
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
