/**
 * AuslBoDevicePageDrawer — drawer completo per la pagina Device del portale AUSL BO.
 *
 * Gestisce sia la modalità read (tab Dettagli/RIS-PACS/WiFi nell'hero)
 * che la modalità edit (form inline con DeviceFormFields).
 *
 * Estratto dal drawer inline di Device.tsx per separare
 * orchestrazione pagina da struttura drawer.
 */
import * as React from 'react'
import DeviceDrawerFrame, {
  getDeviceDrawerTabs,
} from '@shared/device/DeviceDrawerFrame'
import DeviceReadContent from '@shared/device/DeviceReadContent'
import DeviceFormFields from '@shared/device/DeviceFormFields'
import { DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import type {
  DeviceFormState,
  DeviceTypeItem,
  LookupItem,
  ManufacturerItem,
  RispacsItem,
  SiteItem,
  RispacsLink,
  WifiDetail,
} from '@shared/device/deviceTypes'

// ─── Tipo DeviceDetail locale ─────────────────────────────────────────────────

export type AuslBoPageDeviceDetail = {
  id: number
  model: string | null
  aetitle: string | null
  serial_number: string | null
  inventario: string | null
  reparto: string | null
  room: string | null
  ip: string | null
  location: string | null
  note: string | null
  site_name: string | null
  site_display_name: string | null
  type_name: string | null
  manufacturer_name: string | null
  manufacturer_logo_url: string | null
  status_name: string | null
  vlan: boolean
  wifi: boolean
  rispacs: boolean
  dose: boolean
  custom_fields: Record<string, unknown> | null
  rispacs_links: RispacsLink[]
  wifi_detail: WifiDetail | null
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AuslBoDevicePageDrawerProps {
  open: boolean
  onClose: () => void
  detail: AuslBoPageDeviceDetail | null
  selectedId: number | null
  detailLoading: boolean
  editMode: boolean
  canEdit: boolean
  drawerTab: number
  onTabChange: (v: number) => void
  onEdit: () => void
  // form edit
  form: DeviceFormState
  setForm: React.Dispatch<React.SetStateAction<DeviceFormState>>
  sites: SiteItem[]
  types: DeviceTypeItem[]
  statuses: LookupItem[]
  manufacturers: ManufacturerItem[]
  rispacsList: RispacsItem[]
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AuslBoDevicePageDrawer({
  open,
  onClose,
  detail,
  selectedId,
  detailLoading,
  editMode,
  canEdit,
  drawerTab,
  onTabChange,
  onEdit,
  form,
  setForm,
  sites,
  types,
  statuses,
  manufacturers,
  rispacsList,
  saving,
  onSave,
  onCancel,
}: AuslBoDevicePageDrawerProps) {
  const hasRispacs = (detail?.rispacs_links?.length ?? 0) > 0
  const hasWifi = !!detail?.wifi_detail

  // Tab nell'hero solo in read mode
  const tabs = editMode ? undefined : getDeviceDrawerTabs(hasRispacs, hasWifi)

  return (
    <DeviceDrawerFrame
      open={open}
      onClose={onClose}
      detail={detail ?? undefined}
      title={
        editMode
          ? (selectedId ? `Modifica device #${selectedId}` : 'Nuovo device')
          : (detail?.model || detail?.type_name || (selectedId ? `Device #${selectedId}` : '—'))
      }
      subtitle={editMode ? undefined : (detail?.site_display_name || detail?.site_name || undefined)}
      loading={detailLoading}
      tabs={tabs}
      tabValue={drawerTab}
      onTabChange={onTabChange}
      showEditAction={!editMode && canEdit && !!detail}
      onEdit={onEdit}
      width={420}
    >
      {/* ── Edit mode ─────────────────────────────────────────────────── */}
      {editMode ? (
        <DeviceFormFields
          form={form}
          setForm={setForm}
          sites={sites}
          types={types}
          statuses={statuses}
          manufacturers={manufacturers}
          rispacsList={rispacsList}
          saving={saving}
          onSave={onSave}
          onCancel={onCancel}
          requireModel
          requireInventario
          requireReparto
        />
      ) : null}

      {/* ── Read mode ─────────────────────────────────────────────────── */}
      {!editMode && detailLoading ? <DrawerLoadingState /> : null}
      {!editMode && !detailLoading && detail ? (
        <DeviceReadContent detail={detail} tabValue={drawerTab} />
      ) : null}
      {!editMode && !detailLoading && !detail ? <DrawerEmptyState /> : null}

    </DeviceDrawerFrame>
  )
}
