import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { CampoIcon, type CampoIconName } from './CampoIcon'

/*
 * Righe a filo delle schede dei pannelli "Campo sterile" (siti, inventari,
 * documenti…): riquadro icona, titolo + dettaglio, coda a destra; gruppi con
 * titolo, conteggio e link.
 */

/* eslint-disable react-refresh/only-export-components */
type Page<T> = { results?: T[] } | T[]
const list = <T,>(d: Page<T>): T[] => (Array.isArray(d) ? d : d.results ?? [])
export const mono = { fontFamily: '"Geist Mono", monospace' }

export function useList<T>(url: string, params: Record<string, unknown> | null, reloadKey?: unknown) {
  const [rows, setRows] = React.useState<T[] | null>(null)
  const key = JSON.stringify(params)
  React.useEffect(() => {
    if (!params) { setRows([]); return }
    let alive = true
    setRows(null)
    api.get(url, { params }).then((r) => { if (alive) setRows(list(r.data as Page<T>)) }).catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, reloadKey])
  return rows
}

// ─── Elementi comuni ─────────────────────────────────────────────────────────

export function Group({ title, count, action, children, first }: { title: React.ReactNode; count?: number | null; action?: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  return (
    <Box component="section" sx={{ mt: first ? 0 : 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, minHeight: 22 }}>
        <Typography component="h3" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Typography>
        {count != null ? <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.75, lineHeight: '18px', fontVariantNumeric: 'tabular-nums' }}>{count}</Box> : null}
        {action ? <Box sx={{ ml: 'auto', flex: 'none' }}>{action}</Box> : null}
      </Box>
      {children}
    </Box>
  )
}

const linkSx = { minWidth: 0, p: 0, height: 'auto', fontSize: 12, fontWeight: 550, color: 'primary.main', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline', textUnderlineOffset: '3px' } }
export function GroupLink({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button size="small" onClick={onClick} sx={linkSx}>{label}</Button>
}

type Tone = 'brand' | 'neutral' | 'pdf'
export function Tile({ icon, text, tone = 'neutral' }: { icon?: CampoIconName; text?: string; tone?: Tone }) {
  return (
    <Box sx={{
      width: 28, height: 28, flex: 'none', borderRadius: '7px', display: 'grid', placeItems: 'center',
      ...(tone === 'brand' ? { bgcolor: 'archie.field', color: 'primary.main' } : tone === 'pdf' ? { bgcolor: 'error.light', color: 'error.main' } : { bgcolor: 'archie.neutralBg', color: 'text.secondary' }),
      ...(text ? { ...mono, fontSize: 8.5, fontWeight: 650, letterSpacing: '.03em' } : {}),
    }}>
      {icon ? <CampoIcon name={icon} size={15} /> : text}
    </Box>
  )
}

/** Riga a filo: icona, titolo + dettaglio, coda; cliccabile se `onClick`. */
export function Row({ tile, title, sub, end, onClick, chevron }: { tile: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; end?: React.ReactNode; onClick?: () => void; chevron?: boolean }) {
  const body = (
    <>
      {tile}
      <Box sx={{ minWidth: 0, display: 'grid', gap: '1px', textAlign: 'left' }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 550, color: 'text.primary' }}>{title}</Typography>
        {sub ? <Typography noWrap component="div" sx={{ fontSize: 12, color: 'text.secondary' }}>{sub}</Typography> : null}
      </Box>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flex: 'none' }}>
        {end}
        {chevron ? <Box sx={{ color: 'text.disabled', display: 'inline-flex' }}><CampoIcon name="chevR" size={14} /></Box> : null}
      </Box>
    </>
  )
  const sx = {
    display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', alignItems: 'center', gap: 1.25, width: '100%',
    minHeight: 50, py: 0.75, px: 0.75, borderBottom: '1px solid', borderColor: 'divider',
  }
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      {onClick ? (
        <ButtonBase onClick={onClick} sx={{ ...sx, borderRadius: 0, '&:hover': { bgcolor: 'archie.surface2' }, '&.Mui-focusVisible': { boxShadow: (t) => `inset ${t.palette.archie.focusRing}` } }}>{body}</ButtonBase>
      ) : <Box sx={sx}>{body}</Box>}
    </Box>
  )
}

export function Rows({ children }: { children: React.ReactNode }) {
  return <Box component="ul" sx={{ m: 0, p: 0, borderTop: '1px solid', borderColor: 'divider' }}>{children}</Box>
}

export function Empty({ text }: { text: string }) {
  return <Typography sx={{ fontSize: 12, color: 'text.secondary', py: 1.25 }}>{text}</Typography>
}
export function Loading() {
  return <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress size={20} /></Box>
}

