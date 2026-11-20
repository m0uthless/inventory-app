/** Indirizzo → coordinate con Nominatim (OpenStreetMap), senza chiave. Cache in memoria per
 *  evitare richieste doppie e i limiti di frequenza. */
const geocodeCache = new Map<string, { lat: number; lon: number } | null>()

export function normalizeAddress(addr: string): string {
  return addr
    .replace(/\bV\.le\b/gi, 'Viale')
    .replace(/\bVle\b/gi, 'Viale')
    .replace(/\bP\.zza\b/gi, 'Piazza')
    .replace(/\bPza\b/gi, 'Piazza')
    .replace(/\bP\.le\b/gi, 'Piazzale')
    .replace(/\bLgo\b/gi, 'Largo')
    .replace(/\bFraz\.\s*/gi, 'Frazione ')
    .replace(/\bS\.S\.\s*/gi, 'Strada Statale ')
    .replace(/\bS\.P\.\s*/gi, 'Strada Provinciale ')
    .trim()
}

export async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const key = normalizeAddress(address)
  if (geocodeCache.has(key)) return geocodeCache.get(key)!
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(key)}&limit=1&countrycodes=it`
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'it' } })
    const data: { lat: string; lon: string }[] = await res.json()
    const result = data.length ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null
    geocodeCache.set(key, result)
    return result
  } catch {
    return null
  }
}
