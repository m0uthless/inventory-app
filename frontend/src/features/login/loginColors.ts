/**
 * Colori dello sfondo animato della login (ShaderGradient), condivisi con la fascia "Aurora"
 * della Dashboard. File leggero apposta: importarli non carica three.js.
 */
export const LOGIN_SHADER = {
  light: { color1: '#6fae9b', color2: '#c3e0d6', color3: '#93acc4', brightness: 1.15 },
  dark: { color1: '#1f5a4c', color2: '#173f37', color3: '#2b4258', brightness: 0.85 },
} as const

/** Gradiente fermo con gli stessi colori: si vede subito e resta se il browser non ha WebGL. */
export const LOGIN_GRADIENT = {
  light: 'linear-gradient(135deg, #6fae9b, #c3e0d6 55%, #93acc4)',
  dark: 'linear-gradient(135deg, #1f5a4c, #173f37 55%, #2b4258)',
} as const

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
