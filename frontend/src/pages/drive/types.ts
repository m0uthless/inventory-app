// ─── Types ────────────────────────────────────────────────────────────────────

export type DriveFolder = {
  id: number
  name: string
  parent: number | null
  full_path: string
  children_count: number
  files_count: number
  customers: number[]
  allowed_groups?: number[]
  access?: DriveAccessRule[]
  notes?: string | null
  created_by_name: string | null
  updated_by_name?: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** Restrizione per gruppo su un livello della catena (il file o una cartella che lo contiene). */
export type DriveAccessRule = { level: 'file' | 'folder'; id: number; name: string; groups: string[] }

export type DriveFile = {
  id: number
  name: string
  folder: number | null
  folder_name: string | null
  file: string
  mime_type: string
  size: number
  size_human: string
  extension: string
  is_previewable: boolean
  is_image: boolean
  is_pdf: boolean
  customers: number[]
  allowed_groups?: number[]
  access?: DriveAccessRule[]
  notes?: string | null
  created_by_name: string | null
  updated_by_name?: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type BreadcrumbItem = { id: number; name: string }
export type CustomerMini = { id: number; display_name: string }

export type DrawerItem = { kind: 'folder'; data: DriveFolder } | { kind: 'file'; data: DriveFile }
