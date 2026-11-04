/**
 * DrawerShell — struttura condivisa per tutti i drawer di dettaglio ARCHIE.
 *
 * Gestisce internamente:
 *  - Hero banner con gradient, orb decorativi, badge status, azioni CRUD,
 *    titolo/sottotitolo/caption, icon avatar, tab bar NELL'HERO
 *  - LinearProgress durante il caricamento
 *  - Body scrollabile
 *  - Slot bodyFooter per footer fissi (es. input commenti)
 *
 * Props strutturate (non serve costruire JSX nei drawer):
 *  - statusLabel      → badge status auto (stile inline, colore dal gradient)
 *  - canChange/canDelete/deleteBusy/restoreBusy → azioni hero auto
 *  - onEdit/onDelete/onRestore/onClose → callback azioni
 *  - tabs             → array di label stringa (o null per tab condizionali)
 *                       + tabValue + onTabChange
 *  - extraChips       → chip aggiuntivi accanto alle tab (es. VLAN/WiFi/PACS)
 *
 * Slot override:
 *  - actions          → sostituisce le azioni auto (IssueDrawer)
 *  - icon             → avatar/icona tipo accanto al titolo
 *  - bodyFooter       → footer del corpo (input commenti)
 */

import * as React from 'react'
import {
  Box,
  Chip,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import { useTheme } from '@mui/material/styles'

// ─── Aspetto (opt-in) ─────────────────────────────────────────────────────────
// 'classic' = hero a gradiente (predefinito, Portal). 'campo' = restyle
// "Campo sterile" di Archie: scheda flottante sopra la lista (non modale),
// testata a fascia di marca, linguette, niente orb. Lo attiva solo la shell
// di Archie con <DrawerAppearanceProvider value="campo">.

export type DrawerAppearance = 'classic' | 'campo'
const DrawerAppearanceContext = React.createContext<DrawerAppearance>('classic')
export const DrawerAppearanceProvider = DrawerAppearanceContext.Provider
// eslint-disable-next-line react-refresh/only-export-components
export function useDrawerAppearance(): DrawerAppearance {
  return React.useContext(DrawerAppearanceContext)
}
type CampoPalette = { band: string; band2: string; shadowFloat: string }

// ─── Gradients predefiniti ────────────────────────────────────────────────────

export const DRAWER_GRADIENTS = {
  teal: 'linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)',
  blue: 'linear-gradient(140deg, #0B3D6B 0%, #1A6BB5 55%, #4A90D9 100%)',
} as const

export type DrawerGradient = keyof typeof DRAWER_GRADIENTS | (string & NonNullable<unknown>)

function resolveGradient(g: DrawerGradient): string {
  return g in DRAWER_GRADIENTS ? DRAWER_GRADIENTS[g as keyof typeof DRAWER_GRADIENTS] : g
}

// ─── Colori badge per gradient ────────────────────────────────────────────────

const BADGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  teal: { bg: 'rgba(20,255,180,0.18)', color: '#a7f3d0', border: '1px solid rgba(167,243,208,0.3)' },
  blue: { bg: 'rgba(93,174,240,0.20)',  color: '#93C9F8', border: '1px solid rgba(147,201,248,0.3)' },
}

function badgeColors(gradient: DrawerGradient) {
  return BADGE_COLORS[gradient as string] ?? BADGE_COLORS.teal
}

// ─── Sx helper per i bottoni sull'hero ───────────────────────────────────────

export const HERO_ICON_BTN_SX: SxProps<Theme> = {
  color: 'rgba(255,255,255,0.85)',
  bgcolor: 'rgba(255,255,255,0.12)',
  borderRadius: 1.5,
  '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
}

export const HERO_ICON_BTN_DELETE_SX: SxProps<Theme> = {
  ...HERO_ICON_BTN_SX,
  '&:hover': { bgcolor: 'rgba(239,68,68,0.28)', color: '#fca5a5' },
}

// ─── Badge inline (stile IssueDrawer) ────────────────────────────────────────

function HeroBadge({
  label,
  gradient,
  secondary = false,
}: {
  label: string
  gradient: DrawerGradient
  secondary?: boolean
}) {
  const bc = badgeColors(gradient)
  return (
    <Box
      sx={{
        bgcolor: secondary ? 'rgba(255,255,255,0.12)' : bc.bg,
        color: secondary ? 'rgba(255,255,255,0.85)' : bc.color,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.07em',
        border: secondary ? '1px solid rgba(255,255,255,0.2)' : bc.border,
        borderRadius: '4px',
        px: 1,
        py: 0.25,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        flexShrink: 0,
      }}
    >
      {label}
    </Box>
  )
}

function CampoBadge({ label }: { label: string }) {
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550,
      bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', boxShadow: '0 0 0 1px rgba(255,255,255,0.2)', whiteSpace: 'nowrap',
    }}>
      {label.replace(/^●\s*/, '')}
    </Box>
  )
}

// ─── HeroIconButton ───────────────────────────────────────────────────────────

function HeroIconBtn({
  label,
  onClick,
  disabled,
  danger = false,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={danger ? HERO_ICON_BTN_DELETE_SX : HERO_ICON_BTN_SX}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

// ─── Sx chip feature (VLAN, WiFi, ecc.) ──────────────────────────────────────

export const FEATURE_CHIP_SX: SxProps<Theme> = {
  height: 18,
  fontSize: '0.65rem',
  fontWeight: 700,
  bgcolor: 'rgba(255,255,255,0.18)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.25)',
  '& .MuiChip-label': { px: 0.6 },
}

// ─── DrawerBody ───────────────────────────────────────────────────────────────

export function DrawerBody({ children, sx }: { children: React.ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        px: 2.5,
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

// ─── DrawerShell props ────────────────────────────────────────────────────────

export interface DrawerShellProps {
  // ── Drawer base ──
  open: boolean
  onClose: () => void
  /** Larghezza su schermi ≥ sm. Default 368. */
  width?: number
  gradient: DrawerGradient

  // ── Hero: status badge ──
  /** Label del badge status principale (es. "● Attivo"). Colore auto dal gradient. */
  statusLabel?: string
  /** Badge secondario affiancato al primo (es. priorità in IssueDrawer). */
  statusLabelSecondary?: string
  /** Nodo custom che sostituisce il/i badge status (per casi complessi come IssueDrawer). */
  statusSlot?: React.ReactNode

  // ── Hero: azioni CRUD auto ──
  canChange?: boolean
  canDelete?: boolean
  deleteBusy?: boolean
  restoreBusy?: boolean
  deleted?: boolean
  onEdit?: () => void | Promise<void>
  onDelete?: () => void
  onRestore?: () => void | Promise<void>
  /** Override completo delle azioni (sostituisce le azioni auto). */
  actions?: React.ReactNode

  // ── Hero: titolo ──
  /** Icona/avatar affiancata al titolo. */
  icon?: React.ReactNode
  /** Se true, `icon` è reso "nudo" (es. Avatar tondo) senza il riquadro/bordo traslucido di default. */
  iconBare?: boolean
  title: string
  subtitle?: string
  caption?: string
  /** Testo sfumato in trasparenza subito dopo la freccia indietro, allineato a sinistra (es. tipo/categoria). Opt-in. */
  heroWatermark?: string

  // ── Hero: tab bar interna ──
  /**
   * Label delle tab. Può contenere null per tab condizionali (vengono saltate).
   * Es: ['Dettagli', 'RIS/PACS', hasWifi ? 'WiFi' : null]
   */
  tabs?: (string | null)[]
  tabValue?: number
  onTabChange?: (value: number) => void
  /** Chip aggiuntivi accanto alle tab (es. VLAN, WiFi, PACS). */
  extraChips?: React.ReactNode

  // ── Body ──
  loading?: boolean
  bodySx?: SxProps<Theme>
  /** Slot fisso tra hero e body scrollabile (es. floating card in InventoryDrawer). */
  preBody?: React.ReactNode
  /** Footer fisso dopo il body (es. input commenti in IssueDrawer). */
  bodyFooter?: React.ReactNode
  children: React.ReactNode
}

// ─── DrawerShell ──────────────────────────────────────────────────────────────

export function DrawerShell({
  open,
  onClose,
  width = 420,
  gradient,
  // status
  statusLabel,
  statusLabelSecondary,
  statusSlot,
  // azioni
  canChange,
  canDelete,
  deleteBusy,
  restoreBusy,
  deleted,
  onEdit,
  onDelete,
  onRestore,
  actions,
  // titolo
  icon,
  iconBare = false,
  title,
  subtitle,
  caption,
  heroWatermark,
  // tab
  tabs,
  tabValue = 0,
  onTabChange,
  extraChips,
  // body
  loading,
  bodySx,
  preBody,
  bodyFooter,
  children,
}: DrawerShellProps) {
  const appearance = React.useContext(DrawerAppearanceContext)
  const theme = useTheme()
  const campo = appearance === 'campo' ? (theme.palette as unknown as { archie?: CampoPalette }).archie : undefined

  // Esc chiude la scheda flottante (non è modale, quindi MUI non lo gestisce).
  React.useEffect(() => {
    if (!campo || !open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.MuiModal-root:not(.MuiDrawer-docked)')) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [campo, open, onClose])

  // ── Status slot (freccia indietro + badge status) ────────────────────────
  const resolvedStatusSlot = statusSlot ?? (campo ? (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      {statusLabel ? <CampoBadge label={statusLabel} /> : null}
      {statusLabelSecondary ? <CampoBadge label={statusLabelSecondary} /> : null}
    </Stack>
  ) : (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Tooltip title="Chiudi">
        <IconButton size="small" onClick={onClose} sx={HERO_ICON_BTN_SX} aria-label="Chiudi">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {statusLabel ? <HeroBadge label={statusLabel} gradient={gradient} /> : null}
      {statusLabelSecondary ? <HeroBadge label={statusLabelSecondary} gradient={gradient} secondary /> : null}
    </Stack>
  ))

  // ── Azioni auto ──────────────────────────────────────────────────────────
  const resolvedActions = actions ?? (
    <>
      {canChange ? (
        deleted ? (
          <HeroIconBtn label="Ripristina" onClick={onRestore} disabled={restoreBusy}>
            <RestoreFromTrashIcon fontSize="small" />
          </HeroIconBtn>
        ) : (
          <HeroIconBtn label="Modifica" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </HeroIconBtn>
        )
      ) : null}
      {canDelete && !deleted ? (
        <HeroIconBtn label="Elimina" onClick={onDelete} disabled={deleteBusy} danger>
          <DeleteOutlineIcon fontSize="small" />
        </HeroIconBtn>
      ) : null}
    </>
  )

  // ── Tab bar interna all'hero ─────────────────────────────────────────────
  const visibleTabs = tabs?.filter((t): t is string => t !== null) ?? []
  const hasTabs = visibleTabs.length > 0

  const heroTabBar = hasTabs ? (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: campo ? 'flex-start' : 'space-between', flexDirection: campo ? 'row-reverse' : 'row', gap: 1, mt: campo ? 1.5 : 1.25, mx: campo ? -0.75 : 0, position: 'relative', zIndex: 2 }}>
      {extraChips ? (
        <Stack direction="row" spacing={0.5} alignItems="center">
          {extraChips}
        </Stack>
      ) : <Box />}
      <Tabs
        value={tabValue}
        onChange={(_, v: number) => onTabChange?.(v)}
        // Con 6-7 tab (es. Cliente) la barra supera la larghezza del drawer:
        // scrollabile con frecce, così le ultime tab restano raggiungibili.
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={campo ? {
          minHeight: 0,
          minWidth: 0,
          flex: '0 1 auto',
          mb: '-1px',
          '& .MuiTabs-scrollButtons': { color: '#fff', width: 24, '&.Mui-disabled': { opacity: 0 } },
          '& .MuiTabs-indicator': { display: 'none' },
          '& .MuiTabs-flexContainer': { gap: '2px' },
          '& .MuiTab-root': {
            minHeight: 34, minWidth: 0, px: 1.5, py: 0, borderRadius: '8px 8px 0 0',
            fontSize: 13, fontWeight: 550, letterSpacing: 0, textTransform: 'none',
            color: 'rgba(255,255,255,0.72)',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
            '&.Mui-selected': { color: 'text.primary', bgcolor: 'background.paper' },
          },
        } : {
          minHeight: 0,
          minWidth: 0,
          flex: '0 1 auto',
          '& .MuiTabs-scrollButtons': { color: '#fff', width: 28, '&.Mui-disabled': { opacity: 0 } },
          '& .MuiTabs-indicator': { bgcolor: 'rgba(255,255,255,0.9)', height: 2, borderRadius: 1 },
          '& .MuiTab-root': {
            minHeight: 0, minWidth: 0, px: 1.25, py: 0.5,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.75)',
            '&.Mui-selected': { color: '#fff' },
          },
        }}
      >
        {visibleTabs.map((label) => (
          <Tab key={label} label={label} />
        ))}
      </Tabs>
    </Box>
  ) : null

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant={campo ? 'persistent' : 'temporary'}
      PaperProps={{ sx: campo ? {
        width: { xs: '100%', md: `min(${Math.max(width, 440)}px, calc(100vw - 24px))` },
        top: { xs: 0, md: 64 }, right: { xs: 0, md: 12 }, bottom: { xs: 0, md: 12 }, height: 'auto',
        borderRadius: { xs: 0, md: '12px' }, border: { xs: 0, md: '1px solid' }, borderColor: 'divider',
        boxShadow: `${campo.shadowFloat}, 0 24px 60px -24px rgb(0 0 0 / .3)`, zIndex: (t: Theme) => t.zIndex.drawer + 1,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      } : { width: { xs: '100%', sm: width }, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      <Stack sx={{ height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Hero banner ─────────────────────────────────────────────────── */}
        <Box
          sx={{
            background: campo ? `linear-gradient(120deg, ${campo.band} 0%, ${campo.band2} 100%)` : resolveGradient(gradient),
            px: campo ? 2.25 : 2.5,
            pt: campo ? 2 : 2.25,
            pb: campo ? (hasTabs ? 0 : 2) : hasTabs ? (preBody ? 3 : 1.5) : 2.25,
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {campo ? null : (
            <>
              {/* Orb decorativo alto-destra */}
              <Box sx={{ position: 'absolute', top: -44, right: -44, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
              {/* Orb decorativo basso-sinistra */}
              <Box sx={{ position: 'absolute', bottom: -26, left: 52, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
            </>
          )}

          {/* Riga 1: status + azioni */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              {resolvedStatusSlot}
              {heroWatermark ? (
                <Typography
                  aria-hidden="true"
                  sx={{
                    fontSize: 12, fontWeight: 700, lineHeight: 1,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    pointerEvents: 'none', userSelect: 'none',
                  }}
                >
                  {heroWatermark}
                </Typography>
              ) : null}
            </Stack>
            {/* Su touch Modifica ed Elimina più distanziate: un tocco impreciso non deve finire sul cestino. */}
            <Stack direction="row" spacing={{ xs: 1.5, sm: 0.75 }}>
              {resolvedActions}
              {campo ? (
                <HeroIconBtn label="Chiudi (Esc)" onClick={onClose}>
                  <CloseIcon fontSize="small" />
                </HeroIconBtn>
              ) : null}
            </Stack>
          </Stack>

          {/* Riga 2: badge eliminato + icon + titolo + subtitle + caption */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {deleted ? (
              <Chip size="small" color="error" label="Eliminato" sx={{ mb: 0.75, height: 20, fontSize: 10 }} />
            ) : null}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: icon ? 0.5 : 0 }}>
              {icon ? (
                iconBare ? (
                  icon
                ) : (
                  <Box sx={{ width: 44, height: 44, borderRadius: 1, flexShrink: 0, bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                  </Box>
                )
              ) : null}
              <Typography sx={{ color: '#fff', fontSize: campo ? 18 : icon ? 24 : 26, fontWeight: campo ? 650 : 900, letterSpacing: campo ? '-0.01em' : '-0.025em', lineHeight: campo ? 1.3 : 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </Typography>
            </Stack>
            {subtitle ? (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)', mt: icon ? 0 : 0.5, ...(campo && { fontSize: 12, color: 'rgba(255,255,255,0.7)', mt: 0.25 }) }}>
                {subtitle}
              </Typography>
            ) : null}
            {caption ? (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mt: 0.25 }}>
                {caption}
              </Typography>
            ) : null}
          </Box>

          {/* Riga 3: tab bar interna all'hero */}
          {heroTabBar}
        </Box>

        {/* ── Loading bar ─────────────────────────────────────────────────── */}
        {loading ? <LinearProgress sx={{ height: 2 }} /> : null}

        {/* ── Slot pre-body fisso (es. floating card) ──────────────────────── */}
        {preBody ?? null}

        {/* ── Body scrollabile ────────────────────────────────────────────── */}
        <DrawerBody sx={campo ? { px: 2.25, py: 1.75, ...(bodySx as object) } : bodySx}>
          {children}
        </DrawerBody>

        {/* ── Footer fisso (es. input commenti) ───────────────────────────── */}
        {bodyFooter ?? null}

      </Stack>
    </Drawer>
  )
}

export default DrawerShell
