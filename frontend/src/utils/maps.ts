export function buildMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildMapsEmbedUrl(query: string): string {
  // Embed senza API key (di solito funziona bene per indirizzi testuali)
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}
