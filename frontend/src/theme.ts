import { createTheme, alpha, type Theme } from '@mui/material/styles'
import { itIT as materialItIT } from '@mui/material/locale'
import { itIT as dataGridItIT } from '@mui/x-data-grid/locales'
import type {} from '@mui/x-data-grid/themeAugmentation'

import geistUrl from './assets/fonts/Geist-300_800-normal.woff2?url'
import geistMonoUrl from './assets/fonts/GeistMono-400_600-normal.woff2?url'
import { PALETTES, type ArchieTokens, type ColorMode, type PaletteKey } from './theme/palettes'

// Ruoli di colore del restyle disponibili come theme.palette.archie.*
declare module '@mui/material/styles' {
  interface Palette { archie: ArchieTokens }
  interface PaletteOptions { archie?: ArchieTokens }
}

export const FONT_SANS = '"Geist", system-ui, -apple-system, "Segoe UI", sans-serif'
export const FONT_MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/**
 * Tema MUI "Campo sterile" (frontend/DESIGN.md).
 * Superfici neutre, colore solo per azione/selezione/stato, bordi sottili al
 * posto delle ombre (ombra solo su ciò che galleggia), Geist a 13px reali
 * senza la vecchia riduzione globale 0.8.
 */
export function createArchieTheme(key: PaletteKey = 'default', mode: ColorMode = 'light'): Theme {
  const p = PALETTES[key][mode]
  const a = p.archie
  const dark = mode === 'dark'

  return createTheme(
    {
      palette: {
        mode,
        primary: { main: p.primary.main, dark: p.primary.hover, contrastText: p.primary.contrastText },
        // Secondario = tinta della palette in versione tenue: niente secondo accento.
        secondary: { main: p.text.secondary, contrastText: p.background.paper },
        success: { main: p.success.main, light: p.success.bg, dark: p.success.main },
        warning: { main: p.warning.main, light: p.warning.bg, dark: p.warning.main },
        error: { main: p.error.main, light: p.error.bg, dark: p.error.main },
        info: { main: p.info.main, light: p.info.bg, dark: p.info.main },
        background: p.background,
        text: { primary: p.text.primary, secondary: p.text.secondary, disabled: a.textFaint },
        divider: p.divider,
        action: {
          hover: a.surface2,
          selected: a.field,
          focus: alpha(p.primary.main, 0.12),
        },
        archie: a,
      },

      shape: { borderRadius: 6 },

      typography: {
        fontFamily: FONT_SANS,
        fontSize: 13,
        htmlFontSize: 16,
        h1: { fontSize: '28px', fontWeight: 650, lineHeight: 1.2, letterSpacing: '-0.02em' },
        h2: { fontSize: '26px', fontWeight: 650, lineHeight: 1.2, letterSpacing: '-0.02em' },
        h3: { fontSize: '24px', fontWeight: 650, lineHeight: 1.2, letterSpacing: '-0.015em' },
        h4: { fontSize: '22px', fontWeight: 650, lineHeight: 1.2, letterSpacing: '-0.015em' },
        h5: { fontSize: '18px', fontWeight: 650, lineHeight: 1.3 },
        h6: { fontSize: '15px', fontWeight: 650, lineHeight: 1.35 },
        subtitle1: { fontSize: '13px', fontWeight: 550, lineHeight: 1.45, color: p.text.secondary },
        subtitle2: { fontSize: '12px', fontWeight: 550, lineHeight: 1.45 },
        body1: { fontSize: '13px', lineHeight: 1.5 },
        body2: { fontSize: '12px', lineHeight: 1.45 },
        caption: { fontSize: '11px', lineHeight: 1.4 },
        overline: { fontSize: '11px', fontWeight: 600, lineHeight: 1.4, letterSpacing: '0.02em', textTransform: 'none' },
        button: { fontSize: '13px', fontWeight: 550, textTransform: 'none' },
      },

      components: {
        MuiCssBaseline: {
          styleOverrides: `
            @font-face { font-family: "Geist"; src: url("${geistUrl}") format("woff2"); font-weight: 300 800; font-style: normal; font-display: swap; }
            @font-face { font-family: "Geist Mono"; src: url("${geistMonoUrl}") format("woff2"); font-weight: 400 600; font-style: normal; font-display: swap; }
            body { -webkit-font-smoothing: antialiased; font-feature-settings: "ss01"; }
            code, kbd, samp, pre { font-family: ${FONT_MONO}; }
            ::selection { background: ${a.field}; color: ${p.text.primary}; }
            * { scrollbar-width: thin; scrollbar-color: ${a.borderStrong} transparent; }
            ::-webkit-scrollbar { width: 8px; height: 8px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background-color: ${a.borderStrong}; border-radius: 999px; }
            ::-webkit-scrollbar-thumb:hover { background-color: ${p.text.secondary}; }
            @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }
          `,
        },

        // Superfici piatte: solo ciò che galleggia ha un'ombra.
        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: { backgroundImage: 'none' },
            outlined: { borderColor: p.divider },
            elevation1: { boxShadow: 'none', border: `1px solid ${p.divider}` },
          },
        },
        MuiCard: {
          defaultProps: { elevation: 0 },
          styleOverrides: { root: { border: `1px solid ${p.divider}`, borderRadius: 8, boxShadow: 'none' } },
        },
        MuiPopover: { styleOverrides: { paper: { boxShadow: a.shadowFloat, border: `1px solid ${p.divider}`, borderRadius: 8 } } },
        MuiMenu: { styleOverrides: { paper: { boxShadow: a.shadowFloat, border: `1px solid ${p.divider}`, borderRadius: 8 }, list: { padding: 4 } } },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              fontSize: '13px', minHeight: 32, borderRadius: 5, margin: '0 0', gap: 8,
              '&.Mui-selected': { backgroundColor: a.field },
              '&.Mui-selected:hover': { backgroundColor: a.field },
            },
          },
        },
        MuiDialog: { styleOverrides: { paper: { borderRadius: 12, boxShadow: a.shadowFloat, border: `1px solid ${p.divider}` } } },
        MuiDialogTitle: { styleOverrides: { root: { fontSize: '16px', fontWeight: 650, padding: '16px 20px 8px' } } },
        MuiDialogContent: { styleOverrides: { root: { padding: '8px 20px 16px' } } },
        MuiDialogActions: { styleOverrides: { root: { padding: '12px 20px', borderTop: `1px solid ${p.divider}`, backgroundColor: a.surface2, gap: 8 } } },
        MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none' } } },
        MuiBackdrop: { styleOverrides: { root: { '&:not(.MuiBackdrop-invisible)': { backgroundColor: dark ? 'rgb(0 0 0 / .5)' : 'rgb(10 20 18 / .32)' } } } },

        MuiTooltip: {
          defaultProps: { arrow: false },
          styleOverrides: {
            tooltip: { backgroundColor: dark ? '#e4ecea' : '#15201e', color: dark ? '#0f1615' : '#ffffff', fontSize: '12px', fontWeight: 500, borderRadius: 5, padding: '5px 8px' },
          },
        },

        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              borderRadius: 6, minHeight: 32, padding: '0 12px', boxShadow: 'none', gap: 6, whiteSpace: 'nowrap',
              '&:hover': { boxShadow: 'none' },
              '&.Mui-focusVisible': { boxShadow: a.focusRing },
              '& .MuiButton-startIcon': { marginRight: 0, marginLeft: 0 },
              '& .MuiButton-endIcon': { marginLeft: 0, marginRight: 0 },
              '& .MuiButton-startIcon > *:nth-of-type(1), & .MuiButton-endIcon > *:nth-of-type(1)': { fontSize: 16 },
            },
            sizeSmall: { minHeight: 28, padding: '0 10px', fontSize: '12px' },
            sizeLarge: { minHeight: 38, padding: '0 16px', fontSize: '14px' },
            containedPrimary: { '&:hover': { backgroundColor: p.primary.hover } },
            outlined: {
              borderColor: p.divider, color: p.text.primary, backgroundColor: p.background.paper,
              '&:hover': { borderColor: a.borderStrong, backgroundColor: a.surface2 },
            },
            text: { color: p.text.secondary, '&:hover': { color: p.text.primary, backgroundColor: a.surface2 } },
            textPrimary: { color: p.primary.main },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              borderRadius: 6, color: p.text.secondary, border: '1px solid transparent',
              '&:hover': { backgroundColor: a.surface2, borderColor: p.divider, color: p.text.primary },
              '&.Mui-focusVisible': { boxShadow: a.focusRing },
            },
            sizeSmall: { padding: 5 },
          },
        },
        MuiToggleButton: {
          styleOverrides: {
            root: {
              textTransform: 'none', fontWeight: 550, color: p.text.secondary, borderColor: p.divider, padding: '0 10px', minHeight: 28,
              '&.Mui-selected': { backgroundColor: p.background.paper, color: p.text.primary, boxShadow: `0 1px 2px rgb(0 0 0 / .08), 0 0 0 1px ${p.divider}` },
              '&.Mui-selected:hover': { backgroundColor: p.background.paper },
            },
          },
        },
        MuiToggleButtonGroup: {
          styleOverrides: {
            root: { backgroundColor: a.surface2, border: `1px solid ${p.divider}`, borderRadius: 7, padding: 2, gap: 2 },
            grouped: { border: 0, borderRadius: '5px !important' },
          },
        },

        MuiChip: {
          styleOverrides: {
            root: { fontWeight: 550, borderRadius: 5, height: 22, fontSize: '12px' },
            sizeSmall: { height: 20, fontSize: '11px' },
            label: { paddingLeft: 7, paddingRight: 7 },
            outlined: { borderColor: p.divider },
            colorDefault: { backgroundColor: a.neutralBg, color: p.text.secondary },
            colorPrimary: { backgroundColor: a.field, color: p.primary.main },
            colorSuccess: { backgroundColor: p.success.bg, color: p.success.main },
            colorWarning: { backgroundColor: p.warning.bg, color: p.warning.main },
            colorError: { backgroundColor: p.error.bg, color: p.error.main },
            colorInfo: { backgroundColor: p.info.bg, color: p.info.main },
          },
        },
        MuiBadge: { styleOverrides: { badge: { fontWeight: 600, fontSize: '10px' } } },

        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 6, backgroundColor: p.background.paper,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: a.borderStrong },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: p.text.secondary },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: p.primary.main, borderWidth: 1 },
              '&.Mui-focused': { boxShadow: a.focusRing },
              '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: p.error.main },
            },
            input: { fontSize: '13px' },
            inputSizeSmall: { paddingTop: 7, paddingBottom: 7 },
          },
        },
        MuiInputLabel: { styleOverrides: { root: { fontSize: '13px' }, sizeSmall: { fontSize: '13px' } } },
        MuiFormHelperText: { styleOverrides: { root: { fontSize: '12px', marginLeft: 0, marginTop: 4 } } },
        MuiFormLabel: { styleOverrides: { root: { fontSize: '12px', fontWeight: 550, color: p.text.primary } } },
        MuiCheckbox: { defaultProps: { size: 'small' } },
        MuiRadio: { defaultProps: { size: 'small' } },
        MuiSwitch: { defaultProps: { size: 'small' } },

        MuiTabs: {
          styleOverrides: {
            root: { minHeight: 40 },
            indicator: { height: 2, borderRadius: '2px 2px 0 0', backgroundColor: p.primary.main },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: 'none', fontWeight: 550, fontSize: '13px', minHeight: 40, padding: '0 12px', color: p.text.secondary,
              '&.Mui-selected': { color: p.text.primary },
            },
          },
        },

        MuiListItemButton: {
          styleOverrides: {
            root: {
              borderRadius: 6,
              '&.Mui-selected': { backgroundColor: a.field },
              '&.Mui-selected:hover': { backgroundColor: a.field },
            },
          },
        },
        MuiListItemIcon: { styleOverrides: { root: { minWidth: 32, color: 'inherit' } } },

        MuiAlert: {
          styleOverrides: {
            root: { borderRadius: 8, border: '1px solid', fontSize: '13px', alignItems: 'center' },
            standardSuccess: { backgroundColor: p.success.bg, color: p.text.primary, borderColor: alpha(p.success.main, 0.25), '& .MuiAlert-icon': { color: p.success.main } },
            standardWarning: { backgroundColor: p.warning.bg, color: p.text.primary, borderColor: alpha(p.warning.main, 0.25), '& .MuiAlert-icon': { color: p.warning.main } },
            standardError: { backgroundColor: p.error.bg, color: p.text.primary, borderColor: alpha(p.error.main, 0.25), '& .MuiAlert-icon': { color: p.error.main } },
            standardInfo: { backgroundColor: p.info.bg, color: p.text.primary, borderColor: alpha(p.info.main, 0.25), '& .MuiAlert-icon': { color: p.info.main } },
          },
        },
        MuiLinearProgress: { styleOverrides: { root: { borderRadius: 3, backgroundColor: a.neutralBg } } },
        MuiSkeleton: { styleOverrides: { root: { backgroundColor: a.neutralBg } } },
        MuiDivider: { styleOverrides: { root: { borderColor: p.divider } } },

        MuiAppBar: {
          defaultProps: { elevation: 0, color: 'inherit' },
          styleOverrides: { root: { backgroundColor: a.frame, color: p.text.primary, boxShadow: 'none', borderBottom: 'none' } },
        },

        MuiDataGrid: {
          styleOverrides: {
            root: {
              border: 'none',
              fontSize: '13px',
              '--DataGrid-containerBackground': a.surface2,
              '--DataGrid-rowBorderColor': p.divider,
              '& .MuiDataGrid-columnHeaderTitle': { fontSize: '12px', fontWeight: 550, color: p.text.secondary },
              '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-cell:focus': { outline: 'none' },
              '& .MuiDataGrid-columnHeader:focus-visible, & .MuiDataGrid-cell:focus-visible': { outline: `2px solid ${alpha(p.primary.main, 0.4)}`, outlineOffset: -2 },
              '& .MuiDataGrid-row:hover': { backgroundColor: a.surface2 },
              '& .MuiDataGrid-row.Mui-selected': { backgroundColor: a.field, boxShadow: `inset 3px 0 0 ${p.primary.main}` },
              '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: a.field },
            },
            columnHeaders: { borderBottom: `1px solid ${p.divider}` },
            cell: { borderBottom: `1px solid ${p.divider}` },
            footerContainer: { borderTop: `1px solid ${p.divider}`, minHeight: 40, fontSize: '12px', color: p.text.secondary },
          },
        },
      },
    },
    materialItIT,
    dataGridItIT,
  )
}

/**
 * Tema predefinito (Verde chirurgico, chiaro). Resta esportato per i moduli
 * che lo importano staticamente; nei componenti usare sempre `useTheme()`.
 */
export const theme = createArchieTheme('default', 'light')
