// Tipi condivisi tra Maintenance.tsx, MaintenancePlans.tsx e Rapportini.tsx

export type PlanRow = {
  id: number
  customer: number
  customer_code?: string | null
  customer_name?: string | null
  inventory_types: number[]
  inventory_type_labels?: string[]
  covered_count?: number | null
  completed_count?: number | null
  title: string
  schedule_type: string
  interval_value?: number | null
  interval_unit?: string | null
  fixed_month?: number | null
  fixed_day?: number | null
  next_due_date: string
  last_done_date?: string | null
  alert_days_before: number
  is_active: boolean
  notes?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  custom_fields?: Record<string, any> | null
  deleted_at?: string | null
}

export type EventRow = {
  id: number
  plan: number
  plan_title?: string | null
  inventory: number
  inventory_name?: string | null
  inventory_hostname?: string | null
  inventory_knumber?: string | null
  customer_code?: string | null
  customer_name?: string | null
  site_name?: string | null
  performed_at: string
  result: string
  tech?: number | null
  tech_name?: string | null
  created_by?: number | null
  created_by_username?: string | null
  notes?: string | null
  pdf_url?: string | null
  deleted_at?: string | null
  created_at?: string | null
}

export type RapportinoContext = {
  /** Righe da compilare — sempre almeno una.
   *  In modalità singola c'è un solo elemento;
   *  in multi-selezione ce ne sono N. */
  rows: TodoRow[]
  /** Comodità: dati del primo (o unico) elemento */
  plan_id: number
  plan_title: string
  inventory_id: number
  inventory_name: string
  customer_id: number
  customer_name: string
  /** Legacy — mantenuto per compatibilità col bulk-toggle dentro sibling */
  siblingOverdue: TodoRow[]
}

export type TodoRow = {
  plan_id: number
  plan_title: string
  plan_alert_days_before: number
  inventory_id: number
  inventory_name: string
  customer_id: number
  customer_code: string
  customer_name: string
  site_id?: number | null
  site_name?: string | null
  type_label?: string | null
  knumber?: string | null
  hostname?: string | null
  next_due_date: string
  /** Data sovrascritta manualmente per questo inventory (null = eredita dal piano) */
  due_date_override?: string | null
  /** Data originale del piano (sempre presente quando due_date_override è valorizzato) */
  plan_next_due_date?: string | null
  /** ID del record MaintenancePlanInventory (pivot), null se non ancora creato */
  plan_inventory_id?: number | null
  schedule_type: string
  interval_value?: number | null
  interval_unit?: string | null
  fixed_month?: number | null
  fixed_day?: number | null
}
