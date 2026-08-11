/**
 * Copia testo negli appunti con fallback per contesti senza Clipboard API
 * (es. http non sicuro, browser datati). Usata dai drawer di dettaglio
 * (Customer, Site, Contact) per i campi con pulsante "copia".
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
