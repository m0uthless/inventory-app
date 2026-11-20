/** Indirizzi separati da «;» come li normalizza il backend (core/app_settings.py):
 *  spazi tolti, minuscole, doppioni e vuoti scartati; i non validi a parte. */
const EMAIL_RE = /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/

export function parseEmails(raw: string): { list: string[]; invalid: string[] } {
  const list: string[] = []
  const invalid: string[] = []
  for (const part of (raw ?? '').split(';')) {
    const e = part.trim()
    if (!e) continue
    if (EMAIL_RE.test(e)) {
      const low = e.toLowerCase()
      if (!list.includes(low)) list.push(low)
    } else invalid.push(e)
  }
  return { list, invalid }
}
