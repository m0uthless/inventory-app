import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, ButtonBase, IconButton, Popover, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined'

import { NAV_GROUPS, entryActive, leafMatches, type CountKey, type NavEntry, type NavLeaf } from './appNav'

export const SIDEBAR_WIDTH = 232
export const SIDEBAR_MINI_WIDTH = 64

type Props = {
  mini: boolean
  /** Sidebar dentro il pannello mobile: niente pulsante di compressione. */
  mobile?: boolean
  onToggleMini?: () => void
  onNavigate?: () => void
  canAccess: (leaf: NavLeaf) => boolean
  counts: Partial<Record<CountKey, number | null | undefined>>
}

/**
 * Sidebar unica (DESIGN.md › Navigation): fondo "cornice" condiviso con la
 * topbar, logo ARCHIE + Biotron, voci raggruppate per lavoro, comprimibile a
 * sole icone. Voce attiva = fondo paper + filo del primario.
 */
export function AppSidebar({ mini, mobile = false, onToggleMini, onNavigate, canAccess, counts }: Props) {
  const theme = useTheme()
  const a = theme.palette.archie
  const loc = useLocation()
  const nav = useNavigate()
  const [flyout, setFlyout] = React.useState<{ el: HTMLElement; entry: NavEntry } | null>(null)
  const closeTimer = React.useRef<number | null>(null)
  const cancelClose = () => { if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null } }
  const scheduleClose = () => { cancelClose(); closeTimer.current = window.setTimeout(() => setFlyout(null), 180) }
  React.useEffect(() => () => cancelClose(), [])
  React.useEffect(() => { setFlyout(null) }, [loc.pathname, mini])

  const go = (path: string) => { nav({ pathname: path, search: '' }); onNavigate?.() }

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(canAccess).map((it) => ({ ...it, children: (it.children ?? []).filter(canAccess) })),
  })).filter((g) => g.items.length)

  const countChip = (n: number | null | undefined, selected: boolean) => !n ? null : (
    <Box component="span" sx={{
      ml: 'auto', minWidth: 20, px: 0.75, lineHeight: '18px', borderRadius: '5px', textAlign: 'center',
      fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
      bgcolor: selected ? 'archie.field' : 'archie.neutralBg', color: selected ? 'primary.main' : 'text.secondary',
      ...(mini && { position: 'absolute', top: 2, right: 4, minWidth: 16, px: 0.5, lineHeight: '15px', fontSize: 10 }),
    }}>{n > 99 ? '99+' : n}</Box>
  )

  const itemSx = (selected: boolean, sectionActive: boolean) => ({
    position: 'relative' as const, width: '100%', height: 32, borderRadius: '6px', gap: 1.25, px: mini ? 0 : 1,
    justifyContent: mini ? 'center' : 'flex-start', border: '1px solid transparent',
    color: selected || sectionActive ? 'text.primary' : 'text.secondary',
    fontSize: 13, fontWeight: selected ? 600 : sectionActive ? 550 : 500, whiteSpace: 'nowrap' as const,
    '& .nav-ic': { display: 'inline-flex', color: selected ? 'primary.main' : 'inherit', '& svg': { fontSize: 18 } },
    '&:hover': { bgcolor: 'background.paper', color: 'text.primary' },
    '&.Mui-focusVisible': { boxShadow: a.focusRing },
    ...(selected && { bgcolor: 'background.paper', borderColor: a.fieldLine }),
  })

  const renderEntry = (it: NavEntry & { children: NavLeaf[] }) => {
    const selected = leafMatches(it, loc.pathname)
    const active = entryActive(it, loc.pathname)
    const count = it.count ? counts[it.count] : null
    const hasKids = it.children.length > 0
    const btn = (
      <ButtonBase
        onClick={() => go(it.path)}
        aria-current={selected ? 'page' : undefined}
        aria-label={mini ? it.label : undefined}
        onMouseEnter={mini && hasKids ? (e) => { cancelClose(); setFlyout({ el: e.currentTarget, entry: it }) } : undefined}
        onMouseLeave={mini && hasKids ? scheduleClose : undefined}
        sx={itemSx(selected, active && !selected)}
      >
        <Box component="span" className="nav-ic">{it.icon}</Box>
        {!mini && <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</Box>}
        {countChip(count, selected)}
      </ButtonBase>
    )
    return (
      <Box component="li" key={it.path} sx={{ listStyle: 'none' }}>
        {mini && !hasKids ? <Tooltip title={it.label} placement="right">{btn}</Tooltip> : btn}
        {!mini && hasKids && active ? (
          <Box component="ul" sx={{ m: 0, p: 0, pl: 3.5, mt: 0.25, mb: 0.5, display: 'grid', gap: 0.25 }}>
            {it.children.map((c) => {
              const sel = leafMatches(c, loc.pathname)
              return (
                <Box component="li" key={c.path} sx={{ listStyle: 'none' }}>
                  <ButtonBase onClick={() => go(c.path)} aria-current={sel ? 'page' : undefined}
                    sx={{ ...itemSx(sel, false), height: 28, fontSize: 12.5, pl: 1.25,
                      '&::before': { content: '""', position: 'absolute', left: -10, top: 6, bottom: 6, width: '1px', bgcolor: sel ? 'primary.main' : 'divider' } }}>
                    {c.label}
                  </ButtonBase>
                </Box>
              )
            })}
          </Box>
        ) : null}
      </Box>
    )
  }

  return (
    <Box component="nav" aria-label="Navigazione principale" sx={{
      height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'archie.frame', overflow: 'hidden',
      width: mobile ? SIDEBAR_WIDTH + 28 : mini ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH,
      transition: 'width 200ms cubic-bezier(.2,.8,.2,1)',
    }}>
      {/* Marchio */}
      <Box sx={{
        height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.25,
        px: mini ? 0 : 2, justifyContent: mini ? 'center' : 'flex-start',
      }}>
        {!mini && (
          <>
            <Box aria-hidden sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, flex: 'none' }}>A</Box>
            <Box sx={{ minWidth: 0, lineHeight: 1.2 }}>
              <Typography sx={{ fontWeight: 650, fontSize: 14, letterSpacing: '0.01em' }} noWrap>ARCHIE</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>Biotron S.p.A.</Typography>
            </Box>
          </>
        )}
        {!mobile && onToggleMini ? (
          <Tooltip title={mini ? 'Espandi la barra laterale' : 'Comprimi la barra laterale'} placement="right">
            <IconButton onClick={onToggleMini} aria-label={mini ? 'Espandi la barra laterale' : 'Comprimi la barra laterale'} aria-expanded={!mini}
              sx={{ ml: mini ? 0 : 'auto', '&:hover': { bgcolor: 'background.paper' }, '& svg': { fontSize: 18, transform: mini ? 'scaleX(-1)' : 'none' } }}>
              <ViewSidebarOutlinedIcon />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>

      {/* Voci */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: mini ? 1 : 1.25, pt: 0.5, pb: 2 }}>
        {groups.map((g, gi) => (
          <Box key={g.id} sx={{ mt: gi === 0 ? 0 : mini ? 1.25 : 1.75, pt: mini && gi > 0 ? 1.25 : 0, borderTop: mini && gi > 0 ? '1px solid' : 'none', borderColor: 'divider' }}>
            {!mini && (
              <Typography component="div" sx={{ fontSize: 11, fontWeight: 600, color: 'text.disabled', px: 1, pb: 0.5 }}>{g.label}</Typography>
            )}
            <Box component="ul" sx={{ m: 0, p: 0, display: 'grid', gap: 0.25 }}>
              {g.items.map(renderEntry)}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Sottopagine con la sidebar compressa */}
      <Popover
        open={!!flyout}
        anchorEl={flyout?.el}
        onClose={() => setFlyout(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableRestoreFocus
        sx={{ pointerEvents: 'none' }}
        slotProps={{ paper: { onMouseEnter: cancelClose, onMouseLeave: scheduleClose, sx: { pointerEvents: 'auto', ml: 1, p: 0.5, minWidth: 180 } } }}
      >
        {flyout ? (
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.disabled', px: 1, pt: 0.5, pb: 0.25 }}>{flyout.entry.label}</Typography>
            {[{ label: flyout.entry.label, path: flyout.entry.path, match: flyout.entry.match } as NavLeaf, ...(flyout.entry.children ?? []).filter(canAccess)].map((c) => {
              const sel = leafMatches(c, loc.pathname)
              return (
                <ButtonBase key={c.path} onClick={() => go(c.path)} sx={{
                  display: 'flex', justifyContent: 'flex-start', width: '100%', height: 30, px: 1, borderRadius: '5px', fontSize: 13,
                  fontWeight: sel ? 600 : 500, color: sel ? 'primary.main' : 'text.primary', bgcolor: sel ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                  '&:hover': { bgcolor: 'archie.surface2' },
                }}>{c.label}</ButtonBase>
              )
            })}
          </Box>
        ) : null}
      </Popover>
    </Box>
  )
}
