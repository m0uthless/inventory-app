import * as React from 'react'

/**
 * true quando il frontend è stato buildato con VITE_APP_ENV=development
 * (impostato via build-arg Docker in docker-compose.dev.yml). In assenza
 * della variabile (build locale con `npm run dev`, o build prod) il
 * comportamento resta quello di produzione.
 */
export const isDevEnvironment = import.meta.env.VITE_APP_ENV === 'development'

/**
 * Indicatore visivo fisso, sempre presente sopra il contenuto, che segnala
 * di essere sull'ambiente di sviluppo (poseidon) e non su produzione
 * (archie). Non altera il layout dell'app (posizionamento fixed, nessuna
 * spaziatura riservata) e antepone "[DEV] " al titolo della scheda del
 * browser, cosi da distinguere le tab anche senza guardare lo schermo.
 *
 * Renderizza null in produzione: montarlo incondizionatamente in
 * AppLayout di entrambi i frontend (archie e portal).
 */
export default function DevEnvironmentBadge() {
  React.useEffect(() => {
    if (!isDevEnvironment) return
    const original = document.title
    if (!original.startsWith('[DEV] ')) {
      document.title = `[DEV] ${original}`
    }
    return () => {
      document.title = original
    }
  }, [])

  if (!isDevEnvironment) return null

  const stripe = 'repeating-linear-gradient(45deg, #f59e0b 0 10px, #1e1b16 10px 20px)'
  const barThickness = 5

  const commonBarStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 2000,
    pointerEvents: 'none',
    backgroundImage: stripe,
  }

  return (
    <>
      {/* Cornice a righe diagonali su tutti e 4 i lati della viewport —
          non occupa spazio di layout (fixed), non intercetta i click. */}
      <div
        aria-hidden
        style={{ ...commonBarStyle, top: 0, left: 0, right: 0, height: barThickness }}
      />
      <div
        aria-hidden
        style={{ ...commonBarStyle, bottom: 0, left: 0, right: 0, height: barThickness }}
      />
      <div
        aria-hidden
        style={{ ...commonBarStyle, top: 0, bottom: 0, left: 0, width: barThickness }}
      />
      <div
        aria-hidden
        style={{ ...commonBarStyle, top: 0, bottom: 0, right: 0, width: barThickness }}
      />
      {/* Etichetta ambiente, angolo alto-destra, sempre visibile */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 2000,
          pointerEvents: 'none',
          background: '#f59e0b',
          color: '#1e1b16',
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: '0.08em',
          padding: '3px 10px',
          borderRadius: 999,
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          fontFamily: 'Inter, system-ui, sans-serif',
          userSelect: 'none',
        }}
      >
        AMBIENTE DI SVILUPPO
      </div>
    </>
  )
}
