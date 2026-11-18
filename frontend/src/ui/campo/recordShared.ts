import * as React from 'react'

/* Costanti e hook delle finestre dei record anagrafici (vedi RecordParts). */

export const recordMono = { fontFamily: '"Geist Mono", ui-monospace, monospace' } as const

/** Bottone pieno bianco sulla testata (Nuova issue, Ripristina). */
export const bandSolidSx = { bgcolor: '#fff', color: 'archie.band', borderColor: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#e9f3f0', borderColor: '#e9f3f0' } } as const

/**
 * La prima apertura aspetta i dati collegati (al massimo `maxMs`): la finestra compare già piena,
 * senza sezioni che si riempiono una alla volta. Una volta aperta resta aperta (‹ › cambia solo il contenuto).
 */
export function useShownWhenReady(ready: boolean, maxMs = 700) {
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => { if (ready) setShown(true) }, [ready])
  React.useEffect(() => { const t = window.setTimeout(() => setShown(true), maxMs); return () => window.clearTimeout(t) }, [maxMs])
  return shown
}

/**
 * Bozza dei campi modificabili: si riparte dal record quando cambia; `changed` sono le chiavi diverse
 * dall'originale (spazi ai bordi ignorati), da inviare da sole nel PATCH.
 */
export function useRecordDraft<D extends Record<string, string>>(source: unknown, toDraft: () => D) {
  const orig = toDraft()
  const [draft, setDraft] = React.useState<D>(orig)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { setDraft(toDraft()) }, [source])
  const changed = (Object.keys(orig) as (keyof D)[]).filter((k) => draft[k].trim() !== orig[k].trim())
  const set = (k: keyof D) => (v: string) => setDraft((x) => ({ ...x, [k]: v }))
  const isDirty = (k: keyof D) => draft[k].trim() !== orig[k].trim()
  return { draft, orig, changed, set, isDirty, reset: () => setDraft(toDraft()) }
}
