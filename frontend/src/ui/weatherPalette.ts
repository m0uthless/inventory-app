/**
 * weatherPalette.ts — palette decorativa dell'illustrazione meteo in
 * `ui/WeatherHeroCard.tsx` (cielo/terreno/glow per condizione, giorno/notte).
 *
 * ECCEZIONE STRUTTURALE al sistema di tema (refactoring colori 0.9.x,
 * confermato esplicitamente): questi colori rappresentano condizioni
 * meteo reali (cielo sereno, nuvoloso, pioggia, neve, temporale — giorno/
 * notte), non il brand dell'app. Restano fissi a prescindere dal tema per
 * scelta di design, non perché dimenticati: non vanno quindi "corretti" in
 * un futuro audit colori.
 *
 * Isolati qui (invece che come costante locale in WeatherHeroCard.tsx)
 * solo per chiarezza dell'audit — nessun cambio di comportamento.
 */

export type WeatherCondition = 'clear' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'thunder'

export type WeatherSkyPalette = {
  isDay: { sky: string[]; ground: string; horizonGlow: string }
  isNight: { sky: string[]; ground: string; horizonGlow: string }
}

// ─── Theme palette per condizione ────────────────────────────────────────────
// Gradiente cielo a 3 stop (più atmosferico) + colore "glow" dell'orizzonte
// (una fascia di luce calda/fredda molto tenue appena sopra le colline, che
// dà profondità alla scena senza appesantirla).
export const WEATHER_SKY_PALETTE: Record<WeatherCondition, WeatherSkyPalette> = {
  clear: {
    isDay:   { sky: ['#5AA9E6', '#8FCBEE', '#CBEBFA'], ground: '#4a7c59', horizonGlow: '#FFE9B0' },
    isNight: { sky: ['#050b22', '#0f1f45', '#25406e'], ground: '#1c3327', horizonGlow: '#3a5a8c' },
  },
  partly_cloudy: {
    isDay:   { sky: ['#78B9E8', '#A9D6F0', '#DDF0FA'], ground: '#5a8a6a', horizonGlow: '#FFF3C4' },
    isNight: { sky: ['#0c1730', '#182b52', '#2e4877'], ground: '#1f3a2c', horizonGlow: '#3f5f8f' },
  },
  cloudy: {
    isDay:   { sky: ['#94A6AE', '#B7C4CA', '#DCE4E7'], ground: '#607d6a', horizonGlow: '#E8EEF0' },
    isNight: { sky: ['#1c262b', '#2a363c', '#3c4a51'], ground: '#20302a', horizonGlow: '#4a5a60' },
  },
  rain: {
    isDay:   { sky: ['#526B7A', '#6E8A99', '#93AAB6'], ground: '#3d5c4a', horizonGlow: '#B8C8CE' },
    isNight: { sky: ['#101820', '#1a2732', '#263844'], ground: '#182620', horizonGlow: '#33454e' },
  },
  snow: {
    isDay:   { sky: ['#B9D2E0', '#D3E6F0', '#F0F8FC'], ground: '#c8dce8', horizonGlow: '#FFFFFF' },
    isNight: { sky: ['#141f30', '#22344a', '#3a5068'], ground: '#5c7889', horizonGlow: '#7fa0b8' },
  },
  thunder: {
    isDay:   { sky: ['#333B47', '#4A5460', '#63707C'], ground: '#2e3d30', horizonGlow: '#8892a0' },
    isNight: { sky: ['#07090f', '#12151e', '#1e2330'], ground: '#141d18', horizonGlow: '#2a3040' },
  },
} as const
