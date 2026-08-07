import { Box, Typography } from '@mui/material'

/**
 * PageTitleCropped — titolo di pagina in stile "poster", ancorato al
 * bordo basso VERO della topbar (la Toolbar) e tagliato da quel bordo.
 *
 * PROVA ESTETICA (Agosto 2026) — vedi archie-topbar-font-NN.zip.
 * Se non convince, basta ripristinare la Typography precedente in
 * AppLayout.tsx (variant="h6", letterSpacing 0.22em) e rimuovere
 * l'import di questo componente: nessun'altra parte del progetto
 * dipende da PageTitleCropped.
 *
 * Titoli con separatore " · " (es. "MANUTENZIONE · RAPPORTINI") vengono
 * spezzati: la parte prima del separatore diventa un'etichetta piccola
 * in alto, la parte dopo diventa il titolo grande.
 *
 * Tecnica del taglio (v3): i tentativi precedenti usavano un'altezza
 * percentuale (100%) su un contenitore flessibile — ambigua, e di
 * fatto il testo finiva "a galleggiare" a metà della topbar invece
 * che a ridosso del suo vero bordo inferiore, quindi il taglio non si
 * vedeva (tagliava dentro area dello stesso colore). Qui il
 * contenitore ha un'altezza FISSA in px (uguale all'altezza reale
 * della Toolbar, 64px), position: relative + overflow: hidden, e il
 * titolo è posizionato con position: absolute; bottom: -N — cioè il
 * suo bordo inferiore è N pixel SOTTO il bordo reale della topbar,
 * quindi quei N pixel finali vengono tagliati in modo netto e
 * verificabile contro il vero confine topbar/contenuto.
 */

export type PageTitleCroppedProps = {
  /** Titolo grezzo come restituito da getPageTitle(), es. "DASHBOARD" o "MANUTENZIONE · RAPPORTINI" */
  title: string
  /** Colore del titolo grande (di norma SIDEBAR.accentLight del tema attivo) */
  accentColor: string
  /** Colore dell'etichetta piccola sopra, se il titolo ha un separatore. Default: accentColor con opacità ridotta */
  eyebrowColor?: string
  /** Font-family del titolo grande. Default: Archivo Black (caricato via Google Fonts in index.html) */
  fontFamily?: string
  /** Altezza reale della Toolbar in px. Default 64 (valore usato da entrambi i frontend su desktop) */
  toolbarHeight?: number
}

const SEPARATOR = ' · '

export function PageTitleCropped({
  title,
  accentColor,
  eyebrowColor,
  fontFamily = '"Archivo Black", "Inter", system-ui, sans-serif',
  toolbarHeight = 64,
}: PageTitleCroppedProps) {
  if (!title) return null

  const sepIndex = title.indexOf(SEPARATOR)
  const eyebrow = sepIndex >= 0 ? title.slice(0, sepIndex) : null
  const main = sepIndex >= 0 ? title.slice(sepIndex + SEPARATOR.length) : title

  // Titoli lunghi restano più contenuti per non sforare in larghezza
  // e finire troncati dal noWrap prima di arrivare al bordo destro.
  const isLong = main.length > 10

  // fontSize del titolo grande e quanti px devono sporgere (ed essere
  // tagliati) oltre il bordo basso della toolbar.
  const fontSize = isLong ? 42 : 56
  const crop = isLong ? 6 : 8

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: toolbarHeight,
        minWidth: 0,
        flex: 1,
      }}
    >
      {eyebrow && (
        <Typography
          noWrap
          sx={{
            position: 'absolute',
            top: 2,
            left: 0,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 700,
            letterSpacing: '0.16em',
            fontSize: 10,
            color: eyebrowColor ?? accentColor,
            opacity: 0.7,
            lineHeight: 1,
          }}
        >
          {eyebrow}
        </Typography>
      )}

      <Typography
        noWrap
        component="span"
        aria-label={title}
        sx={{
          position: 'absolute',
          bottom: -crop,
          left: 0,
          right: 0,
          display: 'block',
          fontFamily,
          fontWeight: 400,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          color: accentColor,
          fontSize,
          userSelect: 'none',
        }}
      >
        {main}
      </Typography>
    </Box>
  )
}
