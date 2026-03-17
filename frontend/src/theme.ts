import { createTheme } from '@mui/material/styles'
import { itIT as materialItIT } from '@mui/material/locale'
import { itIT as dataGridItIT } from '@mui/x-data-grid/locales'
import type {} from '@mui/x-data-grid/themeAugmentation'

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { 
        main: '#0f766e',
        light: '#45a59d',
        dark: '#0a524d',
      },
      secondary: { 
        main: '#0ea5e9', // Virata verso un azzurro/ottanio più brillante per contrasto
      },
      // --- COLORI SEMANTICI RAFFINATI (Per Chip e Alert) ---
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
        main: '#3b82f6',
        light: '#dbeafe',
        dark: '#1e40af',
      },
      background: {
        default: '#f1f5f9', // Slate-100: più pulito e moderno
        paper: '#ffffff',
      },
      text: {
        primary: '#0f172a',
        secondary: '#64748b', // Slate-500
      },
      divider: '#e2e8f0', // Slate-200 per bordi quasi invisibili
    },

    shape: { borderRadius: 10 }, 

    typography: {
      fontFamily: [
        'Inter',
        'system-ui',
        '-apple-system',
        'sans-serif',
      ].join(','),

      h4: { fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' },
      h5: { fontWeight: 800, lineHeight: 1.2 },
      h6: { fontWeight: 700, lineHeight: 1.2 },
      subtitle1: { fontWeight: 600, color: '#475569' },
      button: { fontWeight: 600, textTransform: 'none' as const },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: `
        * { font-feature-settings: "cv02","cv03","cv04","cv11"; }
        body { scrollbar-gutter: stable; }
      `,
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            // Flat primary: evita la competizione visiva con il gradiente verticale
            // della sidebar. Un solo gradiente per schermata (sidebar) è più raffinato.
            background: '#0f766e',
            color: '#ffffff',
            borderBottom: 'none',
            boxShadow: '0 1px 0 rgba(0,0,0,0.12), 0 2px 8px rgba(15,118,110,0.20)',
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          // Non usare backgroundImage: 'none' globale — azzererebbe
          // anche il gradiente del Drawer. Lo applichiamo solo su elevation.
          elevation1: {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            border: '1px solid #e2e8f0',
            boxShadow:
              '0 0 0 1px rgba(15,118,110,0.04), 0 4px 6px -2px rgba(0,0,0,0.05), 0 12px 24px -8px rgba(0,0,0,0.08)',
            borderRadius: 12,
          },
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
            boxShadow: 'none',
            '&:hover': { boxShadow: '0 4px 12px rgba(15, 118, 110, 0.15)' },
          },
          containedPrimary: {
            background: '#0f766e',
            '&:hover': { background: '#0d6560' },
          },
        },
      },

      // ListItemButton: stile neutro — i colori della sidebar scura
      // sono gestiti inline in AppLayout per non rompere altri contesti
      // (notifiche, menu, popover) che usano ListItemButton su sfondo chiaro.
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: 'all 0.15s ease-in-out',
          },
        },
      },

      // --- CHIP PASTELLO ---
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 8,
          },
          colorSuccess: { 
            backgroundColor: '#d1fae5', 
            color: '#065f46',
            border: '1px solid rgba(16, 185, 129, 0.2)' 
          },
          colorWarning: { 
            backgroundColor: '#fef3c7', 
            color: '#92400e',
            border: '1px solid rgba(245, 158, 11, 0.2)' 
          },
          colorError: { 
            backgroundColor: '#fee2e2', 
            color: '#991b1b',
            border: '1px solid rgba(239, 68, 68, 0.2)' 
          },
          colorInfo: { 
            backgroundColor: '#dbeafe', 
            color: '#1e40af',
            border: '1px solid rgba(59, 130, 246, 0.2)' 
          },
        },
      },

      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: 'none',
            '& .MuiDataGrid-columnHeaderTitle': {
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
            },
            '& .MuiDataGrid-row': {
              transition: 'background 0.12s, box-shadow 0.12s',
            },
            '& .MuiDataGrid-row:hover': {
              background: 'linear-gradient(90deg, rgba(15,118,110,0.05), transparent)',
              // boxShadow inset invece di borderLeft + paddingLeft:
              // evita il layout shift (shift di 2px su ogni cella al hover).
              boxShadow: 'inset 3px 0 0 #0f766e',
            },
          },
          columnHeaders: {
            background: 'linear-gradient(90deg, #f8fafc, #f0fdf9)',
            borderBottom: '2px solid #e2e8f0',
          },
          cell: {
            borderBottom: '1px solid #f1f5f9',
          },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            border: '1px solid',
          },
          standardSuccess: { borderColor: '#d1fae5' },
          standardError: { borderColor: '#fee2e2' },
          standardWarning: { borderColor: '#fef3c7' },
          standardInfo: { borderColor: '#dbeafe' },
        },
      },
    },
  },
  materialItIT,
  dataGridItIT,
)
