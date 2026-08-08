import { createTheme } from '@mui/material/styles'
import { itIT as materialItIT } from '@mui/material/locale'
import { itIT as dataGridItIT } from '@mui/x-data-grid/locales'
import type {} from '@mui/x-data-grid/themeAugmentation'

// Tema "Navy" — stessa struttura di theme.ts (l'unico tema esistente fino a
// questo punto), con primary spostato su blu navy (#143475, richiesto da
// Fede). Le scelte di palette derivano dalla discussione fatta in chat:
// - secondary (violet) e success (green) restano quelli già corretti nel
//   tema di base (erano già distinti da un blu, quindi vanno bene anche qui)
// - info è stato spostato da blu a ciano: con primary ora blu navy, un info
//   anch'esso blu sarebbe stato poco distinguibile in chip/alert affiancati
export const navyTheme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: {
        main: '#143475',
        light: '#667ba5',
        dark: '#0d224c',
      },
      secondary: {
        main: '#8b5cf6', // Violet-500: invariato, già distinto da un blu
        light: '#ede9fe',
        dark: '#5b21b6',
      },
      // --- COLORI SEMANTICI RAFFINATI (Per Chip e Alert) ---
      success: {
        main: '#16a34a', // Green-600 puro: invariato
        light: '#dcfce7',
        dark: '#166534',
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
        main: '#0891b2', // Cyan-600: spostato da blu, altrimenti si scontrerebbe col primary navy
        light: '#c1e4ec',
        dark: '#055e74',
      },
      background: {
        default: '#f1f5f9', // Slate-100: invariato
        paper: '#ffffff',
      },
      text: {
        primary: '#0f172a',
        secondary: '#64748b', // Slate-500
      },
      divider: '#e2e8f0', // Slate-200: invariato
    },

    shape: { borderRadius: 8 },
    spacing: (factor: number) => `${factor * 6.4}px`,

    typography: {
      fontSize: 11.2,
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
        * { 
          font-feature-settings: "cv02","cv03","cv04","cv11";
          scrollbar-width: thin;
          scrollbar-color: #667ba5 transparent;
        }

        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background-color: #667ba5;
          border-radius: 999px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background-color: #143475;
        }
      `,
      },

      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: '64px !important',
            '@media (min-width:600px)': { minHeight: '64px !important' },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: '#143475',
            color: '#ffffff',
            borderBottom: 'none',
            boxShadow: '0 1px 0 rgba(0,0,0,0.12), 0 2px 8px rgba(20,52,117,0.20)',
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
              '0 0 0 1px rgba(20,52,117,0.04), 0 4px 6px -2px rgba(0,0,0,0.05), 0 12px 24px -8px rgba(0,0,0,0.08)',
            borderRadius: 8,
          },
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
            boxShadow: 'none',
            '&:hover': { boxShadow: '0 4px 12px rgba(20, 52, 117, 0.15)' },
          },
          containedPrimary: {
            background: '#143475',
            '&:hover': { background: '#102b60' },
          },
        },
      },

      // ListItemButton: stile neutro — i colori della sidebar scura
      // sono gestiti inline in AppLayout (via useSidebarTokens) per non
      // rompere altri contesti (notifiche, menu, popover) che usano
      // ListItemButton su sfondo chiaro.
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
            backgroundColor: '#dcfce7',
            color: '#166534',
            border: '1px solid rgba(22, 163, 74, 0.2)',
          },
          colorWarning: {
            backgroundColor: '#fef3c7',
            color: '#92400e',
            border: '1px solid rgba(245, 158, 11, 0.2)',
          },
          colorError: {
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          },
          colorInfo: {
            backgroundColor: '#c1e4ec',
            color: '#055e74',
            border: '1px solid rgba(8, 145, 178, 0.2)',
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
              background: 'linear-gradient(90deg, rgba(20,52,117,0.05), transparent)',
              // boxShadow inset invece di borderLeft + paddingLeft:
              // evita il layout shift (shift di 2px su ogni cella al hover).
              boxShadow: 'inset 3px 0 0 #143475',
            },
          },
          columnHeaders: {
            background: 'linear-gradient(90deg, #f8fafc, #eef2fa)',
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
            borderRadius: 8,
            border: '1px solid',
          },
          standardSuccess: { borderColor: '#dcfce7' },
          standardError: { borderColor: '#fee2e2' },
          standardWarning: { borderColor: '#fef3c7' },
          standardInfo: { borderColor: '#c1e4ec' },
        },
      },
    },
  },
  materialItIT,
  dataGridItIT,
)
