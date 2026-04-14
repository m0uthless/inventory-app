/**
 * Tipi condivisi per l'entità Inventory.
 *
 * InventoryReadDetail — sottoinsieme read-only comune tra frontend e frontend-auslbo.
 * Non include credenziali (os_pwd, app_pwd, vnc_pwd) che sono solo nel frontend interno.
 *
 * I campi opzionali (?) riflettono il fatto che i due frontend espongono
 * sottoinsiemi leggermente diversi dell'API inventory.
 *
 * Usato in:
 *  - frontend-auslbo (AuslBoInventoryDrawer)
 *  - frontend (InventoryDrawer — tab Dettagli)
 */

export type InventoryReadDetail = {
  id: number
  name: string
  hostname?: string | null
  knumber?: string | null
  serial_number?: string | null
  local_ip?: string | null
  srsa_ip?: string | null
  customer_name?: string | null
  site_name?: string | null
  site_display_name?: string | null
  status_label?: string | null
  status_key?: string | null
  type_label?: string | null
  type_key?: string | null
  deleted_at?: string | null
  manufacturer?: string | null
  model?: string | null
  warranty_end_date?: string | null
  notes?: string | null
  tags?: string[] | null
  custom_fields?: Record<string, unknown> | null
}
