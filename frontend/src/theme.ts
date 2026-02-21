import { createTheme, alpha } from "@mui/material/styles";
import { itIT as materialItIT } from "@mui/material/locale";
import { itIT as dataGridItIT } from "@mui/x-data-grid/locales";
// Enables theme typings for DataGrid component overrides (MuiDataGrid)
import type {} from "@mui/x-data-grid/themeAugmentation";

export const theme = createTheme(
  {
  palette: {
    mode: "light",
    primary:    { main: "#0f766e" },   // teal
    secondary:  { main: "#0ea5a4" },   // ottanio
    background: {
      default: "#eef2f7",              // leggermente più scuro → le card bianche staccano meglio
      paper:   "#ffffff",
    },
    text: {
      primary:   "#0f172a",            // quasi nero — più leggibile di default MUI
      secondary: "#475569",            // slate-600 — secondario deciso
    },
    divider: "rgba(0,0,0,0.07)",
  },

  shape: { borderRadius: 8 },          // da 14 → 8: più professionale, meno "consumer"

  typography: {
    fontFamily: [
      "Inter",
      "system-ui",
      "-apple-system",
      "Segoe UI",
      "Roboto",
      "Helvetica",
      "Arial",
      "sans-serif",
    ].join(","),

    // Titoli pagina
    h4: { fontWeight: 800, lineHeight: 1.25 },
    h5: { fontWeight: 800, lineHeight: 1.3  },
    h6: { fontWeight: 700, lineHeight: 1.4  },

    // Testi usati nelle pagine
    subtitle1: { fontWeight: 600, lineHeight: 1.5  },
    subtitle2: { fontWeight: 600, lineHeight: 1.57 },
    body1:     { fontWeight: 400, lineHeight: 1.6  },
    body2:     { fontWeight: 400, lineHeight: 1.5  },
    caption:   { fontWeight: 400, lineHeight: 1.6, fontSize: "0.75rem" },
    button:    { fontWeight: 600, textTransform: "none" as const, letterSpacing: 0.2 },
  },

  components: {

    MuiCssBaseline: {
      styleOverrides: `
        /* Inter viene caricato via Google Fonts in index.html */
        * { font-feature-settings: "cv02","cv03","cv04","cv11"; }
      `,
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#ffffff",
          color: "#0f172a",
          borderBottom: "3px solid #0f766e",
          boxShadow: "none",
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        // elevation standard: border sottile + ombra delicata
        elevation1: {
          boxShadow: "0 1px 4px rgba(15,23,42,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 1px 6px rgba(15,23,42,0.06)",  // più sottile → meno pesante
          borderRadius: 10,                              // card leggermente più tonde del base
        },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          // Riduce il padding default MUI (16px) a qualcosa di più compatto
          padding: "14px 16px",
          "&:last-child": { paddingBottom: 14 },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #0f766e 0%, #0ea5a4 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #0d6560 0%, #0c9192 100%)",
          },
        },
        sizeSmall: { fontSize: "0.78rem", padding: "3px 12px" },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 7 },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: "0.75rem",
        },
        sizeSmall: { height: 22 },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          "& fieldset": { borderColor: "rgba(0,0,0,0.15)" },
          "&:hover fieldset": { borderColor: "rgba(15,118,110,0.4) !important" },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: "0.72rem",
          fontWeight: 500,
          backgroundColor: "#0f172a",
          borderRadius: 5,
          padding: "4px 8px",
        },
        arrow: { color: "#0f172a" },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "rgba(0,0,0,0.07)" },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          "&:hover": { backgroundColor: alpha("#0f766e", 0.07) },
          "&.Mui-selected": { backgroundColor: "#0f766e", color: "#fff" },
          "&.Mui-selected:hover": { backgroundColor: alpha("#0f766e", 0.92) },
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          fontSize: "0.875rem",
          minHeight: 40,
          "&.Mui-selected": { fontWeight: 700 },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, fontSize: "0.75rem", color: "#475569" },
      },
    },

    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 8,
          overflow: "hidden",
          fontSize: "0.8125rem",          // 13px — più compatto
        },
        columnHeaders: {
          backgroundColor: alpha("#0f766e", 0.04),
          borderBottom: "1px solid rgba(0,0,0,0.07)",
        },
        columnHeaderTitle: {
          fontWeight: 700,
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#475569",
        },
        row: {
          "&:hover": { backgroundColor: alpha("#0f766e", 0.04) },
          "&.Mui-selected": { backgroundColor: `${alpha("#0f766e", 0.08)} !important` },
          "&.Mui-selected:hover": { backgroundColor: `${alpha("#0f766e", 0.12)} !important` },
        },
        cell: {
          borderColor: "rgba(0,0,0,0.05)",
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 12 },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: { fontWeight: 700, fontSize: "1rem" },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8 },
        message: { fontWeight: 500 },
      },
    },

  },
  },
  materialItIT,
  dataGridItIT
);
