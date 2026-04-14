import * as React from 'react'
import { Box, CircularProgress } from '@mui/material'
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { DrawerShell } from '@shared/ui/DrawerShell'
import {
  emptyDeviceForm, type DeviceTypeItem, type LookupItem,
  type DeviceFormState, type ManufacturerItem, type RispacsItem, type SiteItem,
} from '@shared/device/deviceTypes'
import DeviceFormFields from '@shared/device/DeviceFormFields'

export interface AuslBoNewDeviceDrawerProps {
  initialForm: DeviceFormState | null
  customerId: number
  onClose: () => void
  onSaved: (deviceId: number) => void
}

export default function AuslBoNewDeviceDrawer({ initialForm, customerId, onClose, onSaved }: AuslBoNewDeviceDrawerProps) {
  const toast = useToast()
  const open = initialForm !== null
  const [form, setForm] = React.useState<DeviceFormState>(emptyDeviceForm())
  const [saving, setSaving] = React.useState(false)
  const [sites, setSites] = React.useState<SiteItem[]>([])
  const [types, setTypes] = React.useState<DeviceTypeItem[]>([])
  const [statuses, setStatuses] = React.useState<LookupItem[]>([])
  const [manufacturers, setManufacturers] = React.useState<ManufacturerItem[]>([])
  const [rispacsList, setRispacsList] = React.useState<RispacsItem[]>([])
  const [loadingLookups, setLoadingLookups] = React.useState(false)

  React.useEffect(() => {
    if (!open || !customerId) return
    setForm(initialForm!); setSaving(false); setLoadingLookups(true)
    Promise.all([
      api.get<{ results: SiteItem[] }>('/sites/', { params: { customer: customerId, page_size: 200 } }),
      api.get<{ results: DeviceTypeItem[] }>('/device-types/', { params: { page_size: 200 } }),
      api.get<{ results: LookupItem[] }>('/device-statuses/', { params: { page_size: 200 } }),
      api.get<{ results: ManufacturerItem[] }>('/device-manufacturers/', { params: { page_size: 200 } }),
      api.get<{ results: RispacsItem[] }>('/rispacs/', { params: { page_size: 200 } }),
    ]).then(([s, t, st, m, r]) => {
      setSites(s.data.results); setTypes(t.data.results); setStatuses(st.data.results)
      setManufacturers(m.data.results); setRispacsList(r.data.results)
      const inUso = st.data.results.find(s => s.name.toLowerCase().trim() === 'in uso')
      if (inUso) setForm(f => ({ ...f, status: f.status || inUso.id }))
    }).catch(() => {}).finally(() => setLoadingLookups(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId])


  const handleSave = async () => {
    if (!customerId) return
    setSaving(true)
    try {
      const payload = { customer: customerId, site: form.site || undefined, type: form.type || undefined, status: form.status || undefined, manufacturer: form.manufacturer || null, model: form.model || null, serial_number: form.serial_number || null, inventario: form.inventario || null, reparto: form.reparto || null, room: form.room || null, ip: form.ip || null, note: form.note || null, location: form.location || null, aetitle: form.aetitle || null, vlan: form.vlan, wifi: form.wifi, rispacs: form.rispacs, dose: form.dose }
      const res = await api.post<{ id: number }>('/devices/', payload)
      const savedId = res.data.id
      if (form.rispacs && form.rispacs_ids.length > 0) {
        await Promise.all(form.rispacs_ids.map(rid => api.post('/device-rispacs/', { device: savedId, rispacs: rid })))
      }
      if (form.wifi) {
        const fd = new FormData()
        fd.append('device', String(savedId))
        if (form.wifi_ip) fd.append('ip', form.wifi_ip)
        if (form.wifi_mac) fd.append('mac_address', form.wifi_mac)
        if (form.wifi_scad) fd.append('scad_certificato', form.wifi_scad)
        if (form.wifi_pass) fd.append('pass_certificato', form.wifi_pass)
        if (form.wifi_cert_file) fd.append('certificato', form.wifi_cert_file)
        await api.post('/device-wifi/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      toast.success('Device creato con successo.')
      onSaved(savedId)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally { setSaving(false) }
  }

  const heroSubtitle = [form.ip, form.aetitle].filter(Boolean).join(' — ') || undefined

  return (
    <DrawerShell
      open={open} onClose={onClose} width={420} gradient="blue"
      icon={<RouterOutlinedIcon sx={{ fontSize: 26, color: 'rgba(255,255,255,0.9)' }} />}
      title="Nuovo Device" subtitle={heroSubtitle}
    >
      {loadingLookups ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
      ) : (
        <DeviceFormFields
          form={form}
          setForm={setForm}
          sites={sites}
          types={types}
          statuses={statuses}
          manufacturers={manufacturers}
          rispacsList={rispacsList}
          saving={saving}
          onSave={handleSave}
          onCancel={onClose}
          saveLabel="Salva device"
          showLocation={false}
          showWifiCertificate={false}
        />
      )}
    </DrawerShell>
  )
}
