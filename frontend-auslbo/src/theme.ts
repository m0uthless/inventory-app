import { createTheme } from '@mui/material/styles'
import { itIT as materialItIT } from '@mui/material/locale'
import { itIT as dataGridItIT } from '@mui/x-data-grid/locales'
import type {} from '@mui/x-data-grid/themeAugmentation'

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: {
        main: '#1A6BB5',
        light: '#4A90D9',
        dark: '#0B3D6B',
      },
      secondary: {
        main: '#0ea5e9',
      },
      success: {
        main: '#10b981',
        light: '#d1fae5',
        dark: '#065f46',
      },
      warning: {
        main: '#f59e0b',
        light: '#fef3c7',
        dark: '#92400e',
      },
      error: {
        main: '#ef4444',
        light: '#fee2e2',
        dark: '#991b1b',
      },
      info: {
        main: '#1A6BB5',
        light: '#E6F1FB',
        dark: '#0B3D6B',
      },
      background: {
        default: '#F4F6F9',
        paper: '#ffffff',
      },
      text: {
        primary: '#1A2332',
        secondary: '#6B7280',
      },
      divider: '#DDE1E7',
    },

    shape: { borderRadius: 8 },

    typography: {
      fontSize: 11.2,
      fontFamily: [
        'Inter',
        'system-ui',
        '-apple-system',
        'sans-serif',
      ].join(','),
    },
  },
  materialItIT,
  dataGridItIT,
)

// ─── SIDEBAR tokens (blu istituzionale AUSL BO) ───────────────────────────────
export const SIDEBAR = {
  /** Sfondo del drawer (gradiente verticale blu istituzionale) */
  bgGradient: 'linear-gradient(180deg, #0B3D6B 0%, #072d52 100%)',

  textMuted:   'rgba(255,255,255,0.50)',
  textDefault: 'rgba(255,255,255,0.78)',
  textStrong:  'rgba(255,255,255,0.95)',
  textBright:  '#ffffff',

  /** Accento azzurro: used for selected state, active icons */
  accent:       '#5DAEF0',
  accentLight:  '#93C9F8',
  accentBright: '#D1EAFE',

  selectedBg:         'rgba(93,174,240,0.10)',
  selectedBgHover:    'rgba(93,174,240,0.16)',
  selectedBgStrong:   'rgba(93,174,240,0.22)',
  selectedBgStronger: 'rgba(93,174,240,0.30)',

  activeBorder: '2px solid #5DAEF0',

  hoverBg: 'rgba(255,255,255,0.07)',

  divider: 'rgba(255,255,255,0.09)',

  chipBg:         'rgba(255,255,255,0.10)',
  chipBorder:     'rgba(255,255,255,0.14)',
  chipBgOpen:     'rgba(93,174,240,0.14)',
  chipBorderOpen: 'rgba(93,174,240,0.28)',
} as const
