// Condizioni meteo da codice WMO (Open-Meteo), raggruppate per il disegno del widget.
export type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

export function wmoToCondition(code: number): Condition {
  if (code === 0) return 'clear'
  if (code <= 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  if (code >= 51) return 'rain'
  return 'cloudy'
}

export const CONDITION_LABEL: Record<Condition, string> = {
  clear: 'Sereno', partly: 'Poco nuvoloso', cloudy: 'Nuvoloso', fog: 'Nebbia', rain: 'Pioggia', snow: 'Neve', storm: 'Temporale',
}
