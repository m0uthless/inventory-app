/**
 * Tipi condivisi per il dominio CRM (Contatti e Sedi).
 *
 * Campi opzionali (?) riflettono le differenze tra i due frontend:
 *  - frontend interno espone customer_id, relazioni FK, timestamp
 *  - frontend-auslbo espone sottoinsieme read-only senza FK
 *
 * Usato in:
 *  - frontend-auslbo (AuslBoContactDrawer, AuslBoSiteDrawer)
 *  - frontend (ContactDrawer, SiteDrawer)
 */

// ─── Contact ──────────────────────────────────────────────────────────────────

export type ContactReadDetail = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  department?: string | null
  site_name?: string | null
  site_display_name?: string | null
  is_primary: boolean
  deleted_at?: string | null
  notes?: string | null
}

// ─── Site ─────────────────────────────────────────────────────────────────────

export type SiteReadDetail = {
  id: number
  name: string
  display_name?: string | null
  customer_name?: string | null
  customer_display_name?: string | null
  status_label?: string | null
  city?: string | null
  postal_code?: string | null
  address_line1?: string | null
  province?: string | null
  country?: string | null
  notes?: string | null
  custom_fields?: Record<string, unknown> | null
  deleted_at?: string | null
}
