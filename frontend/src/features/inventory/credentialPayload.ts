type CredForm = { os_user: string; os_pwd: string; app_usr: string; app_pwd: string; vnc_pwd: string }

/**
 * Credenziali da mandare col salvataggio dell'inventario. Le password non arrivano più col dettaglio
 * (si leggono da `/secrets/`), quindi un campo password vuoto vuol dire «invariata»: si manda solo
 * se è stato scritto. Senza il permesso Credenziali solo gli utenti (il backend rifiuta le password).
 */
export function credentialPayload(form: CredForm, canViewSecrets: boolean): Record<string, string | null> {
  const t = (v: string) => (v || '').trim() || null
  const out: Record<string, string | null> = { os_user: t(form.os_user), app_usr: t(form.app_usr) }
  if (canViewSecrets) {
    for (const k of ['os_pwd', 'app_pwd', 'vnc_pwd'] as const) {
      if ((form[k] || '').trim()) out[k] = form[k].trim()
    }
  }
  return out
}
