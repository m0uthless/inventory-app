import * as React from 'react'
import { Box, ButtonBase, IconButton, Menu, MenuItem, Tooltip, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useCloseOnOutsideClick } from '@shared/hooks/useCloseOnOutsideClick'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'

export type DetailTab = { key: string; label: string; count?: number | null }
export type DetailMenuItem = { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }

type Props = {
  open: boolean
  onClose: () => void
  /** Etichetta a sinistra in testata (es. "#1041"). */
  idLabel?: React.ReactNode
  /** Badge di stato in testata. */
  status?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  tabs?: DetailTab[]
  tab?: string
  onTab?: (key: string) => void
  /** Posizione nella lista, es. "4 di 12". */
  position?: string
  onPrev?: () => void
  onNext?: () => void
  menu?: DetailMenuItem[]
  footer?: React.ReactNode
  width?: number
  children: React.ReactNode
  ariaLabel?: string
}

/**
 * Pannello di dettaglio flottante (DESIGN.md › Detail card): scheda sopra la
 * tabella (non la restringe), testata scura di marca con linguette, scorrimento
 * precedente/successivo (J/K), Esc per chiudere. A tutto schermo su telefono.
 */
export function FloatingDetail({
  open, onClose, idLabel, status, title, subtitle, tabs, tab, onTab, position, onPrev, onNext, menu, footer,
  width = 460, children, ariaLabel = 'Dettaglio',
}: Props) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'))
  const [menuEl, setMenuEl] = React.useState<HTMLElement | null>(null)
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)
  useCloseOnOutsideClick(rootRef, open, onClose)

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"]:not([data-floating-detail])')) return
      if (document.querySelector('.MuiPopover-root, .MuiModal-root:not([data-floating-detail-root]):not(.MuiModal-hidden)') && e.key === 'Escape') return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'j' && onNext) onNext()
      else if (e.key === 'k' && onPrev) onPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, onNext, onPrev])

  React.useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }) }, [title, tab])

  if (!open) return null
  const band = theme.palette.archie
  const white = '#fff'
  const iconBtn = { color: 'rgb(255 255 255 / .8)', '&:hover': { bgcolor: 'rgb(255 255 255 / .12)', borderColor: 'rgb(255 255 255 / .16)', color: white }, '&.Mui-disabled': { color: 'rgb(255 255 255 / .35)' } }

  return (
    <Box
      ref={rootRef}
      role="dialog"
      aria-label={ariaLabel}
      data-floating-detail
      sx={{
        position: 'fixed', zIndex: theme.zIndex.drawer + 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        bgcolor: 'background.paper', ...(phone
          ? { inset: 0 }
          : { top: 64, right: 12, bottom: 12, width: `min(${width}px, calc(100vw - 24px))`, borderRadius: '12px', border: '1px solid', borderColor: 'divider', boxShadow: `${band.shadowFloat}, 0 24px 60px -24px rgb(0 0 0 / .3)` }),
        animation: 'fdIn .2s cubic-bezier(.2,.8,.2,1)',
        '@keyframes fdIn': { from: { transform: 'translateX(24px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      {/* Testata di marca */}
      <Box sx={{ background: `linear-gradient(120deg, ${band.band} 0%, ${band.band2} 100%)`, color: white, px: 2.25, pt: 2, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 28 }}>
          {idLabel ? <Typography component="span" sx={{ fontFamily: (t) => t.typography.fontFamily, fontSize: 12, fontWeight: 500, color: 'rgb(255 255 255 / .75)', fontVariantNumeric: 'tabular-nums' }}>{idLabel}</Typography> : null}
          {status}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}>
            {position ? <Typography component="span" sx={{ fontSize: 12, color: 'rgb(255 255 255 / .7)', px: 0.5, fontVariantNumeric: 'tabular-nums' }}>{position}</Typography> : null}
            {onPrev || onNext ? (
              <>
                <Tooltip title="Precedente (K)"><span><IconButton size="small" aria-label="Precedente" onClick={onPrev} disabled={!onPrev} sx={iconBtn}><ChevronLeftIcon fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Successivo (J)"><span><IconButton size="small" aria-label="Successivo" onClick={onNext} disabled={!onNext} sx={iconBtn}><ChevronRightIcon fontSize="small" /></IconButton></span></Tooltip>
              </>
            ) : null}
            {menu?.length ? (
              <Tooltip title="Altre azioni"><IconButton size="small" aria-label="Altre azioni" aria-haspopup="menu" onClick={(e) => setMenuEl(e.currentTarget)} sx={iconBtn}><MoreHorizIcon fontSize="small" /></IconButton></Tooltip>
            ) : null}
            <Tooltip title="Chiudi (Esc)"><IconButton size="small" aria-label="Chiudi il pannello" onClick={onClose} sx={iconBtn}><CloseIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        </Box>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 650, lineHeight: 1.3, mt: 1, mb: 0.5, color: white }}>{title}</Typography>
        {subtitle ? <Typography component="div" sx={{ fontSize: 12, color: 'rgb(255 255 255 / .7)', display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', '& a': { color: 'inherit' } }}>{subtitle}</Typography> : null}
        {tabs?.length ? (
          <Box role="tablist" sx={{ display: 'flex', gap: '2px', mt: 1.25, mx: -0.75 }}>
            {tabs.map((t) => {
              const on = t.key === tab
              return (
                <ButtonBase key={t.key} role="tab" aria-selected={on} onClick={() => onTab?.(t.key)} sx={{
                  height: 34, px: 1.5, gap: 0.75, borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 550,
                  color: on ? 'text.primary' : 'rgb(255 255 255 / .72)', bgcolor: on ? 'background.paper' : 'transparent',
                  '&:hover': on ? undefined : { color: white, bgcolor: 'rgb(255 255 255 / .08)' },
                  '&.Mui-focusVisible': { boxShadow: 'inset 0 0 0 2px rgb(255 255 255 / .6)' },
                }}>
                  {t.label}
                  {t.count != null ? <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: on ? 'primary.main' : 'inherit', opacity: on ? 1 : 0.75, fontVariantNumeric: 'tabular-nums' }}>{t.count}</Box> : null}
                </ButtonBase>
              )
            })}
          </Box>
        ) : <Box sx={{ height: 16 }} />}
      </Box>

      <Box ref={bodyRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.25, py: 1.75, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {children}
      </Box>

      {footer ? (
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 2.25, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }}>
          {footer}
        </Box>
      ) : null}

      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {menu?.map((m) => (
          <MenuItem key={m.label} disabled={m.disabled} onClick={() => { setMenuEl(null); m.onClick() }}
            sx={{ color: m.danger ? 'error.main' : undefined, '& svg': { fontSize: 16, color: m.danger ? 'error.main' : 'text.secondary' } }}>
            {m.icon}{m.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}

/** Sezione con titoletto nel corpo del pannello. */
export function DetailSection({ title, end, children }: { title?: React.ReactNode; end?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box component="section">
      {title || end ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          {title ? <Typography component="h3" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{title}</Typography> : null}
          {end ? <Box sx={{ ml: 'auto' }}>{end}</Box> : null}
        </Box>
      ) : null}
      {children}
    </Box>
  )
}
